import { getGame } from "../../types";
import type { FoundryCompendiumCollection, FoundryIndexEntry } from "../../types";
import type {
  CreatorContentType,
  CreatorWorkflow,
  PackEntry,
  PackSourceBadge,
  PackSourceConfig,
  PackSourceKey,
  SourcesTabViewModel,
  CreatorIndexEntry,
} from "../character-creator-types";
import { CONTENT_TYPE_LABELS } from "../character-creator-types";

const INDEX_FIELDS = ["name", "type", "folder"];
const SAMPLE_ITEM_LIMIT = 6;
const PREVIEW_BREAKDOWN_LIMIT = 3;
const DOMINANT_FOLDER_MIN_ITEMS = 2;
const DOMINANT_FOLDER_RATIO = 0.6;
const MATERIAL_FEAT_COUNT = 5;
const MATERIAL_FEAT_RATIO = 0.25;

const SOURCE_KEY_TO_TYPE: Record<PackSourceKey, CreatorContentType> = {
  classes: "class",
  subclasses: "subclass",
  races: "race",
  backgrounds: "background",
  feats: "feat",
  spells: "spell",
  items: "item",
};

const ITEM_TYPE_TO_CONTENT_TYPE: Record<string, CreatorContentType | undefined> = {
  class: "class",
  subclass: "subclass",
  race: "race",
  background: "background",
  feat: "feat",
  spell: "spell",
  weapon: "item",
  equipment: "item",
  consumable: "item",
  tool: "item",
  loot: "item",
};

const GENERIC_PACK_LABELS = new Set([
  "character options",
  "character classes",
  "character origins",
  "feats",
  "spells",
  "equipment",
  "items",
]);

const PACKAGE_LABEL_OVERRIDES: Record<string, string> = {
  "dnd5e": "D&D 5e SRD",
  "dnd-players-handbook": "Player's Handbook",
  "dnd-dungeon-masters-guide": "Dungeon Master's Guide",
  "dnd-monster-manual": "Monster Manual",
  "dnd-heroes-faerun": "Heroes of Faerun",
};

const CORE_2024_PACKAGES = new Set([
  "dnd-players-handbook",
  "dnd-dungeon-masters-guide",
  "dnd-monster-manual",
]);

const PREMIUM_2024_PACKAGES = new Set([
  "dnd-heroes-faerun",
]);

const PLAYER_OPTION_TYPES = new Set<CreatorContentType>([
  "class",
  "subclass",
  "race",
  "background",
  "feat",
]);

const FEAT_FRIENDLY_HINTS = [
  "feats",
  "origin feat",
  "origin",
  "character option",
  "player option",
  "hero",
];

const FEAT_HOSTILE_HINTS = [
  "monster",
  "npc",
  "equipment",
  "item",
  "trade good",
  "tradegoods",
  "loot",
  "weapon",
  "class feature",
  "classfeatures",
  "monster feature",
  "monsterfeatures",
];

interface PackMetadataLike {
  label?: string;
  name?: string;
  id?: string;
  package?: string;
  packageName?: string;
  flags?: {
    dnd5e?: {
      sourceBook?: string;
      types?: string[];
    };
  };
}

interface FolderLike {
  id?: string;
  _id?: string;
  name?: string;
  folder?: FolderLike | string | null;
}

interface PackWithFolders extends FoundryCompendiumCollection {
  folders?: unknown;
}

export interface PackAnalysis {
  collection: string;
  rawLabel: string;
  packageLabel: string;
  packageName: string;
  sourceBadge: PackSourceBadge;
  contentTypes: CreatorContentType[];
  contentBreakdown: PackEntry["contentBreakdown"];
  sampleItems: string[];
  sampleOverflow: number;
  folderHints: string[];
  dominantFolders: Partial<Record<CreatorContentType, string>>;
  previewSummary: string;
  mixedContent: boolean;
  metadataTypes: string[];
  totalEntries: number;
}

let packAnalysisCache: Promise<PackAnalysis[]> | null = null;

export async function getPackAnalyses(): Promise<PackAnalysis[]> {
  if (!packAnalysisCache) {
    packAnalysisCache = analyzeItemPacks();
  }
  return packAnalysisCache;
}

export function invalidatePackAnalysisCache(): void {
  packAnalysisCache = null;
}

