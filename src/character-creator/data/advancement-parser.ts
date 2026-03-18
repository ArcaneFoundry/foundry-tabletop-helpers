/**
 * Character Creator — Advancement Parser
 *
 * Parses dnd5e 5.x `system.advancement` arrays from compendium documents
 * to extract grants for backgrounds, class skills, and species traits.
 *
 * Advancement data lives on compendium items (backgrounds, classes, species)
 * and describes what they grant during character creation: ability score
 * improvements, skill/tool/language proficiencies, feat grants, etc.
 */

import type { FoundryDocument } from "../../types";
import { fromUuid } from "../../types";
import type { BackgroundGrants, SpeciesItemChoiceGroup } from "../character-creator-types";
import { ABILITY_KEYS, SKILLS } from "./dnd5e-constants";

/* ── Internal Types ─────────────────────────────────────── */

/** Shape of a single advancement entry in `system.advancement`. */
interface AdvancementEntry {
  type?: string;
  title?: string;
  configuration?: Record<string, unknown>;
}

/* ── Helpers ────────────────────────────────────────────── */

/** Safely extract the advancement array from a Foundry document. */
function getAdvancementArray(doc: FoundryDocument): AdvancementEntry[] {
  const system = doc.system;
  if (!system) return [];
  const adv = system.advancement;
  if (!Array.isArray(adv)) return [];
  return adv as AdvancementEntry[];
}

/** Find an advancement entry by type and optional title substring match. */
function findAdvancement(
  entries: AdvancementEntry[],
  type: string,
  titleContains?: string,
): AdvancementEntry | undefined {
  return entries.find((e) => {
    if (e.type !== type) return false;
    if (titleContains && !(e.title ?? "").toLowerCase().includes(titleContains.toLowerCase())) {
      return false;
    }
    return true;
  });
}

/**
 * Parse a trait grant key into a usable identifier.
 * - `"skills:ins"` -> `"ins"`
 * - `"tool:art:calligrapher"` -> `"art:calligrapher"`
 * - `"languages:standard:common"` -> `"common"`
 * - `"languages:standard:*"` -> `"languages:standard:*"` (kept as-is for pool matching)
 */
function parseGrantKey(key: string): string {
  if (typeof key !== "string") return "";
  if (key.startsWith("skills:")) return key.slice("skills:".length);
  if (key.startsWith("tool:")) return key.slice("tool:".length);
  if (key.startsWith("languages:")) {
    // e.g., "languages:standard:common" -> "common"
    // But for wildcard pools like "languages:standard:*", keep as-is
    const parts = key.split(":");
    const last = parts[parts.length - 1] ?? "";
    if (last === "*") return key; // preserve pool wildcard
    return last;
  }
  return key;
}

/** All 18 skill abbreviation keys. */
const ALL_SKILL_KEYS = Object.keys(SKILLS);

/* ── Background Grants ──────────────────────────────────── */

/**
 * Parse a background document's advancement data into typed grants.
 *
 * Extracts ASI configuration, skill/tool proficiencies, origin feat,
 * and language grants/choices from the `system.advancement` array.
 */
