import type {
  CreatorIndexEntry,
  EquipmentOptionItem,
  EquipmentSelection,
  EquipmentSourceOption,
  WizardState,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { getStartingGoldForIdentifier } from "../starting-resources";

type SourceKey = "class" | "background";

type DescriptionSystemLike = {
  description?: {
    value?: unknown;
  };
};

type EquipmentDocumentLike = {
  system?: Record<string, unknown> & DescriptionSystemLike;
  img?: string;
  name?: string;
};

export interface EquipmentSourceResolution {
  source: SourceKey;
  label: string;
  img: string;
  options: EquipmentSourceOption[];
  unsupportedReason?: string;
}

export interface EquipmentFlowResolution {
  classSource: EquipmentSourceResolution | null;
  backgroundSource: EquipmentSourceResolution | null;
  shopInventory: CreatorIndexEntry[];
}

export interface DerivedEquipmentItem {
  uuid: string;
  name: string;
  img?: string;
  quantity: number;
  priceCp: number;
  itemType?: string;
}

export interface DerivedEquipmentState {
  selectedClassOption: EquipmentSourceOption | null;
  selectedBackgroundOption: EquipmentSourceOption | null;
  baseGoldCp: number;
  remainingGoldCp: number;
  inventory: DerivedEquipmentItem[];
  purchases: Array<{ uuid: string; quantity: number }>;
  sales: Array<{ uuid: string; quantity: number }>;
}

const DEFAULT_SHOP_MODE = "buy";

const GOLD_CURRENCY_MULTIPLIERS: Record<string, number> = {
  gp: 100,
  sp: 10,
  cp: 1,
  ep: 50,
  pp: 1000,
};

const DISPLAY_CURRENCY_ORDER = ["gp", "sp", "cp"] as const;
const ACTOR_CURRENCY_ORDER = ["gp", "sp", "cp"] as const;

export function buildDefaultEquipmentSelection(): EquipmentSelection {
  return {
    purchases: {},
    sales: {},
    shopMode: DEFAULT_SHOP_MODE,
    baseGoldCp: 0,
    remainingGoldCp: 0,
  };
}

export function getEquipmentSelection(state: WizardState): EquipmentSelection {
  return state.selections.equipment ?? buildDefaultEquipmentSelection();
}

export function getEnabledShopInventory(state: WizardState): CreatorIndexEntry[] {
  return compendiumIndexer.getIndexedEntries("item", state.config.packSources)
    .filter((entry) => !state.config.disabledUUIDs.has(entry.uuid))
    .filter((entry) => !entry.isMagical)
    .filter((entry) => state.config.allowFirearms === true || !entry.isFirearm)
    .filter((entry) => typeof entry.priceCp === "number" && entry.priceCp > 0);
}

export async function resolveEquipmentFlow(state: WizardState): Promise<EquipmentFlowResolution> {
  const [classSource, backgroundSource] = await Promise.all([
    resolveSourceOptions(state, "class"),
    resolveSourceOptions(state, "background"),
  ]);
  return {
    classSource,
    backgroundSource,
    shopInventory: getEnabledShopInventory(state),
  };
}

export function deriveEquipmentState(
  state: WizardState,
  resolution: EquipmentFlowResolution,
): DerivedEquipmentState {
  const selection = getEquipmentSelection(state);
  const selectedClassOption = resolution.classSource?.options.find((option) => option.id === selection.classOptionId) ?? null;
  const selectedBackgroundOption = resolution.backgroundSource?.options.find((option) => option.id === selection.backgroundOptionId) ?? null;
  const inventory = new Map<string, DerivedEquipmentItem>();

  let baseGoldCp = 0;
  for (const option of [selectedClassOption, selectedBackgroundOption]) {
    if (!option) continue;
    baseGoldCp += option.goldCp;
    if (option.mode === "gold") {
      baseGoldCp += option.totalValueCp;
      continue;
    }
    for (const item of option.items) {
      const existing = inventory.get(item.uuid);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        inventory.set(item.uuid, {
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          quantity: item.quantity,
          priceCp: item.priceCp ?? 0,
          itemType: item.itemType,
        });
      }
    }
  }

  const purchases = Object.entries(selection.purchases ?? {})
    .filter(([, quantity]) => typeof quantity === "number" && quantity > 0)
    .map(([uuid, quantity]) => ({ uuid, quantity }));
  const sales = Object.entries(selection.sales ?? {})
    .filter(([, quantity]) => typeof quantity === "number" && quantity > 0)
    .map(([uuid, quantity]) => ({ uuid, quantity }));

  let remainingGoldCp = baseGoldCp;
  const shopLookup = new Map(resolution.shopInventory.map((entry) => [entry.uuid, entry]));

  for (const purchase of purchases) {
    const entry = shopLookup.get(purchase.uuid);
    if (!entry || typeof entry.priceCp !== "number") continue;
    remainingGoldCp -= entry.priceCp * purchase.quantity;
    const existing = inventory.get(entry.uuid);
    if (existing) existing.quantity += purchase.quantity;
    else {
      inventory.set(entry.uuid, {
        uuid: entry.uuid,
        name: entry.name,
        img: entry.img,
        quantity: purchase.quantity,
        priceCp: entry.priceCp,
        itemType: entry.itemType,
      });
    }
  }

  for (const sale of sales) {
    const entry = shopLookup.get(sale.uuid);
    const existing = inventory.get(sale.uuid);
    if (!entry || !existing || typeof entry.priceCp !== "number") continue;
    const soldQuantity = Math.min(existing.quantity, sale.quantity);
    if (soldQuantity <= 0) continue;
    existing.quantity -= soldQuantity;
    if (existing.quantity <= 0) inventory.delete(sale.uuid);
    remainingGoldCp += entry.priceCp * soldQuantity;
  }

  return {
    selectedClassOption,
    selectedBackgroundOption,
    baseGoldCp: Math.max(0, baseGoldCp),
    remainingGoldCp: Math.max(0, remainingGoldCp),
    inventory: [...inventory.values()].sort((left, right) => left.name.localeCompare(right.name)),
    purchases,
    sales,
  };
}

