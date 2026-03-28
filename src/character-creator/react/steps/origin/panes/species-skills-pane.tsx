import { motion, useReducedMotion } from "motion/react";

import type { WizardState } from "../../../../character-creator-types";
import { SKILLS } from "../../../../data/dnd5e-constants";
import { buildEmptySpeciesChoicesState, getAvailableSpeciesSkillOptions } from "../../../../steps/origin-flow-utils";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
  EmptySelectionState,
  SelectionPip,
  StatCard,
  SummaryListCard,
} from "../components/origin-pane-primitives";

type SpeciesSkillsViewModel = {
  title: string;
  description: string;
  requiredCount: number;
  requestedSkillChoiceCount?: number;
  availableSpeciesSkills?: Array<SpeciesSkillOption>;
  validationMessages?: string[];
  note?: string;
};

type SpeciesSkillOption = {
  key: string;
  label: string;
  abilityAbbrev: string;
  checked: boolean;
  disabled: boolean;
};

function skillLabel(id: string): string {
  return SKILLS[id]?.label ?? id;
}

function buildEarlierSkillClaimEntries(state: WizardState): Array<{ id: string; label: string }> {
  const backgroundSkills = state.selections.background?.grants.skillProficiencies ?? [];
  const classSkills = state.selections.skills?.chosen ?? [];
  const speciesSkills = state.selections.species?.skillGrants ?? [];

  return [
    ...backgroundSkills.map((skill) => ({
      id: `background-${skill}`,
      label: `Background: ${skillLabel(skill)}`,
    })),
    ...classSkills.map((skill) => ({
      id: `class-${skill}`,
      label: `Class: ${skillLabel(skill)}`,
    })),
    ...speciesSkills.map((skill) => ({
      id: `species-${skill}`,
      label: `Species: ${skillLabel(skill)}`,
    })),
  ];
}

