import { motion } from "motion/react";

import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
} from "../components/origin-pane-primitives";

type BackgroundAsiMode = "background" | "class";

type BackgroundAsiViewModel = {
  backgroundName: string;
  backgroundImg: string;
  asiAbilities: Array<{
    key: string;
    label: string;
    backgroundSuggested: boolean;
    classRecommended: boolean;
    emphasized: boolean;
    options: Array<{ value: number; label: string; selected: boolean }>;
  }>;
  asiPointsUsed: number;
  asiPoints: number;
  hasClassRecommendations: boolean;
};

type BackgroundAsiAbility = BackgroundAsiViewModel["asiAbilities"][number];
type BackgroundAsiQuickPickMode = "background" | "class";

type BackgroundAsiPaneProps = OriginPaneProps & {
  prefersReducedMotion: boolean;
};

export function buildBackgroundAsiQuickPickAssignments(
  abilities: BackgroundAsiAbility[],
  points: number,
  mode: BackgroundAsiQuickPickMode,
): Record<string, number> {
  const prioritized = [...abilities].map((ability, index) => ({
    ability,
    index,
    maxValue: Math.max(...ability.options.map((option) => option.value)),
    priority: mode === "background"
      ? [
        ability.backgroundSuggested ? 2 : 0,
        ability.classRecommended ? 1 : 0,
        ability.emphasized ? 1 : 0,
        -index,
      ]
      : [
        ability.classRecommended ? 2 : 0,
        ability.backgroundSuggested ? 1 : 0,
        ability.emphasized ? 1 : 0,
        -index,
      ],
  }))
    .sort((left, right) => {
      for (let i = 0; i < left.priority.length; i += 1) {
        if (left.priority[i] !== right.priority[i]) return right.priority[i] - left.priority[i];
      }
      return left.index - right.index;
    });

  const nextAssignments: Record<string, number> = {};
  let remaining = points;

  for (const item of prioritized) {
    if (remaining <= 0) break;
    if (item.maxValue < 1) continue;
    nextAssignments[item.ability.key] = 1;
    remaining -= 1;
  }

  if (remaining > 0) {
    for (const item of prioritized) {
      if (remaining <= 0) break;
      const currentValue = nextAssignments[item.ability.key] ?? 0;
      const maxValue = item.maxValue;
      if (currentValue >= maxValue) continue;

      const nextValue = Math.min(maxValue, currentValue + remaining);
      nextAssignments[item.ability.key] = nextValue;
      remaining -= nextValue - currentValue;
    }
  }

  return nextAssignments;
}