export function getEquipmentShopAvailability(
  state: WizardState,
  resolution: EquipmentFlowResolution,
): { applicable: boolean; remainingGoldCp: number } {
  const derived = deriveEquipmentState(state, resolution);
  const hasSelections = Boolean(derived.selectedClassOption && derived.selectedBackgroundOption);
  return {
    applicable: hasSelections && derived.baseGoldCp > 0,
    remainingGoldCp: derived.remainingGoldCp,
  };
}

export function formatCurrencyCp(totalCp: number): string {
  let remaining = Math.max(0, Math.floor(totalCp));
  const parts: string[] = [];

  for (const denomination of DISPLAY_CURRENCY_ORDER) {
    const multiplier = GOLD_CURRENCY_MULTIPLIERS[denomination];
    const amount = Math.floor(remaining / multiplier);
    if (amount > 0) {
      parts.push(`${amount} ${denomination}`);
      remaining -= amount * multiplier;
    }
  }

  return parts.length > 0 ? parts.join(", ") : "0 cp";
}

export function currencyCpToActorCurrency(totalCp: number): Record<string, number> {
  let remaining = Math.max(0, Math.floor(totalCp));
  const currency: Record<string, number> = {
    pp: 0,
    gp: 0,
    ep: 0,
    sp: 0,
    cp: 0,
  };

  for (const denomination of ACTOR_CURRENCY_ORDER) {
    const multiplier = GOLD_CURRENCY_MULTIPLIERS[denomination];
    const amount = Math.floor(remaining / multiplier);
    currency[denomination] = amount;
    remaining -= amount * multiplier;
  }

  return currency;
}

export function updatePurchaseQuantity(state: WizardState, uuid: string, nextQuantity: number): void {
  const selection = getEquipmentSelection(state);
  const purchases = { ...(selection.purchases ?? {}) };
  if (nextQuantity > 0) purchases[uuid] = nextQuantity;
  else delete purchases[uuid];
  state.selections.equipment = {
    ...selection,
    purchases,
  };
}

