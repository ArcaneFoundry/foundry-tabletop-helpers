import { Fragment, type ReactNode } from "react";
import { motion } from "motion/react";

type ClassSelectionGalleryPaneProps<TEntry> = {
  entries: TEntry[];
  emptyState: ReactNode;
  getEntryKey: (entry: TEntry) => string;
  prefersReducedMotion: boolean;
  renderEntry: (entry: TEntry) => ReactNode;
};

export function ClassSelectionGalleryPane<TEntry>({
  entries,
  emptyState,
  getEntryKey,
  prefersReducedMotion,
  renderEntry,
}: ClassSelectionGalleryPaneProps<TEntry>) {
  if (entries.length === 0) return <>{emptyState}</>;

  return (
    <div className="cc-class-selection-pane cc-theme-panel cc-theme-panel--soft relative isolate flex w-full min-w-0 flex-col rounded-[1.5rem] border pb-2 pt-2">
      <div className="cc-class-selection-pane__gallery-shell relative z-[1] w-full min-w-0 rounded-[1.25rem] border border-[color:color-mix(in_srgb,var(--cc-border-subtle)_92%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-bg-surface)_68%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_14%,transparent),0_18px_34px_color-mix(in_srgb,var(--cc-bg-base)_14%,transparent)]">
        <div className="cc-class-selection-pane__gallery-inner w-full min-w-0 px-2">
          <motion.div
            animate={prefersReducedMotion ? undefined : "show"}
            className="cc-class-chooser-grid grid w-full justify-center gap-4"
            initial={prefersReducedMotion ? false : "hidden"}
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.045,
                  delayChildren: 0.08,
                },
              },
            }}
          >
            {entries.map((entry) => (
              <Fragment key={getEntryKey(entry)}>
                {renderEntry(entry)}
              </Fragment>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
