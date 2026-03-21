/**
 * Character Creator — Step 2: Background (2024 PHB)
 *
 * Card grid of available backgrounds. On selection, fetches advancement
 * data and stores grants for the next step (Background Grants) to configure.
 */

import { Log, MOD } from "../../logger";
import { renderTemplate } from "../../types";
import type {
  WizardStepDefinition,
  WizardState,
  BackgroundSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseBackgroundGrants } from "../data/advancement-parser";
import {
  beginCardSelectionUpdate,
  isCurrentCardSelectionUpdate,
  patchCardDetailFromTemplate,
} from "./card-select-utils";

interface DatasetElementLike extends Element {
  dataset: DOMStringMap;
}

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableBackgrounds(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("background", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/* ── Step Definition ─────────────────────────────────────── */

export function createBackgroundStep(): WizardStepDefinition {
  return {
    id: "background",
    label: "Character Origins",
    icon: "fa-solid fa-scroll",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-select.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return !!state.selections.background?.uuid;
    },

    getStatusHint(state: WizardState): string {
      return state.selections.background?.uuid ? "" : "Select a background";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);
      const entries = getAvailableBackgrounds(state);
      const selected = state.selections.background;
      const selectedEntry = selected
        ? entries.find((e) => e.uuid === selected.uuid) ?? null
        : null;
      const detailSelectedEntry = selectedEntry
        ? { ...selectedEntry, description: await compendiumIndexer.getCachedDescription(selectedEntry.uuid) }
        : null;

      return {
        stepId: "background",
        stepTitle: "Character Origins:",
        stepLabel: "Background",
        stepIcon: "fa-solid fa-scroll",
        stepDescription: "Select the background that shaped your character before they became an adventurer.",
        emptySelectionPrompt: "Choose the past that forged your instincts, outlook, and place in the world.",
        entries: entries.map((e) => ({
          ...e,
          selected: e.uuid === selected?.uuid,
        })),
        selectedEntry: detailSelectedEntry,
        detailPaneHtml: detailSelectedEntry
          ? await renderBackgroundDetailPane(detailSelectedEntry)
          : "",
        hasEntries: entries.length > 0,
        emptyMessage: "No backgrounds available. Check your GM configuration.",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      getCardElements(el).forEach((card) => {
        card.addEventListener("click", async () => {
          const uuid = card.dataset.cardUuid;
          if (!uuid) return;
          const entries = getAvailableBackgrounds(state);
          const entry = entries.find((e) => e.uuid === uuid);
          if (!entry) return;
          const requestId = beginCardSelectionUpdate(el, uuid, entry);

          try {
            const doc = await compendiumIndexer.fetchDocument(uuid);
            if (!doc) return;
            const grants = await parseBackgroundGrants(doc);

            const selection: BackgroundSelection = {
              uuid: entry.uuid,
              name: entry.name,
              img: entry.img,
              grants,
              asi: { assignments: {} },
              languages: {
                fixed: grants.languageGrants,
                chosen: [],
              },
            };

            const selectedEntry = {
              ...entry,
              description: await compendiumIndexer.getCachedDescription(uuid),
            };
            await patchCardDetailFromTemplate(el, {
              requestId,
              templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-detail-pane.hbs`,
              data: { selectedEntry },
            });
            if (!isCurrentCardSelectionUpdate(el, requestId)) return;
            callbacks.setDataSilent(selection);
          } catch (err) {
            Log.warn("Failed to parse background grants", err);
          }
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

export const __backgroundStepInternals = {
  getAvailableBackgrounds,
};

async function renderBackgroundDetailPane(selectedEntry: Record<string, unknown>): Promise<string> {
  return renderTemplate(
    `modules/${MOD}/templates/character-creator/cc-step-card-detail-pane.hbs`,
    { selectedEntry },
  );
}
