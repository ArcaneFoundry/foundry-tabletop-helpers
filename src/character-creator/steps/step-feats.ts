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
  FeatSelection,
  StepCallbacks,
  AbilityKey,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { getPackAnalysisMap, isEntryRelevantForWorkflow } from "../data/pack-analysis";
import { ABILITY_KEYS, ABILITY_LABELS, abilityModifier, formatModifier } from "../data/dnd5e-constants";
import { FeatsStepScreen } from "../react/steps/cinematic/creator-cinematic-step-screens";

/* ── Constants ───────────────────────────────────────────── */

/** Levels that grant an ASI/feat. */
const ASI_LEVELS = [4, 8, 12, 16, 19];

interface DatasetElementLike extends Element {
  dataset: DOMStringMap;
}

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

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      // Choice tabs (ASI vs Feat)
      getDatasetElements(el, "[data-feat-choice]").forEach((tab) => {
        tab.addEventListener("click", () => {
          const choice = getFeatChoice(tab.dataset.featChoice);
          if (!choice) return;
          const current = state.selections.feats ?? { choice: "asi" };
          callbacks.setData({ ...current, choice } as FeatSelection);
        });
      });

      // ASI ability toggles — patch selected state in-place
      getDatasetElements(el, "[data-asi-ability]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const ability = getAbilityKey(btn.dataset.asiAbility);
          if (!ability) return;
          const current = state.selections.feats ?? { choice: "asi" };
          const abilities = new Set(current.asiAbilities ?? []);

          if (abilities.has(ability)) {
            abilities.delete(ability);
          } else if (abilities.size < 2) {
            abilities.add(ability);
          }

          const newData = {
            ...current,
            choice: "asi" as const,
            asiAbilities: [...abilities],
          } satisfies FeatSelection;

          callbacks.setData(newData);
        });
      });

      // Feat card selection — patch selected state in-place
      getDatasetElements(el, "[data-card-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = card.dataset.cardUuid;
          if (!uuid) return;
          void (async () => {
            const feats = await getAvailableFeats(state);
            const entry = feats.find((e) => e.uuid === uuid);
            if (!entry) return;

            const newData = {
              choice: "feat" as const,
              featUuid: entry.uuid,
              featName: entry.name,
              featImg: entry.img,
            } satisfies FeatSelection;

            callbacks.setData(newData);
          })();
        });
      });
    },
  };
}

function getDatasetElements(root: ParentNode, selector: string): DatasetElementLike[] {
  return Array.from(root.querySelectorAll(selector)).filter(isDatasetElementLike);
}

function getFeatChoice(value: string | undefined): "asi" | "feat" | null {
  return value === "asi" || value === "feat" ? value : null;
}

function getAbilityKey(value: string | undefined): AbilityKey | null {
  return ABILITY_KEYS.includes(value as AbilityKey) ? value as AbilityKey : null;
}

function isDatasetElementLike(value: unknown): value is DatasetElementLike {
  return value instanceof Element && "dataset" in value;
}

export const __featsStepInternals = {
  getAvailableFeats,
};
