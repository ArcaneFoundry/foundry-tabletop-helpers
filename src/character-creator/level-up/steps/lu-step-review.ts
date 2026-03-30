/**
 * Level-Up — Step 7: Review
 *
 * Named summary of level-up changes with jump-back actions.
 */

import { MOD } from "../../../logger";
import type { FoundryDocument } from "../../../types";
import type { AbilityKey } from "../../character-creator-types";
import { compendiumIndexer } from "../../data/compendium-indexer";
import { ABILITY_LABELS } from "../../data/dnd5e-constants";
import type { LevelUpState } from "../level-up-types";
import type { LevelUpStepDef } from "./lu-step-class-choice";

const STEP_LABELS: Record<string, string> = {
  classChoice: "Class",
  hp: "Hit Points",
  features: "Features",
  subclass: "Subclass",
  feats: "ASI / Feat",
  spells: "Spells",
};

function namesForUuids(uuids: string[], namesByUuid: Map<string, string>): string[] {
  return uuids
    .map((uuid) => namesByUuid.get(uuid))
    .filter((name): name is string => typeof name === "string" && name.length > 0);
}

export function createLuReviewStep(): LevelUpStepDef {
  return {
    id: "review",
    label: "Review",
    icon: "fa-solid fa-clipboard-check",
    templatePath: `modules/${MOD}/templates/character-creator/lu-step-review.hbs`,

    isComplete(): boolean {
      return true;
    },

    async buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks({
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: ["dnd5e.spells"],
        items: [],
      });

      const spellEntries = compendiumIndexer.getIndexedEntries("spell", {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: ["dnd5e.spells"],
        items: [],
      });
      const spellNamesByUuid = new Map(spellEntries.map((entry) => [entry.uuid, entry.name]));
      const sel = state.selections;
      const changes: Array<{
        label: string;
        detail: string;
        icon: string;
        stepId: string;
        items: string[];
        hasItems: boolean;
      }> = [];

      if (sel.classChoice) {
        const currentClassLevel = sel.classChoice.mode === "existing"
          ? (state.classItems.find((item) => item.itemId === sel.classChoice?.classItemId)?.levels ?? 0)
          : 0;
        const detail = sel.classChoice.mode === "multiclass"
          ? `Multiclass into ${sel.classChoice.className}`
          : `${sel.classChoice.className} → Class Level ${currentClassLevel + 1}`;
        changes.push({
          label: "Class",
          detail,
          icon: "fa-solid fa-shield-halved",
          stepId: "classChoice",
          items: [],
          hasItems: false,
        });
      }

      if (sel.hp) {
        const method = sel.hp.method === "roll" ? `Rolled ${sel.hp.rollResult}` : "Took average";
        changes.push({
          label: "Hit Points",
          detail: `${method} and gained ${sel.hp.hpGained} HP`,
          icon: "fa-solid fa-heart",
          stepId: "hp",
          items: [],
          hasItems: false,
        });
      }

      if (sel.features && sel.features.featureNames.length > 0) {
        changes.push({
          label: "Features",
          detail: `${sel.features.featureNames.length} feature${sel.features.featureNames.length === 1 ? "" : "s"} accepted`,
          icon: "fa-solid fa-scroll",
          stepId: "features",
          items: sel.features.featureNames,
          hasItems: true,
        });
      }

      if (sel.subclass) {
        changes.push({
          label: "Subclass",
          detail: sel.subclass.name,
          icon: "fa-solid fa-book-sparkles",
          stepId: "subclass",
          items: [],
          hasItems: false,
        });
      }

      if (sel.feats) {
        if (sel.feats.choice === "asi" && sel.feats.asiAbilities) {
          const abilityNames = sel.feats.asiAbilities.map((ability) => ABILITY_LABELS[ability as AbilityKey] ?? ability);
          const bonus = sel.feats.asiAbilities.length === 1 ? "+2" : "+1 each";
          changes.push({
            label: "Ability Score Improvement",
            detail: `${abilityNames.join(", ")} (${bonus})`,
            icon: "fa-solid fa-star",
            stepId: "feats",
            items: abilityNames,
            hasItems: abilityNames.length > 0,
          });
        } else if (sel.feats.choice === "feat") {
          changes.push({
            label: "Feat",
            detail: sel.feats.featName ?? "Selected feat",
            icon: "fa-solid fa-star",
            stepId: "feats",
            items: sel.feats.featName ? [sel.feats.featName] : [],
            hasItems: !!sel.feats.featName,
          });
        }
      }

      if (sel.spells) {
        const newCantrips = namesForUuids(sel.spells.newCantripUuids, spellNamesByUuid);
        const newSpells = namesForUuids(sel.spells.newSpellUuids, spellNamesByUuid);
        const swappedOut = namesForUuids(sel.spells.swappedOutUuids, spellNamesByUuid).map((name) => `Swap out: ${name}`);
        const swappedIn = namesForUuids(sel.spells.swappedInUuids, spellNamesByUuid).map((name) => `Swap in: ${name}`);
        const items = [...newCantrips, ...newSpells, ...swappedOut, ...swappedIn];
        const parts: string[] = [];
        if (newCantrips.length > 0) parts.push(`${newCantrips.length} cantrip${newCantrips.length === 1 ? "" : "s"}`);
        if (newSpells.length > 0) parts.push(`${newSpells.length} spell${newSpells.length === 1 ? "" : "s"}`);
        if (swappedOut.length > 0 || swappedIn.length > 0) {
          parts.push(`${Math.min(swappedOut.length, swappedIn.length)} swap${Math.min(swappedOut.length, swappedIn.length) === 1 ? "" : "s"}`);
        }

        if (parts.length > 0) {
          changes.push({
            label: "Spells",
            detail: parts.join(", "),
            icon: "fa-solid fa-wand-sparkles",
            stepId: "spells",
            items,
            hasItems: items.length > 0,
          });
        }
      }

      const pendingSections = state.applicableSteps
        .filter((stepId) => stepId !== "review")
        .filter((stepId) => (state.stepStatus.get(stepId) ?? "pending") !== "complete")
        .map((stepId) => STEP_LABELS[stepId] ?? stepId);

      return {
        actorName: actor.name ?? "Character",
        currentLevel: state.currentLevel,
        targetLevel: state.targetLevel,
        className: sel.classChoice?.className ?? "",
        changes,
        hasChanges: changes.length > 0,
        pendingSections,
        hasPendingSections: pendingSections.length > 0,
        isReview: true,
      };
    },
  };
}
