import { motion, useReducedMotion } from "motion/react";

import type { CreatorIndexEntry, WizardState } from "../../../../character-creator-types";
import { buildSpeciesSelectionFromEntry } from "../../../../steps/step-species";
import { buildEmptySpeciesChoicesState } from "../../../../steps/origin-flow-utils";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
  SelectionPane,
} from "../components/origin-pane-primitives";

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
      prefersReducedMotion={prefersReducedMotion}
      renderEntry={(entry) => {
        const selected = selectedUuid === entry.uuid;
        const traits = (entry.traits ?? []).filter(Boolean).slice(0, 3);
        return (
          <motion.button
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            className={cn(
              "group relative overflow-hidden rounded-[1.08rem] border p-[0.22rem] text-left shadow-[0_18px_34px_rgba(46,30,22,0.28)] transition duration-200 hover:brightness-[1.02] hover:shadow-[0_24px_40px_rgba(46,30,22,0.34)]",
              selected
                ? "border-[#d4b06c] bg-[linear-gradient(180deg,rgba(98,66,46,0.96),rgba(35,23,20,0.99))] shadow-[0_0_0_1px_rgba(212,176,108,0.36),0_0_24px_rgba(212,176,108,0.18),0_24px_42px_rgba(64,37,20,0.42)]"
                : "border-[#6e4b30] bg-[linear-gradient(180deg,rgba(64,43,31,0.96),rgba(23,16,15,0.99))]",
            )}
            aria-pressed={selected}
            data-selected={selected ? "true" : "false"}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            onClick={() => {
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
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            type="button"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.014, y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            <div className="pointer-events-none absolute inset-[0.2rem] rounded-[0.82rem] border border-[#d9b074]/22 shadow-[inset_0_1px_0_rgba(255,240,219,0.12)]" />
            <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-10 rounded-full bg-[linear-gradient(180deg,rgba(255,244,216,0.16),rgba(255,244,216,0))]" />
            <div className="absolute inset-x-1 top-1 z-10 rounded-[0.72rem_0.72rem_0.24rem_0.24rem] border border-[#a27747]/65 bg-[linear-gradient(180deg,#5d3b29_0%,#352016_100%)] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,235,204,0.22),0_4px_10px_rgba(0,0,0,0.18)]">
              <div className="pointer-events-none absolute inset-x-2 top-0 h-px bg-[rgba(255,238,207,0.5)]" />
              <div className="pointer-events-none absolute left-1 top-1 h-3 w-3 rounded-tl-[0.4rem] border-l border-t border-[#e1bc79]/55" />
              <div className="pointer-events-none absolute right-1 top-1 h-3 w-3 rounded-tr-[0.4rem] border-r border-t border-[#e1bc79]/55" />
              <div className="font-fth-cc-display text-center uppercase tracking-[0.05em] text-[#f7e5bf]">
                {entry.name}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-[0.92rem] border border-[#b68f63]/70 bg-[#20130e] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.12)]">
              <div className="overflow-hidden aspect-[0.92] pt-[3.05rem]">
                {entry.img ? (
                  <img
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                    src={entry.img}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#f0d2a6]">
                    <i className="fa-solid fa-dna text-2xl" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,233,0.09)_0%,transparent_16%,transparent_50%,rgba(18,10,8,0.2)_70%,rgba(10,7,6,0.9)_100%)] shadow-[inset_0_0_0_1px_rgba(240,209,153,0.32)]" />
              <div className="pointer-events-none absolute left-2 top-2 h-4 w-4 rounded-tl-[0.5rem] border-l border-t border-[#d0a76c]/75" />
              <div className="pointer-events-none absolute right-2 top-2 h-4 w-4 rounded-tr-[0.5rem] border-r border-t border-[#d0a76c]/75" />
              <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 rounded-bl-[0.5rem] border-b border-l border-[#d0a76c]/75" />
              <div className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 rounded-br-[0.5rem] border-b border-r border-[#d0a76c]/75" />
              <div className="absolute inset-x-3 bottom-3">
                <div className="rounded-[1rem] border border-[#efd29a]/35 bg-[linear-gradient(180deg,rgba(22,14,10,0.18),rgba(12,8,7,0.78))] px-3 py-3 shadow-[0_12px_22px_rgba(0,0,0,0.2)] backdrop-blur-[3px]">
                <div className="font-fth-cc-display text-[1rem] uppercase tracking-[0.05em] text-[#f7e5bf]">
                  {entry.name}
                </div>
                {entry.blurb ? (
                  <p className="mt-1.5 line-clamp-3 font-fth-cc-body text-[0.84rem] leading-5 text-[#f0dcc1]">
                    {entry.blurb}
                  </p>
                ) : (
                  <p className="mt-1.5 font-fth-cc-body text-[0.84rem] leading-5 text-[#f0dcc1]">
                    Compendium details unavailable for this species.
                  </p>
                )}
                {traits.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {traits.map((trait) => (
                      <span
                        className="rounded-full border border-[#efd29a]/55 bg-[linear-gradient(180deg,rgba(35,22,15,0.55),rgba(22,14,10,0.86))] px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.16em] text-[#f6deb0]"
                        key={`${entry.uuid}-${trait}`}
                      >
                        {trait}
                      </span>
                    ))}
                    <span className="rounded-full border border-[#efd29a]/45 bg-[rgba(255,252,246,0.08)] px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.16em] text-[#f6deb0]">
                      Mythic lineage
                    </span>
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[#d5b98a]">
                    {selected ? "Selected Species" : "Choose Species"}
                  </span>
                  <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(214,177,111,0.32),rgba(214,177,111,0))]" />
                </div>
                <CompactMetaChips
                  chips={[
                    selected ? "Selected species" : "Available choice",
                  ]}
                  tone={selected ? "light" : "dark"}
                />
              </div>
              </div>
            </div>
            {selected ? (
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#f2d48f]/70 bg-[radial-gradient(circle_at_35%_35%,rgba(247,214,145,0.95),rgba(182,120,38,0.92))] text-white shadow-[0_6px_12px_rgba(0,0,0,0.24)]"
                initial={{ opacity: 0, scale: 0.72, y: 6 }}
                transition={{ type: "spring", stiffness: 460, damping: 24, mass: 0.75 }}
              >
                <i className="fa-solid fa-check text-[0.8rem]" aria-hidden="true" />
              </motion.div>
            ) : null}
          </motion.button>
        );
      }}
      selectionLabel="Select a Species"
      title="Species"
    />
  );
}
