import { motion } from "motion/react";

import type { CreatorIndexEntry, OriginFeatSelection } from "../../../../character-creator-types";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
  DetailCard,
  EmptySelectionState,
  SectionHeading,
  StatCard,
  SummaryListCard,
} from "../components/origin-pane-primitives";

type OriginFeatViewModel = {
  backgroundName: string;
  className: string;
  allowOriginFeatSwap: boolean;
  defaultOriginFeatName: string | null;
  originFeatName: string | null;
  originFeatImg: string;
  isCustomOriginFeat: boolean;
  selectedOriginFeat?: (CreatorIndexEntry & { description?: string }) | null;
  availableOriginFeats: Array<CreatorIndexEntry & { selected?: boolean }>;
  hasOriginFeats: boolean;
  originFeatEmptyMessage: string;
};

type OriginFeatPaneProps = OriginPaneProps & {
  prefersReducedMotion: boolean;
};

export function OriginFeatPane({ shellContext, state, controller, prefersReducedMotion }: OriginFeatPaneProps) {
  const viewModel = shellContext.stepViewModel as OriginFeatViewModel | undefined;
  if (!viewModel) return null;

  const backgroundFeatUuid = state.selections.background?.grants.originFeatUuid ?? null;
  const selectedUuid = state.selections.originFeat?.uuid ?? backgroundFeatUuid ?? null;

  const selectFeat = (entry: CreatorIndexEntry) => {
    const originFeat: OriginFeatSelection = {
      uuid: entry.uuid,
      name: entry.name,
      img: entry.img,
      isCustom: entry.uuid !== backgroundFeatUuid,
    };
    state.selections.originFeat = originFeat;
    void controller.refresh();
  };

  const revertToBackgroundDefault = () => {
    if (!backgroundFeatUuid) return;
    state.selections.originFeat = {
      uuid: backgroundFeatUuid,
      name: state.selections.background?.grants.originFeatName ?? "Origin Feat",
      img: state.selections.background?.grants.originFeatImg ?? "",
      isCustom: false,
    };
    void controller.refresh();
  };

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.82fr)]">
      <section className="fth-react-scrollbar min-h-0 overflow-y-auto rounded-[1.45rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(22,20,27,0.98),rgba(11,11,15,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,248,233,0.03),0_22px_42px_rgba(0,0,0,0.22)]">
        <SectionHeading
          eyebrow={viewModel.backgroundName}
          title="Origin Feat"
          description="Your background offers a default feat, but you can pivot into a different origin expression if a custom choice creates a stronger identity for the character you want to play."
        />

        <div className="mt-4 rounded-[1.2rem] border border-[#e9c176]/16 bg-[rgba(255,255,255,0.02)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,248,233,0.03)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.24em] text-[#e9c176]/78">
                Default Recommendation
              </div>
              <div className="mt-1 font-fth-cc-body text-[0.98rem] leading-6 text-[#d7d1d9]">
                {viewModel.defaultOriginFeatName
                  ? `${viewModel.backgroundName} recommends ${viewModel.defaultOriginFeatName} as the default origin feat.`
                  : "No default origin feat has been recorded for this background."}
              </div>
            </div>
            <CompactMetaChips
              chips={[
                viewModel.defaultOriginFeatName ? `Default: ${viewModel.defaultOriginFeatName}` : "",
                viewModel.isCustomOriginFeat ? "Custom feat active" : "Using background default",
              ].filter(Boolean)}
              tone="dark"
            />
          </div>
        </div>

        {viewModel.hasOriginFeats ? (
          <div className="mt-4 grid gap-3">
            {viewModel.availableOriginFeats.map((entry) => {
              const selected = entry.uuid === selectedUuid;
              const isBackgroundDefault = entry.uuid === backgroundFeatUuid;
              return (
                <motion.button
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.15rem] border p-3 text-left shadow-[0_14px_24px_rgba(67,43,23,0.12)] transition duration-200",
                    selected
                      ? "border-[#d6bb83] bg-[linear-gradient(180deg,rgba(250,240,215,0.98),rgba(229,206,157,0.94))]"
                      : "border-[#7f6646] bg-[linear-gradient(180deg,rgba(54,42,31,0.98),rgba(23,18,15,0.99))] hover:border-[#cda56c]",
                  )}
                  data-default={isBackgroundDefault ? "true" : "false"}
                  data-selected={selected ? "true" : "false"}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  key={entry.uuid}
                  onClick={() => selectFeat(entry)}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  type="button"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.01, y: -1 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                >
                  <div className="grid grid-cols-[4.9rem_minmax(0,1fr)] gap-3">
                    <div className="aspect-square overflow-hidden rounded-[0.95rem] border border-[#d4bb96]/50 bg-[#20130e]">
                      {entry.img ? (
                        <img alt={entry.name} className="h-full w-full object-cover" loading="lazy" src={entry.img} />
                      ) : (
                        <div className={cn(
                          "flex h-full w-full items-center justify-center",
                          selected ? "text-[#6b4c23]" : "text-[#f0d2a6]",
                        )}>
                          <i className="fa-solid fa-stars text-xl" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className={cn(
                        "font-fth-cc-body text-[1rem] font-semibold",
                        selected ? "text-[#4c3524]" : "text-[#f5ead5]",
                      )}>
                        {entry.name}
                      </div>
                      <p className={cn(
                        "mt-1 font-fth-cc-body text-[0.9rem] leading-5",
                        selected ? "text-[#6b5040]" : "text-[#cabebf]",
                      )}>
                        {selected
                          ? "Currently selected for this character."
                          : isBackgroundDefault
                            ? "Recommended by the chosen background."
                            : "Alternative origin feat option."}
                      </p>
                      <div className="mt-3">
                        <CompactMetaChips
                          chips={[
                            isBackgroundDefault ? "Background default" : "Custom option",
                            selected ? "Selected feat" : "",
                          ].filter(Boolean)}
                          tone={selected ? "light" : "dark"}
                        />
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptySelectionState message={viewModel.originFeatEmptyMessage || "No alternative origin feats are available."} />
          </div>
        )}
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label="Selection Mode" value={viewModel.isCustomOriginFeat ? "Custom" : "Default"} />
        <section className="rounded-[1.2rem] border border-[#e9c176]/16 bg-[linear-gradient(180deg,rgba(29,24,20,0.96),rgba(16,14,13,0.99))] p-4 shadow-[0_14px_26px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
            <div>
              <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#e9c176]/74">
                Feat State
              </div>
              <div className="mt-1 font-fth-cc-body text-[1rem] font-semibold text-[#f6e8cc]">
                {viewModel.originFeatName ?? "No feat selected"}
              </div>
            </div>
            <CompactMetaChips
              chips={[viewModel.isCustomOriginFeat ? "Custom feat" : "Background default"]}
              tone="dark"
            />
          </div>
          <div className="mt-3 grid gap-3">
            <SummaryListCard
              emptyLabel="No default feat recorded."
              entries={viewModel.defaultOriginFeatName ? [{ id: viewModel.defaultOriginFeatName, label: viewModel.defaultOriginFeatName }] : []}
              iconClass="fa-solid fa-scroll"
              title="Background Default"
            />
            <SummaryListCard
              emptyLabel="No feat selected yet."
              entries={viewModel.originFeatName ? [{ id: viewModel.originFeatName, label: viewModel.originFeatName }] : []}
              iconClass="fa-solid fa-stars"
              title="Current Selection"
            />
          </div>
          {viewModel.isCustomOriginFeat && backgroundFeatUuid ? (
            <button
              className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#e9c176]/45 bg-[rgba(233,193,118,0.08)] px-4 py-2.5 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.16em] text-[#f5ddae] transition hover:border-[#e9c176]/75 hover:bg-[rgba(233,193,118,0.14)]"
              onClick={revertToBackgroundDefault}
              type="button"
            >
              Revert To Background Default
            </button>
          ) : null}
        </section>
        <DetailCard entry={viewModel.selectedOriginFeat ?? null} fallbackIcon="fa-solid fa-scroll" />
      </aside>
    </div>
  );
}
