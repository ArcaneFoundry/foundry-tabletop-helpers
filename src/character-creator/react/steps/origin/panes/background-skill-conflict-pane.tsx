import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

import type { WizardState } from "../../../../character-creator-types";
import {
  applyBackgroundSkillConflictSelections,
  getBackgroundSkillConflictOptions,
  getBackgroundSkillConflictReplacementCount,
} from "../../../../steps/origin-flow-utils";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps } from "../components/origin-pane-primitives";
import {
  CompactMetaChips,
  EmptySelectionState,
  SectionHeading,
  SelectionPip,
  StatCard,
  SummaryListCard,
} from "../components/origin-pane-primitives";

type BackgroundSkillConflictViewModel = {
  backgroundName: string;
  className: string;
  fixedBackgroundSkills: string[];
  conflictingSkills: string[];
  retainedSkills: string[];
  selectedReplacementSkills: string[];
  replacementCount: number;
  requiredClassSkillCount: number;
  replacementOptions: Array<{
    id: string;
    label: string;
    abilityAbbrev: string;
  }>;
};

type BackgroundSkillConflictPaneProps = OriginPaneProps;

function getSelectedReplacementIds(state: WizardState, selectedIds: string[]): string[] {
  const persistedReplacementIds = Array.isArray(state.selections.backgroundSkillConflicts)
    ? state.selections.backgroundSkillConflicts.filter((entry): entry is string => typeof entry === "string")
    : [];
  return persistedReplacementIds.filter((skill) => selectedIds.includes(skill));
}

