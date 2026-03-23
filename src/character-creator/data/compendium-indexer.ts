/**
 * Character Creator — Compendium Indexer
 *
 * Loads, caches, and normalizes compendium data from multiple configurable packs.
 * Strategy: index-first loading (fast), lazy document fetch (on demand).
 */

import { Log } from "../../logger";
import { getGame, fromUuid } from "../../types";
import type { FoundryCompendiumCollection, FoundryDocument, FoundryIndexEntry } from "../../types";
import type {
  CreatorContentType,
  CreatorIndexEntry,
  PackSourceConfig,
  PersistentCompendiumIndexSnapshot,
} from "../character-creator-types";
import { parseBackgroundGrantedOriginFeatUuid } from "./advancement-parser";
import { formatInjectedDescriptionHtml } from "../utils/description-formatting";

interface TextEditorLike {
  enrichHTML?(html: string, options: { async: boolean }): Promise<string>;
}

interface DescriptionSystemData {
  description?: {
    value?: string;
  };
}

interface WeaponDocumentSystemData extends DescriptionSystemData {
  identifier?: string;
  weaponType?: string;
  type?: { value?: string };
  ammunition?: { type?: string };
  mastery?: string;
  rarity?: string;
  magicalBonus?: number;
  properties?: Iterable<string> | ArrayLike<string> | Record<string, boolean>;
  price?: {
    value?: number | string | null;
    denomination?: string | null;
  };
}

interface WeaponDocumentLike {
  system?: WeaponDocumentSystemData;
}

interface FeatDocumentLike {
  system?: {
    prerequisites?: {
      level?: number | string | null;
    };
    type?:
      | {
        value?: string | null;
        subtype?: string | null;
      }
      | string
      | null;
  };
}

/** Fields requested from compendium indexes for normalization. */
const INDEX_FIELDS = [
  "name", "img", "type",
  "system.identifier",
  "system.classIdentifier",
  "system.level",
  "system.prerequisites.level",
  "system.type.value",
  "system.type.subtype",
  "system.school",
  "system.armor.type",
  "system.weaponType",
  "system.ammunition.type",
  "system.mastery",
  "system.rarity",
  "system.magicalBonus",
  "system.price.value",
  "system.price.denomination",
  "system.properties",
];

export const PERSISTENT_INDEX_CACHE_FORMAT_VERSION = 5;

/** Maps pack source config keys to content types. */
const SOURCE_KEY_TO_TYPE: Record<keyof PackSourceConfig, CreatorContentType> = {
  classes: "class",
  subclasses: "subclass",
  races: "race",
  backgrounds: "background",
  feats: "feat",
  spells: "spell",
  items: "item",
};

function getFeatCategory(doc: FeatDocumentLike | null): string | null {
  const rawType = doc?.system?.type;
  if (typeof rawType === "string") return rawType.toLowerCase();
  if (rawType && typeof rawType === "object") {
    if (typeof rawType.subtype === "string" && rawType.subtype.trim()) return rawType.subtype.toLowerCase();
    if (typeof rawType.value === "string" && rawType.value.trim()) return rawType.value.toLowerCase();
  }
  return null;
}

function getPrerequisiteLevel(doc: FeatDocumentLike | null): number | null | undefined {
  const rawLevel = doc?.system?.prerequisites?.level;
  if (typeof rawLevel === "number") return rawLevel;
  if (typeof rawLevel === "string" && rawLevel.trim()) {
    const parsed = Number(rawLevel);
    if (Number.isFinite(parsed)) return parsed;
  }
  return rawLevel === null ? null : undefined;
}

function normalizeProperties(
  value: Iterable<string> | ArrayLike<string> | Record<string, boolean> | undefined,
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "object" && value !== null && typeof (value as Record<PropertyKey, unknown>)[Symbol.iterator] === "function") {
    return Array.from(value as Iterable<unknown>).filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "object") {
    return Object.entries(value).filter(([, enabled]) => enabled === true).map(([key]) => key);
  }
  return [];
}

function getPriceInCopper(
  rawValue: number | string | null | undefined,
  denomination: string | null | undefined,
): number | undefined {
  if (rawValue === null || rawValue === undefined || rawValue === "") return undefined;
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(value)) return undefined;
  const normalizedDenomination = (denomination ?? "gp").trim().toLowerCase();
  const multiplier = normalizedDenomination === "pp"
    ? 1000
    : normalizedDenomination === "gp"
      ? 100
      : normalizedDenomination === "ep"
        ? 50
        : normalizedDenomination === "sp"
          ? 10
          : 1;
  return Math.max(0, Math.round(value * multiplier));
}

