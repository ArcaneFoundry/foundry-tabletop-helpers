import { motion } from "motion/react";

import type { CreatorIndexEntry } from "../../../../character-creator-types";
import { buildBackgroundSelectionFromEntry } from "../../../../steps/step-background";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import { SelectionPane } from "../components/origin-pane-primitives";

type BackgroundStepViewModel = {
  entries: Array<CreatorIndexEntry & { selected?: boolean; blurb?: string }>;
  selectedEntry?: (CreatorIndexEntry & { description?: string }) | null;
  emptyMessage?: string;
};

type BackgroundSelectionPaneProps = OriginPaneProps & {
  prefersReducedMotion: boolean;
};

export function BackgroundSelectionPane({ shellContext, state, controller, prefersReducedMotion }: BackgroundSelectionPaneProps) {
  const viewModel = shellContext.stepViewModel as BackgroundStepViewModel | undefined;
  const entries = viewModel?.entries ?? [];
  const selectedUuid = state.selections.background?.uuid ?? null;

  return (
    <SelectionPane
      description="Choose the life your character led before the road called them onward."
      emptyState={
        <div className="rounded-[1.1rem] border border-dashed border-[#e9c176]/30 bg-[rgba(19,17,23,0.72)] px-4 py-5 font-fth-cc-body text-[#d1c4c6]">
          {viewModel?.emptyMessage ?? "No backgrounds available."}
        </div>
      }
      entries={entries}
      eyebrow="Origins"
      getEntryKey={(entry) => entry.uuid}
      prefersReducedMotion={prefersReducedMotion}
      renderEntry={(entry) => {
        const selected = selectedUuid === entry.uuid;
        return (
        <button
          aria-pressed={selected}
          className={cn(
            "group relative overflow-hidden rounded-[1.05rem] border bg-[linear-gradient(180deg,rgba(46,42,48,0.94),rgba(15,15,19,0.98))] p-[0.22rem] text-left shadow-[0_24px_50px_rgba(0,0,0,0.28)] transition duration-200 hover:brightness-[1.03]",
            selected
              ? "border-[#e9c176]/70 shadow-[0_0_0_1px_rgba(233,193,118,0.26),0_0_30px_rgba(233,193,118,0.12),0_24px_50px_rgba(0,0,0,0.32)]"
              : "border-[#e9c176]/16",
          )}
          data-selected={selected ? "true" : "false"}
          onClick={() => {
            void (async () => {
              const selection = await buildBackgroundSelectionFromEntry(entry);
              if (!selection) return;
              state.selections.originFeat = undefined;
              controller.updateCurrentStepData(selection);
            })();
          }}
          type="button"
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-[0.2rem] rounded-[0.78rem] border shadow-[inset_0_1px_0_rgba(255,240,219,0.14)]",
              selected ? "border-[#e9c176]/45" : "border-[#d9b074]/22",
            )}
          />
          <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-6 rounded-full bg-[linear-gradient(180deg,rgba(255,244,216,0.22),rgba(255,244,216,0))]" />
          <div
            className={cn(
              "relative overflow-hidden rounded-[1.06rem] border bg-[#140f16] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.08),inset_0_-16px_24px_rgba(0,0,0,0.26)]",
              selected ? "border-[#d8b578]/70" : "border-[#4f3828]",
            )}
          >
            <div className="overflow-hidden aspect-[0.96]">
              {entry.img ? (
                <img
                  alt={entry.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                  src={entry.img}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#f0d2a6]">
                  <i className="fa-solid fa-scroll text-2xl" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[1.06rem] bg-[linear-gradient(180deg,rgba(255,247,233,0.04)_0%,transparent_22%,rgba(8,7,12,0.02)_42%,rgba(8,7,12,0.82)_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(14,14,18,0))]" />
            <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-4">
              <div>
                <div className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.3em] text-[#e9c176]/78">
                  Background
                </div>
                <div className="mt-1 font-fth-cc-display text-[1.4rem] leading-none text-[#f5ead5] md:text-[1.7rem]">
                  {entry.name}
                </div>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(8,8,12,0.42)] text-[#e9c176] backdrop-blur-sm">
                <i className="fa-solid fa-scroll" aria-hidden="true" />
              </span>
            </div>
            <div className="pointer-events-none absolute inset-x-3 bottom-3">
              <div className="rounded-[1rem] border border-[#efd29a]/36 bg-[linear-gradient(180deg,rgba(22,14,10,0.18),rgba(12,8,7,0.78))] px-3 py-3 shadow-[0_12px_22px_rgba(0,0,0,0.2)] backdrop-blur-[3px]">
                <div className="font-fth-cc-display text-[1rem] uppercase tracking-[0.05em] text-[#f7e5bf] md:text-[1.12rem]">
                  {entry.name}
                </div>
                {entry.blurb ? (
                  <p className="mt-1.5 line-clamp-3 font-fth-cc-body text-[0.84rem] leading-5 text-[#f0dcc1]">
                    {entry.blurb}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[#d5b98a]">
                    {selected ? "Selected Background" : "Choose Background"}
                  </span>
                  <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(214,177,111,0.32),rgba(214,177,111,0))]" />
                </div>
              </div>
            </div>
            {selected ? (
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#f2d48f]/70 bg-[radial-gradient(circle_at_35%_35%,rgba(247,214,145,0.95),rgba(182,120,38,0.92))] text-white shadow-[0_6px_12px_rgba(0,0,0,0.24)]"
                initial={{ opacity: 0, scale: 0.72, y: 6 }}
                transition={{ type: "spring", stiffness: 460, damping: 24, mass: 0.75 }}
              >
                <i className="fa-solid fa-check text-[0.82rem]" aria-hidden="true" />
              </motion.div>
            ) : null}
          </div>
        </button>
        );
      }}
      selectionLabel="Select a Background"
      title="Background"
    />
  );
}
