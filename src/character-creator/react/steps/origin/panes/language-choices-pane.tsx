import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { getOriginLanguageLabel } from "../../../../steps/origin-flow-utils";
import { cn } from "../../../../../ui/lib/cn";
import {
  CompactMetaChips,
  EmptySelectionState,
  StatCard,
  SummaryListCard,
  SelectionPip,
} from "../components/origin-pane-primitives";

export type LanguageChoiceOption = {
  id: string;
  label: string;
};

export type LanguageChoicesPaneProps = {
  title: string;
  subtitle: string;
  description: string;
  requiredCount: number;
  selectedIds: string[];
  options: LanguageChoiceOption[];
  emptyMessage: string;
  selectionLabel: string;
  prefersReducedMotion?: boolean;
  selectedSummaryTitle?: string;
  selectedSummaryEmptyLabel?: string;
  statLabel?: string;
  validationMessages?: string[];
  validationTitle?: string;
  onChange: (chosen: string[]) => void;
};

function getRemainingCount(selectedCount: number, requiredCount: number): number {
  return Math.max(0, requiredCount - selectedCount);
}

export function LanguageChoicesPane({
  title,
  subtitle,
  description,
  requiredCount,
  selectedIds,
  options,
  emptyMessage,
  selectionLabel,
  prefersReducedMotion: prefersReducedMotionProp,
  selectedSummaryTitle = "Chosen Languages",
  selectedSummaryEmptyLabel = "No languages selected yet.",
  statLabel = "Selections",
  validationMessages = [],
  validationTitle = "Validation Notes",
  onChange,
}: LanguageChoicesPaneProps) {
  const prefersReducedMotion = prefersReducedMotionProp ?? useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hasScrollShadow, setHasScrollShadow] = useState(false);
  const selectedSet = new Set(selectedIds);
  const remainingCount = getRemainingCount(selectedIds.length, requiredCount);

  useEffect(() => {
    setHasScrollShadow((scrollRef.current?.scrollTop ?? 0) > 0);
  }, [options.length, selectedIds.length]);

  const handleScroll = () => {
    setHasScrollShadow((scrollRef.current?.scrollTop ?? 0) > 0);
  };

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <section className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(23,21,28,0.98),rgba(12,12,16,0.99))] shadow-[inset_0_1px_0_rgba(255,248,233,0.03),0_22px_42px_rgba(0,0,0,0.22)]">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-[linear-gradient(180deg,rgba(7,7,10,0.72),rgba(7,7,10,0.28),rgba(7,7,10,0))] transition-opacity duration-200",
            hasScrollShadow ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={scrollRef}
          className="fth-react-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 py-4"
          data-origins-language-scroll="true"
          data-scroll-shadow={hasScrollShadow ? "true" : "false"}
          onScroll={handleScroll}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e9c176]/[0.16] pb-4">
            <div className="min-w-0 max-w-3xl">
              <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.24em] text-[#e9c176]/78">
                {subtitle}
              </div>
              <div className="mt-2 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em] text-[#f5ead5]">
                {title}
              </div>
              <p className="mt-2 max-w-3xl font-fth-cc-body text-[0.98rem] leading-6 text-[#d0cad0]">
                {description}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-2 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.24em] text-[#c6c0cb]">
                {selectionLabel}
              </div>
              <CompactMetaChips
                chips={[
                  `${selectedIds.length} / ${requiredCount} chosen`,
                  remainingCount > 0 ? `${remainingCount} remaining` : "Requirement met",
                ]}
                tone="dark"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {options.length > 0 ? (
              options.map((option) => {
                const checked = selectedSet.has(option.id);
                const disabled = !checked && selectedSet.size >= requiredCount;
                return (
                  <motion.button
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left shadow-[0_12px_22px_rgba(67,43,23,0.08)] transition duration-200",
                      checked
                        ? "border-[#e9c176]/58 bg-[linear-gradient(180deg,rgba(239,224,184,0.96),rgba(214,184,117,0.92))] text-[#4c3524]"
                        : "border-[#8f7256] bg-[linear-gradient(180deg,rgba(42,31,24,0.98),rgba(22,16,14,0.99))] text-[#f3e3c7] hover:border-[#e9c176]/70 hover:brightness-[1.03]",
                      disabled && !checked && "cursor-not-allowed opacity-60",
                    )}
                    aria-pressed={checked}
                    data-selected={checked ? "true" : "false"}
                    disabled={disabled}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    key={option.id}
                    onClick={() => {
                      const next = new Set(selectedIds);
                      if (next.has(option.id)) next.delete(option.id);
                      else next.add(option.id);
                      onChange([...next]);
                    }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    type="button"
                    whileHover={prefersReducedMotion || disabled ? undefined : { scale: 1.01, y: -1 }}
                    whileTap={prefersReducedMotion || disabled ? undefined : { scale: 0.99 }}
                  >
                    <div className="min-w-0">
                      <div className="font-fth-cc-body text-[1rem] font-semibold">
                        {option.label}
                      </div>
                      <div
                        className={cn(
                          "mt-1 font-fth-cc-ui text-[0.65rem] uppercase tracking-[0.18em]",
                          checked ? "text-[#7b5a3e]" : "text-[#ad9ba7]",
                        )}
                      >
                        {getOriginLanguageLabel(option.id)}
                      </div>
                    </div>
                    <SelectionPip checked={checked} />
                  </motion.button>
                );
              })
            ) : (
              <EmptySelectionState message={emptyMessage} />
            )}
          </div>
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label={statLabel} value={`${selectedIds.length} / ${requiredCount}`} />
        <SummaryListCard
          emptyLabel={selectedSummaryEmptyLabel}
          entries={selectedIds.map((entry) => ({ id: entry, label: getOriginLanguageLabel(entry) }))}
          iconClass="fa-solid fa-language"
          onRemove={(entryId) => {
            onChange(selectedIds.filter((candidate) => candidate !== entryId));
          }}
          title={selectedSummaryTitle}
          removable
        />
        {validationMessages.length > 0 ? (
          <section className="rounded-[1.15rem] border border-[#d6b57a]/55 bg-[linear-gradient(180deg,rgba(255,247,231,0.95),rgba(246,231,198,0.92))] px-4 py-3 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
            <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
              {validationTitle}
            </div>
            <div className="mt-3 grid gap-2">
              {validationMessages.map((message) => (
                <div
                  className="rounded-[0.95rem] border border-[#d6b57a]/35 bg-[rgba(255,255,255,0.42)] px-3 py-2 font-fth-cc-body text-[0.92rem] leading-6 text-[#5e4637]"
                  key={message}
                >
                  {message}
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <section className="rounded-[1.35rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(24,20,18,0.96),rgba(15,13,12,0.99))] p-4 shadow-[0_16px_28px_rgba(0,0,0,0.18)]">
          <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#e9c176]/72">
            Guidance
          </div>
          <p className="mt-3 font-fth-cc-body text-[0.96rem] leading-6 text-[#d0cad0]">
            Choose the languages that best fit the character's story and background. The summary keeps the current
            picks visible so you can remove any choice before moving on.
          </p>
        </section>
      </aside>
    </div>
  );
}