function inferMagicalFlag(
  rarity: string | undefined,
  magicalBonus: number | undefined,
  properties: string[],
): boolean | undefined {
  if (typeof magicalBonus === "number" && magicalBonus > 0) return true;
  if (properties.includes("mgc")) return true;
  if (typeof rarity === "string" && rarity.trim()) return true;
  if (magicalBonus === undefined && properties.length === 0 && rarity === undefined) return undefined;
  return false;
}

/**
 * Maps our content types to the dnd5e item types that qualify.
 * Used to filter out unrelated items from mixed-content packs.
 */
const ACCEPTED_ITEM_TYPES: Record<CreatorContentType, Set<string>> = {
  class: new Set(["class"]),
  subclass: new Set(["subclass"]),
  race: new Set(["race"]),
  background: new Set(["background"]),
  feat: new Set(["feat"]),
  spell: new Set(["spell"]),
  item: new Set(["weapon", "equipment", "consumable", "tool", "loot"]),
};

export class CompendiumIndexer {
  /** Cached index entries keyed by pack collection ID. */
  private indexCache = new Map<string, CreatorIndexEntry[]>();

  /** Cached full documents keyed by UUID. */
  private docCache = new Map<string, FoundryDocument>();

  /** In-flight index loads for deduplication. */
  private loading = new Map<string, Promise<CreatorIndexEntry[]>>();