export function BackgroundAsiPane({ shellContext, state, controller, prefersReducedMotion }: BackgroundAsiPaneProps) {
  const viewModel = shellContext.stepViewModel as BackgroundAsiViewModel | undefined;
  const background = state.selections.background;
  if (!viewModel || !background) return null;

  const totalUsed = Object.values(background.asi.assignments).reduce((sum, value) => sum + (value ?? 0), 0);
  const remainingPoints = Math.max(0, viewModel.asiPoints - totalUsed);

  const applyQuickAssign = (mode: BackgroundAsiMode) => {
    background.asi.assignments = buildBackgroundAsiQuickPickAssignments(viewModel.asiAbilities, viewModel.asiPoints, mode);
    void controller.refresh();
  };

  const applyValue = (abilityKey: string, value: number) => {
    const nextAssignments = { ...background.asi.assignments };
    const currentValue = nextAssignments[abilityKey as keyof typeof nextAssignments] ?? 0;
    const otherTotal = totalUsed - currentValue;
    if (otherTotal + value > background.grants.asiPoints) return;
    if (value === 0) delete nextAssignments[abilityKey as keyof typeof nextAssignments];
    else nextAssignments[abilityKey as keyof typeof nextAssignments] = value;
    background.asi.assignments = nextAssignments;
    void controller.refresh();
  };

  return (
    <section className="cc-theme-shell-inner relative isolate rounded-[1.45rem] border shadow-[0_18px_34px_color-mix(in_srgb,var(--cc-bg-base)_12%,transparent)]">
      <div className="relative z-10 p-3">
        <div className="cc-theme-card flex flex-wrap items-center justify-between gap-3 rounded-[1.08rem] border px-3 py-2">
          <div className="min-w-0">
            <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em]">
              Background Ability Scores
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="cc-theme-badge cc-theme-badge--muted rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.16em] transition hover:brightness-[1.03]"
              disabled={remainingPoints <= 0}
              onClick={() => applyQuickAssign("background")}
              type="button"
            >
              Apply Background Suggestions
            </button>
            {viewModel.hasClassRecommendations ? (
              <button
                className="cc-theme-badge cc-theme-badge--muted rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.16em] transition hover:brightness-[1.03]"
                disabled={remainingPoints <= 0}
                onClick={() => applyQuickAssign("class")}
                type="button"
              >
                Apply Class Synergy
              </button>
            ) : null}
            <CompactMetaChips
              chips={[
                `${totalUsed}/${viewModel.asiPoints} spent`,
                remainingPoints > 0 ? `${remainingPoints} remaining` : "Fully assigned",
              ]}
              tone="dark"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {viewModel.asiAbilities.map((ability) => {
            const currentValue = background.asi.assignments[ability.key as keyof typeof background.asi.assignments] ?? 0;
            const tone = ability.backgroundSuggested || ability.classRecommended || currentValue > 0;

            return (
              <article
                className={cn(
                  "flex h-full flex-col rounded-[1.32rem] border p-4 shadow-[0_16px_28px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]",
                  tone
                    ? "cc-theme-panel cc-theme-panel--accent"
                    : "cc-theme-panel",
                )}
                key={ability.key}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="inline-flex h-12 min-w-12 shrink-0 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_srgb,var(--cc-border-accent)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-surface-accent-soft)_66%,transparent)] px-3 font-fth-cc-display text-[1.1rem] uppercase tracking-[0.08em] text-[color:var(--cc-text-primary)]">
                    {ability.label.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="cc-theme-body font-fth-cc-body text-[1rem] font-semibold">{ability.label}</div>
                    <div className="cc-theme-kicker mt-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em]">
                      Current value {currentValue > 0 ? `+${currentValue}` : "unassigned"}
                    </div>
                    <CompactMetaChips
                      chips={[
                        ability.backgroundSuggested ? "Background-aligned" : "",
                        ability.classRecommended ? "Class synergy" : "",
                        currentValue > 0 ? "Applied" : "",
                      ]}
                      tone="dark"
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-2 min-[420px]:grid-cols-3">
                  {ability.options.map((option) => {
                      const selected = currentValue === option.value;
                      const blockedBySpend =
                        option.value > 0 && totalUsed - currentValue + option.value > viewModel.asiPoints;
                      const disabled = blockedBySpend && !selected;
                      const remainingAfterChoice = viewModel.asiPoints - (totalUsed - currentValue + option.value);

                      return (
                        <motion.button
                          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                          className={cn(
                            "flex min-h-[7rem] flex-col justify-between rounded-[0.95rem] border px-3 py-3 text-left shadow-[0_12px_22px_rgba(0,0,0,0.1)] transition duration-200",
                            selected
                              ? "cc-theme-card cc-theme-card--interactive cc-theme-card--selected text-[color:var(--cc-text-primary)]"
                              : disabled
                                ? "cc-theme-card cursor-not-allowed text-[color:var(--cc-text-secondary)] opacity-70"
                                : "cc-theme-card cc-theme-card--interactive text-[color:var(--cc-text-primary)]",
                          )}
                          data-blocked={disabled ? "true" : "false"}
                          data-selected={selected ? "true" : "false"}
                          disabled={disabled}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                          key={option.label}
                          onClick={() => applyValue(ability.key, option.value)}
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          type="button"
                          whileHover={prefersReducedMotion || disabled ? undefined : { scale: 1.012, y: -1 }}
                          whileTap={prefersReducedMotion || disabled ? undefined : { scale: 0.99 }}
                        >
                          <div>
                            <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em] text-inherit/70">
                              Pick
                            </div>
                            <div className="mt-1 font-fth-cc-display text-[1rem] uppercase tracking-[0.08em]">
                              {option.label}
                            </div>
                          </div>
                          <div className="font-fth-cc-body text-[0.72rem] leading-5 text-inherit/75">
                            {selected
                              ? "Applied"
                              : blockedBySpend
                                ? "Not enough points left"
                                : option.value === 0
                                  ? "Reset this score"
                                  : `${remainingAfterChoice} left after pick`}
                          </div>
                        </motion.button>
                      );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const __backgroundAsiPaneInternals = {
  buildBackgroundAsiQuickPickAssignments,
};