export async function buildPackSourceGroups(currentSources: PackSourceConfig): Promise<SourcesTabViewModel["groups"]> {
  const enabledBySource = buildEnabledSourceSets(currentSources);
  const analyses = await getPackAnalyses();

  return (Object.keys(SOURCE_KEY_TO_TYPE) as PackSourceKey[]).map((sourceKey) => {
    const type = SOURCE_KEY_TO_TYPE[sourceKey];
    const packs = analyses
      .filter((analysis) => isPackRelevantForContentType(analysis, sourceKey))
      .map((analysis) => buildPackEntryForSource(analysis, sourceKey, enabledBySource[sourceKey].has(analysis.collection)))
      .sort(comparePackEntries);

    return {
      sourceKey,
      type,
      label: CONTENT_TYPE_LABELS[type],
      packs,
    };
  });
}

export function isPackRelevantForContentType(
  analysis: PackAnalysis,
  typeOrSourceKey: CreatorContentType | PackSourceKey,
): boolean {
  const type = normalizeContentType(typeOrSourceKey);
  if (!type) return false;

  if (!analysis.contentTypes.includes(type)) return false;
  if (type !== "feat") return true;

  const featCount = getContentTypeCount(analysis, "feat");
  const featRatio = analysis.totalEntries > 0 ? featCount / analysis.totalEntries : 0;
  const metadataTypes = new Set(analysis.metadataTypes);
  const textSignals = getTextSignals(analysis);
  const friendly = containsAny(textSignals, FEAT_FRIENDLY_HINTS) || !!analysis.dominantFolders.feat;
  const hostile = containsAny(textSignals, FEAT_HOSTILE_HINTS);
  const dedicatedFeatPack = metadataTypes.size === 1 && metadataTypes.has("feat");
  const playerOptionMetadata = Array.from(metadataTypes).some((value) =>
    value === "feat" || value === "class" || value === "subclass" || value === "race" || value === "background");
  const mixedPlayerOptions = playerOptionMetadata
    && analysis.contentBreakdown.some((entry) => entry.type !== "feat" && PLAYER_OPTION_TYPES.has(entry.type));
  const materialFeatPack = featCount >= MATERIAL_FEAT_COUNT || featRatio >= MATERIAL_FEAT_RATIO;
  const equipmentDominated = analysis.contentBreakdown[0]?.type === "item" && featRatio < 0.5;

  if (dedicatedFeatPack) return true;
  if (hostile && !friendly) return false;
  if (equipmentDominated) return false;
  if (friendly && featCount > 0) return true;
  if (mixedPlayerOptions && materialFeatPack) return true;

  return featCount > 0 && featRatio >= 0.5;
}

export function isEntryRelevantForWorkflow(
  entry: CreatorIndexEntry,
  workflow: CreatorWorkflow,
  options?: {
    packAnalysis?: PackAnalysis | null;
    prerequisiteLevel?: number | null;
    grantedOriginFeatUuids?: Set<string>;
  },
): boolean {
  const packAnalysis = options?.packAnalysis ?? null;

  if (workflow === "spell") return entry.type === "spell";
  if (workflow === "equipment") return entry.type === "item";
  if (workflow === "creator-feat") {
    return entry.type === "feat"
      && (!packAnalysis || isPackRelevantForContentType(packAnalysis, "feat"));
  }

  if (workflow === "origin-feat") {
    if (entry.type !== "feat") return false;
    if (options?.grantedOriginFeatUuids && !options.grantedOriginFeatUuids.has(entry.uuid)) return false;
    if (options?.prerequisiteLevel !== null && options?.prerequisiteLevel !== undefined) return false;
    if (!packAnalysis) return true;
    if (!isPackRelevantForContentType(packAnalysis, "feat")) return false;

    const textSignals = getTextSignals(packAnalysis);
    const originFriendly = containsAny(textSignals, ["origin", "background", "character option", "player option"])
      || !!packAnalysis.dominantFolders.feat;
    return originFriendly || (options?.grantedOriginFeatUuids?.has(entry.uuid) ?? false);
  }

  return false;
}

export async function getPackAnalysisMap(): Promise<Map<string, PackAnalysis>> {
  const analyses = await getPackAnalyses();
  return new Map(analyses.map((analysis) => [analysis.collection, analysis]));
}

async function analyzeItemPacks(): Promise<PackAnalysis[]> {
  const game = getGame();
  if (!game?.packs) return [];

  const analyses = await Promise.all(
    getPackIterable(game.packs)
      .filter((pack) => pack.documentName === "Item")
      .map((pack) => analyzePack(pack)),
  );

  return analyses.filter((analysis): analysis is PackAnalysis => analysis !== null);
}

