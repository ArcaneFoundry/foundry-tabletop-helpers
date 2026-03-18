/**
 * Character Creator — Step: Class (2024 PHB)
 *
 * Card grid of available classes from configured compendium packs.
 * On selection, fetches the full document and parses advancement data
 * to extract skill proficiency pool and count for downstream steps.
 */

import { Log, MOD } from "../../logger";
import type {
  AbilityKey,
  ClassFeatureSummary,
  WizardStepDefinition,
  WizardState,
  ClassSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseClassSkillAdvancement, parseClassSpellcasting } from "../data/advancement-parser";
import { ABILITY_LABELS } from "../data/dnd5e-constants";
import { patchCardSelection } from "./card-select-utils";

interface DatasetElementLike extends Element {
  dataset: DOMStringMap;
}

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableClasses(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("class", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

type ClassDocumentLike = {
  system?: Record<string, unknown>;
};

type ClassRecommendation = {
  primaryAbilities: AbilityKey[];
  hint: string;
  hasWeaponMastery: boolean;
};

const CLASS_RECOMMENDATIONS: Record<string, ClassRecommendation> = {
  barbarian: { primaryAbilities: ["str", "con"], hint: "Strength and Constitution recommended.", hasWeaponMastery: true },
  bard: { primaryAbilities: ["cha", "dex"], hint: "Charisma recommended, with Dexterity often close behind.", hasWeaponMastery: false },
  cleric: { primaryAbilities: ["wis", "con"], hint: "Wisdom recommended, with Constitution supporting concentration and toughness.", hasWeaponMastery: false },
  druid: { primaryAbilities: ["wis", "con"], hint: "Wisdom recommended, with Constitution supporting concentration and resilience.", hasWeaponMastery: false },
  fighter: { primaryAbilities: ["str", "dex"], hint: "Strength or Dexterity recommended.", hasWeaponMastery: true },
  monk: { primaryAbilities: ["dex", "wis"], hint: "Dexterity and Wisdom recommended.", hasWeaponMastery: true },
  paladin: { primaryAbilities: ["str", "cha"], hint: "Strength and Charisma recommended.", hasWeaponMastery: true },
  ranger: { primaryAbilities: ["dex", "wis"], hint: "Dexterity and Wisdom recommended.", hasWeaponMastery: true },
  rogue: { primaryAbilities: ["dex", "int"], hint: "Dexterity recommended, with Intelligence or Charisma depending on style.", hasWeaponMastery: true },
  sorcerer: { primaryAbilities: ["cha", "con"], hint: "Charisma recommended, with Constitution helping survivability.", hasWeaponMastery: false },
  warlock: { primaryAbilities: ["cha", "con"], hint: "Charisma recommended, with Constitution helping concentration.", hasWeaponMastery: false },
  wizard: { primaryAbilities: ["int", "con"], hint: "Intelligence recommended, with Constitution helping concentration.", hasWeaponMastery: false },
};

function getClassRecommendation(identifier: string): ClassRecommendation {
  return CLASS_RECOMMENDATIONS[identifier] ?? {
    primaryAbilities: [],
    hint: "Choose abilities that support your class's core features.",
    hasWeaponMastery: false,
  };
}

function getHitDie(doc: ClassDocumentLike | null): string {
  const system = doc?.system;
  const hd = system?.hd as { denomination?: unknown } | undefined;
  const hitDice = system?.hitDice;
  if (typeof hitDice === "string" && hitDice) return hitDice;
  if (typeof hd?.denomination === "string" && hd.denomination) return hd.denomination;
  return "d8";
}

function normalizeTraitValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  if (value instanceof Set) {
    return [...value].filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  return [];
}

function formatTraitLabel(value: string): string {
  return value
    .split(/[-:]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSavingThrowProficiencies(doc: ClassDocumentLike | null): AbilityKey[] {
  const saves = doc?.system?.saves;
  if (Array.isArray(saves)) {
    return saves.filter((entry): entry is AbilityKey =>
      typeof entry === "string" && entry in ABILITY_LABELS
    );
  }

  if (typeof saves === "object" && saves !== null) {
    return Object.entries(saves)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .filter((key): key is AbilityKey => key in ABILITY_LABELS);
  }

  return [];
}

function getTraitSummary(doc: ClassDocumentLike | null, traitKey: "armorProf" | "weaponProf"): string[] {
  const traits = doc?.system?.traits as Record<string, unknown> | undefined;
  const trait = traits?.[traitKey] as { value?: unknown; custom?: unknown } | undefined;
  const values = normalizeTraitValues(trait?.value).map(formatTraitLabel);
  const custom = typeof trait?.custom === "string" && trait.custom.trim().length > 0
    ? trait.custom.split(/[;,]/g).map((part) => part.trim()).filter(Boolean)
    : [];
  return [...new Set([...values, ...custom])];
}

function getFeatureSummary(doc: ClassDocumentLike | null, startingLevel: number): ClassFeatureSummary[] {
  const advancement = Array.isArray(doc?.system?.advancement)
    ? doc?.system?.advancement as Array<Record<string, unknown>>
    : [];

  const features: ClassFeatureSummary[] = [];
  for (const entry of advancement) {
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    if (!title) continue;

    const level = typeof entry.level === "number" ? entry.level : undefined;
    if (level && level > startingLevel) continue;

    if (title.toLowerCase() === "skill proficiencies") continue;

    features.push({ title, level });
  }

  const seen = new Set<string>();
  return features.filter((feature) => {
    const key = `${feature.level ?? 0}:${feature.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getEntryPrimaryAbilityText(entry: CreatorIndexEntry): string {
  const recommendation = getClassRecommendation(entry.identifier ?? "");
  if (recommendation.primaryAbilities.length === 0) return "";
  return recommendation.primaryAbilities
    .map((ability) => ABILITY_LABELS[ability])
    .join(" / ");
}

/* ── Step Definition ─────────────────────────────────────── */

export function createClassStep(): WizardStepDefinition {
  return {
    id: "class",
    label: "Class",
    icon: "fa-solid fa-shield-halved",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return !!state.selections.class?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableClasses(state);
      const selected = state.selections.class;
      const selectedEntry = selected
        ? entries.find((e) => e.uuid === selected.uuid) ?? null
        : null;

      return {
        stepId: "class",
        stepTitle: "Class",
        stepLabel: "",
        stepIcon: "fa-solid fa-shield-halved",
        stepDescription:
          "Select the class that defines your character's abilities and fighting style.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
          primaryAbilityText: getEntryPrimaryAbilityText(e),
          primaryAbilityHint: getClassRecommendation(e.identifier ?? "").hint,
        })),
        selectedEntry: selectedEntry
          ? {
            ...selectedEntry,
            description: await compendiumIndexer.getCachedDescription(selectedEntry.uuid),
            primaryAbilityText: getEntryPrimaryAbilityText(selectedEntry),
            primaryAbilityHint: getClassRecommendation(selectedEntry.identifier ?? "").hint,
          }
          : null,
        hasEntries: entries.length > 0,
        emptyMessage: "No classes available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      getCardElements(el).forEach((card) => {
        card.addEventListener("click", async () => {
          const uuid = card.dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableClasses(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;

          const selection: ClassSelection = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
            identifier: entry.identifier ?? "",
            skillPool: [],
            skillCount: 2,
            isSpellcaster: false,
            spellcastingAbility: "",
            spellcastingProgression: "",
          };

          const recommendation = getClassRecommendation(selection.identifier);
          selection.primaryAbilities = recommendation.primaryAbilities;
          selection.primaryAbilityHint = recommendation.hint;
          selection.hasWeaponMastery = recommendation.hasWeaponMastery;

          // Fetch full document to parse advancement data
          try {
            const doc = await compendiumIndexer.fetchDocument(uuid) as ClassDocumentLike | null;
            if (doc) {
              const { skillPool, skillCount } = parseClassSkillAdvancement(doc as never);
              selection.skillPool = skillPool;
              selection.skillCount = skillCount;

              const sc = parseClassSpellcasting(doc as never);
              selection.isSpellcaster = sc.isSpellcaster;
              selection.spellcastingAbility = sc.ability;
              selection.spellcastingProgression = sc.progression;
              selection.hitDie = getHitDie(doc);
              selection.savingThrowProficiencies = getSavingThrowProficiencies(doc);
              selection.armorProficiencies = getTraitSummary(doc, "armorProf");
              selection.weaponProficiencies = getTraitSummary(doc, "weaponProf");
              selection.classFeatures = getFeatureSummary(doc, state.config.startingLevel);
            }
          } catch (err) {
            Log.warn("Failed to parse class advancement data", err);
          }

          // Patch DOM directly instead of full re-render
          patchCardSelection(el, uuid, entry);
          callbacks.setDataSilent(selection);
        });
      });
    },
  };
}

function getCardElements(root: ParentNode): DatasetElementLike[] {
  return Array.from(root.querySelectorAll("[data-card-uuid]")).filter(isDatasetElementLike);
}

function isDatasetElementLike(value: unknown): value is DatasetElementLike {
  return value instanceof Element && "dataset" in value;
}

export const __classStepInternals = {
  getAvailableClasses,
  getClassRecommendation,
  getHitDie,
  getSavingThrowProficiencies,
  getTraitSummary,
  getFeatureSummary,
};
