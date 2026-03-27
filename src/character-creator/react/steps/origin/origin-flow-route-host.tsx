import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { buildOriginFlowShellModel } from "./build-origin-flow-shell-model";
import classStepFieldBackground from "../../../assets/class-step-field-bg.webp";
import classStepHeaderBackground from "../../../assets/class-step-header-bg.webp";
import { ClassAggregateStepper } from "../class/class-step-screen";
import { getClassTheme } from "../class/class-presentation";
import { useClassStepperLayoutMode } from "../class/class-stepper-layout";
import {
  buildEmptySpeciesChoicesState,
  getAvailableSpeciesSkillOptions,
  getBackgroundLanguageOptions,
  getSpeciesLanguageOptions,
} from "../../../steps/origin-flow-utils";
import {
  CompactMetaChips,
  HeaderFlourish,
  HeroPortraitCard,
  type OriginPaneProps,
  EmptySelectionState,
  SectionHeading,
  SelectionPip,
  StatCard,
  SummaryListCard,
} from "./components/origin-pane-primitives";
import { BackgroundAsiPane } from "./panes/background-asi-pane";
import { BackgroundSelectionPane } from "./panes/background-selection-pane";
import { BackgroundSkillConflictPane } from "./panes/background-skill-conflict-pane";
import { LanguageChoicesPane } from "./panes/language-choices-pane";
import { OriginFeatPane } from "./panes/origin-feat-pane";
import { SpeciesItemChoicesPane } from "./panes/species-item-choices-pane";
import { SpeciesSelectionPane } from "./panes/species-selection-pane";