async function analyzePack(pack: FoundryCompendiumCollection): Promise<PackAnalysis | null> {
  const collection = pack.collection ?? getPackMetadata(pack)?.id ?? "";
  if (!collection) return null;

  try {
    const index = await pack.getIndex({ fields: INDEX_FIELDS });
    const metadata = getPackMetadata(pack);
    const rawLabel = metadata?.label ?? metadata?.name ?? collection;
    const packageName = metadata?.packageName ?? metadata?.package ?? "unknown";
    const packageLabel = getPackageLabel(packageName);
    const folderCounts = buildFolderCounts(pack as PackWithFolders, index);
    const contentBreakdown = buildContentBreakdown(index);
    if (contentBreakdown.length === 0) return null;

    const contentTypes = contentBreakdown.map((entry) => entry.type);
    const sampleItems = index
      .map((entry) => normalizeName(entry.name))
      .filter((name): name is string => !!name)
      .slice(0, SAMPLE_ITEM_LIMIT);

    return {
      collection,
      rawLabel,
      packageLabel,
      packageName,
      sourceBadge: resolveSourceBadge(collection, packageName, metadata),
      contentTypes,
      contentBreakdown,
      sampleItems,
      sampleOverflow: Math.max(index.length - sampleItems.length, 0),
      folderHints: buildFolderHints(folderCounts),
      dominantFolders: buildDominantFolders(folderCounts, contentBreakdown),
      previewSummary: buildPreviewSummary(contentBreakdown),
      mixedContent: contentBreakdown.length > 1,
      metadataTypes: metadata?.flags?.dnd5e?.types?.map((value) => value.toLowerCase()) ?? [],
      totalEntries: index.length,
    };
  } catch {
    return null;
  }
}

function buildPackEntryForSource(analysis: PackAnalysis, sourceKey: PackSourceKey, enabled: boolean): PackEntry {
  const label = buildDisplayLabel(analysis, sourceKey);
  const previewHint = buildPreviewHint(analysis, sourceKey, label);

  return {
    collection: analysis.collection,
    label,
    rawLabel: analysis.rawLabel,
    packageLabel: analysis.packageLabel,
    packageName: analysis.packageName,
    itemCount: analysis.totalEntries,
    enabled,
    contentTypes: analysis.contentTypes,
    sourceBadge: analysis.sourceBadge,
    mixedContent: analysis.mixedContent,
    previewSummary: analysis.previewSummary,
    contentBreakdown: analysis.contentBreakdown,
    sampleItems: analysis.sampleItems,
    sampleOverflow: analysis.sampleOverflow,
    folderHints: analysis.folderHints,
    previewHint,
  };
}

function buildEnabledSourceSets(currentSources: PackSourceConfig): Record<PackSourceKey, Set<string>> {
  return {
    classes: new Set(currentSources.classes ?? []),
    subclasses: new Set(currentSources.subclasses ?? []),
    races: new Set(currentSources.races ?? []),
    backgrounds: new Set(currentSources.backgrounds ?? []),
    feats: new Set(currentSources.feats ?? []),
    spells: new Set(currentSources.spells ?? []),
    items: new Set(currentSources.items ?? []),
  };
}

function buildContentBreakdown(index: FoundryIndexEntry[]): PackEntry["contentBreakdown"] {
  const counts = new Map<CreatorContentType, number>();

  for (const entry of index) {
    const type = ITEM_TYPE_TO_CONTENT_TYPE[String(entry.type ?? "").toLowerCase()];
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || CONTENT_TYPE_LABELS[a[0]].localeCompare(CONTENT_TYPE_LABELS[b[0]]))
    .map(([type, count]) => ({ type, label: CONTENT_TYPE_LABELS[type], count }));
}

function buildFolderCounts(pack: PackWithFolders, index: FoundryIndexEntry[]): Map<CreatorContentType, Map<string, number>> {
  const folderMap = createFolderNameMap(pack.folders);
  const result = new Map<CreatorContentType, Map<string, number>>();

  for (const entry of index) {
    const type = ITEM_TYPE_TO_CONTENT_TYPE[String(entry.type ?? "").toLowerCase()];
    if (!type) continue;
    const folderName = resolveFolderName(entry.folder, folderMap);
    if (!folderName) continue;

    const byFolder = result.get(type) ?? new Map<string, number>();
    byFolder.set(folderName, (byFolder.get(folderName) ?? 0) + 1);
    result.set(type, byFolder);
  }

  return result;
}

