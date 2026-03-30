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

type DuplicateAwareOriginEntry = Pick<CreatorIndexEntry, "name" | "packLabel"> & {
  blurb?: string;
  traits?: string[];
};

function normalizeOriginDuplicateKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function compactOriginVariantSummary(value: string | null | undefined): string | undefined {
  const normalized = value
    ?.replace(/\s+/g, " ")
    .replace(/^@Embed\[[^\]]+\]\s*/i, "")
    .trim();
  if (!normalized) return undefined;
  if (normalized.length <= 40) return normalized;
  return `${normalized.slice(0, 37).trimEnd()}...`;
}

export function buildOriginDuplicateDisambiguator<TEntry extends DuplicateAwareOriginEntry>(
  entry: TEntry,
  entries: TEntry[],
): string | undefined {
  const duplicateEntries = entries.filter((candidate) => normalizeOriginDuplicateKey(candidate.name) === normalizeOriginDuplicateKey(entry.name));
  if (duplicateEntries.length < 2) return undefined;

  const traitSummary = (entry.traits ?? []).filter(Boolean).slice(0, 2).join(" + ");
  const duplicateTraitSummaries = new Set(
    duplicateEntries
      .map((candidate) => (candidate.traits ?? []).filter(Boolean).slice(0, 2).join(" + "))
      .filter(Boolean),
  );
  if (traitSummary && duplicateTraitSummaries.size > 1) return traitSummary;

  const distinctPackLabels = new Set(duplicateEntries.map((candidate) => candidate.packLabel.trim()).filter(Boolean));
  if (distinctPackLabels.size > 1 && entry.packLabel.trim()) return entry.packLabel.trim();

  return compactOriginVariantSummary(entry.blurb) ?? (entry.packLabel.trim() ? `${entry.packLabel.trim()} entry` : "Alternate entry");
}

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
    <section className="cc-origin-selection-pane cc-theme-panel cc-theme-panel--soft relative isolate flex w-full min-w-0 flex-col rounded-[1.5rem] pb-2 pt-2">
      {introMode === "full" ? (
        <div className="cc-origin-selection-pane__intro relative z-[1] mb-5 flex items-end justify-between gap-4 px-2">
          <div className="min-w-0 max-w-[34rem] flex-1" data-origins-selection-copy="true">
            <div className="cc-theme-kicker font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.3em]">
              {eyebrow ?? "Origins"}
            </div>
            <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em]">
              {title}
            </div>
            <div className="cc-theme-body-muted mt-2 max-w-[34rem] font-fth-cc-body text-[1rem] leading-7">
              {description}
            </div>
          </div>
          <div className="cc-theme-badge--muted inline-flex shrink-0 self-end whitespace-nowrap rounded-full px-4 py-2 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.24em]">
            {selectionLabel}
          </div>
        </div>
      ) : null}

      <div className="cc-origin-selection-pane__gallery-shell cc-theme-panel cc-theme-panel--accent relative z-[1] w-full min-w-0 rounded-[1.25rem] border shadow-[var(--cc-shadow-panel)]">
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
    <div className="mx-auto flex max-w-3xl flex-col items-center border-b border-[color:color-mix(in_srgb,var(--cc-border-accent)_34%,transparent)] pb-4 text-center">
      {eyebrow ? (
        <div className="cc-theme-kicker font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em]">
          {eyebrow}
        </div>
      ) : null}
      <div className="cc-theme-body mt-1 text-center font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em]">
        {title}
      </div>
      {description ? (
        <p className="cc-theme-body-muted mx-auto mt-2 max-w-2xl text-center font-fth-cc-body text-[0.97rem] leading-6">
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
    <section className="cc-theme-panel cc-theme-panel--accent rounded-[1.45rem] border p-4">
      {entry ? (
        <>
          <div className="cc-theme-media-frame overflow-hidden rounded-[1rem] border">
            {entry.img ? (
              <img alt={entry.name} className="aspect-[1.15] w-full object-cover" loading="lazy" src={entry.img} />
            ) : (
              <div className="cc-theme-kicker flex aspect-[1.15] w-full items-center justify-center">
                <i className={cn(fallbackIcon, "text-3xl")} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="cc-theme-body mt-4 font-fth-cc-body text-[1.1rem] font-semibold">{entry.name}</div>
          <div className="cc-theme-kicker mt-1 font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em]">{entry.packLabel}</div>
          {entry.description ? (
            <div
              className="prose prose-sm cc-theme-body mt-4 max-w-none font-fth-cc-body"
              dangerouslySetInnerHTML={{ __html: entry.description }}
            />
          ) : hideEmptyDescription ? null : (
            <p className="cc-theme-body-muted mt-4 font-fth-cc-body text-[0.95rem] leading-6">
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

function CompactDetailCard({
  entry,
  fallbackIcon,
  hideEmptyDescription = false,
  children,
}: {
  entry: (CreatorIndexEntry & { description?: string }) | null;
  fallbackIcon: string;
  hideEmptyDescription?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className="cc-theme-panel cc-theme-panel--accent rounded-[1.2rem] border p-3"
      data-origin-detail-card="true"
    >
      {entry ? (
        <div className="grid gap-3 lg:grid-cols-[5.75rem_minmax(0,1fr)] lg:items-start">
          <div className="cc-theme-media-frame overflow-hidden rounded-[0.9rem] border" data-origin-detail-thumbnail="true">
            {entry.img ? (
              <img alt={entry.name} className="aspect-square w-full object-cover" loading="lazy" src={entry.img} />
            ) : (
              <div className="cc-theme-kicker flex aspect-square w-full items-center justify-center">
                <i className={cn(fallbackIcon, "text-2xl")} aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="cc-theme-body font-fth-cc-body text-[1.02rem] font-semibold">{entry.name}</div>
            <div className="cc-theme-kicker mt-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]">
              {entry.packLabel}
            </div>
            {entry.description ? (
              <div
                className="prose prose-sm cc-theme-body mt-3 max-w-none font-fth-cc-body"
                dangerouslySetInnerHTML={{ __html: entry.description }}
              />
            ) : hideEmptyDescription ? null : (
              <p className="cc-theme-body-muted mt-3 font-fth-cc-body text-[0.92rem] leading-6">
                No description is available in the current compendium data.
              </p>
            )}
          </div>
        </div>
      ) : (
        <EmptySelectionState message="Select a card to inspect its details here." />
      )}

      {children ? <div className="mt-3">{children}</div> : null}
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
        className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--cc-bg-base)_76%,transparent)] backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="cc-theme-panel cc-theme-panel--accent relative z-10 flex max-h-[min(88vh,44rem)] w-full max-w-[42rem] flex-col overflow-hidden rounded-[1.45rem] p-[0.28rem]"
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="cc-theme-header cc-theme-header--hero flex items-center justify-between gap-3 rounded-[1.2rem] border px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="cc-theme-kicker font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.24em]">
              Gallery Detail
            </div>
            <div className="cc-theme-title mt-1 font-fth-cc-display text-[1.08rem] uppercase tracking-[0.08em]">
              {title}
            </div>
          </div>
          <button
            aria-label={`Close ${title}`}
            className="cc-theme-badge--muted inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:brightness-[1.02]"
            onClick={onClose}
            type="button"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2.5 overflow-y-auto rounded-[1.1rem]">
          <CompactDetailCard entry={entry} fallbackIcon={fallbackIcon} hideEmptyDescription />
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </motion.div>
    </div>
  );
}

export function OriginGalleryCard({
  title,
  eyebrow,
  variantLabel,
  sourceLabel,
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
  variantLabel?: string;
  sourceLabel?: string;
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
  const hasFooterContent = Boolean(blurb?.trim()) || visibleMeta.length > 0 || visibleTags.length > 0;
  const showSourceLabel = Boolean(sourceLabel) && sourceLabel !== variantLabel;

  return (
    <motion.article
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      className={cn(
        "cc-theme-card cc-theme-card--raised cc-theme-card--interactive group relative overflow-hidden rounded-[1.08rem] border p-[0.22rem] text-left transition duration-200",
        selected
          ? "cc-theme-card--selected"
          : "cc-theme-card--soft",
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
          "pointer-events-none absolute inset-[0.2rem] rounded-[0.82rem] border shadow-[inset_0_1px_0_color-mix(in_srgb,var(--cc-border-subtle)_24%,transparent)]",
          selected
            ? "border-[color:color-mix(in_srgb,var(--cc-border-accent)_72%,transparent)]"
            : "border-[color:color-mix(in_srgb,var(--cc-border-subtle)_64%,transparent)]",
        )}
      />
      <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-6 rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cc-surface-accent-soft)_28%,transparent),transparent)]" />
      {cornerAction ? (
        <button
          aria-label={cornerAction.label}
          className="cc-theme-badge--muted absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition hover:brightness-[1.02]"
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
        <div className="cc-theme-media-frame relative overflow-hidden rounded-[1.02rem] border">
          <div className="relative min-h-[20rem] overflow-hidden">
            {media ?? (
              <div className="cc-theme-kicker flex h-full min-h-[20rem] w-full items-center justify-center">
                <i className={cn(fallbackIcon, "text-2xl")} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-[1.02rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cc-bg-surface)_8%,transparent)_0%,transparent_18%,color-mix(in_srgb,var(--cc-bg-base)_8%,transparent)_46%,color-mix(in_srgb,var(--cc-bg-base)_84%,transparent)_100%)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--cc-border-subtle)_18%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cc-bg-surface)_14%,transparent),transparent)]" />
          <div className="absolute inset-x-4 top-4 z-10 pr-12">
            <div className="cc-theme-kicker font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.3em]">
              {eyebrow}
            </div>
            <div className="cc-theme-title mt-1 font-fth-cc-display text-[1.35rem] leading-none md:text-[1.6rem]">
              {title}
            </div>
            {variantLabel ? (
              <div
                className="cc-theme-card cc-theme-card--soft mt-2 inline-flex max-w-full items-center rounded-full border px-2.5 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.16em]"
                data-origin-disambiguator="true"
              >
                <span className="truncate">{variantLabel}</span>
              </div>
            ) : null}
            {showSourceLabel ? (
              <div className="cc-theme-badge--muted mt-2 inline-flex max-w-full rounded-full px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.16em]">
                <span className="truncate">{sourceLabel}</span>
              </div>
            ) : null}
          </div>
          {hasFooterContent ? (
            <div className="absolute inset-x-3 bottom-3 z-10">
              <div
                className="cc-theme-panel cc-theme-panel--soft rounded-[1rem] border px-3 py-3 shadow-[var(--cc-shadow-panel)] backdrop-blur-[4px]"
                data-origin-gallery-footer="true"
              >
                {blurb ? (
                  <p className="line-clamp-3 font-fth-cc-body text-[0.84rem] leading-5">
                    {blurb}
                  </p>
                ) : null}
                {visibleMeta.length > 0 ? (
                  <div
                    className={cn(
                      "flex flex-wrap gap-2",
                      blurb ? "mt-2.5" : "",
                    )}
                    data-origin-gallery-meta="true"
                  >
                    {visibleMeta.map((entry) => (
                      <div
                        className="cc-theme-card cc-theme-card--soft inline-flex min-w-0 max-w-full items-center gap-2 rounded-full px-2.5 py-1.5"
                        key={`${entry.label}-${entry.value}`}
                      >
                        <span className="cc-theme-badge inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                          <i className={entry.iconClass} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="cc-theme-kicker block font-fth-cc-ui text-[0.52rem] uppercase tracking-[0.16em]">
                            {entry.label}
                          </span>
                          <span className="cc-theme-body block font-fth-cc-body text-[0.76rem] leading-5">
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
                        className="cc-theme-pill--muted rounded-full border px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.16em]"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </button>
      {selected ? (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="pointer-events-none absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--cc-border-accent)_72%,transparent)] bg-[radial-gradient(circle_at_35%_35%,color-mix(in_srgb,var(--cc-surface-accent-soft)_92%,white_8%),color-mix(in_srgb,var(--cc-action-primary)_88%,var(--cc-accent-bronze)_12%))] text-white shadow-[0_6px_12px_rgba(0,0,0,0.24)]"
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
    <div className="cc-theme-panel cc-theme-panel--accent overflow-hidden rounded-[1.25rem] border shadow-[var(--cc-shadow-panel)]">
      {image ? (
        <img alt={label} className="aspect-[1.1] w-full object-cover" loading="lazy" src={image} />
      ) : (
        <div className="cc-theme-kicker flex aspect-[1.1] w-full items-center justify-center">
          <i className={cn(iconClass, "text-3xl")} aria-hidden="true" />
        </div>
      )}
      <div className="cc-theme-panel cc-theme-panel--soft border-t px-4 py-3 font-fth-cc-body text-[1rem] font-semibold">
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
    <section className="cc-theme-panel cc-theme-panel--soft rounded-[1.2rem] border p-4 shadow-[var(--cc-shadow-panel)]">
      <div className="flex items-center gap-3 border-b border-[color:color-mix(in_srgb,var(--cc-border-subtle)_72%,transparent)] pb-3">
        <div className="cc-theme-badge flex h-10 w-10 items-center justify-center rounded-full">
          <i className={iconClass} aria-hidden="true" />
        </div>
        <div className="cc-theme-body font-fth-cc-body text-[1rem] font-semibold">{title}</div>
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
    <div className="cc-theme-empty rounded-[1.1rem] border border-dashed px-4 py-5 text-center font-fth-cc-body">
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
              ? "cc-theme-pill"
              : "cc-theme-pill--muted",
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
    <div className="cc-theme-panel cc-theme-panel--accent rounded-[1.2rem] border px-4 py-4">
      <div className="cc-theme-kicker font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em]">{label}</div>
      <div className="cc-theme-body mt-2 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em]">{value}</div>
    </div>
  );
}

export function SelectionPip({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border transition",
        checked
          ? "border-[color:color-mix(in_srgb,var(--cc-border-accent)_76%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-surface-accent-soft)_68%,var(--cc-bg-elevated)_32%)] text-[color:var(--cc-text-kicker)]"
          : "border-[color:color-mix(in_srgb,var(--cc-border-subtle)_96%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-bg-elevated)_82%,white_18%)] text-[color:var(--cc-text-ink-700)]",
      )}
    >
      <i className={cn(checked ? "fa-solid fa-check" : "fa-solid fa-plus")} aria-hidden="true" />
    </div>
  );
}
