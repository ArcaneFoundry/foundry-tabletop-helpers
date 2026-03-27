/**
 * Character Creator — Step 7: Feats & ASI
 *
 * At ASI levels (4, 8, 12, 16, 19), the player chooses between:
 * - Ability Score Improvement (+2 to one / +1 to two abilities)
 * - A feat from the compendium
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { getPackAnalysisMap, isEntryRelevantForWorkflow } from "../data/pack-analysis";
import { ABILITY_KEYS, ABILITY_LABELS, abilityModifier, formatModifier } from "../data/dnd5e-constants";
import { FeatsStepScreen } from "../react/steps/build/feats-step-screen";

/* ── Constants ───────────────────────────────────────────── */

/** Levels that grant an ASI/feat. */
const ASI_LEVELS = [4, 8, 12, 16, 19];

/* ── Helpers ─────────────────────────────────────────────── */

async function getAvailableFeats(state: WizardState): Promise<CreatorIndexEntry[]> {
  const entries = compendiumIndexer.getIndexedEntries("feat", state.config.packSources);
  const packAnalysisMap = await getPackAnalysisMap();
  return entries.filter((entry) =>
    !state.config.disabledUUIDs.has(entry.uuid)
    && isEntryRelevantForWorkflow(entry, "creator-feat", {
      packAnalysis: packAnalysisMap.get(entry.packId) ?? null,
    }));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createFeatsStep(): WizardStepDefinition {
  return {
    id: "feats",
    label: "Feats & ASI",
    icon: "fa-solid fa-star",
    renderMode: "react",
    reactComponent: FeatsStepScreen,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-feats.hbs`,
    dependencies: ["class", "abilities"],

    isApplicable(state: WizardState): boolean {
      return state.config.startingLevel >= ASI_LEVELS[0];
    },

    isComplete(state: WizardState): boolean {
      const data = state.selections.feats;
      if (!data) return false;
      if (data.choice === "asi") {
        return (data.asiAbilities?.length ?? 0) > 0;
      }
      return !!data.featUuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);

      const data = state.selections.feats;
      const feats = await getAvailableFeats(state);
      const scores = state.selections.abilities?.scores;
      const asiSet = new Set(data?.asiAbilities ?? []);

      // Build ability entries for ASI panel
      const abilities = ABILITY_KEYS.map((key) => {
        const score = scores?.[key] ?? 10;
        const mod = abilityModifier(score);
        return {
          key,
          label: ABILITY_LABELS[key],
          score,
          modifier: formatModifier(mod),
          selected: asiSet.has(key),
          atMax: score >= 20,
        };
      });

      return {
        choice: data?.choice ?? "asi",
        isAsi: !data?.choice || data.choice === "asi",
        isFeat: data?.choice === "feat",
        abilities,
        asiCount: data?.asiAbilities?.length ?? 0,
        maxAsiPicks: 2,
        feats: feats.map((e) => ({
          ...e,
          selected: e.uuid === data?.featUuid,
        })),
        selectedFeat: data?.featUuid ? feats.find((e) => e.uuid === data.featUuid) : null,
        hasFeats: feats.length > 0,
        emptyMessage: "No feats available. Check your GM configuration.",
      };
    },
  };
}

export const __featsStepInternals = {
  getAvailableFeats,
};
