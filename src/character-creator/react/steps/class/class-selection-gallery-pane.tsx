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
    <div className="cc-class-selection-pane flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-2 pt-2">
      <div className="cc-class-selection-pane__intro cc-class-flow-vocations mb-5 flex items-end justify-between gap-4 px-2">
        <div className="cc-class-flow-vocations__copy">
          <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.3em] text-[#e9c176]/78">
            Classes
          </div>
          <div className="mt-2 font-fth-cc-body text-[1rem] leading-7 text-[#d0cad0]">
            Choose the discipline that will define your first rites of battle, devotion, guile, or arcana.
          </div>
        </div>
        <div className="cc-class-flow-vocations__badge rounded-full border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-2 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.24em] text-[#c6c0cb]">
          Select a Class
        </div>
      </div>

      <div
        className="cc-class-selection-pane__gallery-scroll fth-react-scrollbar min-h-0 flex-1 overflow-y-auto px-1 pb-1"
        data-scroll-region="class-gallery"
      >
        <motion.div
          animate={prefersReducedMotion ? undefined : "show"}
          className="cc-class-chooser-grid grid gap-4"
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
  );
}