export function SpeciesSkillsPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as SpeciesSkillsViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  const options: SpeciesSkillOption[] = (viewModel?.availableSpeciesSkills ?? getAvailableSpeciesSkillOptions(state))
    .map((option) => ("key" in option
      ? option
      : {
        ...option,
        key: option.id,
        checked: false,
        disabled: false,
      }));
  const selectedIds = state.selections.speciesChoices?.chosenSkills ?? [];
  const selectedSet = new Set(selectedIds);
  const requiredCount = viewModel?.requiredCount ?? 0;
  const requestedSkillChoiceCount = viewModel?.requestedSkillChoiceCount ?? requiredCount;
  const remainingCount = Math.max(0, requiredCount - selectedIds.length);
  const earlierSkillEntries = buildEarlierSkillClaimEntries(state);
  const hasValidationMessages = (viewModel?.validationMessages?.length ?? 0) > 0;

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <section className="relative isolate flex flex-col rounded-[1.45rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(23,21,28,0.98),rgba(12,12,16,0.99))] shadow-[inset_0_1px_0_rgba(255,248,233,0.03),0_22px_42px_rgba(0,0,0,0.22)]">
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e9c176]/[0.16] pb-4">
            <div className="min-w-0 max-w-3xl">
              <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.24em] text-[#e9c176]/78">
                {state.selections.species?.name ?? "Species"}
              </div>
              <div className="mt-2 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em] text-[#f5ead5]">
                {viewModel?.title ?? "Choose Species Skills"}
              </div>
              <p className="mt-2 max-w-3xl font-fth-cc-body text-[0.98rem] leading-6 text-[#d0cad0]">
                {viewModel?.description ?? "Choose the skills granted by this species while keeping earlier background and class choices in mind."}
              </p>
              <p className="mt-2 max-w-3xl font-fth-cc-body text-[0.92rem] leading-6 text-[#bdb6c2]">
                Background, class, and fixed species skill grants already remove illegal options from the pool. Only the legal choices remain visible here.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-2 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.24em] text-[#c6c0cb]">
                {requestedSkillChoiceCount > 0 ? "Select Species Skills" : "No Skill Choice Required"}
              </div>
              <CompactMetaChips
                chips={[
                  `${selectedIds.length} / ${requiredCount} chosen`,
                  `${remainingCount} remaining`,
                  `${options.length} legal option${options.length === 1 ? "" : "s"}`,
                ]}
                tone="dark"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {options.length > 0 ? (
              options.map((option) => {
                const checked = selectedSet.has(option.key);
                const disabled = !checked && selectedSet.size >= requiredCount;
                return (
                  <motion.button
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    className={cn(
                      "group relative flex items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left shadow-[0_14px_28px_rgba(0,0,0,0.22)] transition duration-200",
                      checked
                        ? "border-[#e9c176]/60 bg-[linear-gradient(180deg,rgba(49,60,35,0.98),rgba(22,27,19,0.99))] text-[#f6e8c7] shadow-[0_0_0_1px_rgba(233,193,118,0.18),0_18px_34px_rgba(0,0,0,0.28)]"
                        : "border-[#8f7256] bg-[linear-gradient(180deg,rgba(41,32,27,0.98),rgba(20,16,14,0.99))] text-[#f3e3c7] hover:border-[#e9c176]/70 hover:brightness-[1.03]",
                      disabled && !checked && "cursor-not-allowed opacity-60",
                    )}
                    aria-pressed={checked}
                    data-selected={checked ? "true" : "false"}
                    disabled={disabled}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    key={option.key}
                    onClick={() => {
                      const next = new Set(selectedIds);
                      if (next.has(option.key)) next.delete(option.key);
                      else next.add(option.key);
                      state.selections.speciesChoices = {
                        ...(state.selections.speciesChoices ?? buildEmptySpeciesChoicesState(state)),
                        chosenSkills: [...next],
                      };
                      void controller.refresh();
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
                      <CompactMetaChips
                        chips={[
                          `${option.abilityAbbrev} keyed`,
                          checked ? "Selected" : "Available",
                        ]}
                        tone={checked ? "light" : "dark"}
                      />
                    </div>
                    <SelectionPip checked={checked} />
                  </motion.button>
                );
              })
            ) : (
              <EmptySelectionState message={viewModel?.note ?? "No legal species skill options remain after your earlier choices."} />
            )}
          </div>
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label="Required Skills" value={`${selectedIds.length} / ${requiredCount}`} />
        <SummaryListCard
          emptyLabel="No species skills selected yet."
          entries={selectedIds.map((entry) => ({
            id: entry,
            label: options.find((candidate) => candidate.key === entry)?.label ?? skillLabel(entry),
          }))}
          iconClass="fa-solid fa-list-check"
          onRemove={(entryId) => {
            state.selections.speciesChoices = {
              ...(state.selections.speciesChoices ?? buildEmptySpeciesChoicesState(state)),
              chosenSkills: selectedIds.filter((candidate) => candidate !== entryId),
            };
            void controller.refresh();
          }}
          title="Chosen Skills"
          removable
        />
        <SummaryListCard
          emptyLabel="No earlier skill grants are locking out options."
          entries={earlierSkillEntries}
          iconClass="fa-solid fa-lock"
          title="Already Claimed"
        />
        <section className="rounded-[1.35rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(24,20,18,0.96),rgba(15,13,12,0.99))] p-4 shadow-[0_16px_28px_rgba(0,0,0,0.18)]">
          <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#e9c176]/72">
            Guidance
          </div>
          <div className="mt-3 space-y-2 font-fth-cc-body text-[0.96rem] leading-6 text-[#d0cad0]">
            {hasValidationMessages ? (
              viewModel?.validationMessages?.map((message) => <p key={message}>{message}</p>)
            ) : (
              <p>
                Earlier background and class skill decisions are already reserved, so this pane only shows the legal species options that remain.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
