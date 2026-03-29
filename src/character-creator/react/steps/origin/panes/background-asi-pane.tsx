import { motion } from "motion/react";

import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
} from "../components/origin-pane-primitives";

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
};

type BackgroundAsiPaneProps = OriginPaneProps & {
  prefersReducedMotion: boolean;
};

export function BackgroundAsiPane({ shellContext, state, controller, prefersReducedMotion }: BackgroundAsiPaneProps) {
  const viewModel = shellContext.stepViewModel as BackgroundAsiViewModel | undefined;
  const background = state.selections.background;
  if (!viewModel || !background) return null;

  const totalUsed = Object.values(background.asi.assignments).reduce((sum, value) => sum + (value ?? 0), 0);
  const remainingPoints = Math.max(0, viewModel.asiPoints - totalUsed);

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
    <section className="relative isolate rounded-[1.45rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(22,19,25,0.98),rgba(12,12,15,0.99))] shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
      <div className="relative z-10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.08rem] border border-[#e9c176]/[0.12] bg-[rgba(255,255,255,0.025)] px-3 py-2">
          <div className="min-w-0">
            <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em] text-[#e9c176]/72">
              Background Ability Scores
            </div>
          </div>
          <CompactMetaChips
            chips={[
              `${totalUsed}/${viewModel.asiPoints} spent`,
              remainingPoints > 0 ? `${remainingPoints} remaining` : "Fully assigned",
            ]}
            tone="dark"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {viewModel.asiAbilities.map((ability) => {
            const currentValue = background.asi.assignments[ability.key as keyof typeof background.asi.assignments] ?? 0;
            const tone = ability.backgroundSuggested || ability.classRecommended || currentValue > 0;

            return (
              <article
                className={cn(
                  "flex h-full flex-col rounded-[1.32rem] border p-4 shadow-[0_16px_28px_rgba(0,0,0,0.18)]",
                  tone
                    ? "border-[#e9c176]/[0.18] bg-[linear-gradient(180deg,rgba(40,31,24,0.98),rgba(20,16,13,0.99))]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(32,27,24,0.94),rgba(18,15,15,0.99))]",
                )}
                key={ability.key}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="inline-flex h-12 min-w-12 shrink-0 items-center justify-center rounded-[0.9rem] border border-[#e9c176]/32 bg-[rgba(233,193,118,0.08)] px-3 font-fth-cc-display text-[1.1rem] uppercase tracking-[0.08em] text-[#f5ead5]">
                    {ability.label.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-fth-cc-body text-[1rem] font-semibold text-[#f5ead5]">{ability.label}</div>
                    <div className="mt-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em] text-[#d5b98a]">
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
                              ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(250,232,186,0.96),rgba(228,202,135,0.92))] text-[#4c3524]"
                              : disabled
                                ? "cursor-not-allowed border-[#6b5b49] bg-[rgba(60,48,39,0.7)] text-[#b9b0ab] opacity-70"
                                : "border-[#8f7256] bg-[linear-gradient(180deg,rgba(64,47,34,0.96),rgba(32,23,18,0.99))] text-[#f3e3c7] hover:border-[#e9c176]/80 hover:brightness-[1.03]",
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