export async function parseBackgroundGrants(doc: FoundryDocument): Promise<BackgroundGrants> {
  const advancements = getAdvancementArray(doc);

  // Defaults for a fully empty/missing advancement array
  const result: BackgroundGrants = {
    skillProficiencies: [],
    toolProficiency: null,
    originFeatUuid: null,
    originFeatName: null,
    originFeatImg: null,
    asiPoints: 0,
    asiCap: 0,
    asiSuggested: [],
    languageGrants: [],
    languageChoiceCount: 0,
    languageChoicePool: [],
  };

  // --- Ability Score Improvement ---
  const asi = findAdvancement(advancements, "AbilityScoreImprovement");
  if (asi?.configuration) {
    const config = asi.configuration;
    result.asiPoints = typeof config.points === "number" ? config.points : 0;
    result.asiCap = typeof config.cap === "number" ? config.cap : 0;

    // `locked` contains abilities NOT suggested — invert to get suggested
    const locked = Array.isArray(config.locked) ? (config.locked as string[]) : [];
    const lockedSet = new Set(locked);
    result.asiSuggested = ABILITY_KEYS.filter((k) => !lockedSet.has(k));
  }

  // --- Skill & Tool Proficiencies ---
  const proficiencies = findAdvancement(advancements, "Trait", "proficiencies");
  if (proficiencies?.configuration) {
    const grants = Array.isArray(proficiencies.configuration.grants)
      ? (proficiencies.configuration.grants as string[])
      : [];

    for (const grant of grants) {
      if (typeof grant !== "string") continue;
      if (grant.startsWith("skills:")) {
        result.skillProficiencies.push(parseGrantKey(grant));
      } else if (grant.startsWith("tool:")) {
        result.toolProficiency = parseGrantKey(grant);
      }
    }
  }

  // --- Origin Feat (ItemGrant) ---
  const featGrant = findAdvancement(advancements, "ItemGrant", "feat");
  if (featGrant?.configuration) {
    const items = Array.isArray(featGrant.configuration.items)
      ? (featGrant.configuration.items as Array<Record<string, unknown>>)
      : [];
    const first = items[0];
    if (first && typeof first.uuid === "string") {
      result.originFeatUuid = first.uuid;
      // Attempt to resolve name/img from the compendium
      try {
        const featDoc = await fromUuid(first.uuid);
        if (featDoc) {
          result.originFeatName = featDoc.name ?? null;
          result.originFeatImg = featDoc.img ?? null;
        }
      } catch {
        // fromUuid may fail in non-Foundry environments; leave name/img null
      }
    }
  }

  // --- Languages ---
  const languages = findAdvancement(advancements, "Trait", "language");
  if (languages?.configuration) {
    const grants = Array.isArray(languages.configuration.grants)
      ? (languages.configuration.grants as string[])
      : [];

    for (const grant of grants) {
      if (typeof grant !== "string") continue;
      const parsed = parseGrantKey(grant);
      if (parsed && !parsed.includes("*")) {
        result.languageGrants.push(parsed);
      }
    }

    const choices = Array.isArray(languages.configuration.choices)
      ? (languages.configuration.choices as Array<Record<string, unknown>>)
      : [];
    const firstChoice = choices[0];
    if (firstChoice) {
      result.languageChoiceCount = typeof firstChoice.count === "number" ? firstChoice.count : 0;
      result.languageChoicePool = Array.isArray(firstChoice.pool)
        ? (firstChoice.pool as string[])
        : [];
    }
  }

  return result;
}

/* ── Class Skill Advancement ────────────────────────────── */

/**
 * Parse a class document's skill proficiency advancement.
 *
 * Returns the pool of choosable skills and how many to pick.
 * Falls back to all skills / 2 choices if the advancement is missing.
 */
export function parseClassSkillAdvancement(
  doc: FoundryDocument,
): { skillPool: string[]; skillCount: number } {
  const advancements = getAdvancementArray(doc);
  const fallback = { skillPool: ALL_SKILL_KEYS, skillCount: 2 };

  const skillAdv = advancements.find((e) => {
    if (e.type !== "Trait") return false;
    if (e.title !== "Skill Proficiencies") return false;
    const mode = e.configuration?.mode;
    return mode === "default" || mode === undefined;
  });

  if (!skillAdv?.configuration) return fallback;

  const choices = Array.isArray(skillAdv.configuration.choices)
    ? (skillAdv.configuration.choices as Array<Record<string, unknown>>)
    : [];
  const firstChoice = choices[0];
  if (!firstChoice) return fallback;

  const count = typeof firstChoice.count === "number" ? firstChoice.count : 2;
  const pool = Array.isArray(firstChoice.pool) ? (firstChoice.pool as string[]) : [];

  // Convert pool entries: "skills:ath" -> "ath", "skills:*" -> all skill keys
  const skillPool: string[] = [];
  for (const entry of pool) {
    if (typeof entry !== "string") continue;
    if (entry === "skills:*") {
      return { skillPool: ALL_SKILL_KEYS, skillCount: count };
    }
    const key = parseGrantKey(entry);
    if (key) skillPool.push(key);
  }

  if (skillPool.length === 0) return fallback;
  return { skillPool, skillCount: count };
}

