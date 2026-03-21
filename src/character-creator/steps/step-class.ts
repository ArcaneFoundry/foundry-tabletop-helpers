/**
 * Character Creator — Step: Class (2024 PHB)
 *
 * Card grid of available classes from configured compendium packs.
 * On selection, fetches the full document and parses advancement data
 * to extract skill proficiency pool and count for downstream steps.
 */

import { MOD } from "../../logger";
import type {
  StepCallbacks,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { ClassStepScreen } from "../react/steps/class/class-step-screen";
import {
  buildClassSelectionFromEntry,
  buildSelectedClassViewModel,
  formatEquipmentChoicesInHtml,
  getAvailableClasses,
  getClassHeroImage,
  getClassRecommendation,
  getClassStepViewModel,
  getClassSubtitle,
  getFeatureSummary,
  getHitDie,
  getHitPointFeatureLabel,
  getLeadingParagraphText,
  getRawDescription,
  getSavingThrowProficiencies,
  getSubtitleFromDescription,
  getTraitSummary,
  normalizeDescriptionText,
  postprocessDescriptionHtml,
} from "./step-class-model";
import { beginCardSelectionUpdate, isCurrentCardSelectionUpdate, patchCardDetailFromTemplate } from "./card-select-utils";

interface DatasetElementLike extends Element {
  dataset: DOMStringMap;
}

export function createClassStep(): WizardStepDefinition {
  return {
    id: "class",
    label: "Class",
    icon: "fa-solid fa-shield-halved",
    renderMode: "react",
    reactComponent: ClassStepScreen,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-select.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return !!state.selections.class?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      return getClassStepViewModel(state);
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      bindClassDetailInteractions(el);
      getCardElements(el).forEach((card) => {
        card.addEventListener("click", async () => {
          const uuid = card.dataset.cardUuid;
          if (!uuid) return;

          const entries = getAvailableClasses(state);
          const entry = entries.find((candidate) => candidate.uuid === uuid);
          if (!entry) return;

          getClassSelectRoot(el)?.classList.remove("cc-class-select--expanded");
          const requestId = beginCardSelectionUpdate(el, uuid, entry);

          const selection = await buildClassSelectionFromEntry(state, entry);
          const selectedEntry = await buildSelectedClassViewModel(state, entry, selection);

          await patchCardDetailFromTemplate(el, {
            requestId,
            templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-detail.hbs`,
            data: { selectedEntry },
          });
          if (!isCurrentCardSelectionUpdate(el, requestId)) return;

          getClassSelectRoot(el)?.classList.add("cc-class-select--has-selection");
          callbacks.setDataSilent(selection);
        });
      });
    },
  };
}

function bindClassDetailInteractions(root: HTMLElement): void {
  if (root.dataset.classDetailInteractionsBound === "true") return;

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const classSelect = getClassSelectRoot(root);
    if (!classSelect) return;

    if (target.closest("[data-class-detail-close]")) {
      classSelect.classList.remove("cc-class-select--expanded");
      return;
    }

    if (target.closest("[data-class-detail-toggle]")) {
      classSelect.classList.add("cc-class-select--expanded");
    }
  });

  root.dataset.classDetailInteractionsBound = "true";
}

function getClassSelectRoot(root: ParentNode): HTMLElement | null {
  if (typeof HTMLElement !== "undefined" && root instanceof HTMLElement && root.matches(".cc-class-select")) return root;
  if ("querySelector" in root && typeof root.querySelector === "function") {
    return root.querySelector(".cc-class-select");
  }
  return null;
}

function getCardElements(root: ParentNode): DatasetElementLike[] {
  return Array.from(root.querySelectorAll("[data-card-uuid]")).filter(isDatasetElementLike);
}

function isDatasetElementLike(value: unknown): value is DatasetElementLike {
  return value instanceof Element && "dataset" in value;
}

export const __classStepInternals = {
  buildClassSelectionFromEntry,
  getAvailableClasses,
  getClassRecommendation,
  getHitDie,
  getSavingThrowProficiencies,
  getTraitSummary,
  getFeatureSummary,
  getRawDescription,
  getLeadingParagraphText,
  getSubtitleFromDescription,
  getClassSubtitle,
  getClassHeroImage,
  getClassStepViewModel,
  getHitPointFeatureLabel,
  normalizeDescriptionText,
  formatEquipmentChoicesInHtml,
  postprocessDescriptionHtml,
};
