import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { buildOriginFlowShellModel } from "./build-origin-flow-shell-model";
import { ClassAggregateStepper } from "../class/class-step-screen";
import { useClassStepperLayoutMode } from "../class/class-stepper-layout";
import {
  buildEmptySpeciesChoicesState,
  getBackgroundLanguageOptions,
  getSpeciesLanguageOptions,
  getSpeciesChoiceValidationMessages,
} from "../../../steps/origin-flow-utils";
import {
  HeaderFlourish,
} from "./components/origin-pane-primitives";
import { BackgroundAsiPane } from "./panes/background-asi-pane";
import { BackgroundSelectionPane } from "./panes/background-selection-pane";
import { BackgroundSkillConflictPane } from "./panes/background-skill-conflict-pane";
import { LanguageChoicesPane } from "./panes/language-choices-pane";
import { OriginFeatPane } from "./panes/origin-feat-pane";
import { OriginSummaryPane } from "./panes/origin-summary-pane";
import { SpeciesItemChoicesPane } from "./panes/species-item-choices-pane";
import { SpeciesSkillsPane } from "./panes/species-skills-pane";
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

  useEffect(() => {
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
    <section className="cc-origin-flow-shell flex flex-col px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="cc-theme-shell cc-origin-flow-shell__frame relative flex flex-col rounded-[1.75rem] p-[0.35rem]"
        initial={false}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="cc-theme-shell-inner relative flex flex-col rounded-[1.45rem]">
          <motion.header
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            className="mx-2 mt-2 px-4 pt-3 md:px-6"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
            transition={{ delay: 0.05, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cc-theme-header cc-theme-header--hero cc-origin-flow-shell__header relative overflow-hidden rounded-[1.15rem] border px-4 py-3 md:px-5">
              <div className="pointer-events-none absolute inset-0 cc-theme-hero-shell opacity-80" />
              <div className="relative z-10 flex items-center justify-center gap-3">
                <HeaderFlourish side="left" />
                <div className="min-w-0 flex-1 text-center" style={{ containerType: "inline-size" }}>
                  <div className="cc-theme-kicker font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.26em]">
                    Origins
                  </div>
                  <h2
                    className="cc-theme-title m-0 mt-1 font-fth-cc-display uppercase tracking-[0.12em] text-[clamp(1.075rem,8cqi,2.15rem)] leading-none"
                  >
                    {shellModel.title}
                  </h2>
                </div>
                <HeaderFlourish side="right" />
              </div>
            </div>
          </motion.header>

          <div className="relative flex flex-col px-3 pb-4 pt-3 md:px-6">
            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3">
              <div
                ref={setStepperContainer}
                className="cc-theme-panel cc-theme-panel--soft rounded-[1.25rem] border px-3 py-3 md:px-4"
              >
                <ClassAggregateStepper
                  layoutMode={layoutMode}
                  model={shellModel.aggregateStepper}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={shellModel.currentPane}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                  className="flex w-full flex-col"
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
                      guidance="Choose the languages that best fit the character's story and background. The summary keeps the current picks visible so you can remove any choice before moving on."
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
                      guidance="Choose the languages that fit your species and the life they have lived. The summary keeps the current picks visible so you can remove any choice before moving on."
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
        </div>
      </motion.div>
    </section>
  );
}
