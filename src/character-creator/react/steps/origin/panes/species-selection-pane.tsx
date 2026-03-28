import { useReducedMotion } from "motion/react";

import type { CreatorIndexEntry, WizardState } from "../../../../character-creator-types";
import { buildSpeciesSelectionFromEntry } from "../../../../steps/step-species";
import { buildEmptySpeciesChoicesState } from "../../../../steps/origin-flow-utils";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import { OriginGalleryCard, SelectionPane } from "../components/origin-pane-primitives";

type SpeciesStepViewModel = {
  entries: Array<CreatorIndexEntry & { selected?: boolean; blurb?: string; traits?: string[] }>;
  emptyMessage?: string;
};

type SpeciesSelectionPaneProps = OriginPaneProps;

export function SpeciesSelectionPane({ shellContext, state, controller }: SpeciesSelectionPaneProps) {
  const viewModel = shellContext.stepViewModel as SpeciesStepViewModel | undefined;
  const entries = viewModel?.entries ?? [];
  const selectedUuid = state.selections.species?.uuid ?? null;
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <SelectionPane
      description="Choose the lineage, ancestry, or folk your adventurer carries into the world."
      emptyState={
        <div className="rounded-[1.1rem] border border-dashed border-[#e9c176]/30 bg-[rgba(19,17,23,0.72)] px-4 py-5 font-fth-cc-body text-[#d1c4c6]">
          {viewModel?.emptyMessage ?? "No species available."}
        </div>
      }
      entries={entries}
      eyebrow="Lineage"
      getEntryKey={(entry) => entry.uuid}
      introMode="hidden"
      prefersReducedMotion={prefersReducedMotion}
      renderEntry={(entry) => {
        const selected = selectedUuid === entry.uuid;
        const traits = (entry.traits ?? []).filter(Boolean).slice(0, 3);
        return (
          <OriginGalleryCard
            blurb={entry.blurb || "Compendium details unavailable for this species."}
            eyebrow="Species"
            fallbackIcon="fa-solid fa-dna"
            media={entry.img ? (
              <img
                alt={entry.name}
                className="h-full w-full min-h-[20rem] object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
                src={entry.img}
              />
            ) : undefined}
            onSelect={() => {
              void (async () => {
                const selection = await buildSpeciesSelectionFromEntry(entry);
                const stagedState = {
                  ...state,
                  selections: {
                    ...state.selections,
                    species: selection,
                  },
                } as WizardState;
                state.selections.speciesChoices = buildEmptySpeciesChoicesState(stagedState);
                controller.updateCurrentStepData(selection);
              })();
            }}
            prefersReducedMotion={prefersReducedMotion}
            selected={selected}
            tags={traits}
            title={entry.name}
          />
        );
      }}
      selectionLabel="Select a Species"
      title="Species"
    />
  );
}