/* ── Class Spellcasting ────────────────────────────────── */

/** Parsed spellcasting configuration from a class document. */
export interface ClassSpellcasting {
  /** Whether this class has spellcasting at all. */
  isSpellcaster: boolean;
  /** Spellcasting ability key (e.g., "int", "wis", "cha"). */
  ability: string;
  /** Spell slot progression: "full", "half", "third", "pact", "artificer", or "". */
  progression: string;
  /** Spellcasting type: "leveled" or "pact". */
  type: string;
}

/**
 * Parse a class document's spellcasting configuration.
 *
 * Checks both `system.spellcasting` (dnd5e data model) and the
 * `Spellcasting` advancement entry for the fullest picture.
 */
export function parseClassSpellcasting(doc: FoundryDocument): ClassSpellcasting {
  const noSpellcasting: ClassSpellcasting = {
    isSpellcaster: false, ability: "", progression: "", type: "",
  };

  // Check system.spellcasting (dnd5e class data model)
  const system = doc.system as Record<string, unknown> | undefined;
  const sc = system?.spellcasting as Record<string, unknown> | undefined;
  if (sc?.progression && sc.progression !== "none") {
    return {
      isSpellcaster: true,
      ability: typeof sc.ability === "string" ? sc.ability : "",
      progression: typeof sc.progression === "string" ? sc.progression : "",
      type: typeof sc.type === "string" ? sc.type : "leveled",
    };
  }

  // Fallback: check advancement array for Spellcasting entry
  const advancements = getAdvancementArray(doc);
  const spellAdv = findAdvancement(advancements, "Spellcasting");
  if (spellAdv?.configuration) {
    const config = spellAdv.configuration;
    const progression = typeof config.progression === "string" ? config.progression : "";
    if (progression && progression !== "none") {
      return {
        isSpellcaster: true,
        ability: typeof config.ability === "string" ? config.ability : "",
        progression,
        type: typeof config.type === "string" ? config.type : "leveled",
      };
    }
  }

  return noSpellcasting;
}

/* ── Species Traits & Languages ─────────────────────────── */

/**
 * Extract display-friendly trait names from a species document.
 *
 * Collects the `title` from all `ItemGrant` advancements,
 * which represent the species' racial traits (e.g., "Darkvision", "Fey Ancestry").
 */
export function parseSpeciesTraits(doc: FoundryDocument): string[] {
  const advancements = getAdvancementArray(doc);
  const traits: string[] = [];

  for (const entry of advancements) {
    if (entry.type === "ItemGrant" && typeof entry.title === "string" && entry.title.length > 0) {
      traits.push(entry.title);
    }
  }

  return traits;
}

/** Parsed language grants from a species document. */
export interface SpeciesLanguageGrants {
  /** Languages auto-granted (e.g., ["common"]). */
  fixed: string[];
  /** Number of additional language choices. */
  choiceCount: number;
  /** Pool of choosable languages (e.g., ["languages:standard:*"]). */
  choicePool: string[];
}

/** Parsed species proficiency grants and choices. */
export interface SpeciesProficiencyGrants {
  fixedSkills: string[];
  skillChoiceCount: number;
  skillChoicePool: string[];
}

/**
 * Parse a species document's language advancement.
 *
 * Species in the 2024 PHB typically grant Common plus one or more
 * additional language choices (e.g., Human: Common + 1 choice).
 */
export function parseSpeciesLanguages(doc: FoundryDocument): SpeciesLanguageGrants {
  const advancements = getAdvancementArray(doc);
  const result: SpeciesLanguageGrants = { fixed: [], choiceCount: 0, choicePool: [] };

  const langAdv = findAdvancement(advancements, "Trait", "language");
  if (!langAdv?.configuration) return result;

  // Fixed language grants
  const grants = Array.isArray(langAdv.configuration.grants)
    ? (langAdv.configuration.grants as string[])
    : [];
  for (const grant of grants) {
    if (typeof grant !== "string") continue;
    const parsed = parseGrantKey(grant);
    if (parsed && !parsed.includes("*")) {
      result.fixed.push(parsed);
    }
  }

  // Language choices
  const choices = Array.isArray(langAdv.configuration.choices)
    ? (langAdv.configuration.choices as Array<Record<string, unknown>>)
    : [];
  const firstChoice = choices[0];
  if (firstChoice) {
    result.choiceCount = typeof firstChoice.count === "number" ? firstChoice.count : 0;
    result.choicePool = Array.isArray(firstChoice.pool)
      ? (firstChoice.pool as string[])
      : [];
  }

  return result;
}