export function updateSaleQuantity(state: WizardState, uuid: string, nextQuantity: number): void {
  const selection = getEquipmentSelection(state);
  const sales = { ...(selection.sales ?? {}) };
  if (nextQuantity > 0) sales[uuid] = nextQuantity;
  else delete sales[uuid];
  state.selections.equipment = {
    ...selection,
    sales,
  };
}

export function syncEquipmentSelectionSnapshot(
  state: WizardState,
  resolution: EquipmentFlowResolution,
): void {
  const selection = getEquipmentSelection(state);
  const derived = deriveEquipmentState(state, resolution);
  state.selections.equipment = {
    ...selection,
    baseGoldCp: derived.baseGoldCp,
    remainingGoldCp: derived.remainingGoldCp,
  };
}

async function resolveSourceOptions(
  state: WizardState,
  source: SourceKey,
): Promise<EquipmentSourceResolution | null> {
  const selected = source === "class" ? state.selections.class : state.selections.background;
  if (!selected?.uuid) return null;

  const doc = await compendiumIndexer.fetchDocument(selected.uuid) as EquipmentDocumentLike | null;
  if (!doc) {
    return {
      source,
      label: selected.name,
      img: selected.img,
      options: [],
      unsupportedReason: `Could not load ${source} starting equipment data.`,
    };
  }

  const itemLookup = buildItemLookup(state);
  const structuredOptions = parseStructuredEquipmentOptions(doc, source, selected.name, selected.img, itemLookup, state.config.allowFirearms === true);
  const options = structuredOptions.length > 0
    ? structuredOptions
    : parseDescriptionEquipmentOptions(
      doc,
      source,
      selected.name,
      selected.img,
      itemLookup,
      state.config.allowFirearms === true,
      source === "class" && "identifier" in selected && typeof selected.identifier === "string"
        ? selected.identifier
        : undefined,
    );

  const gmMethod = state.config.equipmentMethod;
  const filteredOptions = options.filter((option) =>
    gmMethod === "both"
      ? true
      : gmMethod === "gold"
        ? option.mode === "gold"
        : option.mode === "equipment"
  );

  return {
    source,
    label: selected.name,
    img: selected.img,
    options: filteredOptions,
    unsupportedReason: filteredOptions.length > 0 ? undefined : `No supported ${source} equipment options could be resolved from the current source data.`,
  };
}

function parseStructuredEquipmentOptions(
  doc: EquipmentDocumentLike,
  source: SourceKey,
  label: string,
  img: string,
  itemLookup: Map<string, CreatorIndexEntry>,
  allowFirearms: boolean,
): EquipmentSourceOption[] {
  const system = doc.system as Record<string, unknown> | undefined;
  const rawChoices = (system?.startingEquipment ?? system?.equipmentChoices) as unknown;
  if (!Array.isArray(rawChoices)) return [];

  return rawChoices.flatMap((choice, index) => {
    if (!choice || typeof choice !== "object") return [];
    const record = choice as Record<string, unknown>;
    const title = typeof record.label === "string" ? record.label : `${label} Option ${index + 1}`;
    const rawItems = Array.isArray(record.items) ? record.items : [];
    const items = rawItems.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const itemRecord = entry as Record<string, unknown>;
      const itemUuid = typeof itemRecord.uuid === "string" ? itemRecord.uuid : "";
      const quantity = typeof itemRecord.quantity === "number" ? itemRecord.quantity : 1;
      const item = itemUuid ? itemLookup.get(itemUuid) : null;
      if (!item || (!allowFirearms && item.isFirearm)) return [];
      return [{
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        quantity,
        priceCp: item.priceCp,
        itemType: item.itemType,
        isFirearm: item.isFirearm,
        isMagical: item.isMagical,
      } satisfies EquipmentOptionItem];
    });

    const explicitGold = parseGoldAward(typeof record.gold === "string" || typeof record.gold === "number" ? String(record.gold) : "");
    const option: EquipmentSourceOption = {
      id: `${source}-structured-${index}`,
      source,
      mode: "equipment",
      title,
      description: typeof record.description === "string" ? record.description : summarizeItemNames(items),
      img,
      items,
      goldCp: explicitGold,
      totalValueCp: items.reduce((sum, item) => sum + ((item.priceCp ?? 0) * item.quantity), 0),
    };
    return items.length > 0 ? [option] : [];
  });
}

