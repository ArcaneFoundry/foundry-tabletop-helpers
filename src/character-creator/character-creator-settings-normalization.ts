import type { AbilityScoreMethod, EquipmentMethod, HpMethod, PackSourceConfig } from "./character-creator-types";
import { DEFAULT_PACK_SOURCES } from "./data/dnd5e-constants";

const DEFAULT_ABILITY_METHODS: AbilityScoreMethod[] = ["4d6", "pointBuy", "standardArray"];
const VALID_ABILITY_METHODS = new Set<AbilityScoreMethod>(DEFAULT_ABILITY_METHODS);

export interface NormalizedAbilityMethodsResult {
  methods: AbilityScoreMethod[];
  usedFallback: boolean;
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

export function normalizePackSources(raw: unknown): PackSourceConfig {
  const parsed = typeof raw === "object" && raw !== null ? raw as Partial<PackSourceConfig> : {};
  return {
    classes: uniqueStrings(parsed.classes ?? DEFAULT_PACK_SOURCES.classes),
    subclasses: uniqueStrings(parsed.subclasses ?? DEFAULT_PACK_SOURCES.subclasses),
    races: uniqueStrings(parsed.races ?? DEFAULT_PACK_SOURCES.races),
    backgrounds: uniqueStrings(parsed.backgrounds ?? DEFAULT_PACK_SOURCES.backgrounds),
    feats: uniqueStrings(parsed.feats ?? DEFAULT_PACK_SOURCES.feats),
    spells: uniqueStrings(parsed.spells ?? DEFAULT_PACK_SOURCES.spells),
    items: uniqueStrings(parsed.items ?? DEFAULT_PACK_SOURCES.items),
  };
}

export function normalizeAbilityMethods(raw: unknown): NormalizedAbilityMethodsResult {
  const parsed = uniqueStrings(raw)
    .filter((value): value is AbilityScoreMethod => VALID_ABILITY_METHODS.has(value as AbilityScoreMethod));
  if (parsed.length > 0) {
    return { methods: parsed, usedFallback: false };
  }
  return { methods: [...DEFAULT_ABILITY_METHODS], usedFallback: true };
}

export function normalizeStartingLevel(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(20, Math.floor(value)));
}

export function normalizeEquipmentMethod(raw: unknown): EquipmentMethod {
  return raw === "equipment" || raw === "gold" || raw === "both" ? raw : "both";
}

export function normalizeLevel1HpMethod(raw: unknown): HpMethod {
  return raw === "max" || raw === "roll" ? raw : "max";
}

export function normalizeMaxRerolls(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