function buildFolderHints(folderCounts: Map<CreatorContentType, Map<string, number>>): string[] {
  const counts = new Map<string, number>();

  for (const byFolder of folderCounts.values()) {
    for (const [name, count] of byFolder.entries()) {
      counts.set(name, (counts.get(name) ?? 0) + count);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name]) => name);
}

function buildDominantFolders(
  folderCounts: Map<CreatorContentType, Map<string, number>>,
  contentBreakdown: PackEntry["contentBreakdown"],
): Partial<Record<CreatorContentType, string>> {
  const result: Partial<Record<CreatorContentType, string>> = {};

  for (const entry of contentBreakdown) {
    const byFolder = folderCounts.get(entry.type);
    if (!byFolder || byFolder.size === 0) continue;

    const [topFolder, topCount] = Array.from(byFolder.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];

    if (!topFolder || !topCount) continue;
    if (topCount < DOMINANT_FOLDER_MIN_ITEMS) continue;
    if (topCount / entry.count < DOMINANT_FOLDER_RATIO) continue;

    result[entry.type] = topFolder;
  }

  return result;
}

function buildDisplayLabel(analysis: PackAnalysis, sourceKey: PackSourceKey): string {
  const type = SOURCE_KEY_TO_TYPE[sourceKey];
  const curated = getCuratedDisplayLabel(analysis.collection, sourceKey);
  if (curated) return curated;

  const dominantFolder = analysis.dominantFolders[type];
  if (dominantFolder && shouldUseDominantFolderLabel(analysis, sourceKey, dominantFolder)) {
    return `${analysis.packageLabel}: ${dominantFolder}`;
  }

  if (shouldPrefixPackageLabel(analysis.rawLabel, analysis.packageLabel, analysis.packageName)) {
    return `${analysis.packageLabel}: ${analysis.rawLabel.trim()}`;
  }

  return analysis.rawLabel.trim() || analysis.collection;
}

function buildPreviewSummary(contentBreakdown: PackEntry["contentBreakdown"]): string {
  return contentBreakdown
    .slice(0, PREVIEW_BREAKDOWN_LIMIT)
    .map(({ count, label }) => `${count} ${label.toLowerCase()}`)
    .join(" • ");
}

function buildPreviewHint(analysis: PackAnalysis, sourceKey: PackSourceKey, label: string): string | undefined {
  const type = SOURCE_KEY_TO_TYPE[sourceKey];
  const dominantFolder = analysis.dominantFolders[type];

  if (dominantFolder && label !== analysis.rawLabel) {
    return `From ${analysis.rawLabel}`;
  }

  if (analysis.folderHints.length > 0) {
    return `Folders: ${analysis.folderHints.slice(0, 3).join(", ")}`;
  }

  if (analysis.mixedContent) {
    return `${analysis.packageLabel} mixed player options`;
  }

  if (shouldPrefixPackageLabel(analysis.rawLabel, analysis.packageLabel, "")) {
    return `From ${analysis.packageLabel}`;
  }

  return undefined;
}

function getCuratedDisplayLabel(collection: string, sourceKey: PackSourceKey): string | undefined {
  const curated: Partial<Record<PackSourceKey, Record<string, string>>> = {
    backgrounds: {
      "dnd-heroes-faerun.options": "Heroes of Faerun: Character Options",
    },
  };
  return curated[sourceKey]?.[collection];
}

function shouldUseDominantFolderLabel(analysis: PackAnalysis, sourceKey: PackSourceKey, dominantFolder: string): boolean {
  if (sourceKey !== "feats") return false;
  if (!isGenericLabel(analysis.rawLabel)) return false;
  return /origin|feat|character option/i.test(dominantFolder);
}

function shouldPrefixPackageLabel(rawLabel: string, packageLabel: string, packageName: string): boolean {
  if (!packageLabel || packageLabel === "unknown") return false;
  if (packageLabel === "D&D 5e SRD") return false;
  if (CORE_2024_PACKAGES.has(packageName)) return false;

  const normalizedLabel = rawLabel.trim().toLowerCase();
  const normalizedPackage = packageLabel.trim().toLowerCase();
  return isGenericLabel(normalizedLabel) && !normalizedLabel.startsWith(normalizedPackage);
}

function isGenericLabel(label: string): boolean {
  return GENERIC_PACK_LABELS.has(label.trim().toLowerCase());
}

