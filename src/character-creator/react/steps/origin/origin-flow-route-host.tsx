import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { buildOriginFlowShellModel } from "./build-origin-flow-shell-model";
import classStepFieldBackground from "../../../assets/class-step-field-bg.webp";
import classStepHeaderBackground from "../../../assets/class-step-header-bg.webp";
import { ClassAggregateStepper } from "../class/class-step-screen";
import { getClassTheme } from "../class/class-presentation";
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
    <section className="flex flex-col px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="relative flex flex-col rounded-[1.75rem] border border-[#e9c176]/25 bg-[linear-gradient(180deg,rgba(25,25,30,0.96),rgba(15,15,19,0.99))] p-[0.35rem] shadow-[0_30px_80px_rgba(0,0,0,0.38)]"
        initial={false}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-[0.35rem] rounded-[1.45rem] bg-[radial-gradient(circle_at_top,rgba(211,190,235,0.12),transparent_28%),linear-gradient(180deg,rgba(29,29,35,0.98),rgba(15,15,19,0.98))]" />

        <div className="relative flex flex-col rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(27,27,32,0.96),rgba(16,16,20,0.99))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
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

          <div className="relative flex flex-col px-3 pb-4 pt-3 md:px-6">
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

            <div className="relative z-10 mt-3 flex min-h-0 flex-1 flex-col">
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
      </motion.div>
    </section>
  );
}
