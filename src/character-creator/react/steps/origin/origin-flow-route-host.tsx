import { useEffect, useMemo, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  CreatorIndexEntry,
  OriginFeatSelection,
  ReactWizardStepProps,
  WizardState,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { buildOriginFlowShellModel } from "./build-origin-flow-shell-model";
import classStepFieldBackground from "../../../assets/class-step-field-bg.webp";
import classStepHeaderBackground from "../../../assets/class-step-header-bg.webp";
import { ClassAggregateStepper } from "../class/class-step-screen";
import { getClassTheme } from "../class/class-presentation";
import { buildBackgroundSelectionFromEntry } from "../../../steps/step-background";
import { buildSpeciesSelectionFromEntry } from "../../../steps/step-species";
import {
  buildEmptySpeciesChoicesState,
  getAvailableSpeciesSkillOptions,
  getBackgroundLanguageOptions,
  getOriginLanguageLabel,
  getSpeciesChoiceValidationMessages,
  getSpeciesItemChoiceRequirements,
  getSpeciesLanguageOptions,
} from "../../../steps/origin-flow-utils";

type BackgroundStepViewModel = {
  entries: Array<CreatorIndexEntry & { selected?: boolean }>;
  selectedEntry?: (CreatorIndexEntry & { description?: string }) | null;
  emptyMessage?: string;
};

type SpeciesStepViewModel = BackgroundStepViewModel;

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

type BackgroundLanguagesViewModel = {
  title: string;
  description: string;
  requiredCount: number;
};

type OriginFeatViewModel = {
  backgroundName: string;
  className: string;
  allowOriginFeatSwap: boolean;
  defaultOriginFeatName: string | null;
  originFeatName: string | null;
  originFeatImg: string;
  isCustomOriginFeat: boolean;
  selectedOriginFeat?: (CreatorIndexEntry & { description?: string }) | null;
  availableOriginFeats: Array<CreatorIndexEntry & { selected?: boolean }>;
  hasOriginFeats: boolean;
  originFeatEmptyMessage: string;
};

type SpeciesAdvancementViewModel = {
  title: string;
  description: string;
  requiredCount: number;
  validationMessages?: string[];
};

type OriginSummaryViewModel = {
  className: string;
  backgroundName: string;
  backgroundImage: string;
  speciesName: string;
  speciesImage: string;
  fixedLanguages: string[];
  selectedGrantGroups: Array<{
    id: string;
    title: string;
    iconClass: string;
    entries: string[];
    source?: "background" | "species";
  }>;
  backgroundSkills: string[];
  speciesTraits: string[];
  speciesSkills: string[];
  speciesItems: string[];
  toolProficiency: string | null;
  originFeatName: string | null;
};

const ORIGIN_FLOW_STEP_IDS = new Set([
  "background",
  "backgroundAsi",
  "backgroundLanguages",
  "originChoices",
  "species",
  "speciesSkills",
  "speciesLanguages",
  "speciesItemChoices",
  "originSummary",
]);

export function isOriginFlowStep(stepId: string | undefined): boolean {
  return Boolean(stepId && ORIGIN_FLOW_STEP_IDS.has(stepId));
}

export function getOriginFlowTransitionKey(stepId: string | undefined): string {
  return isOriginFlowStep(stepId) ? "origin-flow" : (stepId ?? "");
}

export function OriginFlowRouteHost(
  { shellContext, state, controller }: ReactWizardStepProps,
) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const shellModel = useMemo(
    () => buildOriginFlowShellModel(state, shellContext.steps, shellContext.currentStepId),
    [shellContext.currentStepId, shellContext.steps, state],
  );
  const theme = getClassTheme(shellModel.selectedClassIdentifier ?? "fighter");

  useEffect(() => {
    if (shellModel.currentPane !== "originChoices") return;
    const backgroundFeatUuid = state.selections.background?.grants.originFeatUuid;
    if (!backgroundFeatUuid || state.selections.originFeat) return;
    state.selections.originFeat = {
      uuid: backgroundFeatUuid,
      name: state.selections.background?.grants.originFeatName ?? "Origin Feat",
      img: state.selections.background?.grants.originFeatImg ?? "",
      isCustom: false,
    };
    void controller.refresh();
  }, [controller, shellModel.currentPane, state]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-fth-cc-gold/45 bg-[linear-gradient(180deg,rgba(249,237,216,0.98),rgba(236,219,191,0.98))] p-[0.35rem] shadow-[0_24px_60px_rgba(0,0,0,0.34)]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-[0.35rem] rounded-[1.45rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),transparent_28%),linear-gradient(180deg,rgba(255,248,236,0.98),rgba(232,214,187,0.98))]" />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-[#b78d56]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.92),rgba(236,220,197,0.96))] shadow-[inset_0_0_0_1px_rgba(255,245,226,0.72)]">
          <motion.header
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            className="mx-2 mt-2 px-4 pb-3 pt-3 md:px-6"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
            transition={{ delay: 0.05, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="relative overflow-hidden rounded-[1.15rem] border border-fth-cc-gold/50"
              style={{
                boxShadow: `inset 0 1px 0 rgba(255,236,206,0.22), 0 10px 22px rgba(0,0,0,0.18), 0 18px 34px ${theme.glow}`,
              }}
            >
              <img
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                src={classStepHeaderBackground}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,11,0.24),rgba(16,12,11,0.42))]" />
              <div className="relative z-10 flex items-center justify-center gap-4 px-4 py-3">
                <i className={cn(theme.crest, "text-fth-cc-gold-bright")} aria-hidden="true" />
                <h2
                  className="m-0 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.12em] text-fth-cc-gold-bright md:text-[2.05rem]"
                  style={{
                    textShadow:
                      "0 0 8px rgba(255,225,164,0.4), 0 0 18px rgba(255,211,130,0.2), 0 2px 10px rgba(16,9,6,0.72)",
                  }}
                >
                  {shellModel.title}
                </h2>
              </div>
            </div>
          </motion.header>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-3 md:px-6">
            <img
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18] mix-blend-multiply"
              src={classStepFieldBackground}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,252,245,0.6),rgba(255,248,236,0.18)_52%,rgba(219,190,145,0.08)_100%)]" />
            <ClassAggregateStepper model={shellModel.aggregateStepper} prefersReducedMotion={prefersReducedMotion} />

            <div className="relative z-10 mt-3 flex min-h-0 flex-1">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={shellModel.currentPane}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                  className="flex h-full min-h-0 w-full flex-1 flex-col"
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  {shellModel.currentPane === "background" ? (
                    <BackgroundSelectionPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "backgroundAsi" ? (
                    <BackgroundAsiPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "backgroundLanguages" ? (
                    <LanguageChoicesPane
                      description={(shellContext.stepViewModel as BackgroundLanguagesViewModel | undefined)?.description ?? ""}
                      emptyMessage="No background language choices are available."
                      options={getBackgroundLanguageOptions(state)}
                      requiredCount={(shellContext.stepViewModel as BackgroundLanguagesViewModel | undefined)?.requiredCount ?? 0}
                      selectedIds={state.selections.background?.languages.chosen ?? []}
                      subtitle={state.selections.background?.name ?? "Background"}
                      title={(shellContext.stepViewModel as BackgroundLanguagesViewModel | undefined)?.title ?? "Choose Languages"}
                      onChange={(chosen) => {
                        if (!state.selections.background) return;
                        state.selections.background.languages.chosen = chosen;
                        void controller.refresh();
                      }}
                    />
                  ) : shellModel.currentPane === "originChoices" ? (
                    <OriginFeatPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "species" ? (
                    <SpeciesSelectionPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "speciesSkills" ? (
                    <SpeciesSkillsPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "speciesLanguages" ? (
                    <LanguageChoicesPane
                      description={(shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined)?.description ?? ""}
                      emptyMessage="No species language choices are available."
                      options={getSpeciesLanguageOptions(state)}
                      requiredCount={(shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined)?.requiredCount ?? 0}
                      selectedIds={state.selections.speciesChoices?.chosenLanguages ?? []}
                      subtitle={state.selections.species?.name ?? "Species"}
                      title={(shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined)?.title ?? "Choose Species Languages"}
                      onChange={(chosen) => {
                        state.selections.speciesChoices = {
                          ...(state.selections.speciesChoices ?? buildEmptySpeciesChoicesState(state)),
                          chosenLanguages: chosen,
                        };
                        void controller.refresh();
                      }}
                    />
                  ) : shellModel.currentPane === "speciesItemChoices" ? (
                    <SpeciesItemChoicesPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "originSummary" ? (
                    <OriginSummaryPane shellContext={shellContext} />
                  ) : (
                    <SpeciesSkillsPane controller={controller} shellContext={shellContext} state={state} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

type OriginPaneProps = Pick<ReactWizardStepProps, "controller" | "shellContext" | "state">;

function BackgroundSelectionPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as BackgroundStepViewModel | undefined;
  const entries = viewModel?.entries ?? [];
  const selectedUuid = state.selections.background?.uuid ?? null;

  return (
    <SelectionPane
      description="Choose the life your character led before the road called them onward."
      emptyMessage={viewModel?.emptyMessage ?? "No backgrounds available."}
      entries={entries}
      selectedEntry={viewModel?.selectedEntry ?? null}
      selectedUuid={selectedUuid}
      title="Background"
      onSelect={async (entry) => {
        const selection = await buildBackgroundSelectionFromEntry(entry);
        if (!selection) return;
        state.selections.originFeat = undefined;
        controller.updateCurrentStepData(selection);
      }}
      renderMeta={(entry) => (
        <CompactMetaChips
          chips={[
            "Ability Score Improvement",
            entry.selected ? "Selected" : "Origin-ready",
          ]}
        />
      )}
    />
  );
}

function SpeciesSelectionPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as SpeciesStepViewModel | undefined;
  const entries = viewModel?.entries ?? [];
  const selectedUuid = state.selections.species?.uuid ?? null;

  return (
    <SelectionPane
      description="Choose the lineage, ancestry, or folk your adventurer carries into the world."
      emptyMessage={viewModel?.emptyMessage ?? "No species available."}
      entries={entries}
      selectedEntry={viewModel?.selectedEntry ?? null}
      selectedUuid={selectedUuid}
      title="Species"
      onSelect={async (entry) => {
        const selection = await buildSpeciesSelectionFromEntry(entry);
        const stagedState = {
          ...state,
          selections: {
            ...state.selections,
            species: selection,
          },
        } as WizardState;
        state.selections.speciesChoices = buildEmptySpeciesChoicesState(stagedState);
        controller.updateCurrentStepData(selection);
      }}
      renderMeta={(entry) => (
        <CompactMetaChips
          chips={[
            "Traits",
            entry.selected ? "Selected" : "Origin-ready",
          ]}
        />
      )}
    />
  );
}

function BackgroundAsiPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as BackgroundAsiViewModel | undefined;
  const background = state.selections.background;
  if (!viewModel || !background) return null;

  const totalUsed = Object.values(background.asi.assignments).reduce((sum, value) => sum + (value ?? 0), 0);

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
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
      <section className="fth-react-scrollbar min-h-0 overflow-y-auto rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
        <SectionHeading eyebrow={viewModel.backgroundName} title="Background Aptitudes" />
        <div className="mt-4 grid gap-3">
          {viewModel.asiAbilities.map((ability) => (
            <div
              className="rounded-[1.15rem] border border-[#ceb18a] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,231,209,0.94))] p-4 shadow-[0_12px_22px_rgba(67,43,23,0.08)]"
              key={ability.key}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-fth-cc-body text-[1rem] font-semibold text-[#4c3524]">{ability.label}</div>
                  <CompactMetaChips
                    chips={[
                      ability.backgroundSuggested ? "Background-aligned" : "",
                      ability.classRecommended ? "Class synergy" : "",
                    ].filter(Boolean)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {ability.options.map((option) => (
                    <button
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.7rem] uppercase tracking-[0.16em] transition",
                        option.selected
                          ? "border-[#9daa58] bg-[linear-gradient(180deg,rgba(243,245,212,0.98),rgba(227,232,180,0.94))] text-[#42511e]"
                          : "border-[#d4bb96] bg-[rgba(255,252,246,0.82)] text-[#7a5a41] hover:border-[#b89060]",
                      )}
                      key={option.value}
                      onClick={() => applyValue(ability.key, option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label="Points Assigned" value={`${totalUsed} / ${viewModel.asiPoints}`} />
        <div className="rounded-[1.3rem] border border-[#d1b387]/60 bg-[linear-gradient(180deg,rgba(255,251,244,0.96),rgba(241,227,201,0.92))] p-4 shadow-[0_12px_22px_rgba(67,43,23,0.08)]">
          <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#855b3e]">Guidance</div>
          <p className="mt-3 font-fth-cc-body text-[0.97rem] leading-6 text-[#5f4636]">
            Background improvements follow the 2024 origin rules. Build a spread that supports the character you want to play, then confirm the origin feat and species gifts that complete the picture.
          </p>
        </div>
      </aside>
    </div>
  );
}

function LanguageChoicesPane({
  title,
  subtitle,
  description,
  requiredCount,
  selectedIds,
  options,
  emptyMessage,
  onChange,
}: {
  title: string;
  subtitle: string;
  description: string;
  requiredCount: number;
  selectedIds: string[];
  options: Array<{ id: string; label: string }>;
  emptyMessage: string;
  onChange: (chosen: string[]) => void;
}) {
  const selectedSet = new Set(selectedIds);
  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
      <section className="fth-react-scrollbar min-h-0 overflow-y-auto rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
        <SectionHeading eyebrow={subtitle} title={title} description={description} />
        <div className="mt-4 grid gap-3">
          {options.length > 0 ? options.map((option) => {
            const checked = selectedSet.has(option.id);
            const disabled = !checked && selectedSet.size >= requiredCount;
            return (
              <button
                className={cn(
                  "flex items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left shadow-[0_12px_22px_rgba(67,43,23,0.08)] transition",
                  checked
                    ? "border-[#87a36a] bg-[linear-gradient(180deg,rgba(241,246,220,0.98),rgba(226,234,183,0.94))]"
                    : "border-[#ceb18a] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,231,209,0.94))]",
                  disabled && !checked && "opacity-60",
                )}
                disabled={disabled}
                key={option.id}
                onClick={() => {
                  const next = new Set(selectedIds);
                  if (next.has(option.id)) next.delete(option.id);
                  else next.add(option.id);
                  onChange([...next]);
                }}
                type="button"
              >
                <div>
                  <div className="font-fth-cc-body text-[1rem] font-semibold text-[#4c3524]">{option.label}</div>
                  <div className="mt-1 font-fth-cc-ui text-[0.65rem] uppercase tracking-[0.18em] text-[#89644b]">
                    {getOriginLanguageLabel(option.id)}
                  </div>
                </div>
                <SelectionPip checked={checked} />
              </button>
            );
          }) : (
            <EmptySelectionState message={emptyMessage} />
          )}
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label="Selections" value={`${selectedIds.length} / ${requiredCount}`} />
        <SummaryListCard
          emptyLabel="No languages selected yet."
          entries={selectedIds.map((entry) => getOriginLanguageLabel(entry))}
          iconClass="fa-solid fa-language"
          title="Chosen Languages"
        />
      </aside>
    </div>
  );
}

function OriginFeatPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as OriginFeatViewModel | undefined;
  if (!viewModel) return null;

  const selectedUuid = state.selections.originFeat?.uuid ?? state.selections.background?.grants.originFeatUuid ?? null;
  const selectFeat = (entry: CreatorIndexEntry) => {
    const backgroundFeatUuid = state.selections.background?.grants.originFeatUuid;
    const originFeat: OriginFeatSelection = {
      uuid: entry.uuid,
      name: entry.name,
      img: entry.img,
      isCustom: entry.uuid !== backgroundFeatUuid,
    };
    state.selections.originFeat = originFeat;
    void controller.refresh();
  };

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="fth-react-scrollbar min-h-0 overflow-y-auto rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
        <SectionHeading
          eyebrow={viewModel.backgroundName}
          title="Origin Feat"
          description={`Confirm the feat granted by ${viewModel.backgroundName}, or swap it if your table allows a different 2024 origin feat.`}
        />
        {viewModel.hasOriginFeats ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {viewModel.availableOriginFeats.map((entry) => {
              const checked = entry.uuid === selectedUuid;
              return (
                <button
                  className={cn(
                    "group relative overflow-hidden rounded-[1.15rem] border p-3 text-left shadow-[0_14px_24px_rgba(67,43,23,0.12)] transition",
                    checked
                      ? "border-[#9daa58] bg-[linear-gradient(180deg,rgba(243,245,212,0.98),rgba(227,232,180,0.94))]"
                      : "border-[#ceb18a] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,231,209,0.94))] hover:border-[#b68f63]",
                  )}
                  key={entry.uuid}
                  onClick={() => selectFeat(entry)}
                  type="button"
                >
                  <div className="grid grid-cols-[4.6rem_minmax(0,1fr)] gap-3">
                    <div className="aspect-square overflow-hidden rounded-[0.95rem] border border-[#d4bb96] bg-[#20130e]">
                      {entry.img ? (
                        <img alt={entry.name} className="h-full w-full object-cover" loading="lazy" src={entry.img} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#f0d2a6]">
                          <i className="fa-solid fa-stars text-xl" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-fth-cc-body text-[1rem] font-semibold text-[#4c3524]">{entry.name}</div>
                      <CompactMetaChips chips={[checked ? "Confirmed" : "Available", entry.packLabel]} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptySelectionState message={viewModel.originFeatEmptyMessage || "No alternative origin feats are available."} />
        )}
      </section>

      <aside className="grid gap-4 self-start">
        <SummaryListCard
          emptyLabel="No feat has been confirmed yet."
          entries={viewModel.originFeatName ? [viewModel.originFeatName] : []}
          iconClass="fa-solid fa-stars"
          title={viewModel.isCustomOriginFeat ? "Chosen Feat" : "Default Feat"}
        />
        <DetailCard entry={viewModel.selectedOriginFeat ?? null} fallbackIcon="fa-solid fa-scroll" />
      </aside>
    </div>
  );
}

function SpeciesSkillsPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined;
  const options = getAvailableSpeciesSkillOptions(state);
  const selectedIds = state.selections.speciesChoices?.chosenSkills ?? [];
  const selectedSet = new Set(selectedIds);
  const requiredCount = viewModel?.requiredCount ?? 0;

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
      <section className="fth-react-scrollbar min-h-0 overflow-y-auto rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
        <SectionHeading eyebrow={state.selections.species?.name ?? "Species"} title={viewModel?.title ?? "Choose Species Skills"} description={viewModel?.description ?? ""} />
        <div className="mt-4 grid gap-3">
          {options.length > 0 ? options.map((option) => {
            const checked = selectedSet.has(option.id);
            const disabled = !checked && selectedSet.size >= requiredCount;
            return (
              <button
                className={cn(
                  "flex items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left shadow-[0_12px_22px_rgba(67,43,23,0.08)] transition",
                  checked
                    ? "border-[#87a36a] bg-[linear-gradient(180deg,rgba(241,246,220,0.98),rgba(226,234,183,0.94))]"
                    : "border-[#ceb18a] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,231,209,0.94))]",
                  disabled && !checked && "opacity-60",
                )}
                disabled={disabled}
                key={option.id}
                onClick={() => {
                  const next = new Set(selectedIds);
                  if (next.has(option.id)) next.delete(option.id);
                  else next.add(option.id);
                  state.selections.speciesChoices = {
                    ...(state.selections.speciesChoices ?? buildEmptySpeciesChoicesState(state)),
                    chosenSkills: [...next],
                  };
                  void controller.refresh();
                }}
                type="button"
              >
                <div>
                  <div className="font-fth-cc-body text-[1rem] font-semibold text-[#4c3524]">{option.label}</div>
                  <CompactMetaChips chips={[`${option.abilityAbbrev} keyed`, checked ? "Selected" : "Available"]} />
                </div>
                <SelectionPip checked={checked} />
              </button>
            );
          }) : (
            <EmptySelectionState message="No legal species skill options remain after your earlier choices." />
          )}
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label="Selections" value={`${selectedIds.length} / ${requiredCount}`} />
        <SummaryListCard
          emptyLabel="No species skills selected yet."
          entries={selectedIds.map((entry) => options.find((candidate) => candidate.id === entry)?.label ?? entry)}
          iconClass="fa-solid fa-list-check"
          title="Chosen Skills"
        />
      </aside>
    </div>
  );
}

function SpeciesItemChoicesPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined;
  const requirements = getSpeciesItemChoiceRequirements(state);
  const validationMessages = viewModel?.validationMessages ?? getSpeciesChoiceValidationMessages(state);

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
      <section className="fth-react-scrollbar min-h-0 overflow-y-auto rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
        <SectionHeading eyebrow={state.selections.species?.name ?? "Species"} title={viewModel?.title ?? "Choose Species Gifts"} description={viewModel?.description ?? ""} />
        <div className="mt-4 grid gap-4">
          {requirements.map((requirement) => {
            const selectedIds = state.selections.speciesChoices?.chosenItems?.[requirement.id] ?? [];
            return (
              <section
                className="rounded-[1.2rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] p-4 shadow-[0_10px_20px_rgba(69,45,24,0.08)]"
                key={requirement.id}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#cfb58f]/55 pb-3">
                  <div className="font-fth-cc-body text-[1rem] font-semibold text-[#4c3524]">{requirement.title}</div>
                  <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#855b3e]">
                    {selectedIds.length} / {Math.min(requirement.requiredCount, requirement.itemChoices.length)}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {requirement.itemChoices.map((option) => {
                    const checked = selectedIds.includes(option.uuid);
                    const maxCount = Math.min(requirement.requiredCount, requirement.itemChoices.length);
                    const disabled = !checked && selectedIds.length >= maxCount;
                    return (
                      <button
                        className={cn(
                          "group relative overflow-hidden rounded-[1rem] border p-3 text-left shadow-[0_12px_22px_rgba(67,43,23,0.08)] transition",
                          checked
                            ? "border-[#87a36a] bg-[linear-gradient(180deg,rgba(241,246,220,0.98),rgba(226,234,183,0.94))]"
                            : "border-[#ceb18a] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,231,209,0.94))]",
                          disabled && !checked && "opacity-60",
                        )}
                        disabled={disabled}
                        key={option.uuid}
                        onClick={() => {
                          const current = new Set(state.selections.speciesChoices?.chosenItems?.[requirement.id] ?? []);
                          if (current.has(option.uuid)) current.delete(option.uuid);
                          else current.add(option.uuid);
                          state.selections.speciesChoices = {
                            ...(state.selections.speciesChoices ?? buildEmptySpeciesChoicesState(state)),
                            chosenItems: {
                              ...(state.selections.speciesChoices?.chosenItems ?? {}),
                              [requirement.id]: [...current],
                            },
                          };
                          void controller.refresh();
                        }}
                        type="button"
                      >
                        <div className="grid grid-cols-[3.8rem_minmax(0,1fr)] gap-3">
                          <div className="aspect-square overflow-hidden rounded-[0.9rem] border border-[#d4bb96] bg-[#20130e]">
                            {option.img ? (
                              <img alt={option.name} className="h-full w-full object-cover" loading="lazy" src={option.img} />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#f0d2a6]">
                                <i className="fa-solid fa-hand-sparkles" aria-hidden="true" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-fth-cc-body text-[0.98rem] font-semibold text-[#4c3524]">{option.name}</div>
                            <CompactMetaChips chips={[checked ? "Selected" : "Available"]} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        {validationMessages.map((message) => (
          <div
            className="rounded-[1.15rem] border border-[#d6b57a]/55 bg-[linear-gradient(180deg,rgba(255,247,231,0.95),rgba(246,231,198,0.92))] px-4 py-3 font-fth-cc-body text-[0.94rem] leading-6 text-[#5e4637]"
            key={message}
          >
            {message}
          </div>
        ))}
      </aside>
    </div>
  );
}

function OriginSummaryPane({ shellContext }: Pick<ReactWizardStepProps, "shellContext">) {
  const viewModel = shellContext.stepViewModel as OriginSummaryViewModel | undefined;
  if (!viewModel) return null;

  return (
    <section className="fth-react-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-2 pt-2">
      <div className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.95fr)]">
          <section className="rounded-[1.5rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)] md:p-5">
            <div className="border-b border-[#cfb58f]/55 pb-3">
              <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
                {viewModel.className ? `${viewModel.className} Origins` : "Origins"}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <HeroPortraitCard image={viewModel.backgroundImage} label={viewModel.backgroundName} iconClass="fa-solid fa-scroll" />
              <HeroPortraitCard image={viewModel.speciesImage} label={viewModel.speciesName} iconClass="fa-solid fa-dna" />
            </div>
          </section>

          <aside className="grid gap-4 self-start">
            <SummaryListCard
              emptyLabel="No fixed languages recorded."
              entries={viewModel.fixedLanguages}
              iconClass="fa-solid fa-language"
              title="Fixed Languages"
            />
            <SummaryListCard
              emptyLabel="No species traits listed."
              entries={viewModel.speciesTraits}
              iconClass="fa-solid fa-dna"
              title="Species Traits"
            />
          </aside>
        </div>

        <section className="rounded-[1.5rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)] md:p-5">
          <div className="border-b border-[#cfb58f]/55 pb-3">
            <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
              Origin Summary
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {viewModel.toolProficiency ? (
              <SummaryListCard
                emptyLabel="No tool proficiency recorded."
                entries={[viewModel.toolProficiency]}
                iconClass="fa-solid fa-screwdriver-wrench"
                title="Background Tool"
              />
            ) : null}
            {viewModel.originFeatName ? (
              <SummaryListCard
                emptyLabel="No origin feat confirmed."
                entries={[viewModel.originFeatName]}
                iconClass="fa-solid fa-stars"
                title="Origin Feat"
              />
            ) : null}
            {viewModel.selectedGrantGroups.map((group) => (
              <SummaryListCard
                emptyLabel={`No selections recorded for ${group.title}.`}
                entries={group.entries}
                iconClass={group.iconClass}
                key={group.id}
                title={group.title}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function SelectionPane({
  title,
  description,
  entries,
  selectedUuid,
  selectedEntry,
  emptyMessage,
  onSelect,
  renderMeta,
}: {
  title: string;
  description: string;
  entries: Array<CreatorIndexEntry & { selected?: boolean }>;
  selectedUuid: string | null;
  selectedEntry: (CreatorIndexEntry & { description?: string }) | null;
  emptyMessage: string;
  onSelect: (entry: CreatorIndexEntry) => void | Promise<void>;
  renderMeta?: (entry: CreatorIndexEntry & { selected?: boolean }) => ReactNode;
}) {
  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.8fr)]">
      <section className="fth-react-scrollbar min-h-0 overflow-y-auto rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
        <SectionHeading title={title} description={description} />
        {entries.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
            {entries.map((entry, index) => (
              <motion.button
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "group relative overflow-hidden rounded-[1.2rem] border p-2 text-left shadow-[0_16px_28px_rgba(67,43,23,0.12)] transition",
                  selectedUuid === entry.uuid
                    ? "border-[#9daa58] bg-[linear-gradient(180deg,rgba(243,245,212,0.98),rgba(227,232,180,0.94))]"
                    : "border-[#ceb18a] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,231,209,0.94))] hover:border-[#b68f63]",
                )}
                initial={{ opacity: 0, y: 10 }}
                key={entry.uuid}
                onClick={() => {
                  void onSelect(entry);
                }}
                transition={{ delay: index * 0.03, duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                type="button"
              >
                <div className="aspect-[0.84] overflow-hidden rounded-[1rem] border border-[#d4bb96] bg-[#20130e]">
                  {entry.img ? (
                    <img alt={entry.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" src={entry.img} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#f0d2a6]">
                      <i className="fa-solid fa-scroll text-2xl" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="px-1 pb-1 pt-3">
                  <div className="font-fth-cc-body text-[1rem] font-semibold leading-6 text-[#4c3524]">{entry.name}</div>
                  <CompactMetaChips chips={[entry.packLabel]} />
                  {renderMeta ? <div className="mt-2">{renderMeta(entry)}</div> : null}
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <EmptySelectionState message={emptyMessage} />
        )}
      </section>

      <aside className="grid gap-4 self-start">
        <DetailCard entry={selectedEntry} fallbackIcon="fa-solid fa-feather-pointed" />
      </aside>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="border-b border-[#cfb58f]/55 pb-4">
      {eyebrow ? (
        <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
          {eyebrow}
        </div>
      ) : null}
      <div className="mt-1 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em] text-[#4c3524]">
        {title}
      </div>
      {description ? (
        <p className="mt-2 font-fth-cc-body text-[0.97rem] leading-6 text-[#5f4636]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function DetailCard({
  entry,
  fallbackIcon,
}: {
  entry: (CreatorIndexEntry & { description?: string }) | null;
  fallbackIcon: string;
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
          ) : (
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

function HeroPortraitCard({ image, label, iconClass }: { image: string; label: string; iconClass: string }) {
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

function SummaryListCard({
  title,
  iconClass,
  entries,
  emptyLabel,
}: {
  title: string;
  iconClass: string;
  entries: string[];
  emptyLabel: string;
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
            <span
              className="rounded-full border border-[#d4bb96] bg-[rgba(255,252,246,0.82)] px-3 py-1.5 font-fth-cc-body text-[0.94rem] text-[#5f4636]"
              key={`${title}-${entry}`}
            >
              {entry}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 font-fth-cc-body text-[0.94rem] leading-6 text-[#6b5040]">{emptyLabel}</div>
      )}
    </section>
  );
}

function EmptySelectionState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-dashed border-[#c7aa80]/65 bg-[rgba(255,250,241,0.7)] px-4 py-5 font-fth-cc-body text-[#6b5040]">
      {message}
    </div>
  );
}

function CompactMetaChips({ chips }: { chips: string[] }) {
  const visible = chips.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visible.map((chip) => (
        <span
          className="rounded-full border border-[#d4bb96] bg-[rgba(255,252,246,0.82)] px-2.5 py-1 font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.16em] text-[#7a5a41]"
          key={chip}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] px-4 py-4 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
      <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">{label}</div>
      <div className="mt-2 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.08em] text-[#4c3524]">{value}</div>
    </div>
  );
}

function SelectionPip({ checked }: { checked: boolean }) {
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
