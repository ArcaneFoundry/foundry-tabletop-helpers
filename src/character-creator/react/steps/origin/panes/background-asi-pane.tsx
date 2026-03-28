import { motion } from "motion/react";

import { ABILITY_LABELS } from "../../../../data/dnd5e-constants";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
  HeroPortraitCard,
  SectionHeading,
  StatCard,
  SummaryListCard,
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

  const selectedEntries = Object.entries(background.asi.assignments)
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([key, value]) => ({
      id: key,
      label: `${ABILITY_LABELS[key as keyof typeof ABILITY_LABELS]} +${value ?? 0}`,
    }));

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <section className="relative isolate rounded-[1.45rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(22,19,25,0.98),rgba(12,12,15,0.99))] shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
        <div className="relative z-10 p-4">
          <SectionHeading
            eyebrow={viewModel.backgroundName}
            title="Background Ability Scores"
            description="Distribute the background points where they do the most work. The highlighted cues show where this background and your class both point you, while the buttons keep the spend within the allowed limit."
          />

          <div className="mt-4 rounded-[1.2rem] border border-[#e9c176]/[0.14] bg-[rgba(255,255,255,0.02)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.24em] text-[#e9c176]/72">Spend guide</div>
                <p className="mt-2 max-w-3xl font-fth-cc-body text-[0.96rem] leading-6 text-[#d0cad0]">
                  Use the allocation chips to spot background-aligned and class-synergy picks at a glance. Positive choices
                  are disabled when they would exceed the remaining budget, so invalid totals are visible before they can be
                  applied.
                </p>
              </div>
              <CompactMetaChips
                chips={[
                  `${totalUsed}/${viewModel.asiPoints} spent`,
                  remainingPoints > 0 ? `${remainingPoints} remaining` : "Fully assigned",
                  "Invalid totals disabled",
                ]}
                tone="dark"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {viewModel.asiAbilities.map((ability) => {
              const currentValue = background.asi.assignments[ability.key as keyof typeof background.asi.assignments] ?? 0;
              const hasSuggestedCue = ability.backgroundSuggested || ability.classRecommended;
              return (
                <article
                  className="rounded-[1.28rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(34,27,21,0.96),rgba(21,16,13,0.99))] p-4 shadow-[0_16px_28px_rgba(0,0,0,0.18)]"
                  key={ability.key}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-fth-cc-body text-[1rem] font-semibold text-[#f5ead5]">{ability.label}</div>
                        <div
                          className={cn(
                            "rounded-full border px-2.5 py-1 font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.18em]",
                            currentValue > 0
                              ? "border-[#e9c176]/55 bg-[rgba(233,193,118,0.1)] text-[#f8e4bf]"
                              : "border-white/10 bg-white/5 text-[#c7c0ca]",
                          )}
                        >
                          {currentValue > 0 ? `+${currentValue}` : "Unassigned"}
                        </div>
                      </div>
                      <p className="mt-2 max-w-2xl font-fth-cc-body text-[0.95rem] leading-6 text-[#d0cad0]">
                        {ability.backgroundSuggested ? "This background recommends this score." : "This score is optional, but it remains available within the allowed pool."}
                        {ability.classRecommended ? " It also supports your class direction." : ""}
                      </p>
                      <div className="mt-3">
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

                    <div className="grid min-w-[14rem] grid-cols-3 gap-2 sm:min-w-[16rem]">
                      {ability.options.map((option) => {
                        const selected = currentValue === option.value;
                        const blockedBySpend =
                          option.value > 0 && totalUsed - currentValue + option.value > viewModel.asiPoints;
                        const disabled = blockedBySpend && !selected;
                        return (
                          <motion.button
                            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                            className={cn(
                              "flex flex-col items-start gap-1 rounded-[0.95rem] border px-3 py-2 text-left shadow-[0_12px_22px_rgba(0,0,0,0.1)] transition duration-200",
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
                            <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]">{option.label}</div>
                            <div className="font-fth-cc-body text-[0.66rem] leading-none text-inherit/75">
                              {selected ? "Applied" : blockedBySpend ? "Not enough points left" : option.value === 0 ? "Reset this score" : "Available"}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {hasSuggestedCue ? (
                    <div className="mt-3">
                      <CompactMetaChips
                        chips={[
                          ability.backgroundSuggested ? "Background-aligned" : "",
                          ability.classRecommended ? "Class synergy" : "",
                        ]}
                        tone="dark"
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <HeroPortraitCard image={viewModel.backgroundImg} label={viewModel.backgroundName} iconClass="fa-solid fa-chart-line" />
        <StatCard label="Points Spent" value={`${totalUsed} / ${viewModel.asiPoints}`} />
        <StatCard label="Points Remaining" value={`${remainingPoints}`} />
        <SummaryListCard
          emptyLabel="No abilities have been assigned yet."
          entries={selectedEntries}
          iconClass="fa-solid fa-chart-simple"
          title="Current Spread"
        />
        <section className="rounded-[1.35rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(24,20,18,0.96),rgba(15,13,12,0.99))] p-4 shadow-[0_16px_28px_rgba(0,0,0,0.18)]">
          <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#e9c176]/72">Guidance</div>
          <p className="mt-3 font-fth-cc-body text-[0.96rem] leading-6 text-[#d0cad0]">
            Background improvements should feel deliberate and readable. Use the recommended abilities first, keep an eye on
            the remaining budget, and let the disabled choices make the invalid totals obvious before they happen.
          </p>
        </section>
      </aside>
    </div>
  );
}