type BackgroundLanguagesViewModel = {
  title: string;
  description: string;
  requiredCount: number;
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
  "backgroundSkillConflicts",
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
  const [layoutMode, setStepperContainer] = useClassStepperLayoutMode();
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
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[#e9c176]/25 bg-[linear-gradient(180deg,rgba(25,25,30,0.96),rgba(15,15,19,0.99))] p-[0.35rem] shadow-[0_30px_80px_rgba(0,0,0,0.38)]"
        initial={false}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-[0.35rem] rounded-[1.45rem] bg-[radial-gradient(circle_at_top,rgba(211,190,235,0.12),transparent_28%),linear-gradient(180deg,rgba(29,29,35,0.98),rgba(15,15,19,0.98))]" />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(27,27,32,0.96),rgba(16,16,20,0.99))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <motion.header
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            className="mx-2 mt-2 px-4 pb-3 pt-3 md:px-6"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
            transition={{ delay: 0.05, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="relative overflow-hidden rounded-[1.15rem] border border-fth-cc-gold/50"
              style={{
                borderColor: `${theme.frame}9c`,
                boxShadow: `inset 0 1px 0 rgba(255,236,206,0.22), 0 10px 22px rgba(0,0,0,0.18), 0 18px 34px rgba(77,46,18,0.2), 0 0 20px ${theme.glow}`,
              }}
            >
              <img
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                src={classStepHeaderBackground}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,11,0.24),rgba(16,12,11,0.42))]" />
              <div className="relative z-10 flex items-center justify-center px-4 py-3">
                <HeaderFlourish side="left" />
                <div className="relative min-w-0 flex-1" style={{ containerType: "inline-size" }}>
                  <h2
                    className="m-0 text-center font-fth-cc-display uppercase tracking-[0.12em] text-fth-cc-gold-bright"
                    style={{
                      color: "#f7e7c6",
                      fontSize: "clamp(1.075rem, 8cqi, 2.15rem)",
                      lineHeight: 1.05,
                      textShadow: `0 0 9px rgba(255,230,178,0.36), 0 0 18px ${theme.glow}, 0 2px 10px rgba(16, 9, 6, 0.72)`,
                    }}
                  >
                    {shellModel.title}
                  </h2>
                </div>
                <HeaderFlourish side="right" />
              </div>
            </div>
          </motion.header>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-3 md:px-6">
            <img
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16]"
              src={classStepFieldBackground}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(211,190,235,0.1),rgba(15,15,19,0)_52%,rgba(233,193,118,0.06)_100%)]" />
            <div ref={setStepperContainer} className="relative z-10 w-full">
              <ClassAggregateStepper
                layoutMode={layoutMode}
                model={shellModel.aggregateStepper}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>

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
                    <BackgroundSelectionPane
                      controller={controller}
                      prefersReducedMotion={prefersReducedMotion}
                      shellContext={shellContext}
                      state={state}
                    />
                  ) : shellModel.currentPane === "backgroundSkillConflicts" ? (
                  <BackgroundSkillConflictPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "backgroundAsi" ? (
                    <BackgroundAsiPane
                      controller={controller}
                      prefersReducedMotion={prefersReducedMotion}
                      shellContext={shellContext}
                      state={state}
                    />
                  ) : shellModel.currentPane === "backgroundLanguages" ? (
                    <LanguageChoicesPane
                      description={(shellContext.stepViewModel as BackgroundLanguagesViewModel | undefined)?.description ?? ""}
                      emptyMessage="No background language choices are available."
                      options={getBackgroundLanguageOptions(state)}
                      requiredCount={(shellContext.stepViewModel as BackgroundLanguagesViewModel | undefined)?.requiredCount ?? 0}
                      selectedIds={state.selections.background?.languages.chosen ?? []}
                      selectionLabel="Select Languages"
                      subtitle={state.selections.background?.name ?? "Background"}
                      title={(shellContext.stepViewModel as BackgroundLanguagesViewModel | undefined)?.title ?? "Choose Languages"}
                      onChange={(chosen) => {
                        if (!state.selections.background) return;
                        state.selections.background.languages.chosen = chosen;
                        void controller.refresh();
                      }}
                    />
                  ) : shellModel.currentPane === "originChoices" ? (
                    <OriginFeatPane
                      controller={controller}
                      prefersReducedMotion={prefersReducedMotion}
                      shellContext={shellContext}
                      state={state}
                    />
                  ) : shellModel.currentPane === "species" ? (
                    <SpeciesSelectionPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "speciesSkills" ? (
                    <SpeciesSkillsPane controller={controller} shellContext={shellContext} state={state} />
                  ) : shellModel.currentPane === "speciesLanguages" ? (
                    <LanguageChoicesPane
                      description={(shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined)?.description ?? ""}
                      emptyMessage="No species language choices are available."
                      options={getSpeciesLanguageOptions(state)}
                      selectedSummaryEmptyLabel="No species languages selected yet."
                      selectedSummaryTitle="Chosen Species Languages"
                      selectionLabel="Select Species Languages"
                      requiredCount={(shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined)?.requiredCount ?? 0}
                      selectedIds={state.selections.speciesChoices?.chosenLanguages ?? []}
                      statLabel="Species Languages"
                      subtitle={state.selections.species?.name ?? "Species"}
                      validationMessages={(shellContext.stepViewModel as SpeciesAdvancementViewModel | undefined)?.validationMessages ?? getSpeciesChoiceValidationMessages(state)}
                      validationTitle="Species Language Notes"
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
          entries={selectedIds.map((entry) => ({
            id: entry,
            label: options.find((candidate) => candidate.id === entry)?.label ?? entry,
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
              entries={viewModel.fixedLanguages.map((entry) => ({ id: entry, label: entry }))}
              iconClass="fa-solid fa-language"
              title="Fixed Languages"
            />
            <SummaryListCard
              emptyLabel="No species traits listed."
              entries={viewModel.speciesTraits.map((entry) => ({ id: entry, label: entry }))}
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
                entries={[{ id: viewModel.toolProficiency, label: viewModel.toolProficiency }]}
                iconClass="fa-solid fa-screwdriver-wrench"
                title="Background Tool"
              />
            ) : null}
            {viewModel.originFeatName ? (
              <SummaryListCard
                emptyLabel="No origin feat confirmed."
                entries={[{ id: viewModel.originFeatName, label: viewModel.originFeatName }]}
                iconClass="fa-solid fa-stars"
                title="Origin Feat"
              />
            ) : null}
            {viewModel.selectedGrantGroups.map((group) => (
              <SummaryListCard
                emptyLabel={`No selections recorded for ${group.title}.`}
                entries={group.entries.map((entry) => ({ id: entry, label: entry }))}
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
