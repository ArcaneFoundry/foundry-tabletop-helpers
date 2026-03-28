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
    <div className="cc-class-selection-pane relative isolate flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-[#e9c176]/[0.14] pb-2 pt-2 shadow-[inset_0_1px_0_rgba(255,248,233,0.03),0_22px_42px_rgba(0,0,0,0.22)]">
      <div className="cc-class-selection-pane__gallery-shell relative z-[1] flex min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-[1.25rem] border border-[#e9c176]/[0.13] shadow-[inset_0_1px_0_rgba(255,243,219,0.03),0_18px_34px_rgba(0,0,0,0.24)]">
        <div
          aria-hidden="true"
          className={cn(
            "cc-class-selection-pane__gallery-shadow pointer-events-none absolute inset-x-0 top-0 z-20 h-14 transition-opacity duration-200",
            hasScrollShadow ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={galleryScrollRef}
          className="cc-class-selection-pane__gallery-scroll fth-react-scrollbar relative min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-0 pb-1"
          data-scroll-region="class-gallery"
          data-scroll-shadow={hasScrollShadow ? "true" : "false"}
          onScroll={handleGalleryScroll}
        >
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
    </div>
  );
}