function getPackageLabel(packageName: string): string {
  if (PACKAGE_LABEL_OVERRIDES[packageName]) return PACKAGE_LABEL_OVERRIDES[packageName];
  if (!packageName || packageName === "unknown") return "unknown";

  return packageName
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveSourceBadge(
  collection: string,
  packageName: string,
  metadata: PackMetadataLike | undefined,
): PackSourceBadge {
  const sourceBook = metadata?.flags?.dnd5e?.sourceBook?.toLowerCase() ?? "";

  if (sourceBook.includes("5.1")) return "SRD 2014";
  if (sourceBook.includes("5.2")) return "SRD 2024";

  if (packageName === "dnd5e") {
    return collection.endsWith("24") ? "SRD 2024" : "SRD 2014";
  }

  if (CORE_2024_PACKAGES.has(packageName)) return "Core 2024";
  if (PREMIUM_2024_PACKAGES.has(packageName)) return "Premium 2024";

  return "Unknown";
}

function createFolderNameMap(folders: unknown): Map<string, string> {
  const result = new Map<string, string>();

  for (const folder of getFolderIterable(folders)) {
    const id = folder.id ?? folder._id;
    const name = buildFolderPath(folder);
    if (!id || !name) continue;
    result.set(id, name);
  }

  return result;
}

function buildFolderPath(folder: FolderLike): string {
  const names: string[] = [];
  let current: FolderLike | string | null | undefined = folder;

  while (current && typeof current === "object") {
    const name = normalizeName(current.name);
    if (name) names.unshift(name);
    current = current.folder;
  }

  return names.join(" / ");
}

function resolveFolderName(folder: unknown, folderMap: Map<string, string>): string | undefined {
  if (!folder) return undefined;
  if (typeof folder === "string") return folderMap.get(folder);

  if (typeof folder === "object") {
    const folderLike = folder as FolderLike;
    const directName = buildFolderPath(folderLike);
    if (directName) return directName;

    const id = folderLike.id ?? folderLike._id;
    if (id) return folderMap.get(id);
  }

  return undefined;
}

function getPackMetadata(pack: FoundryCompendiumCollection): PackMetadataLike | undefined {
  return pack.metadata as PackMetadataLike | undefined;
}

function getPackIterable(packs: unknown): FoundryCompendiumCollection[] {
  const candidates = getIterableValues(packs);
  return candidates
    .map((value) => unwrapPackValue(value))
    .filter((value): value is FoundryCompendiumCollection => isCompendiumPackLike(value));
}

function getIterableValues(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];

  const valuesFn = (value as { values?: unknown }).values;
  if (typeof valuesFn === "function") {
    const values = valuesFn.call(value) as Iterable<unknown>;
    return Array.from(values);
  }

  if (Symbol.iterator in value) {
    return Array.from(value as Iterable<unknown>);
  }

  return [];
}

function unwrapPackValue(value: unknown): unknown {
  return Array.isArray(value) && value.length >= 2 ? value[1] : value;
}

function isCompendiumPackLike(value: unknown): value is FoundryCompendiumCollection {
  return typeof value === "object"
    && value !== null
    && typeof (value as FoundryCompendiumCollection).getIndex === "function";
}

function getFolderIterable(folders: unknown): FolderLike[] {
  const values = getIterableValues(folders);
  if (values.length > 0) {
    return values.filter((value): value is FolderLike => isFolderLike(value));
  }

  if (folders && typeof folders === "object" && Array.isArray((folders as { contents?: unknown[] }).contents)) {
    return (folders as { contents: unknown[] }).contents.filter((value): value is FolderLike => isFolderLike(value));
  }

  return [];
}

function isFolderLike(value: unknown): value is FolderLike {
  return typeof value === "object"
    && value !== null
    && ("name" in value || "id" in value || "_id" in value);
}

function comparePackEntries(a: PackEntry, b: PackEntry): number {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  return a.label.localeCompare(b.label);
}

function normalizeName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeContentType(value: CreatorContentType | PackSourceKey): CreatorContentType | null {
  if (value in SOURCE_KEY_TO_TYPE) {
    return SOURCE_KEY_TO_TYPE[value as PackSourceKey];
  }
  return value as CreatorContentType;
}

function getContentTypeCount(analysis: PackAnalysis, type: CreatorContentType): number {
  return analysis.contentBreakdown.find((entry) => entry.type === type)?.count ?? 0;
}

function getTextSignals(analysis: PackAnalysis): string[] {
  return [
    analysis.collection,
    analysis.rawLabel,
    analysis.packageName,
    analysis.packageLabel,
    ...analysis.folderHints,
  ].map((value) => value.toLowerCase());
}

function containsAny(haystack: string[], needles: string[]): boolean {
  return haystack.some((value) => needles.some((needle) => value.includes(needle)));
}