function parseDescriptionEquipmentOptions(
  doc: EquipmentDocumentLike,
  source: SourceKey,
  label: string,
  img: string,
  itemLookup: Map<string, CreatorIndexEntry>,
  allowFirearms: boolean,
  classIdentifier?: string,
): EquipmentSourceOption[] {
  const text = extractEquipmentSegment(doc);
  if (!text) return [];

  const choiceMatches = [...text.matchAll(/\(([A-Z])\)\s*([^()]+?)(?=(?:\s*\([A-Z]\)\s*)|$)/g)];
  const parsedOptions = choiceMatches.length > 0
    ? choiceMatches.flatMap((match, index) => {
      const optionText = match[2]?.trim() ?? "";
      const parsed = parseEquipmentOptionText(
        optionText,
        source,
        `${label} ${match[1]}`,
        img,
        itemLookup,
        allowFirearms,
        `choice-${index + 1}`,
      );
      return parsed ? [parsed] : [];
    })
    : (() => {
      const parsed = parseEquipmentOptionText(text, source, `${label} Equipment`, img, itemLookup, allowFirearms, "default");
      return parsed ? [parsed] : [];
    })();

  const equipmentOptions = parsedOptions.filter((option) => option.mode === "equipment");
  const explicitGoldOptions = parsedOptions.filter((option) => option.mode === "gold");
  if (explicitGoldOptions.length > 0) return [...equipmentOptions, ...explicitGoldOptions];

  const fallbackGoldCp = source === "class"
    ? getStartingGoldForIdentifier(classIdentifier) * 100
    : Math.max(...equipmentOptions.map((option) => option.totalValueCp + option.goldCp), 0);

  if (fallbackGoldCp > 0) {
    equipmentOptions.push({
      id: `${source}-fallback-gold`,
      source,
      mode: "gold",
      title: "Take Gold Instead",
      description: `Receive ${formatCurrencyCp(fallbackGoldCp)} instead of the listed equipment.`,
      img,
      items: [],
      goldCp: 0,
      totalValueCp: fallbackGoldCp,
    });
  }

  return equipmentOptions;
}

function parseEquipmentOptionText(
  rawText: string,
  source: SourceKey,
  title: string,
  img: string,
  itemLookup: Map<string, CreatorIndexEntry>,
  allowFirearms: boolean,
  suffix: string,
): EquipmentSourceOption | null {
  const normalizedText = rawText
    .replace(/^or\s+/i, "")
    .replace(/^and\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const goldCp = parseGoldAward(normalizedText);
  const textWithoutGold = normalizedText.replace(/\b\d+\s*(?:PP|GP|EP|SP|CP)\b/gi, " ");
  const itemEntries = extractItemTokens(textWithoutGold, itemLookup);
  if (!allowFirearms && itemEntries.some((item) => item.isFirearm)) return null;

  if (itemEntries.length === 0 && goldCp <= 0) return null;
  if (itemEntries.length === 0 && goldCp > 0) {
    return {
      id: `${source}-${suffix}-gold`,
      source,
      mode: "gold",
      title: "Take Gold Instead",
      description: `Receive ${formatCurrencyCp(goldCp)}.`,
      img,
      items: [],
      goldCp: 0,
      totalValueCp: goldCp,
    };
  }

  return {
    id: `${source}-${suffix}-equipment`,
    source,
    mode: "equipment",
    title,
    description: summarizeItemNames(itemEntries, goldCp),
    img: itemEntries[0]?.img ?? img,
    items: itemEntries,
    goldCp,
    totalValueCp: itemEntries.reduce((sum, item) => sum + ((item.priceCp ?? 0) * item.quantity), 0),
  };
}

function buildItemLookup(state: WizardState): Map<string, CreatorIndexEntry> {
  const byKey = new Map<string, CreatorIndexEntry>();
  for (const entry of compendiumIndexer.getIndexedEntries("item", state.config.packSources)) {
    byKey.set(entry.uuid, entry);
    byKey.set(normalizeLookupKey(entry.name), entry);
    if (entry.identifier) byKey.set(normalizeLookupKey(entry.identifier), entry);
  }
  return byKey;
}

function extractItemTokens(
  text: string,
  itemLookup: Map<string, CreatorIndexEntry>,
): EquipmentOptionItem[] {
  const cleaned = text
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/gi, "$1")
    .replace(/[.;]/g, ",")
    .replace(/\b(?:and|plus)\b/gi, ",")
    .replace(/\s+/g, " ")
    .trim();

  const items: EquipmentOptionItem[] = [];
  for (const rawPart of cleaned.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const quantityMatch = part.match(/^(\d+)\s+(.+)$/);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    const rawName = (quantityMatch ? quantityMatch[2] : part)
      .replace(/^a\s+/i, "")
      .replace(/^an\s+/i, "")
      .trim();
    const entry = resolveItemByName(rawName, itemLookup);
    if (!entry) continue;
    items.push({
      uuid: entry.uuid,
      name: entry.name,
      img: entry.img,
      quantity,
      priceCp: entry.priceCp,
      itemType: entry.itemType,
      isFirearm: entry.isFirearm,
      isMagical: entry.isMagical,
    });
  }
  return items;
}

