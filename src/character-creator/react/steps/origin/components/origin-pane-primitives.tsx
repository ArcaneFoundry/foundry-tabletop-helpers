import { Fragment, type ReactNode } from "react";
import { motion } from "motion/react";

import type { CreatorIndexEntry, ReactWizardStepProps } from "../../../../character-creator-types";
import { cn } from "../../../../../ui/lib/cn";

export type OriginPaneProps = Pick<ReactWizardStepProps, "controller" | "shellContext" | "state">;

export type OriginGalleryMetaItem = {
  iconClass: string;
  label: string;
  value: string;
};

export function handleOriginGalleryCornerActionClick(
  event: { stopPropagation: () => void },
  onClick: () => void,
): void {
  event.stopPropagation();
  onClick();
}

type SelectionPaneProps<TEntry> = {
  entries: TEntry[];
  emptyState: ReactNode;
  getEntryKey: (entry: TEntry) => string;
  title: string;
  description: string;
  selectionLabel: string;
  prefersReducedMotion: boolean;
  renderEntry: (entry: TEntry) => ReactNode;
  eyebrow?: string;
  introMode?: "full" | "hidden";
};

export function SelectionPane<TEntry>({
  entries,
  emptyState,
  getEntryKey,
  title,
  description,
  selectionLabel,
  prefersReducedMotion,
  renderEntry,
  eyebrow,
  introMode = "full",
}: SelectionPaneProps<TEntry>) {
  if (entries.length === 0) return <>{emptyState}</>;

  return (
    <section className="cc-origin-selection-pane relative isolate flex w-full min-w-0 flex-col rounded-[1.5rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(24,22,28,0.96),rgba(14,14,18,0.99))] pb-2 pt-2 shadow-[inset_0_1px_0_rgba(255,248,233,0.03),0_22px_42px_rgba(0,0,0,0.22)]">
      {introMode === "full" ? (
        <div className="cc-origin-selection-pane__intro relative z-[1] mb-5 flex items-end justify-between gap-4 px-2">
          <div className="min-w-0 max-w-[34rem] flex-1" data-origins-selection-copy="true">
            <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.3em] text-[#e9c176]/78">
              {eyebrow ?? "Origins"}
            </div>
            <div className="mt-2 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em] text-[#f5ead5]">
              {title}
            </div>
            <div className="mt-2 max-w-[34rem] font-fth-cc-body text-[1rem] leading-7 text-[#d0cad0]">
              {description}
            </div>
          </div>
          <div className="inline-flex shrink-0 self-end whitespace-nowrap rounded-full border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-2 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.24em] text-[#c6c0cb]">
            {selectionLabel}
          </div>
        </div>
      ) : null}

      <div className="cc-origin-selection-pane__gallery-shell relative z-[1] w-full min-w-0 rounded-[1.25rem] border border-[#e9c176]/[0.13] shadow-[inset_0_1px_0_rgba(255,243,219,0.03),0_18px_34px_rgba(0,0,0,0.24)]">
        <div className="cc-origin-selection-pane__gallery-inner w-full min-w-0 px-2">
          <motion.div
            animate={prefersReducedMotion ? undefined : "show"}
            className="cc-origin-selection-grid grid w-full justify-center gap-4"
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
    </section>
  );
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center border-b border-[#cfb58f]/55 pb-4 text-center">
      {eyebrow ? (
        <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
          {eyebrow}
        </div>
      ) : null}
      <div className="mt-1 text-center font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em] text-[#4c3524]">
        {title}
      </div>
      {description ? (
        <p className="mx-auto mt-2 max-w-2xl text-center font-fth-cc-body text-[0.97rem] leading-6 text-[#5f4636]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function DetailCard({
  entry,
  fallbackIcon,
  hideEmptyDescription = false,
}: {
  entry: (CreatorIndexEntry & { description?: string }) | null;
  fallbackIcon: string;
  hideEmptyDescription?: boolean;
}) {
  return (
    <section className="rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
      {entry ? (
        <>
          <div className="overflow-hidden rounded-[1rem] border border-[#d4bb96] bg-[#20130e]">
            {entry.img ? (
              <img alt={entry.name} className="aspect-[1.15] w-full object-cover" loading="lazy" src={entry.img} />
            ) : (
              <div className="flex aspect-[1.15] w-full items-center justify-center text-[#f0d2a6]">
                <i className={cn(fallbackIcon, "text-3xl")} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="mt-4 font-fth-cc-body text-[1.1rem] font-semibold text-[#4c3524]">{entry.name}</div>
          <div className="mt-1 font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em] text-[#876145]">{entry.packLabel}</div>
          {entry.description ? (
            <div
              className="prose prose-sm mt-4 max-w-none font-fth-cc-body text-[#5f4636]"
              dangerouslySetInnerHTML={{ __html: entry.description }}
            />
          ) : hideEmptyDescription ? null : (
            <p className="mt-4 font-fth-cc-body text-[0.95rem] leading-6 text-[#6b5040]">
              No description is available in the current compendium data.
            </p>
          )}
        </>
      ) : (
        <EmptySelectionState message="Select a card to inspect its details here." />
      )}
    </section>
  );
}

export function OriginDetailModal({
  entry,
  title,
  fallbackIcon,
  onClose,
  children,
}: {
  entry: (CreatorIndexEntry & { description?: string }) | null;
  title: string;
  fallbackIcon: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" data-origin-detail-modal="true">
      <button
        aria-label={`Close ${title}`}
        className="absolute inset-0 bg-[rgba(8,8,12,0.76)] backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 flex max-h-[min(92vh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.55rem] border border-[#e9c176]/28 bg-[linear-gradient(180deg,rgba(28,24,31,0.98),rgba(12,12,16,0.99))] p-[0.34rem] shadow-[0_30px_70px_rgba(0,0,0,0.42)]"
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(37,32,40,0.98),rgba(16,16,21,0.98))] px-4 py-3">
          <div className="min-w-0">
            <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.24em] text-[#e9c176]/76">
              Gallery Detail
            </div>
            <div className="mt-1 font-fth-cc-display text-[1.2rem] uppercase tracking-[0.08em] text-[#f5ead5]">
              {title}
            </div>
          </div>
          <button
            aria-label={`Close ${title}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] text-[#e9c176] transition hover:border-[#e9c176]/48 hover:bg-[rgba(233,193,118,0.08)]"
            onClick={onClose}
            type="button"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 overflow-y-auto rounded-[1.2rem]">
          <DetailCard entry={entry} fallbackIcon={fallbackIcon} hideEmptyDescription />
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </motion.div>
    </div>
  );
}

export function OriginGalleryCard({
  title,
  eyebrow,
  selected,
  onSelect,
  media,
  fallbackIcon,
  blurb,
  meta,
  tags = [],
  cornerAction,
  prefersReducedMotion,
}: {
  title: string;
  eyebrow: string;
  selected: boolean;
  onSelect: () => void;
  media?: ReactNode;
  fallbackIcon: string;
  blurb?: string;
  meta?: OriginGalleryMetaItem[];
  tags?: string[];
  cornerAction?: {
    iconClass: string;
    label: string;
    onClick: () => void;
  };
  prefersReducedMotion: boolean;
}) {
  const visibleMeta = (meta ?? []).filter((entry) => entry.value.trim().length > 0);
  const visibleTags = tags.filter(Boolean);

  return (
    <motion.article
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-[1.08rem] border bg-[linear-gradient(180deg,rgba(46,42,48,0.94),rgba(15,15,19,0.98))] p-[0.22rem] text-left shadow-[0_24px_50px_rgba(0,0,0,0.28)] transition duration-200 hover:brightness-[1.03]",
        selected
          ? "border-[#e9c176]/70 shadow-[0_0_0_1px_rgba(233,193,118,0.26),0_0_30px_rgba(233,193,118,0.12),0_24px_50px_rgba(0,0,0,0.32)]"
          : "border-[#e9c176]/16",
      )}
      data-origin-gallery-card="true"
      data-selected={selected ? "true" : "false"}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.012, y: -2 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.992 }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-[0.2rem] rounded-[0.82rem] border shadow-[inset_0_1px_0_rgba(255,240,219,0.14)]",
          selected ? "border-[#e9c176]/45" : "border-[#d9b074]/22",
        )}
      />
      <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-6 rounded-full bg-[linear-gradient(180deg,rgba(255,244,216,0.22),rgba(255,244,216,0))]" />
      {cornerAction ? (
        <button
          aria-label={cornerAction.label}
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(8,8,12,0.42)] text-[#e9c176] backdrop-blur-sm transition hover:border-[#e9c176]/48 hover:bg-[rgba(233,193,118,0.12)]"
          onClick={(event) => handleOriginGalleryCornerActionClick(event, cornerAction.onClick)}
          type="button"
        >
          <i className={cornerAction.iconClass} aria-hidden="true" />
        </button>
      ) : null}
      <button
        aria-pressed={selected}
        className="relative block h-full w-full rounded-[0.9rem] text-left"
        onClick={onSelect}
        type="button"
      >
        <div className="relative overflow-hidden rounded-[1.02rem] border border-[#4f3828] bg-[#140f16] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.08),inset_0_-16px_24px_rgba(0,0,0,0.26)]">
          <div className="relative min-h-[20rem] overflow-hidden">
            {media ?? (
              <div className="flex h-full min-h-[20rem] w-full items-center justify-center text-[#f0d2a6]">
                <i className={cn(fallbackIcon, "text-2xl")} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-[1.02rem] bg-[linear-gradient(180deg,rgba(255,247,233,0.04)_0%,transparent_18%,rgba(8,7,12,0.03)_46%,rgba(8,7,12,0.86)_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(14,14,18,0.76),rgba(14,14,18,0))]" />
          <div className="absolute inset-x-4 top-4 z-10 pr-12">
            <div className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.3em] text-[#e9c176]/78">
              {eyebrow}
            </div>
            <div className="mt-1 font-fth-cc-display text-[1.35rem] leading-none text-[#f5ead5] md:text-[1.6rem]">
              {title}
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-3 z-10">
            <div className="rounded-[1rem] border border-[#efd29a]/36 bg-[linear-gradient(180deg,rgba(22,14,10,0.18),rgba(12,8,7,0.82))] px-3 py-3 shadow-[0_12px_22px_rgba(0,0,0,0.2)] backdrop-blur-[4px]">
              {blurb ? (
                <p className="line-clamp-3 font-fth-cc-body text-[0.84rem] leading-5 text-[#f0dcc1]">
                  {blurb}
                </p>
              ) : null}
              {visibleMeta.length > 0 ? (
                <div className={cn("grid gap-2", blurb ? "mt-2.5" : "")}>
                  {visibleMeta.map((entry) => (
                    <div
                      className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2 rounded-[0.8rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-2.5 py-2"
                      key={`${entry.label}-${entry.value}`}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e9c176]/32 bg-[rgba(233,193,118,0.1)] text-[#f7d691]">
                        <i className={entry.iconClass} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-fth-cc-ui text-[0.55rem] uppercase tracking-[0.18em] text-[#d5b98a]">
                          {entry.label}
                        </span>
                        <span className="mt-0.5 block font-fth-cc-body text-[0.8rem] leading-5 text-[#f7e5bf]">
                          {entry.value}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {visibleTags.length > 0 ? (
                <div className={cn("flex flex-wrap gap-1.5", blurb || visibleMeta.length > 0 ? "mt-2.5" : "")}>
                  {visibleTags.map((tag) => (
                    <span
                      className="rounded-full border border-[#efd29a]/45 bg-[rgba(255,252,246,0.08)] px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.16em] text-[#f6deb0]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </button>
      {selected ? (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="pointer-events-none absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#f2d48f]/70 bg-[radial-gradient(circle_at_35%_35%,rgba(247,214,145,0.95),rgba(182,120,38,0.92))] text-white shadow-[0_6px_12px_rgba(0,0,0,0.24)]"
          initial={{ opacity: 0, scale: 0.72, y: 6 }}
          transition={{ type: "spring", stiffness: 460, damping: 24, mass: 0.75 }}
        >
          <i className="fa-solid fa-check text-[0.82rem]" aria-hidden="true" />
        </motion.div>
      ) : null}
    </motion.article>
  );
}

export function HeroPortraitCard({ image, label, iconClass }: { image: string; label: string; iconClass: string }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-[#d4bb96] bg-[#20130e] shadow-[0_14px_24px_rgba(47,29,18,0.12)]">
      {image ? (
        <img alt={label} className="aspect-[1.1] w-full object-cover" loading="lazy" src={image} />
      ) : (
        <div className="flex aspect-[1.1] w-full items-center justify-center text-[#f0d2a6]">
          <i className={cn(iconClass, "text-3xl")} aria-hidden="true" />
        </div>
      )}
      <div className="border-t border-[#d4bb96]/45 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] px-4 py-3 font-fth-cc-body text-[1rem] font-semibold text-[#4c3524]">
        {label}
      </div>
    </div>
  );
}

export function SummaryListCard({
  title,
  iconClass,
  entries,
  emptyLabel,
  removable = false,
  onRemove,
}: {
  title: string;
  iconClass: string;
  entries: Array<{ id: string; label: string }>;
  emptyLabel: string;
  removable?: boolean;
  onRemove?: (entryId: string) => void;
}) {
  return (
    <section className="rounded-[1.2rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] p-4 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
      <div className="flex items-center gap-3 border-b border-[#cfb58f]/55 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d0aa6f]/75 bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b77925)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
          <i className={iconClass} aria-hidden="true" />
        </div>
        <div className="font-fth-cc-body text-[1rem] font-semibold text-[#4c3524]">{title}</div>
      </div>
      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map((entry) => (
            removable && onRemove ? (
              <button
                className="cc-origin-summary-pill cc-origin-summary-pill--interactive"
                key={`${title}-${entry.id}`}
                onClick={() => onRemove(entry.id)}
                type="button"
              >
                <span className="cc-origin-summary-pill__label">{entry.label}</span>
                <span className="cc-origin-summary-pill__remove" aria-hidden="true">
                  <i className="fa-solid fa-xmark text-[0.68rem]" />
                </span>
              </button>
            ) : (
              <span
                className="cc-origin-summary-pill"
                key={`${title}-${entry.id}`}
              >
                {entry.label}
              </span>
            )
          ))}
        </div>
      ) : (
        <div className="mt-3 font-fth-cc-body text-[0.94rem] leading-6 text-[#6b5040]">{emptyLabel}</div>
      )}
    </section>
  );
}

export function EmptySelectionState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-dashed border-[#c7aa80]/65 bg-[rgba(255,250,241,0.7)] px-4 py-5 font-fth-cc-body text-[#6b5040]">
      {message}
    </div>
  );
}

export function CompactMetaChips({ chips, tone = "light" }: { chips: string[]; tone?: "light" | "dark" }) {
  const visible = chips.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visible.map((chip) => (
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.16em]",
            tone === "dark"
              ? "border-[#efd29a]/55 bg-[linear-gradient(180deg,rgba(35,22,15,0.55),rgba(22,14,10,0.86))] text-[#f6deb0]"
              : "border-[#d4bb96] bg-[rgba(255,252,246,0.82)] text-[#7a5a41]",
          )}
          key={chip}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

export function HeaderFlourish({ side }: { side: "left" | "right" }) {
  const containerClasses =
    side === "left"
      ? "mr-2 flex min-w-0 flex-1 items-center justify-end gap-1.5 md:mr-4 md:gap-2"
      : "ml-2 flex min-w-0 flex-1 items-center justify-start gap-1.5 md:ml-4 md:gap-2";
  const lineClasses =
    side === "left"
      ? "bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(214,177,111,0.88),rgba(255,233,188,0.42))]"
      : "bg-[linear-gradient(90deg,rgba(255,233,188,0.42),rgba(214,177,111,0.88),rgba(214,177,111,0))]";

  return (
    <span aria-hidden="true" className={containerClasses}>
      {side === "right" ? <FlourishGem /> : null}
      <span className="relative block h-4 w-full max-w-[4.25rem] md:max-w-[10.5rem]">
        <span className={cn("absolute inset-x-0 top-1/2 h-px -translate-y-1/2", lineClasses)} />
        <span
          className={cn(
            "absolute top-1/2 h-px w-full -translate-y-1/2 opacity-65",
            side === "left"
              ? "left-0 scale-x-[0.72] bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(247,218,160,0.55),rgba(214,177,111,0.2))]"
              : "right-0 scale-x-[0.72] bg-[linear-gradient(90deg,rgba(214,177,111,0.2),rgba(247,218,160,0.55),rgba(214,177,111,0))]",
          )}
        />
        <span
          className={cn(
            "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border border-[#d6b16f]/85 bg-[rgba(214,177,111,0.14)] shadow-[0_0_6px_rgba(242,216,157,0.14)]",
            side === "left" ? "right-1.5 md:right-3" : "left-1.5 md:left-3",
          )}
        />
        <span
          className={cn(
            "absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border border-[#f0d39e]/70 bg-[rgba(255,233,188,0.16)]",
            side === "left" ? "right-0 md:right-0.5" : "left-0 md:left-0.5",
          )}
        />
      </span>
      {side === "left" ? <FlourishGem /> : null}
    </span>
  );
}

export function FlourishGem() {
  return (
    <span className="relative block h-3.5 w-3.5 md:h-4.5 md:w-4.5">
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[0.15rem] border border-[#d6b16f]/85 bg-[linear-gradient(180deg,rgba(121,87,37,0.35),rgba(214,177,111,0.18))] shadow-[0_0_8px_rgba(242,216,157,0.14)] md:h-3.5 md:w-3.5" />
      <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#f4ddb1]/85 md:h-1.5 md:w-1.5" />
    </span>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] px-4 py-4 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
      <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">{label}</div>
      <div className="mt-2 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em] text-[#4c3524]">{value}</div>
    </div>
  );
}

export function SelectionPip({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border transition",
        checked
          ? "border-[#87a36a] bg-[#e2eab7] text-[#42511e]"
          : "border-[#d4bb96] bg-[rgba(255,252,246,0.82)] text-[#7a5a41]",
      )}
    >
      <i className={cn(checked ? "fa-solid fa-check" : "fa-solid fa-plus")} aria-hidden="true" />
    </div>
  );
}