  /**
   * Load all configured packs and return indexed entries grouped by pack.
   * Results are cached for the session — call invalidate() to clear.
   */
  async loadPacks(sources: PackSourceConfig): Promise<Map<string, CreatorIndexEntry[]>> {
    const promises: Promise<void>[] = [];

    for (const [sourceKey, packIds] of Object.entries(sources)) {
      const type = SOURCE_KEY_TO_TYPE[sourceKey as keyof PackSourceConfig];
      if (!type) continue;
      for (const packId of packIds) {
        if (this.indexCache.has(packId)) continue;
        promises.push(
          this.loadPack(packId, type).then((entries) => {
            this.indexCache.set(packId, entries);
          }),
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return this.indexCache;
  }

  /**
   * Load a single pack's index, normalize entries, and cache.
   * Deduplicates concurrent calls to the same pack.
   */
  async loadPack(packId: string, type: CreatorContentType): Promise<CreatorIndexEntry[]> {
    // Return cached result
    const cached = this.indexCache.get(packId);
    if (cached) return cached;

    // Deduplicate in-flight requests
    const inflight = this.loading.get(packId);
    if (inflight) return inflight;

    const promise = this._doLoadPack(packId, type);
    this.loading.set(packId, promise);

    try {
      const result = await promise;
      this.indexCache.set(packId, result);
      return result;
    } finally {
      this.loading.delete(packId);
    }
  }

  /**
   * Fetch a full document by UUID, with caching.
   */
  async fetchDocument(uuid: string): Promise<FoundryDocument | null> {
    const cached = this.docCache.get(uuid);
    if (cached) return cached;

    const doc = await fromUuid(uuid);
    if (doc) {
      this.docCache.set(uuid, doc);
    }
    return doc;
  }

  hasPackCache(packId: string): boolean {
    return this.indexCache.has(packId);
  }

  hasDocumentCache(uuid: string): boolean {
    return this.docCache.has(uuid);
  }

  getMissingPackIds(
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): string[] {
    return this.getSelectedPackIds(sources, options).filter((packId) => !this.indexCache.has(packId));
  }

  async ensureIndexedSources(
    sources: PackSourceConfig,
    options?: {
      contentKeys?: Array<keyof PackSourceConfig>;
      enrichWeaponMetadata?: boolean;
      enrichOriginFeatMetadata?: boolean;
      enrichEquipmentShopMetadata?: boolean;
    },
  ): Promise<void> {
    const packIds = this.getSelectedPackIds(sources, options);
    for (const packId of packIds) {
      if (this.indexCache.has(packId)) continue;
      const type = this.getConfiguredTypeForPackId(packId, sources, options?.contentKeys);
      if (!type) continue;
      await this.loadPack(packId, type);
    }

    if (options?.enrichWeaponMetadata) {
      await this.enrichIndexedWeaponMetadata(sources, options);
    }
    if (options?.enrichOriginFeatMetadata) {
      await this.enrichIndexedOriginFeatMetadata(sources, options);
    }
    if (options?.enrichEquipmentShopMetadata) {
      await this.enrichIndexedEquipmentShopMetadata(sources, options);
    }
  }

  createPackSignature(
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): string {
    const keys = options?.contentKeys?.length
      ? [...options.contentKeys]
      : (Object.keys(SOURCE_KEY_TO_TYPE) as Array<keyof PackSourceConfig>);
    const normalized = Object.fromEntries(keys
      .sort()
      .map((key) => [key, [...new Set(sources[key] ?? [])].sort()]));
    return JSON.stringify(normalized);
  }

  validatePersistentSnapshot(
    snapshot: PersistentCompendiumIndexSnapshot | null | undefined,
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): { valid: boolean; reason: string } {
    if (!snapshot) return { valid: false, reason: "No cached compendium index was found." };
    if (snapshot.formatVersion !== PERSISTENT_INDEX_CACHE_FORMAT_VERSION) {
      return { valid: false, reason: "The cached compendium index uses an older schema and needs to be rebuilt." };
    }

    const game = getGame();
    const moduleVersion = game?.modules?.get("foundry-tabletop-helpers")?.version ?? "0.0.0";
    const foundryVersion = game?.version ?? "0.0.0";
    const systemId = game?.system?.id ?? "unknown";
    const systemVersion = game?.system?.version ?? "0.0.0";
    const expectedSignature = this.createPackSignature(sources, options);

    if (snapshot.moduleVersion !== moduleVersion) {
      return { valid: false, reason: "The module version changed since the cache was built." };
    }
    if (snapshot.foundryVersion !== foundryVersion) {
      return { valid: false, reason: "The Foundry core version changed since the cache was built." };
    }
    if (snapshot.systemId !== systemId || snapshot.systemVersion !== systemVersion) {
      return { valid: false, reason: "The active game system changed since the cache was built." };
    }
    if (snapshot.packSignature !== expectedSignature) {
      return { valid: false, reason: "The selected compendium sources changed since the cache was built." };
    }

    return { valid: true, reason: "ready" };
  }

  hydratePersistentSnapshot(
    snapshot: PersistentCompendiumIndexSnapshot | null | undefined,
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): boolean {
    const validation = this.validatePersistentSnapshot(snapshot, sources, options);
    if (!validation.valid || !snapshot) return false;

    for (const [packId, entries] of Object.entries(snapshot.packs ?? {})) {
      if (!this.indexCache.has(packId)) {
        this.indexCache.set(packId, entries);
      }
    }
    Log.debug("CompendiumIndexer: hydrated persistent cache", {
      packCount: Object.keys(snapshot.packs ?? {}).length,
      generatedAt: snapshot.generatedAt,
    });
    return true;
  }

  async buildPersistentSnapshot(
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): Promise<PersistentCompendiumIndexSnapshot> {
    await this.ensureIndexedSources(sources, {
      ...options,
      enrichWeaponMetadata: true,
      enrichOriginFeatMetadata: true,
      enrichEquipmentShopMetadata: true,
    });
    const game = getGame();
    const packIds = this.getSelectedPackIds(sources, options);
    const packs = Object.fromEntries(
      packIds.map((packId) => [packId, this.indexCache.get(packId) ?? []]),
    );
    return {
      formatVersion: PERSISTENT_INDEX_CACHE_FORMAT_VERSION,
      moduleVersion: game?.modules?.get("foundry-tabletop-helpers")?.version ?? "0.0.0",
      foundryVersion: game?.version ?? "0.0.0",
      systemId: game?.system?.id ?? "unknown",
      systemVersion: game?.system?.version ?? "0.0.0",
      packSignature: this.createPackSignature(sources, options),
      generatedAt: new Date().toISOString(),
      packs,
    };
  }

  /**
   * Get a cached document's HTML description, enriched via Foundry's TextEditor.
   * Resolves @UUID links, inline rolls, etc. Returns empty string if unavailable.
   */
  async getCachedDescription(uuid: string): Promise<string> {
    const doc = this.docCache.get(uuid);
    if (!doc) return "";
    const system = getDescriptionSystem(doc.system);
    const raw = typeof system?.description?.value === "string" ? system.description.value : "";
    if (!raw) return "";

    // Enrich via Foundry's TextEditor to resolve @UUID, @Check, inline rolls, etc.
    try {
      const TextEditor = getTextEditor();
      if (TextEditor?.enrichHTML) {
        return formatInjectedDescriptionHtml(await TextEditor.enrichHTML(raw, { async: true }));
      }
    } catch { /* fall through to raw */ }
    return formatInjectedDescriptionHtml(raw);
  }

  /**
   * Get all indexed entries of a given content type from the cache.
   * Must call loadPacks() first.
   */
  getIndexedEntries(type: CreatorContentType, sources: PackSourceConfig): CreatorIndexEntry[] {
    const sourceKey = Object.entries(SOURCE_KEY_TO_TYPE)
      .find(([, t]) => t === type)?.[0] as keyof PackSourceConfig | undefined;
    if (!sourceKey) return [];

    const packIds = sources[sourceKey] ?? [];
    const accepted = ACCEPTED_ITEM_TYPES[type];
    const entries: CreatorIndexEntry[] = [];

    for (const packId of packIds) {
      const cached = this.indexCache.get(packId);
      if (!cached) continue;
      for (const entry of cached) {
        if (accepted && entry.itemType && !accepted.has(entry.itemType)) continue;
        entries.push(entry);
      }
    }

    Log.debug("CompendiumIndexer: queried indexed entries", {
      type,
      packIds,
      totalEntries: entries.length,
      byPack: summarizeEntriesByPack(entries),
    });

    return entries;
  }

  /**
   * Get all indexed entries across all types from the cache.
   */
  getAllIndexedEntries(): CreatorIndexEntry[] {
    const entries: CreatorIndexEntry[] = [];
    for (const cached of this.indexCache.values()) {
      entries.push(...cached);
    }
    return entries;
  }

  /** Clear all caches. Call when GM changes pack sources or content toggles. */
  invalidate(): void {
    this.indexCache.clear();
    this.docCache.clear();
    this.loading.clear();
    Log.debug("CompendiumIndexer: cache invalidated");
  }

  /* ── Private ─────────────────────────────────────────────── */

  private async _doLoadPack(
    packId: string,
    type: CreatorContentType,
  ): Promise<CreatorIndexEntry[]> {
    const game = getGame();
    if (!game?.packs) return [];

    const pack = getCompendiumPack(game.packs.get(packId));
    if (!pack) {
      Log.warn(`CompendiumIndexer: pack "${packId}" not found`);
      return [];
    }

    try {
      const rawIndex = await pack.getIndex({ fields: INDEX_FIELDS });
      const entries: CreatorIndexEntry[] = [];
      const packLabel = pack.metadata?.label ?? pack.metadata?.name ?? packId;

      for (const raw of rawIndex) {
        const entry = this.normalizeEntry(raw, packId, packLabel, type);
        if (entry) entries.push(entry);
      }

      Log.debug(`CompendiumIndexer: loaded ${entries.length} entries from "${packId}"`);
      Log.debug("CompendiumIndexer: load summary", {
        packId,
        requestedType: type,
        packLabel,
        rawIndexCount: rawIndex.length,
        byItemType: summarizeRawIndexTypes(rawIndex),
        namedEntriesByItemType: summarizeEntryItemTypes(entries),
      });
      return entries;
    } catch (err) {
      Log.error(`CompendiumIndexer: failed to load pack "${packId}"`, err);
      return [];
    }
  }

  private getSelectedPackIds(
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): string[] {
    const keys = options?.contentKeys?.length
      ? [...options.contentKeys]
      : (Object.keys(SOURCE_KEY_TO_TYPE) as Array<keyof PackSourceConfig>);
    return [...new Set(keys.flatMap((key) => sources[key] ?? []))];
  }

  private getConfiguredTypeForPackId(
    packId: string,
    sources: PackSourceConfig,
    contentKeys?: Array<keyof PackSourceConfig>,
  ): CreatorContentType | undefined {
    const keys = contentKeys?.length
      ? [...contentKeys]
      : (Object.keys(SOURCE_KEY_TO_TYPE) as Array<keyof PackSourceConfig>);
    const matchedKey = keys.find((key) => (sources[key] ?? []).includes(packId));
    return matchedKey ? SOURCE_KEY_TO_TYPE[matchedKey] : undefined;
  }

  private async enrichIndexedWeaponMetadata(
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): Promise<void> {
    const packIds = this.getSelectedPackIds(sources, options);
    const stats = {
      targetedWeapons: 0,
      fetchedDocuments: 0,
      enrichedEntries: 0,
      unresolvedEntries: 0,
      unresolvedSamples: [] as string[],
    };

    for (const packId of packIds) {
      const type = this.getConfiguredTypeForPackId(packId, sources, options?.contentKeys);
      if (type !== "item") continue;
      const cached = this.indexCache.get(packId);
      if (!cached?.length) continue;

      const nextEntries = await Promise.all(cached.map(async (entry) => {
        if (!this.needsWeaponMasteryEnrichment(entry)) return entry;
        stats.targetedWeapons += 1;
        const cachedDoc = this.docCache.get(entry.uuid);
        const doc = (cachedDoc ?? await this.fetchDocument(entry.uuid)) as FoundryDocument | null;
        if (!cachedDoc && doc) stats.fetchedDocuments += 1;
        const enriched = this.enrichWeaponEntryFromDocument(entry, doc as WeaponDocumentLike | null);
        if (enriched === entry) {
          stats.unresolvedEntries += 1;
          if (stats.unresolvedSamples.length < 8) stats.unresolvedSamples.push(entry.name);
          return entry;
        }
        stats.enrichedEntries += 1;
        return enriched;
      }));

      this.indexCache.set(packId, nextEntries);
    }

    if (stats.targetedWeapons > 0) {
      Log.info("CompendiumIndexer: enriched weapon snapshot metadata", stats);
    }
  }

  private async enrichIndexedOriginFeatMetadata(
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): Promise<void> {
    const packIds = this.getSelectedPackIds(sources, options);
    const stats = {
      targetedBackgrounds: 0,
      targetedFeats: 0,
      fetchedDocuments: 0,
      enrichedEntries: 0,
      unresolvedEntries: 0,
      unresolvedSamples: [] as string[],
    };

    for (const packId of packIds) {
      const type = this.getConfiguredTypeForPackId(packId, sources, options?.contentKeys);
      if (type !== "background" && type !== "feat") continue;
      const cached = this.indexCache.get(packId);
      if (!cached?.length) continue;

      const targets = cached.filter((entry) => this.needsOriginFeatMetadataEnrichment(entry));
      if (!targets.length) continue;
      if (type === "background") stats.targetedBackgrounds += targets.length;
      if (type === "feat") stats.targetedFeats += targets.length;

      const nextEntries = await this.mapWithConcurrency(cached, 24, async (entry) => {
        if (!this.needsOriginFeatMetadataEnrichment(entry)) return entry;
        const cachedDoc = this.docCache.get(entry.uuid);
        const doc = (cachedDoc ?? await this.fetchDocument(entry.uuid)) as FoundryDocument | null;
        if (!cachedDoc && doc) stats.fetchedDocuments += 1;
        const enriched = type === "background"
          ? this.enrichBackgroundEntryFromDocument(entry, doc)
          : this.enrichFeatEntryFromDocument(entry, doc as FeatDocumentLike | null);
        if (enriched === entry) {
          stats.unresolvedEntries += 1;
          if (stats.unresolvedSamples.length < 8) stats.unresolvedSamples.push(entry.name);
          return entry;
        }
        stats.enrichedEntries += 1;
        return enriched;
      });

      this.indexCache.set(packId, nextEntries);
    }

    if (stats.targetedBackgrounds > 0 || stats.targetedFeats > 0) {
      Log.info("CompendiumIndexer: enriched origin feat snapshot metadata", stats);
    }
  }

  private async enrichIndexedEquipmentShopMetadata(
    sources: PackSourceConfig,
    options?: { contentKeys?: Array<keyof PackSourceConfig> },
  ): Promise<void> {
    const packIds = this.getSelectedPackIds(sources, options);
    const stats = {
      targetedItems: 0,
      fetchedDocuments: 0,
      enrichedEntries: 0,
      unresolvedEntries: 0,
    };

    for (const packId of packIds) {
      const type = this.getConfiguredTypeForPackId(packId, sources, options?.contentKeys);
      if (type !== "item") continue;
      const cached = this.indexCache.get(packId);
      if (!cached?.length) continue;

      const nextEntries = await Promise.all(cached.map(async (entry) => {
        if (!this.needsEquipmentShopEnrichment(entry)) return entry;
        stats.targetedItems += 1;
        const cachedDoc = this.docCache.get(entry.uuid);
        const doc = (cachedDoc ?? await this.fetchDocument(entry.uuid)) as FoundryDocument | null;
        if (!cachedDoc && doc) stats.fetchedDocuments += 1;
        const enriched = this.enrichEquipmentEntryFromDocument(entry, doc as WeaponDocumentLike | null);
        if (enriched === entry) {
          stats.unresolvedEntries += 1;
          return entry;
        }
        stats.enrichedEntries += 1;
        return enriched;
      }));

      this.indexCache.set(packId, nextEntries);
    }

    if (stats.targetedItems > 0) {
      Log.info("CompendiumIndexer: enriched equipment shop metadata", stats);
    }
  }

  private needsWeaponMasteryEnrichment(entry: CreatorIndexEntry): boolean {
    if (entry.itemType !== "weapon") return false;
    return !entry.identifier
      || !entry.weaponType
      || !entry.mastery
      || entry.isFirearm === undefined
      || entry.baselineWeapon === undefined;
  }

  private needsOriginFeatMetadataEnrichment(entry: CreatorIndexEntry): boolean {
    if (entry.itemType === "background") return entry.grantsOriginFeatUuid === undefined;
    if (entry.itemType === "feat") return entry.featCategory === undefined || entry.prerequisiteLevel === undefined;
    return false;
  }

  private enrichWeaponEntryFromDocument(
    entry: CreatorIndexEntry,
    doc: WeaponDocumentLike | null,
  ): CreatorIndexEntry {
    const system = doc?.system;
    if (!system) return entry;

    const identifier = typeof system.identifier === "string" && system.identifier.trim()
      ? system.identifier.trim()
      : entry.identifier;
    const weaponType = typeof system.weaponType === "string" && system.weaponType.trim()
      ? system.weaponType.trim()
      : typeof system.type?.value === "string" && system.type.value.trim()
        ? system.type.value.trim()
        : entry.weaponType;
    const mastery = typeof system.mastery === "string" && system.mastery.trim()
      ? system.mastery.trim()
      : entry.mastery;
    const isFirearm = typeof system.ammunition?.type === "string"
      ? system.ammunition.type === "firearmBullet"
      : entry.isFirearm;
    const rarity = typeof system.rarity === "string" && system.rarity.trim()
      ? system.rarity.trim()
      : entry.rarity;
    const magicalBonus = typeof system.magicalBonus === "number"
      ? system.magicalBonus
      : entry.magicalBonus;
    const properties = this.normalizeDocumentStringCollection(system.properties);
    const baselineWeapon = this.isBaselineWeaponDocument(doc);

    if (identifier === entry.identifier
      && weaponType === entry.weaponType
      && mastery === entry.mastery
      && isFirearm === entry.isFirearm
      && rarity === entry.rarity
      && magicalBonus === entry.magicalBonus
      && arraysEqual(properties, entry.properties ?? [])
      && baselineWeapon === entry.baselineWeapon) {
      return entry;
    }

    return {
      ...entry,
      ...(identifier !== undefined && { identifier }),
      ...(weaponType !== undefined && { weaponType }),
      ...(mastery !== undefined && { mastery }),
      ...(isFirearm !== undefined && { isFirearm }),
      ...(rarity !== undefined && { rarity }),
      ...(magicalBonus !== undefined && { magicalBonus }),
      ...(properties.length > 0 ? { properties } : {}),
      baselineWeapon,
    };
  }

  private enrichBackgroundEntryFromDocument(
    entry: CreatorIndexEntry,
    doc: FoundryDocument | null,
  ): CreatorIndexEntry {
    if (!doc) return entry;
    const grantsOriginFeatUuid = parseBackgroundGrantedOriginFeatUuid(doc);
    if (grantsOriginFeatUuid === entry.grantsOriginFeatUuid) return {
      ...entry,
      ...(entry.grantsOriginFeatUuid === undefined ? { grantsOriginFeatUuid } : {}),
    };

    return {
      ...entry,
      grantsOriginFeatUuid,
    };
  }

  private enrichFeatEntryFromDocument(
    entry: CreatorIndexEntry,
    doc: FeatDocumentLike | null,
  ): CreatorIndexEntry {
    if (!doc) return entry;

    const featCategory = getFeatCategory(doc);
    const prerequisiteLevel = getPrerequisiteLevel(doc);
    if (featCategory === entry.featCategory && prerequisiteLevel === entry.prerequisiteLevel) {
      return {
        ...entry,
        ...(entry.featCategory === undefined ? { featCategory } : {}),
        ...(entry.prerequisiteLevel === undefined ? { prerequisiteLevel } : {}),
      };
    }

    return {
      ...entry,
      featCategory,
      prerequisiteLevel,
    };
  }

  private needsEquipmentShopEnrichment(entry: CreatorIndexEntry): boolean {
    const itemType = entry.itemType ?? "";
    if (!ACCEPTED_ITEM_TYPES.item.has(itemType)) return false;
    return entry.priceCp === undefined || entry.isMagical === undefined;
  }

  private enrichEquipmentEntryFromDocument(
    entry: CreatorIndexEntry,
    doc: WeaponDocumentLike | null,
  ): CreatorIndexEntry {
    if (!doc) return entry;

    const system = doc.system;
    const priceCp = getPriceInCopper(system?.price?.value, system?.price?.denomination);
    const isMagical = inferMagicalFlag(
      system?.rarity,
      system?.magicalBonus,
      normalizeProperties(system?.properties),
    );

    if (priceCp === entry.priceCp && isMagical === entry.isMagical) {
      return {
        ...entry,
        ...(entry.priceCp === undefined ? { priceCp } : {}),
        ...(entry.isMagical === undefined ? { isMagical } : {}),
      };
    }

    return {
      ...entry,
      ...(priceCp !== undefined ? { priceCp } : {}),
      ...(isMagical !== undefined ? { isMagical } : {}),
    };
  }

  private normalizeEntry(
    raw: FoundryIndexEntry,
    packId: string,
    packLabel: string,
    type: CreatorContentType,
  ): CreatorIndexEntry | null {
    const name = raw.name;
    if (!name) return null;

    // Store the actual dnd5e item type — filtering happens at query time
    const itemType = (raw.type as string) ?? "";

    const uuid = raw.uuid ?? `Compendium.${packId}.Item.${raw._id}`;
    const img = (raw.img as string) ?? "icons/svg/mystery-man.svg";

    // Extract system fields safely
    const sysIdentifier = this.extractString(raw, "system.identifier");
    const sysClassIdentifier = this.extractString(raw, "system.classIdentifier");
    const sysSpellLevel = this.extractNumber(raw, "system.level");
    const sysPrerequisiteLevel = this.extractNumberish(raw, "system.prerequisites.level");
    const sysFeatSubtype = this.extractString(raw, "system.type.subtype")?.trim().toLowerCase();
    const sysFeatTypeValue = this.extractString(raw, "system.type.value")?.trim().toLowerCase();
    const sysSchool = this.extractString(raw, "system.school");
    const sysArmorType = this.extractString(raw, "system.armor.type");
    const sysWeaponType = this.extractString(raw, "system.weaponType");
    const sysAmmunitionType = this.extractString(raw, "system.ammunition.type");
    const sysMastery = this.extractString(raw, "system.mastery");
    const sysRarity = this.extractString(raw, "system.rarity");
    const sysMagicalBonus = this.extractNumber(raw, "system.magicalBonus");
    const sysPriceValue = this.extractNumberish(raw, "system.price.value");
    const sysPriceDenomination = this.extractString(raw, "system.price.denomination");
    const sysProperties = this.extractStringCollection(raw, "system.properties");
    const normalizedPriceCp = getPriceInCopper(sysPriceValue, sysPriceDenomination);
    const normalizedIsMagical = inferMagicalFlag(sysRarity, sysMagicalBonus, sysProperties);

    return {
      uuid,
      name,
      img,
      packId,
      packLabel,
      type,
      itemType: itemType || undefined,
      ...(sysIdentifier !== undefined && { identifier: sysIdentifier }),
      ...(sysClassIdentifier !== undefined && { classIdentifier: sysClassIdentifier }),
      ...(sysSpellLevel !== undefined && { spellLevel: sysSpellLevel }),
      ...((sysFeatSubtype !== undefined || sysFeatTypeValue !== undefined) && {
        featCategory: sysFeatSubtype ?? sysFeatTypeValue ?? null,
      }),
      ...(sysPrerequisiteLevel !== undefined && { prerequisiteLevel: sysPrerequisiteLevel }),
      ...(sysSchool !== undefined && { school: sysSchool }),
      ...(sysArmorType !== undefined && { armorType: sysArmorType }),
      ...(sysWeaponType !== undefined && { weaponType: sysWeaponType }),
      ...(sysAmmunitionType !== undefined && { isFirearm: sysAmmunitionType === "firearmBullet" }),
      ...(sysMastery !== undefined && { mastery: sysMastery }),
      ...(sysRarity !== undefined && { rarity: sysRarity }),
      ...(sysMagicalBonus !== undefined && { magicalBonus: sysMagicalBonus }),
      ...(normalizedPriceCp !== undefined && { priceCp: normalizedPriceCp }),
      ...(normalizedIsMagical !== undefined && { isMagical: normalizedIsMagical }),
      ...(sysProperties.length > 0 && { properties: sysProperties }),
    };
  }

  /**
   * Safely extract a value from an index entry using dot notation.
   * Tries flat key first (Foundry V13 index style), then nested access.
   */
  private extractValue(raw: Record<string, unknown>, path: string): unknown {
    // Flat key (Foundry index entries often use "system.level" as a literal key)
    const flat = raw[path];
    if (flat !== undefined) return flat;

    // Nested access fallback
    const parts = path.split(".");
    let current: unknown = raw;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /** Safely extract a string field from an index entry using dot notation. */
  private extractString(raw: Record<string, unknown>, path: string): string | undefined {
    const val = this.extractValue(raw, path);
    return typeof val === "string" ? val : undefined;
  }

  /** Safely extract a number field from an index entry using dot notation. */
  private extractNumber(raw: Record<string, unknown>, path: string): number | undefined {
    const val = this.extractValue(raw, path);
    return typeof val === "number" ? val : undefined;
  }

  /** Safely extract a number-or-null field from an index entry using dot notation. */
  private extractNumberish(raw: Record<string, unknown>, path: string): number | null | undefined {
    const val = this.extractValue(raw, path);
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.trim()) {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) return parsed;
    }
    return val === null ? null : undefined;
  }

  /** Safely extract enabled string keys from array/set/object-ish compendium index fields. */
  private extractStringCollection(raw: Record<string, unknown>, path: string): string[] {
    const value = this.extractValue(raw, path);
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string");
    }
    if (typeof value === "object" && value !== null && typeof (value as Record<PropertyKey, unknown>)[Symbol.iterator] === "function") {
      return Array.from(value as Iterable<unknown>).filter((entry): entry is string => typeof entry === "string");
    }
    if (typeof value === "object") {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key);
    }
    return [];
  }