export function BackgroundSkillConflictPane({ shellContext, state, controller }: BackgroundSkillConflictPaneProps) {
  const viewModel = shellContext.stepViewModel as BackgroundSkillConflictViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const selectedIds = state.selections.skills?.chosen ?? [];
  const selectedReplacementIds = getSelectedReplacementIds(state, selectedIds);
  const selectedReplacementSet = useMemo(() => new Set(selectedReplacementIds), [selectedReplacementIds]);
  const replacementOptions = viewModel.replacementOptions.length > 0
    ? viewModel.replacementOptions
    : getBackgroundSkillConflictOptions(state);
  const replacementCount = viewModel.replacementCount || getBackgroundSkillConflictReplacementCount(state);
  const remainingReplacements = Math.max(0, replacementCount - selectedReplacementSet.size);

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <section className="rounded-[1.45rem] border border-[color:var(--fth-color-border)] bg-[image:var(--fth-theme-panel-image)] p-4 shadow-[var(--fth-theme-shadow-panel),inset_0_1px_0_color-mix(in_srgb,var(--fth-color-text)_4%,transparent)]">
        <SectionHeading
          eyebrow={viewModel.backgroundName}
          title="Resolve Skill Overlap"
          description={`Keep the background skills fixed, then replace the overlapping class skills until you satisfy the ${replacementCount} required swap${replacementCount === 1 ? "" : "s"} for ${viewModel.className}.`}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <StatCard label="Replacements remaining" value={`${remainingReplacements}`} />
          <StatCard label="Chosen replacements" value={`${selectedReplacementSet.size} / ${replacementCount}`} />
        </div>

        <div className="mt-4 rounded-[1.15rem] border border-[color:var(--fth-color-border)] bg-[color:var(--fth-color-surface-glass)] px-4 py-4 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--fth-color-text)_4%,transparent)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.24em] text-[color:color-mix(in_srgb,var(--fth-color-accent)_78%,transparent)]">
                Decision Surface
              </div>
              <div className="mt-1 font-fth-cc-body text-[0.98rem] leading-6 text-[color:var(--fth-color-text-muted)]">
                Background skills stay locked. Retained class skills are already safe. Choose replacements only from the valid overlap set.
              </div>
            </div>
            <CompactMetaChips
              chips={[
                `${viewModel.fixedBackgroundSkills.length} fixed`,
                `${viewModel.retainedSkills.length} retained`,
                `${viewModel.conflictingSkills.length} overlaps`,
              ]}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {replacementOptions.length > 0 ? replacementOptions.map((option) => {
            const checked = selectedReplacementSet.has(option.id);
            const disabled = !checked && selectedReplacementSet.size >= replacementCount;
            return (
              <motion.button
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                className={cn(
                  "group relative overflow-hidden rounded-[1rem] border px-4 py-3 text-left shadow-[0_12px_22px_rgba(67,43,23,0.08)] transition duration-200",
                  checked
                    ? "border-[color:color-mix(in_srgb,var(--fth-color-success)_44%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fth-color-success)_12%,var(--fth-color-surface)_88%),color-mix(in_srgb,var(--fth-color-success)_20%,var(--fth-color-surface-elevated)_80%))]"
                    : "border-[color:color-mix(in_srgb,var(--fth-color-accent)_32%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fth-color-text)_10%,var(--fth-color-surface)_90%),color-mix(in_srgb,var(--fth-color-accent)_10%,var(--fth-color-surface-elevated)_90%))]",
                  disabled && !checked && "opacity-60",
                )}
                disabled={disabled}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                key={option.id}
                onClick={() => {
                  const nextReplacements = new Set(selectedReplacementIds);
                  if (nextReplacements.has(option.id)) nextReplacements.delete(option.id);
                  else nextReplacements.add(option.id);
                  applyBackgroundSkillConflictSelections(state, [...nextReplacements]);
                  state.selections.backgroundSkillConflicts = [...nextReplacements];
                  void controller.refresh();
                }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                type="button"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.01, y: -1 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-fth-cc-body text-[1rem] font-semibold text-[color:var(--fth-color-text)]">
                      {option.label}
                    </div>
                    <div className="mt-1 font-fth-cc-body text-[0.86rem] leading-5 text-[color:var(--fth-color-text-muted)]">
                      {checked ? "Chosen as a replacement skill." : "Available as a legal class-skill replacement."}
                    </div>
                    <CompactMetaChips
                      chips={[
                        `${option.abilityAbbrev} keyed`,
                        checked ? "Selected replacement" : "Available replacement",
                      ]}
                    />
                  </div>
                  <SelectionPip checked={checked} />
                </div>
              </motion.button>
            );
          }) : (
            <EmptySelectionState message="No legal replacement class skills remain after accounting for your background and any already-known skills." />
          )}
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label="Resolution" value={`${selectedReplacementSet.size} / ${replacementCount}`} />
        <SummaryListCard
          emptyLabel="No fixed background skills recorded."
          entries={viewModel.fixedBackgroundSkills.map((entry) => ({ id: entry, label: entry }))}
          iconClass="fa-solid fa-scroll"
          title={`Fixed Background Skills (${viewModel.fixedBackgroundSkills.length})`}
        />
        <SummaryListCard
          emptyLabel="No class skills remain locked in yet."
          entries={viewModel.retainedSkills.map((entry) => ({ id: entry, label: entry }))}
          iconClass="fa-solid fa-list-check"
          title={`Retained Class Skills (${viewModel.retainedSkills.length})`}
        />
        <SummaryListCard
          emptyLabel="No overlapping skills were detected."
          entries={viewModel.conflictingSkills.map((entry) => ({ id: entry, label: entry }))}
          iconClass="fa-solid fa-triangle-exclamation"
          title={`Overlapping Skills (${viewModel.conflictingSkills.length})`}
        />
        <SummaryListCard
          emptyLabel="No replacement skills selected yet."
          entries={selectedReplacementIds.map((entry) => ({
            id: entry,
            label: replacementOptions.find((option) => option.id === entry)?.label ?? entry,
          }))}
          iconClass="fa-solid fa-repeat"
          onRemove={(entryId) => {
            const nextReplacements = selectedReplacementIds.filter((candidate) => candidate !== entryId);
            applyBackgroundSkillConflictSelections(state, nextReplacements);
            state.selections.backgroundSkillConflicts = nextReplacements;
            void controller.refresh();
          }}
          removable
          title={`Chosen Replacements (${selectedReplacementSet.size} / ${replacementCount})`}
        />
      </aside>
    </div>
  );
}