function resolveItemByName(
  rawName: string,
  itemLookup: Map<string, CreatorIndexEntry>,
): CreatorIndexEntry | null {
  const direct = itemLookup.get(normalizeLookupKey(rawName));
  if (direct) return direct;

  if (rawName.endsWith("s")) {
    const singular = itemLookup.get(normalizeLookupKey(rawName.slice(0, -1)));
    if (singular) return singular;
  }

  return null;
}

function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/gi, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function summarizeItemNames(items: EquipmentOptionItem[], goldCp = 0): string {
  const parts = items.map((item) => item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name);
  if (goldCp > 0) parts.push(`${formatCurrencyCp(goldCp)} extra`);
  return parts.join(", ");
}

function extractEquipmentSegment(doc: EquipmentDocumentLike): string {
  const raw = getRawDescription(doc);
  if (!raw) return "";

  const rowHtml =
    extractEquipmentRowHtml(raw, "Starting Equipment")
    ?? extractEquipmentRowHtml(raw, "Equipment");
  const source = rowHtml ?? raw;
  const normalized = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[\/award\s+([^[\]]+)\]\]/gi, "$1")
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedSource = source
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[\/award\s+([^[\]]+)\]\]/gi, "$1")
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const rowLabelMatch = normalizedSource.match(/^(?:Starting Equipment|Equipment)\s*:?\s*([\s\S]+)/i);
  if (rowLabelMatch?.[1]?.trim()) return rowLabelMatch[1].trim();

  const segmentMatch = normalized.match(/(?:Starting Equipment|Equipment):\s*([\s\S]+)/i);
  return segmentMatch?.[1]?.trim() ?? normalizedSource;
}

function getRawDescription(doc: EquipmentDocumentLike | null): string {
  const system = doc?.system as DescriptionSystemLike | undefined;
  const value = system?.description?.value;
  return typeof value === "string" ? value : "";
}

function extractEquipmentRowHtml(rawHtml: string, label: string): string | null {
  const thPattern = new RegExp(
    `<th[^>]*>[\\s\\S]*?<strong>\\s*${escapeRegex(label)}\\s*<\\/strong>[\\s\\S]*?<\\/th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>`,
    "i",
  );
  const thMatch = rawHtml.match(thPattern);
  if (thMatch?.[1]?.trim()) return thMatch[1].trim();

  const paragraphPattern = new RegExp(
    `${escapeRegex(label)}\\s*:?[\\s\\S]*?(<p>[\\s\\S]*?<\\/p>)`,
    "i",
  );
  const paragraphMatch = rawHtml.match(paragraphPattern);
  return paragraphMatch?.[1]?.trim() ?? null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseGoldAward(text: string): number {
  let total = 0;
  for (const match of text.matchAll(/\b(\d+)\s*(PP|GP|EP|SP|CP)\b/gi)) {
    const amount = Number(match[1]);
    const denomination = match[2]?.toLowerCase() ?? "gp";
    total += amount * (GOLD_CURRENCY_MULTIPLIERS[denomination] ?? 100);
  }
  return total;
}

export const __equipmentFlowInternals = {
  extractEquipmentSegment,
};