  private normalizeDocumentStringCollection(value: WeaponDocumentSystemData["properties"]): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string");
    }
    if (typeof value === "object" && value !== null && typeof (value as Record<PropertyKey, unknown>)[Symbol.iterator] === "function") {
      return Array.from(value as Iterable<unknown>).filter((entry): entry is string => typeof entry === "string");
    }
    if (typeof value === "object") {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key);
    }
    return [];
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const concurrency = Math.max(1, Math.min(limit, items.length));

    const workers = Array.from({ length: concurrency }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private isBaselineWeaponDocument(doc: WeaponDocumentLike | null): boolean {
    const system = doc?.system;
    if (!system) return false;

    const rarity = typeof system.rarity === "string" ? system.rarity.trim().toLowerCase() : "";
    if (rarity && rarity !== "mundane") return false;
    if (typeof system.magicalBonus === "number" && system.magicalBonus > 0) return false;
    if (this.normalizeDocumentStringCollection(system.properties).includes("mgc")) return false;
    return true;
  }
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function summarizeEntriesByPack(entries: CreatorIndexEntry[]): Array<{ packId: string; count: number; itemTypes: string[] }> {
  const byPack = new Map<string, { count: number; itemTypes: Set<string> }>();

  for (const entry of entries) {
    const summary = byPack.get(entry.packId) ?? { count: 0, itemTypes: new Set<string>() };
    summary.count += 1;
    if (entry.itemType) summary.itemTypes.add(entry.itemType);
    byPack.set(entry.packId, summary);
  }

  return Array.from(byPack.entries())
    .map(([packId, summary]) => ({
      packId,
      count: summary.count,
      itemTypes: Array.from(summary.itemTypes).sort(),
    }))
    .sort((left, right) => left.packId.localeCompare(right.packId));
}

function summarizeRawIndexTypes(entries: FoundryIndexEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    const key = typeof entry.type === "string" && entry.type.trim() ? entry.type : "(missing)";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function summarizeEntryItemTypes(entries: CreatorIndexEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    const key = entry.itemType?.trim() ? entry.itemType : "(missing)";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function getCompendiumPack(value: unknown): FoundryCompendiumCollection | undefined {
  return typeof value === "object" && value !== null && typeof (value as FoundryCompendiumCollection).getIndex === "function"
    ? (value as FoundryCompendiumCollection)
    : undefined;
}

function getTextEditor(): TextEditorLike | undefined {
  const g = globalThis as Record<string, unknown>;
  const foundryApi = g.foundry as Record<string, unknown> | undefined;
  const applicationsApi = foundryApi?.applications as Record<string, unknown> | undefined;
  const uxApi = applicationsApi?.ux as Record<string, unknown> | undefined;
  const textEditorApi = uxApi?.TextEditor as Record<string, unknown> | undefined;
  const namespacedImplementation = textEditorApi?.implementation;
  if (typeof namespacedImplementation === "object" && namespacedImplementation !== null) {
    return namespacedImplementation as TextEditorLike;
  }

  // Back-compat fallback for pre-v13 environments where the namespaced API is absent.
  if (!foundryApi) {
    const legacyTextEditor = g.TextEditor;
    return typeof legacyTextEditor === "object" && legacyTextEditor !== null
      ? (legacyTextEditor as TextEditorLike)
      : undefined;
  }

  return undefined;
}

function getDescriptionSystem(system: unknown): DescriptionSystemData | undefined {
  return typeof system === "object" && system !== null ? (system as DescriptionSystemData) : undefined;
}

/** Singleton indexer instance. */
export const compendiumIndexer = new CompendiumIndexer();
