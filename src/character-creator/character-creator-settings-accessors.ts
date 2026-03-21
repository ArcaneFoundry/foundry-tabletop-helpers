import { MOD } from "../logger";
import { getSetting, setSetting } from "../types";
import type { AbilityScoreMethod, EquipmentMethod, HpMethod, PackSourceConfig } from "./character-creator-types";
import { CC_SETTINGS } from "./character-creator-settings-shared";
import {
  normalizeAbilityMethods,
  normalizeEquipmentMethod,
  normalizeLevel1HpMethod,
  normalizeMaxRerolls,
  normalizePackSources,
  normalizeStartingLevel,
} from "./character-creator-settings-normalization";

export function ccEnabled(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ENABLED) ?? true;
}

export function ccAutoOpen(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.AUTO_OPEN) ?? true;
}

export function ccLevelUpEnabled(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.LEVEL_UP_ENABLED) ?? true;
}

export function getPackSources(): PackSourceConfig {
  const raw = getSetting<string>(MOD, CC_SETTINGS.PACK_SOURCES) ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Partial<PackSourceConfig>;
    return normalizePackSources(parsed);
  } catch {
    return normalizePackSources({});
  }
}

export async function setPackSources(config: PackSourceConfig): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.PACK_SOURCES, JSON.stringify(normalizePackSources(config)));
}

export function getDisabledContentUUIDs(): string[] {
  const raw = getSetting<string>(MOD, CC_SETTINGS.DISABLED_CONTENT) ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setDisabledContentUUIDs(uuids: string[]): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.DISABLED_CONTENT, JSON.stringify(uuids));
}

export function getAllowedAbilityMethods(): AbilityScoreMethod[] {
  const raw = getSetting<string>(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS) ?? '["4d6","pointBuy","standardArray"]';
  try {
    const parsed = JSON.parse(raw);
    return normalizeAbilityMethods(parsed).methods;
  } catch {
    return normalizeAbilityMethods([]).methods;
  }
}

export async function setAllowedAbilityMethods(methods: AbilityScoreMethod[]): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.ALLOWED_ABILITY_METHODS, JSON.stringify(normalizeAbilityMethods(methods).methods));
}

export function getStartingLevel(): number {
  return normalizeStartingLevel(getSetting<number>(MOD, CC_SETTINGS.STARTING_LEVEL));
}

export async function setStartingLevel(level: unknown): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.STARTING_LEVEL, normalizeStartingLevel(level));
}

export function allowMulticlass(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_MULTICLASS) ?? false;
}

export function getEquipmentMethod(): EquipmentMethod {
  return normalizeEquipmentMethod(getSetting<string>(MOD, CC_SETTINGS.EQUIPMENT_METHOD));
}

export async function setEquipmentMethod(method: unknown): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.EQUIPMENT_METHOD, normalizeEquipmentMethod(method));
}

export function getLevel1HpMethod(): HpMethod {
  return normalizeLevel1HpMethod(getSetting<string>(MOD, CC_SETTINGS.LEVEL1_HP_METHOD));
}

export async function setLevel1HpMethod(method: unknown): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.LEVEL1_HP_METHOD, normalizeLevel1HpMethod(method));
}

export function getMaxRerolls(): number {
  return normalizeMaxRerolls(getSetting<number>(MOD, CC_SETTINGS.MAX_REROLLS));
}

export async function setMaxRerolls(count: unknown): Promise<void> {
  await setSetting(MOD, CC_SETTINGS.MAX_REROLLS, normalizeMaxRerolls(count));
}

export function allowCustomBackgrounds(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS) ?? false;
}

export function allowOriginFeatChoice(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_ORIGIN_FEAT_CHOICE) ?? false;
}

export function allowUnrestrictedBackgroundAsi(): boolean {
  return getSetting<boolean>(MOD, CC_SETTINGS.ALLOW_UNRESTRICTED_BACKGROUND_ASI) ?? false;
}
