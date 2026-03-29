import { motion } from "motion/react";

import type { CreatorIndexEntry, OriginFeatSelection } from "../../../../character-creator-types";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
  DetailCard,
  EmptySelectionState,
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
      <section className="cc-theme-shell-inner rounded-[1.45rem] border p-4 shadow-[inset_0_1px_0_color-mix(in_srgb,white_3%,transparent),0_22px_42px_color-mix(in_srgb,var(--cc-bg-base)_22%,transparent)]">
        {viewModel.hasOriginFeats ? (
          <div className="grid gap-3" data-origin-feat-list="true">
            {viewModel.availableOriginFeats.map((entry) => {
              const selected = entry.uuid === selectedUuid;
              const isBackgroundDefault = entry.uuid === backgroundFeatUuid;
              return (
                <motion.button
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.1rem] border p-3 text-left shadow-[0_14px_24px_color-mix(in_srgb,var(--cc-bg-base)_12%,transparent)] transition duration-200",
                    selected
                      ? "cc-theme-card cc-theme-card--interactive cc-theme-card--selected"
                      : "cc-theme-card cc-theme-card--interactive",
                  )}
                  data-default={isBackgroundDefault ? "true" : "false"}
                  data-origin-feat-option="true"
                  data-selected={selected ? "true" : "false"}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  key={entry.uuid}
                  onClick={() => selectFeat(entry)}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  type="button"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.01, y: -1 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                >
                  <div className="grid grid-cols-[4.6rem_minmax(0,1fr)_auto] items-center gap-3">
                    <div className="aspect-square overflow-hidden rounded-[0.95rem] border border-[color:color-mix(in_srgb,var(--cc-border-accent)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-bg-base)_84%,var(--cc-bg-surface)_16%)]">
                      {entry.img ? (
                        <img alt={entry.name} className="h-full w-full object-cover" loading="lazy" src={entry.img} />
                      ) : (
                        <div className={cn(
                          "flex h-full w-full items-center justify-center",
                          selected ? "cc-theme-kicker" : "cc-theme-body-muted",
                        )}>
                          <i className="fa-solid fa-stars text-xl" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-fth-cc-body text-[1rem] font-semibold text-left text-[color:var(--cc-text-primary)]">
                        {entry.name}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <CompactMetaChips
                          chips={[
                            isBackgroundDefault ? "Background default" : "Alternate feat",
                          ].filter(Boolean)}
                          tone={selected ? "light" : "dark"}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.16em]",
                          selected
                            ? "cc-theme-badge"
                            : "cc-theme-badge--muted",
                        )}
                      >
                        {selected ? "Selected" : "Choose"}
                      </span>
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
        <section className="cc-theme-panel cc-theme-panel--accent rounded-[1.2rem] border p-4">
          <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--cc-border-subtle)_80%,transparent)] pb-3">
            <div>
              <div className="cc-theme-kicker font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em]">
                Feat State
              </div>
              <div className="cc-theme-body mt-1 font-fth-cc-body text-[1rem] font-semibold">
                {viewModel.originFeatName ?? "No feat selected"}
              </div>
            </div>
            <CompactMetaChips
              chips={[viewModel.isCustomOriginFeat ? "Custom feat" : "Background default"]}
              tone="dark"
            />
          </div>
          <div className="mt-3 grid gap-2.5">
            <FeatStateRow
              label="Background Default"
              value={viewModel.defaultOriginFeatName ?? "No default feat recorded."}
            />
            <FeatStateRow
              label="Current Selection"
              value={viewModel.originFeatName ?? "No feat selected yet."}
            />
          </div>
          {viewModel.isCustomOriginFeat && backgroundFeatUuid ? (
            <button
              className="cc-theme-badge mt-4 inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.16em] transition hover:brightness-[1.02]"
              onClick={revertToBackgroundDefault}
              type="button"
            >
              Revert To Background Default
            </button>
          ) : null}
        </section>
        <DetailCard entry={viewModel.selectedOriginFeat ?? null} fallbackIcon="fa-solid fa-scroll" hideEmptyDescription />
      </aside>
    </div>
  );
}

function FeatStateRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="cc-theme-card rounded-[0.95rem] border px-3 py-2.5"
      data-origin-feat-state-row="true"
    >
      <div className="cc-theme-kicker font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">
        {label}
      </div>
      <div className="cc-theme-body mt-1 font-fth-cc-body text-[0.95rem] font-semibold">
        {value}
      </div>
    </div>
  );
}