export function parseSpeciesProficiencies(doc: FoundryDocument): SpeciesProficiencyGrants {
  const advancements = getAdvancementArray(doc);
  const result: SpeciesProficiencyGrants = {
    fixedSkills: [],
    skillChoiceCount: 0,
    skillChoicePool: [],
  };

  const proficiencyAdvancements = advancements.filter((entry) =>
    entry.type === "Trait" && (entry.title ?? "").toLowerCase().includes("proficien")
  );

  for (const advancement of proficiencyAdvancements) {
    if (!advancement.configuration) continue;

    const grants = Array.isArray(advancement.configuration.grants)
      ? advancement.configuration.grants as string[]
      : [];
    for (const grant of grants) {
      if (typeof grant !== "string" || !grant.startsWith("skills:")) continue;
      const parsed = parseGrantKey(grant);
      if (parsed) result.fixedSkills.push(parsed);
    }

    const choices = Array.isArray(advancement.configuration.choices)
      ? advancement.configuration.choices as Array<Record<string, unknown>>
      : [];
    for (const choice of choices) {
      const count = typeof choice.count === "number" ? choice.count : 0;
      const pool = Array.isArray(choice.pool) ? choice.pool as string[] : [];
      const skillPool = pool
        .filter((entry) => typeof entry === "string" && entry.startsWith("skills:"))
        .map((entry) => parseGrantKey(entry))
        .filter(Boolean);

      if (skillPool.length > 0) {
        result.skillChoiceCount += count;
        result.skillChoicePool.push(...skillPool);
      }
    }
  }

  result.fixedSkills = [...new Set(result.fixedSkills)];
  result.skillChoicePool = [...new Set(result.skillChoicePool)];
  return result;
}

export async function parseSpeciesItemChoices(doc: FoundryDocument): Promise<SpeciesItemChoiceGroup[]> {
  const advancements = getAdvancementArray(doc);
  const groups: SpeciesItemChoiceGroup[] = [];

  for (const [index, entry] of advancements.entries()) {
    if (entry.type !== "ItemGrant" || !entry.configuration) continue;
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const items = Array.isArray(entry.configuration.items)
      ? entry.configuration.items as Array<Record<string, unknown>>
      : [];
    if (items.length <= 1) continue;

    const configuredCount = typeof entry.configuration.count === "number" && entry.configuration.count > 0
      ? entry.configuration.count
      : typeof entry.configuration.choices === "number" && entry.configuration.choices > 0
        ? entry.configuration.choices
        : 1;
    const count = Math.min(configuredCount, items.length);
    const choiceLikeTitle = /spell|cantrip|feat|choice|choose|pick|selection|option/i.test(title);
    const explicitChoice = count < items.length
      || typeof entry.configuration.prompt === "string"
      || typeof entry.configuration.hint === "string"
      || Array.isArray(entry.configuration.pool);
    if (!choiceLikeTitle && !explicitChoice) continue;

    const rawOptions = items
      .filter((item): item is { uuid: string; name?: string } => typeof item.uuid === "string" && item.uuid.length > 0);
    const options: SpeciesItemChoiceGroup["options"] = [];
    for (const item of rawOptions) {
      let name = item.name ?? "";
      if (!name) {
        try {
          const choiceDoc = await fromUuid(item.uuid);
          name = choiceDoc?.name ?? "";
        } catch {
          name = "";
        }
      }

      options.push({
        uuid: item.uuid,
        name: name || item.uuid.split(".").at(-1) || "Choice",
      });
    }
    if (options.length <= 1) continue;

    const baseTitle = title || `Species Choice ${index + 1}`;
    groups.push({
      id: `${baseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
      title: baseTitle,
      count,
      options,
    });
  }

  return groups;
}
