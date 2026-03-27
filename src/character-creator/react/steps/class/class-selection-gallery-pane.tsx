import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "../../../../ui/lib/cn";

type ClassSelectionGalleryPaneProps<TEntry> = {
  entries: TEntry[];
  emptyState: ReactNode;
  getEntryKey: (entry: TEntry) => string;
  prefersReducedMotion: boolean;
  renderEntry: (entry: TEntry) => ReactNode;
};

export function shouldShowClassSelectionGalleryScrollShadow(scrollTop: number): boolean {
  return scrollTop > 0;
}

export function ClassSelectionGalleryPane<TEntry>({
  entries,
  emptyState,
  getEntryKey,
  prefersReducedMotion,
  renderEntry,
}: ClassSelectionGalleryPaneProps<TEntry>) {
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
  const [hasScrollShadow, setHasScrollShadow] = useState(false);

  useEffect(() => {
    setHasScrollShadow(shouldShowClassSelectionGalleryScrollShadow(galleryScrollRef.current?.scrollTop ?? 0));
  }, [entries.length]);

  const handleGalleryScroll = () => {
    setHasScrollShadow(shouldShowClassSelectionGalleryScrollShadow(galleryScrollRef.current?.scrollTop ?? 0));
  };

  if (entries.length === 0) return <>{emptyState}</>;

  return (
    <div className="cc-class-selection-pane flex min-h-0 flex-1 flex-col overflow-hidden pb-2 pt-2">
      <div className="cc-class-selection-pane__intro cc-class-flow-vocations mb-5 flex items-end justify-between gap-4 px-2">
        <div className="cc-class-flow-vocations__copy">
          <div className="cc-class-flow-vocations__eyebrow font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.3em] text-[#e9c176]/78">
            Classes
          </div>
          <div className="cc-class-flow-vocations__body mt-2 font-fth-cc-body text-[1rem] leading-7 text-[#d0cad0]">
            Choose the discipline that will define your first rites of battle, devotion, guile, or arcana.
          </div>
        </div>
        <div className="cc-class-flow-vocations__badge whitespace-nowrap rounded-full border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-2 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.24em] text-[#c6c0cb]">
          Select a Class
        </div>
      </div>

      <div className="cc-class-selection-pane__gallery-shell relative flex min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className={cn(
            "cc-class-selection-pane__gallery-shadow pointer-events-none absolute inset-x-0 top-0 z-20 h-14 transition-opacity duration-200",
            hasScrollShadow ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={galleryScrollRef}
          className="cc-class-selection-pane__gallery-scroll fth-react-scrollbar relative min-h-0 flex-1 overflow-y-auto px-0 pb-1"
          data-scroll-region="class-gallery"
          data-scroll-shadow={hasScrollShadow ? "true" : "false"}
          onScroll={handleGalleryScroll}
        >
          <div className="cc-class-selection-pane__gallery-inner px-2">
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
      </div>
    </div>
  );
}
