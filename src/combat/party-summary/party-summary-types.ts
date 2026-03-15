/**
 * Party Summary — Types & Data Extraction
 *
 * Defines the PartySummaryCard interface and extraction function
 * for reading PC data from Foundry actor documents.
 */

import { type SaveAbility, SAVE_ABILITIES, getHealthTier, DND_CONDITIONS } from "../combat-types";
import type { HealthTier } from "../combat-types";

interface PartySummaryAbilityData {
  save?: number | { value?: number };
  mod?: number;
  proficient?: boolean | number;
  savingThrow?: { proficient?: boolean | number };
}

interface PartySummarySkillData {
  passive?: number;
}

interface PartySummaryClassData {
  name?: string;
  system?: { levels?: number };
}

interface PartySummaryActiveEffect {
  statuses?: Iterable<string> | { has?(statusId: string): boolean };
}

interface PartySummarySystemData {
  attributes?: {
    hp?: { value?: number; max?: number; temp?: number };
    ac?: { value?: number };
    movement?: { walk?: number };
    spelldc?: number;
  };
  abilities?: Partial<Record<SaveAbility, PartySummaryAbilityData>>;
  skills?: {
    prc?: PartySummarySkillData;
    inv?: PartySummarySkillData;
    ins?: PartySummarySkillData;
  };
  details?: { level?: number };
}

export interface PartySummaryActorLike {
  id?: string;
  name?: string;
  img?: string;
  system?: PartySummarySystemData;
  classes?: Record<string, PartySummaryClassData> | null;
  effects?: Iterable<PartySummaryActiveEffect>;
}

/* ── Card Data ────────────────────────────────────────────── */

export interface SaveInfo {
  ability: SaveAbility;
  label: string;
  modifier: string;    // "+3", "-1"
  modValue: number;
  proficient: boolean;
}

export interface ConditionInfo {
  id: string;
  label: string;
}

export interface PartySummaryCard {
  actorId: string;
  name: string;
  portraitUrl: string;
  classLabel: string;     // "Wizard 7" or "Fighter 5 / Cleric 3"
  level: number;

  // Core
  ac: number;
  hpValue: number;
  hpMax: number;
  hpTemp: number;
  hpPercent: number;
  healthTier: HealthTier;

  // Movement
  speed: number;

  // Saves
  saves: SaveInfo[];

  // Passives
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight: number;

  // Spellcasting
  spellDC: number | null;

  // Status
  isConcentrating: boolean;
  conditions: ConditionInfo[];
}

/* ── Ability Labels ───────────────────────────────────────── */

const ABILITY_LABELS: Record<SaveAbility, string> = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA",
};

/* ── Extraction ───────────────────────────────────────────── */

/**
 * Extract card data from a Foundry actor document.
 * Expects a dnd5e character actor.
 */
export function extractCardData(actor: PartySummaryActorLike): PartySummaryCard {
  const system = actor.system ?? {};
  const attrs = system.attributes ?? {};
  const hp = attrs.hp ?? {};

  const hpValue = typeof hp.value === "number" ? hp.value : 0;
  const hpMax = typeof hp.max === "number" ? hp.max : 1;
  const hpTemp = typeof hp.temp === "number" ? hp.temp : 0;
  const hpPercent = hpMax > 0 ? Math.round((hpValue / hpMax) * 100) : 0;

  // AC
  const ac = typeof attrs.ac?.value === "number" ? attrs.ac.value : 10;

  // Speed
  const speed = typeof attrs.movement?.walk === "number" ? attrs.movement.walk : 30;

  // Saves
  const abilities = system.abilities ?? {};
  const saves: SaveInfo[] = SAVE_ABILITIES.map((ability) => {
    const abilityData = abilities[ability] ?? {};
    let modValue = 0;
    if (typeof abilityData.save === "number") {
      modValue = abilityData.save;
    } else if (typeof abilityData.save?.value === "number") {
      modValue = abilityData.save.value;
    } else if (typeof abilityData.mod === "number") {
      modValue = abilityData.mod;
    }
    const proficient = !!abilityData.proficient || !!abilityData.savingThrow?.proficient;

    return {
      ability,
      label: ABILITY_LABELS[ability],
      modifier: modValue >= 0 ? `+${modValue}` : `${modValue}`,
      modValue,
      proficient,
    };
  });

  // Passives
  const skills = system.skills ?? {};
  const passivePerception = typeof skills.prc?.passive === "number" ? skills.prc.passive : 10;
  const passiveInvestigation = typeof skills.inv?.passive === "number" ? skills.inv.passive : 10;
  const passiveInsight = typeof skills.ins?.passive === "number" ? skills.ins.passive : 10;

  // Spell DC
  const spellDC = typeof attrs.spelldc === "number" && attrs.spelldc > 0
    ? attrs.spelldc
    : null;

  // Class label
  const classLabel = buildClassLabel(actor, system);

  // Level
  const level = typeof system.details?.level === "number" ? system.details.level : 0;

  // Concentration & conditions
  const isConcentrating = actorHasStatus(actor, "concentrating");
  const conditions = extractConditions(actor);

  return {
    actorId: actor.id ?? "",
    name: actor.name ?? "Unknown",
    portraitUrl: actor.img ?? "",
    classLabel,
    level,
    ac,
    hpValue,
    hpMax,
    hpTemp,
    hpPercent,
    healthTier: getHealthTier(hpPercent),
    speed,
    saves,
    passivePerception,
    passiveInvestigation,
    passiveInsight,
    spellDC,
    isConcentrating,
    conditions,
  };
}

/* ── Helpers ──────────────────────────────────────────────── */

function buildClassLabel(actor: PartySummaryActorLike, system: PartySummarySystemData): string {
  // dnd5e 5.x: actor.classes is a Record<string, Item5e>
  if (actor.classes && typeof actor.classes === "object") {
    const entries = Object.values(actor.classes);
    if (entries.length > 0) {
      return entries
        .map((cls) => `${cls.name ?? "?"} ${cls.system?.levels ?? "?"}`)
        .join(" / ");
    }
  }

  // Fallback: just level
  const level = typeof system.details?.level === "number" ? system.details.level : 0;
  return `Level ${level}`;
}

function actorHasStatus(actor: PartySummaryActorLike, statusId: string): boolean {
  if (!actor.effects) return false;
  for (const effect of actor.effects) {
    const statuses = getStatuses(effect);
    if (statuses.has(statusId)) return true;
    for (const effectStatus of statuses) {
      if (effectStatus === statusId) return true;
    }
  }
  return false;
}

/** Known condition IDs for quick lookup */
const CONDITION_IDS = new Set(DND_CONDITIONS.map((c) => c.id));
const CONDITION_LABEL_MAP = new Map(DND_CONDITIONS.map((c) => [c.id, c.label]));

function extractConditions(actor: PartySummaryActorLike): ConditionInfo[] {
  if (!actor.effects) return [];
  const conditions: ConditionInfo[] = [];
  const seen = new Set<string>();

  for (const effect of actor.effects) {
    for (const statusId of getStatuses(effect)) {
      if (statusId === "concentrating") continue; // shown separately
      if (seen.has(statusId)) continue;
      seen.add(statusId);

      if (CONDITION_IDS.has(statusId)) {
        conditions.push({ id: statusId, label: CONDITION_LABEL_MAP.get(statusId) ?? statusId });
      }
    }
  }

  return conditions;
}

function getStatuses(effect: PartySummaryActiveEffect): Set<string> {
  const statuses = effect.statuses;
  if (!statuses) return new Set();
  if (Symbol.iterator in Object(statuses)) return new Set(statuses as Iterable<string>);
  return new Set();
}
