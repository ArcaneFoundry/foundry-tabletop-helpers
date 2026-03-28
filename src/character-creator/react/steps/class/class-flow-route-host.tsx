import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  ClassAdvancementSelectionsState,
  ClassSelection,
  CreatorIndexEntry,
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { ClassAggregateStepper } from "./class-step-screen";
import { useClassStepperLayoutMode } from "./class-stepper-layout";
import { buildClassFlowShellModel } from "./build-class-flow-shell-model";
import { ClassCard } from "./class-card";
import { ClassSelectionGalleryPane } from "./class-selection-gallery-pane";
import { ClassSummaryStepScreen } from "./class-summary-step-screen";
import {
  buildClassSelectionFromEntry,
  getClassStepViewModel,
} from "../../../steps/step-class-model";
import classStepHeaderBackground from "../../../assets/class-step-header-bg.webp";
import classStepFieldBackground from "../../../assets/class-step-field-bg.webp";
import { ensureCharacterCreatorIndexesReady } from "../../../character-creator-index-cache";
import { buildEmptyClassAdvancementSelections } from "../../../steps/class-advancement-utils";
import { getWeaponMasteryPackSources } from "../../../steps/step-weapon-masteries";

type ClassStepViewModel = Awaited<ReturnType<typeof getClassStepViewModel>>;
type ClassEntryViewModel = ClassStepViewModel["entries"][number];

type SkillChoiceOption = {
  key: string;
  label: string;
  abilityAbbrev: string;
  checked: boolean;
  disabled: boolean;
  iconClass: string;
  tooltip: string;
};

const CLASS_SKILL_ABILITY_ORDER = ["STR", "DEX", "CON", "WIS", "INT", "CHA"] as const;

type ClassChoicesStepViewModel = {
  classIdentifier: string;
  primaryAbilityHint: string;
  savingThrows: string[];
  skillSection: {
    hasChoices: boolean;
    chosenCount: number;
    maxCount: number;
    selectedEntries: Array<{
      label: string;
    }>;
    options: SkillChoiceOption[];
    emptyMessage: string;
  };
};

type WeaponMasteryChoiceOption = {
  id: string;
  uuid: string;
  identifier: string;
  name: string;
  img: string;
  weaponType: string;
  mastery: string;
  masteryDescription: string;
  weaponDescription: string;
  tooltip: string;
  checked: boolean;
  disabled: boolean;
};

type MasteryReferenceEntry = {
  mastery: string;
  masteryDescription: string;
  iconClass: string;
  sourceWeapons: string[];
};

type WeaponMasteriesStepViewModel = {
  classIdentifier: string;
  className: string;
  weaponMasterySection: {
    hasChoices: boolean;
    chosenCount: number;
    maxCount: number;
    selectedEntries: Array<{
      label: string;
      img?: string;
      mastery?: string;
      tooltip: string;
    }>;
    options: WeaponMasteryChoiceOption[];
    emptyMessage: string;
  };
};

type ClassAdvancementChoiceOption = {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  description?: string;
  iconClass?: string;
};

type SelectedClassToken = {
  id?: string;
  key?: string;
  label: string;
  description?: string;
  iconClass?: string;
};

type ClassAdvancementCommonStepViewModel = {
  classIdentifier: string;
  className: string;
  type: "expertise" | "languages" | "tools";
  title: string;
  description: string;
  selectedCount: number;
  requiredCount: number;
  selectedEntries: ClassAdvancementChoiceOption[];
  options: ClassAdvancementChoiceOption[];
};

type ClassItemChoiceRequirementViewModel = {
  id: string;
  title: string;
  requiredCount: number;
  selectedIds: string[];
  options: ClassAdvancementChoiceOption[];
};

type ClassItemChoicesStepViewModel = {
  classIdentifier: string;
  className: string;
  type: "itemChoices";
  title: string;
  description: string;
  requirements: ClassItemChoiceRequirementViewModel[];
};

const CLASS_FLOW_STEP_IDS = new Set([
  "class",
  "classChoices",
  "classExpertise",
  "classLanguages",
  "classTools",
  "weaponMasteries",
  "classItemChoices",
  "classSummary",
]);

const CLASS_THEMES: Record<string, { ribbon: string; frame: string; glow: string; crest: string; accent: string; sigil: string }> = {
  barbarian: { ribbon: "from-[#714126] to-[#382015]", frame: "#b57d4d", glow: "rgba(201,124,58,0.35)", crest: "fa-solid fa-fire", accent: "#b57d4d", sigil: "fa-solid fa-fire" },
  bard: { ribbon: "from-[#6e4934] to-[#302018]", frame: "#be9361", glow: "rgba(216,165,103,0.3)", crest: "fa-solid fa-music", accent: "#be9361", sigil: "fa-solid fa-music" },
  cleric: { ribbon: "from-[#665b3b] to-[#2f2819]", frame: "#bca26e", glow: "rgba(212,185,104,0.3)", crest: "fa-solid fa-sun", accent: "#bca26e", sigil: "fa-solid fa-sun" },
  druid: { ribbon: "from-[#46562f] to-[#202715]", frame: "#96a663", glow: "rgba(123,156,82,0.34)", crest: "fa-solid fa-leaf", accent: "#96a663", sigil: "fa-solid fa-leaf" },
  fighter: { ribbon: "from-[#5f4431] to-[#2a1c14]", frame: "#b48959", glow: "rgba(196,145,89,0.32)", crest: "fa-solid fa-swords", accent: "#b48959", sigil: "fa-solid fa-swords" },
  monk: { ribbon: "from-[#74543a] to-[#352316]", frame: "#c89f6d", glow: "rgba(215,164,104,0.34)", crest: "fa-solid fa-hand-fist", accent: "#c89f6d", sigil: "fa-solid fa-hand-fist" },
  paladin: { ribbon: "from-[#625342] to-[#2a221a]", frame: "#d3b27b", glow: "rgba(220,190,121,0.32)", crest: "fa-solid fa-shield-halved", accent: "#d3b27b", sigil: "fa-solid fa-shield-halved" },
  ranger: { ribbon: "from-[#4f5f2f] to-[#233015]", frame: "#a8b95f", glow: "rgba(155,189,88,0.36)", crest: "fa-solid fa-bow-arrow", accent: "#a8b95f", sigil: "fa-solid fa-bow-arrow" },
  rogue: { ribbon: "from-[#4f4447] to-[#241d1f]", frame: "#b08995", glow: "rgba(174,127,146,0.32)", crest: "fa-solid fa-mask", accent: "#b08995", sigil: "fa-solid fa-mask" },
  sorcerer: { ribbon: "from-[#74413c] to-[#341b17]", frame: "#c18377", glow: "rgba(210,125,112,0.34)", crest: "fa-solid fa-wand-sparkles", accent: "#c18377", sigil: "fa-solid fa-wand-sparkles" },
  warlock: { ribbon: "from-[#5c3d5f] to-[#29182a]", frame: "#b285bb", glow: "rgba(173,118,186,0.34)", crest: "fa-solid fa-book-open", accent: "#b285bb", sigil: "fa-solid fa-book-open" },
  wizard: { ribbon: "from-[#3f506a] to-[#1a2230]", frame: "#7ea3d5", glow: "rgba(111,154,215,0.34)", crest: "fa-solid fa-hat-wizard", accent: "#7ea3d5", sigil: "fa-solid fa-hat-wizard" },
};

const PROFICIENCY_BONUS = "+2";

export function isClassFlowStep(stepId: string | undefined): boolean {
  return Boolean(stepId && CLASS_FLOW_STEP_IDS.has(stepId));
}

export function getClassFlowTransitionKey(stepId: string | undefined): string {
  return isClassFlowStep(stepId) ? "class-flow" : (stepId ?? "");
}

export function ClassFlowRouteHost(
  { shellContext, state, controller, step, pendingTransition }: ReactWizardStepProps & {
    pendingTransition?: { targetStepId: string; message: string } | null;
  },
) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const shellModel = useMemo(
    () => buildClassFlowShellModel(state, shellContext.steps, shellContext.currentStepId),
    [shellContext.currentStepId, shellContext.steps, state],
  );
  const [layoutMode, setStepperContainer] = useClassStepperLayoutMode();
  const theme = getClassTheme(shellModel.selectedClassIdentifier ?? "fighter");
  const titleStyle = getClassFlowTitleStyle(shellModel.headerTone, theme);
  const headerFrameStyle = getClassFlowHeaderFrameStyle(shellModel.headerTone, theme);

  useEffect(() => {
    if (!["class", "classChoices", "classExpertise", "classLanguages", "classTools", "classItemChoices"].includes(shellModel.currentPane)) return;
    if (!state.selections.class?.hasWeaponMastery || getRequiredWeaponMasteryCount(state) <= 0) return;
    void ensureCharacterCreatorIndexesReady(getWeaponMasteryPackSources(state.config.packSources), {
      contentKeys: ["items"],
      persistIfMissing: true,
    });
  }, [shellModel.currentPane, state.config.packSources, state.selections.class?.hasWeaponMastery, state.selections.class?.weaponMasteryCount]);

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
              style={headerFrameStyle}
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
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h2
                      key={shellModel.title}
                      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                      className="m-0 text-center font-fth-cc-display uppercase tracking-[0.12em] text-fth-cc-gold-bright"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        ...titleStyle,
                        fontSize: "clamp(1.075rem, 8cqi, 2.15rem)",
                        lineHeight: 1.05,
                      }}
                    >
                      {shellModel.title}
                    </motion.h2>
                  </AnimatePresence>
                </div>
                <HeaderFlourish side="right" />
              </div>
            </div>
          </motion.header>

          <div className="cc-class-flow-chapter relative z-10 mt-3 flex min-h-0 flex-1 flex-col">
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

              <div className="relative z-10 mt-3 flex min-h-0 flex-1 flex-col">
                <AnimatePresence initial={false} mode="wait">
                  {pendingTransition?.targetStepId === "weaponMasteries" ? (
                    <motion.div
                      key="weaponMasteries-loading"
                      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      className="flex h-full min-h-0 w-full flex-1 self-stretch"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <WeaponMasteriesLoadingPane
                        message={pendingTransition.message}
                        theme={theme}
                      />
                    </motion.div>
                  ) : shellModel.currentPane === "classChoices" ? (
                    <motion.div
                      key="classChoices"
                      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      className="flex h-full min-h-0 flex-col"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ClassSkillsPane controller={controller} shellContext={shellContext} state={state} />
                    </motion.div>
                  ) : shellModel.currentPane === "classExpertise" || shellModel.currentPane === "classLanguages" || shellModel.currentPane === "classTools" ? (
                    <motion.div
                      key={shellModel.currentPane}
                      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      className="flex h-full min-h-0 flex-col"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ClassAdvancementChoicePane controller={controller} shellContext={shellContext} state={state} />
                    </motion.div>
                  ) : shellModel.currentPane === "weaponMasteries" ? (
                    <motion.div
                      key="weaponMasteries"
                      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      className="flex h-full min-h-0 flex-col"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <WeaponMasteriesPane controller={controller} shellContext={shellContext} state={state} />
                    </motion.div>
                  ) : shellModel.currentPane === "classItemChoices" ? (
                    <motion.div
                      key="classItemChoices"
                      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      className="flex h-full min-h-0 flex-col"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ClassItemChoicesPane controller={controller} shellContext={shellContext} state={state} />
                    </motion.div>
                  ) : shellModel.currentPane === "classSummary" ? (
                    <motion.div
                      key="classSummary"
                      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      className="flex h-full min-h-0 flex-col"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ClassSummaryStepScreen controller={controller} shellContext={shellContext} state={state} step={step} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="class"
                      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                      className="flex h-full min-h-0 flex-col"
                      exit={prefersReducedMotion ? undefined : { opacity: 0, x: 14 }}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: -14 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ClassSelectionPane controller={controller} state={state} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function buildNextClassAdvancementSelections(
  current: ClassAdvancementSelectionsState | undefined,
): ClassAdvancementSelectionsState {
  return {
    ...buildEmptyClassAdvancementSelections(),
    ...(current ?? {}),
    itemChoices: {
      ...(current?.itemChoices ?? {}),
    },
  };
}

function WeaponMasteriesLoadingPane(
  { message, theme }: { message: string; theme: ReturnType<typeof getClassTheme> },
) {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 items-center justify-center self-stretch"
    >
      <div
        className="flex min-h-[22rem] w-full max-w-xl flex-col items-center justify-center gap-5 rounded-[1.6rem] bg-[rgba(39,25,17,0.8)] px-8 py-10 text-center text-fth-cc-light shadow-[0_20px_48px_rgba(24,12,8,0.34)]"
        style={{ border: `1px solid ${theme.accent}59` }}
      >
        <div
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,248,239,0.08)] shadow-[0_0_18px_rgba(0,0,0,0.28)]"
          style={{ border: `1px solid ${theme.accent}80`, color: theme.accent }}
        >
          <span
            aria-hidden="true"
            className="block h-7 w-7 animate-spin rounded-full border-[3px] border-current/25 border-t-current"
          />
        </div>
        <div className="space-y-2">
          <div className="font-fth-cc-display text-xl uppercase tracking-[0.14em] text-fth-cc-gold-bright">
            Preparing Weapon Masteries
          </div>
          <p className="mx-auto max-w-md font-fth-cc-ui text-sm leading-6 text-fth-cc-light/80">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function getRequiredWeaponMasteryCount(state: ReactWizardStepProps["state"]): number {
  return state.selections.class?.weaponMasteryCount ?? 0;
}

function getClassFlowTitleStyle(
  headerTone: "default" | "accent",
  theme: ReturnType<typeof getClassTheme>,
) {
  if (headerTone === "accent") {
    return {
      color: "#f7e7c6",
      textShadow: `0 0 9px rgba(255,230,178,0.36), 0 0 18px ${theme.glow}, 0 2px 10px rgba(16, 9, 6, 0.72)`,
    };
  }

  return {
    textShadow:
      "0 0 8px rgba(255,225,164,0.4), 0 0 18px rgba(255,211,130,0.2), 0 2px 10px rgba(16, 9, 6, 0.72)",
  };
}

function getClassFlowHeaderFrameStyle(
  headerTone: "default" | "accent",
  theme: ReturnType<typeof getClassTheme>,
) {
  if (headerTone === "accent") {
    return {
      borderColor: `${theme.frame}9c`,
      boxShadow: `inset 0 1px 0 rgba(255,236,206,0.22), 0 10px 22px rgba(0,0,0,0.18), 0 18px 34px rgba(77,46,18,0.2), 0 0 20px ${theme.glow}`,
    };
  }

  return {
    boxShadow: "inset 0 1px 0 rgba(255,236,206,0.22), 0 10px 22px rgba(0,0,0,0.18), 0 18px 34px rgba(77,46,18,0.2)",
  };
}

function ClassSelectionPane({ state, controller }: Pick<ReactWizardStepProps, "state" | "controller">) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [entries, setEntries] = useState<ClassEntryViewModel[]>([]);
  const [emptyMessage, setEmptyMessage] = useState("No classes available. Check your GM configuration.");
  const selectedUuid = (state.selections.class as ClassSelection | undefined)?.uuid ?? null;

  useEffect(() => {
    let cancelled = false;
    void getClassStepViewModel(state).then((viewModel) => {
      if (cancelled) return;
      setEntries(viewModel.entries);
      setEmptyMessage(viewModel.emptyMessage);
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const onSelectEntry = async (entry: CreatorIndexEntry) => {
    const selection = await buildClassSelectionFromEntry(state, entry);
    controller.updateCurrentStepData(selection, { silent: true });
    setEntries((currentEntries) => currentEntries.map((candidate) => ({
      ...candidate,
      selected: candidate.uuid === entry.uuid,
    })));
  };

  return (
    <ClassSelectionGalleryPane
      emptyState={(
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-2xl rounded-[1.5rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(37,34,42,0.96),rgba(16,16,20,0.98))] px-8 py-10 text-center shadow-[0_24px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#e9c176]/45 bg-[radial-gradient(circle_at_35%_35%,#f1d08a,#8e6428)] text-[#2d1f0b] shadow-[0_0_20px_rgba(233,193,118,0.18)]">
              <i className="fa-solid fa-triangle-exclamation text-xl" aria-hidden="true" />
            </div>
            <p className="m-0 font-fth-cc-display text-[1.5rem] uppercase tracking-[0.08em] text-[#f1e6d3]">
              No Classes Available
            </p>
            <p className="mt-3 font-fth-cc-body text-[1.02rem] leading-7 text-[#cbc2bc]">{emptyMessage}</p>
          </div>
        </div>
      )}
      entries={entries}
      getEntryKey={(entry) => entry.uuid}
      prefersReducedMotion={prefersReducedMotion}
      renderEntry={(entry) => (
        <ClassCard
          entry={entry}
          onSelect={onSelectEntry}
          prefersReducedMotion={prefersReducedMotion}
          selected={selectedUuid === entry.uuid}
        />
      )}
    />
  );
}

function ClassSkillsPane({ shellContext, state, controller }: Pick<ReactWizardStepProps, "shellContext" | "state" | "controller">) {
  const viewModel = shellContext.stepViewModel as ClassChoicesStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    viewModel.skillSection.selectedEntries.map((entry) => viewModel.skillSection.options.find((option) => option.label === entry.label)?.key)
      .filter((value): value is string => Boolean(value)),
  );

  useEffect(() => {
    setSelectedKeys(
      viewModel.skillSection.selectedEntries
        .map((entry) => viewModel.skillSection.options.find((option) => option.label === entry.label)?.key)
        .filter((value): value is string => Boolean(value)),
    );
  }, [viewModel]);

  const theme = getClassTheme(viewModel.classIdentifier);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const maxCount = viewModel.skillSection.maxCount;
  const options = useMemo(
    () => viewModel.skillSection.options.map((option) => ({
      ...option,
      checked: selectedSet.has(option.key),
      disabled: !selectedSet.has(option.key) && selectedSet.size >= maxCount,
    })),
    [maxCount, selectedSet, viewModel.skillSection.options],
  );

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, SkillChoiceOption[]>();
    for (const option of options) {
      const key = option.abilityAbbrev.trim().toUpperCase();
      const existing = groups.get(key) ?? [];
      existing.push(option);
      groups.set(key, existing);
    }

    return CLASS_SKILL_ABILITY_ORDER.flatMap((abilityAbbrev) => {
      const entries = groups.get(abilityAbbrev);
      return entries ? [{ abilityAbbrev, entries }] : [];
    });
  }, [options]);

  const onToggleSkill = (skillKey: string) => {
    const option = options.find((candidate) => candidate.key === skillKey);
    if (!option) return;
    const nextSelected = new Set(selectedKeys);
    if (nextSelected.has(skillKey)) nextSelected.delete(skillKey);
    else {
      if (nextSelected.size >= maxCount) return;
      nextSelected.add(skillKey);
    }

    const chosenSkills = Array.from(nextSelected);
    state.selections.skills = { chosen: chosenSkills };
    controller.updateCurrentStepData({ chosenSkills }, { silent: true });
    setSelectedKeys(chosenSkills);
  };

  return (
    <div className="cc-class-choice-layout">
      <section className="cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,32,39,0.94),rgba(18,18,24,0.98))] p-4 shadow-[0_24px_44px_rgba(0,0,0,0.22)]">
        <div className="border-b border-white/10 pb-4">
          {viewModel.primaryAbilityHint ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e9c176]/22 bg-[rgba(233,193,118,0.08)] px-3 py-1.5 font-fth-cc-body text-sm text-[#ddd5ce]">
              <i className={cn(theme.sigil, "text-[#e9c176]")} aria-hidden="true" />
              <span><strong>Prime Attribute Guidance:</strong> {viewModel.primaryAbilityHint}</span>
            </div>
          ) : null}
        </div>

        {viewModel.skillSection.hasChoices ? (
          <div className="cc-class-choice-layout__content-scroll fth-react-scrollbar mt-4 flex min-h-0 flex-1 flex-col px-1 pb-3 pt-2 pr-2">
            <div className="grid gap-4">
              {groupedOptions.map((group, groupIndex) => (
                <section className="grid gap-2.5" data-class-skill-group={group.abilityAbbrev} key={group.abilityAbbrev}>
                  <div className="flex items-center gap-3 px-1">
                    <span className="inline-flex items-center rounded-full border border-[#8c6a47]/75 bg-[linear-gradient(180deg,#5b3d2b_0%,#3a271b_100%)] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#f1d9b3] shadow-[0_10px_18px_rgba(47,29,18,0.14)]">
                      {group.abilityAbbrev}
                    </span>
                    <span className="font-fth-cc-body text-[0.95rem] font-semibold text-[#bdb4c0]">
                      {abilityLabel(group.abilityAbbrev)}
                    </span>
                    <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(202,173,125,0.5),rgba(202,173,125,0.12))]" />
                  </div>
                  {group.entries.map((option, optionIndex) => (
                    <SkillOptionRow
                      key={option.key}
                      onToggle={onToggleSkill}
                      option={option}
                      prefersReducedMotion={prefersReducedMotion}
                      rowIndex={groupIndex * 10 + optionIndex}
                    />
                  ))}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[1.1rem] border border-dashed border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-5 font-fth-cc-body text-[#bfb8c4]">
            {viewModel.skillSection.emptyMessage}
          </div>
        )}
      </section>

      <aside className="cc-class-choice-layout__rail flex min-h-0 flex-col gap-4">
        <SelectionSummaryCard
          accent={theme.accent}
          glow={theme.glow}
          maxCount={maxCount}
          selectedCount={selectedKeys.length}
        />
        <ClassAdvancementSelectedCard
          emptyMessage="No class skills chosen yet."
          entries={options.filter((option) => selectedSet.has(option.key))}
          title="Chosen Skills"
        />
        <ClassProficienciesCard savingThrows={viewModel.savingThrows} />
      </aside>
    </div>
  );
}

function WeaponMasteriesPane({ shellContext, state, controller }: Pick<ReactWizardStepProps, "shellContext" | "state" | "controller">) {
  const viewModel = shellContext.stepViewModel as WeaponMasteriesStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const [selectedIds, setSelectedIds] = useState<string[]>(
    viewModel.weaponMasterySection.options.filter((option) => option.checked).map((option) => option.id),
  );

  useEffect(() => {
    setSelectedIds(viewModel.weaponMasterySection.options.filter((option) => option.checked).map((option) => option.id));
  }, [viewModel]);

  const theme = getClassTheme(viewModel.classIdentifier);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const maxCount = viewModel.weaponMasterySection.maxCount;
  const options = useMemo(
    () => viewModel.weaponMasterySection.options.map((option) => ({
      ...option,
      checked: selectedSet.has(option.id),
      disabled: !selectedSet.has(option.id) && selectedSet.size >= maxCount,
    })),
    [maxCount, selectedSet, viewModel.weaponMasterySection.options],
  );

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, WeaponMasteryChoiceOption[]>();
    for (const option of options) {
      const groupKey = option.weaponType.startsWith("Martial") ? "Martial Weapons" : "Simple Weapons";
      const existing = groups.get(groupKey) ?? [];
      existing.push(option);
      groups.set(groupKey, existing);
    }
    return Array.from(groups.entries()).map(([label, entries]) => ({ label, entries }));
  }, [options]);

  const selectedEntries = useMemo(
    () => options.filter((option) => selectedSet.has(option.id)),
    [options, selectedSet],
  );

  const masteryReference = useMemo<MasteryReferenceEntry[]>(() => {
    const masteryMap = new Map<string, MasteryReferenceEntry>();
    for (const option of options) {
      const key = option.mastery.toLowerCase();
      const existing = masteryMap.get(key);
      const sourceWeapons = selectedSet.has(option.id) ? [option.name] : [];
      if (existing) {
        for (const weaponName of sourceWeapons) {
          if (!existing.sourceWeapons.includes(weaponName)) existing.sourceWeapons.push(weaponName);
        }
        continue;
      }

      masteryMap.set(key, {
        mastery: option.mastery,
        masteryDescription: option.masteryDescription,
        iconClass: getMasteryIcon(option.mastery),
        sourceWeapons,
      });
    }

    return [...masteryMap.values()].sort((left, right) => {
      const leftSelected = left.sourceWeapons.length > 0 ? 0 : 1;
      const rightSelected = right.sourceWeapons.length > 0 ? 0 : 1;
      if (leftSelected !== rightSelected) return leftSelected - rightSelected;
      return left.mastery.localeCompare(right.mastery);
    });
  }, [options, selectedSet]);

  const onToggleMastery = (weaponId: string) => {
    const option = options.find((candidate) => candidate.id === weaponId);
    if (!option) return;

    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(weaponId)) nextSelected.delete(weaponId);
    else {
      if (nextSelected.size >= maxCount) return;
      nextSelected.add(weaponId);
    }

    const chosenWeaponMasteries = Array.from(nextSelected);
    const chosenWeaponMasteryDetails = options
      .filter((candidate) => nextSelected.has(candidate.id))
      .map((candidate) => ({
        id: candidate.id,
        label: candidate.name,
        img: candidate.img,
        mastery: candidate.mastery,
        tooltip: candidate.tooltip,
      }));

    state.selections.weaponMasteries = {
      chosenWeaponMasteries,
      chosenWeaponMasteryDetails,
      availableWeaponMasteries: options.length,
    };
    controller.updateCurrentStepData({
      chosenWeaponMasteries,
      chosenWeaponMasteryDetails,
      availableWeaponMasteries: options.length,
    }, { silent: true });
    setSelectedIds(chosenWeaponMasteries);
  };

  return (
    <div className="cc-class-choice-layout">
      <section className="cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,32,39,0.94),rgba(18,18,24,0.98))] p-4 shadow-[0_24px_44px_rgba(0,0,0,0.22)]">
        {viewModel.weaponMasterySection.hasChoices ? (
          <div className="cc-class-choice-layout__content-scroll fth-react-scrollbar flex min-h-0 flex-1 flex-col px-1 pb-3 pt-2 pr-2">
            <div className="grid gap-4">
              {groupedOptions.map((group, groupIndex) => (
                <section className="grid gap-2.5" key={group.label}>
                  <div className="flex items-center gap-3 px-1">
                    <span className="inline-flex items-center rounded-full border border-[#8c6a47]/75 bg-[linear-gradient(180deg,#5b3d2b_0%,#3a271b_100%)] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#f1d9b3] shadow-[0_10px_18px_rgba(47,29,18,0.14)]">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(202,173,125,0.5),rgba(202,173,125,0.12))]" />
                  </div>
                  {group.entries.map((option, optionIndex) => (
                    <WeaponMasteryRow
                      key={option.id}
                      onToggle={onToggleMastery}
                      option={option}
                      prefersReducedMotion={prefersReducedMotion}
                      rowIndex={groupIndex * 12 + optionIndex}
                    />
                  ))}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[1.1rem] border border-dashed border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-5 font-fth-cc-body text-[#bfb8c4]">
            {viewModel.weaponMasterySection.emptyMessage}
          </div>
        )}
      </section>

      <aside className="cc-class-choice-layout__rail flex min-h-0 flex-col gap-4">
        <SelectionSummaryCard
          accent={theme.accent}
          glow={theme.glow}
          label="Weapon Types Chosen"
          maxCount={maxCount}
          selectedCount={selectedIds.length}
          title="Masteries Summary"
        />
        <SelectedMasteriesCard selectedEntries={selectedEntries} />
        <MasteryReferenceCard entries={masteryReference} />
      </aside>
    </div>
  );
}

function ClassAdvancementChoicePane({ shellContext, state, controller }: Pick<ReactWizardStepProps, "shellContext" | "state" | "controller">) {
  const viewModel = shellContext.stepViewModel as ClassAdvancementCommonStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const [selectedIds, setSelectedIds] = useState<string[]>(viewModel.selectedEntries.map((entry) => entry.id));

  useEffect(() => {
    setSelectedIds(viewModel.selectedEntries.map((entry) => entry.id));
  }, [viewModel]);

  const theme = getClassTheme(viewModel.classIdentifier);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const options = useMemo(
    () => viewModel.options.map((option) => ({
      ...option,
      checked: selectedSet.has(option.id),
      disabled: !selectedSet.has(option.id) && selectedSet.size >= viewModel.requiredCount,
    })),
    [selectedSet, viewModel.options, viewModel.requiredCount],
  );

  const onToggleOption = (optionId: string) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(optionId)) nextSelected.delete(optionId);
    else {
      if (nextSelected.size >= viewModel.requiredCount) return;
      nextSelected.add(optionId);
    }

    const chosen = Array.from(nextSelected);
    const nextSelections = buildNextClassAdvancementSelections(state.selections.classAdvancements);
    if (viewModel.type === "expertise") nextSelections.expertiseSkills = chosen;
    if (viewModel.type === "languages") nextSelections.chosenLanguages = chosen;
    if (viewModel.type === "tools") nextSelections.chosenTools = chosen;
    state.selections.classAdvancements = nextSelections;
    controller.updateCurrentStepData(nextSelections, { silent: true });
    setSelectedIds(chosen);
  };

  return (
    <div className="cc-class-choice-layout">
      <section className="cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,32,39,0.94),rgba(18,18,24,0.98))] p-4 shadow-[0_24px_44px_rgba(0,0,0,0.22)]">
        <div className="border-b border-white/10 pb-4">
          <div className="font-fth-cc-display text-[1.28rem] uppercase tracking-[0.08em] text-[#f1e6d3]">
            {viewModel.title}
          </div>
          <p className="mt-2 max-w-3xl font-fth-cc-body text-[1rem] leading-7 text-[#c7c0cb]">
            {viewModel.description}
          </p>
        </div>
        <div className="cc-class-choice-layout__content-scroll fth-react-scrollbar mt-4 flex min-h-0 flex-1 flex-col px-1 pb-3 pt-2 pr-2">
          <div className="grid gap-2.5">
            {options.map((option, optionIndex) => (
              <ClassAdvancementOptionRow
                key={option.id}
                onToggle={onToggleOption}
                option={option}
                prefersReducedMotion={prefersReducedMotion}
                rowIndex={optionIndex}
              />
            ))}
          </div>
        </div>
      </section>

      <aside className="cc-class-choice-layout__rail flex min-h-0 flex-col gap-4">
        <SelectionSummaryCard
          accent={theme.accent}
          glow={theme.glow}
          label={getSelectionSummaryLabel(viewModel.type)}
          maxCount={viewModel.requiredCount}
          selectedCount={selectedIds.length}
          title="Selection Summary"
        />
        <ClassAdvancementSelectedCard
          emptyMessage={getEmptySelectionMessage(viewModel.type)}
          entries={options.filter((option) => selectedSet.has(option.id))}
          title={getSelectedCardTitle(viewModel.type)}
        />
      </aside>
    </div>
  );
}

function ClassItemChoicesPane({ shellContext, state, controller }: Pick<ReactWizardStepProps, "shellContext" | "state" | "controller">) {
  const viewModel = shellContext.stepViewModel as ClassItemChoicesStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const [selectedByRequirement, setSelectedByRequirement] = useState<Record<string, string[]>>(
    Object.fromEntries(viewModel.requirements.map((requirement) => [requirement.id, [...requirement.selectedIds]])),
  );

  useEffect(() => {
    setSelectedByRequirement(
      Object.fromEntries(viewModel.requirements.map((requirement) => [requirement.id, [...requirement.selectedIds]])),
    );
  }, [viewModel]);

  const theme = getClassTheme(viewModel.classIdentifier);
  const totalRequired = viewModel.requirements.reduce((sum, requirement) => sum + requirement.requiredCount, 0);
  const totalSelected = Object.values(selectedByRequirement).reduce((sum, values) => sum + values.length, 0);

  const onToggleOption = (requirementId: string, optionId: string, limit: number) => {
    const currentSelections = new Set(selectedByRequirement[requirementId] ?? []);
    if (currentSelections.has(optionId)) currentSelections.delete(optionId);
    else {
      if (currentSelections.size >= limit) return;
      currentSelections.add(optionId);
    }

    const chosen = Array.from(currentSelections);
    const nextSelectedByRequirement = {
      ...selectedByRequirement,
      [requirementId]: chosen,
    };
    const nextSelections = buildNextClassAdvancementSelections(state.selections.classAdvancements);
    nextSelections.itemChoices = {
      ...nextSelections.itemChoices,
      [requirementId]: chosen,
    };
    state.selections.classAdvancements = nextSelections;
    controller.updateCurrentStepData(nextSelections, { silent: true });
    setSelectedByRequirement(nextSelectedByRequirement);
  };

  return (
    <div className="cc-class-choice-layout">
      <section className="cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,32,39,0.94),rgba(18,18,24,0.98))] p-4 shadow-[0_24px_44px_rgba(0,0,0,0.22)]">
        <div className="border-b border-white/10 pb-4">
          <div className="font-fth-cc-display text-[1.28rem] uppercase tracking-[0.08em] text-[#f1e6d3]">
            {viewModel.title}
          </div>
          <p className="mt-2 max-w-3xl font-fth-cc-body text-[1rem] leading-7 text-[#c7c0cb]">
            {viewModel.description}
          </p>
        </div>
        <div className="cc-class-choice-layout__content-scroll fth-react-scrollbar mt-4 flex min-h-0 flex-1 flex-col px-1 pb-3 pt-2 pr-2">
          <div className="grid gap-4">
            {viewModel.requirements.map((requirement, groupIndex) => {
              const selectedSet = new Set(selectedByRequirement[requirement.id] ?? []);
              const options = requirement.options.map((option) => ({
                ...option,
                checked: selectedSet.has(option.id),
                disabled: !selectedSet.has(option.id) && selectedSet.size >= requirement.requiredCount,
              }));
              return (
                <section className="grid gap-2.5" key={requirement.id}>
                  <div className="flex items-center gap-3 px-1">
                    <span className="inline-flex items-center rounded-full border border-[#8c6a47]/75 bg-[linear-gradient(180deg,#5b3d2b_0%,#3a271b_100%)] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#f1d9b3] shadow-[0_10px_18px_rgba(47,29,18,0.14)]">
                      {requirement.title}
                    </span>
                    <span className="font-fth-cc-body text-[0.95rem] font-semibold text-[#bdb4c0]">
                      Choose {requirement.requiredCount}
                    </span>
                    <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(202,173,125,0.5),rgba(202,173,125,0.12))]" />
                  </div>
                  {options.map((option, optionIndex) => (
                    <ClassAdvancementOptionRow
                      key={option.id}
                      onToggle={(optionId) => onToggleOption(requirement.id, optionId, requirement.requiredCount)}
                      option={option}
                      prefersReducedMotion={prefersReducedMotion}
                      rowIndex={groupIndex * 10 + optionIndex}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <SelectionSummaryCard
          accent={theme.accent}
          glow={theme.glow}
          label="Class Options Chosen"
          maxCount={totalRequired}
          selectedCount={totalSelected}
          title="Selection Summary"
        />
        <ClassAdvancementSelectedCard
          emptyMessage="No class options selected yet."
          entries={viewModel.requirements.flatMap((requirement) =>
            requirement.options.filter((option) => (selectedByRequirement[requirement.id] ?? []).includes(option.id))
          )}
          title="Chosen Features"
        />
      </aside>
    </div>
  );
}

function HeaderFlourish({ side }: { side: "left" | "right" }) {
  const containerClasses =
    side === "left"
      ? "mr-2 flex min-w-0 flex-1 items-center justify-end gap-1.5 md:mr-4 md:gap-2"
      : "ml-2 flex min-w-0 flex-1 items-center justify-start gap-1.5 md:ml-4 md:gap-2";
  const lineClasses =
    side === "left"
      ? "bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(214,177,111,0.88),rgba(255,233,188,0.42))]"
      : "bg-[linear-gradient(90deg,rgba(255,233,188,0.42),rgba(214,177,111,0.88),rgba(214,177,111,0))]";

  return (
    <span aria-hidden="true" className={containerClasses}>
      {side === "right" ? <FlourishGem /> : null}
      <span className="relative block h-4 w-full max-w-[4.25rem] md:max-w-[10.5rem]">
        <span className={cn("absolute inset-x-0 top-1/2 h-px -translate-y-1/2", lineClasses)} />
        <span
          className={cn(
            "absolute top-1/2 h-px w-full -translate-y-1/2 opacity-65",
            side === "left"
              ? "left-0 scale-x-[0.72] bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(247,218,160,0.55),rgba(214,177,111,0.2))]"
              : "right-0 scale-x-[0.72] bg-[linear-gradient(90deg,rgba(214,177,111,0.2),rgba(247,218,160,0.55),rgba(214,177,111,0))]",
          )}
        />
        <span
          className={cn(
            "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border border-[#d6b16f]/85 bg-[rgba(214,177,111,0.14)] shadow-[0_0_6px_rgba(242,216,157,0.14)]",
            side === "left" ? "right-1.5 md:right-3" : "left-1.5 md:left-3",
          )}
        />
        <span
          className={cn(
            "absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border border-[#f0d39e]/70 bg-[rgba(255,233,188,0.16)]",
            side === "left" ? "right-0 md:right-0.5" : "left-0 md:left-0.5",
          )}
        />
      </span>
      {side === "left" ? <FlourishGem /> : null}
    </span>
  );
}

function FlourishGem() {
  return (
    <span className="relative block h-3.5 w-3.5 md:h-4.5 md:w-4.5">
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[0.15rem] border border-[#d6b16f]/85 bg-[linear-gradient(180deg,rgba(121,87,37,0.35),rgba(214,177,111,0.18))] shadow-[0_0_8px_rgba(242,216,157,0.14)] md:h-3.5 md:w-3.5" />
      <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#f4ddb1]/85 md:h-1.5 md:w-1.5" />
    </span>
  );
}

function SkillOptionRow({
  option,
  onToggle,
  prefersReducedMotion,
  rowIndex,
}: {
  option: SkillChoiceOption;
  onToggle: (skillKey: string) => void;
  prefersReducedMotion: boolean;
  rowIndex: number;
}) {
  return (
    <motion.button
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      aria-pressed={option.checked}
      className={cn(
        "group relative grid w-full grid-cols-[3.4rem_minmax(0,1fr)_3.6rem] items-center gap-3 overflow-hidden rounded-[1rem] border py-2 pl-5 pr-2 text-left shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition md:pl-6",
        option.checked
          ? "border-[#e9c176]/42 bg-[linear-gradient(180deg,rgba(77,62,38,0.64),rgba(36,31,24,0.96))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
        option.disabled && !option.checked && "opacity-60",
      )}
      data-class-skill-row="true"
      disabled={option.disabled && !option.checked}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      onClick={() => onToggle(option.key)}
      transition={{ delay: 0.04 + rowIndex * 0.015, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      type="button"
      whileHover={
        prefersReducedMotion || (option.disabled && !option.checked)
          ? undefined
          : { scale: 1.01, y: -2, boxShadow: "0 18px 28px rgba(67,43,23,0.12)" }
      }
      whileTap={prefersReducedMotion || (option.disabled && !option.checked) ? undefined : { scale: 0.992 }}
    >
      <span
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-[0.8rem] border text-[1.1rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked
            ? "border-[#e9c176]/52 bg-[linear-gradient(180deg,#f0ca81_0%,#8f6427_100%)] text-[#36240d]"
            : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#e9c176]",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.65rem] border border-white/10" />
        <i className={cn("fa-solid", option.iconClass)} aria-hidden="true" />
      </span>
        <span className="min-w-0">
        <span className="block font-fth-cc-body text-[1.02rem] font-semibold leading-6 text-[#f3e7d3]">
          {option.label}
        </span>
      </span>
      <span
        className={cn(
          "relative flex h-10 w-12 items-center justify-center rounded-[0.75rem] border font-fth-cc-ui text-[0.88rem] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked
            ? "border-[#e9c176]/42 bg-[rgba(233,193,118,0.14)] text-[#f4e6c4]"
            : "border-white/10 bg-[rgba(255,255,255,0.03)] text-[#857d89]",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.6rem] border border-white/10" />
        {option.checked ? <span>{PROFICIENCY_BONUS}</span> : <i className="fa-solid fa-hexagon" aria-hidden="true" />}
      </span>
    </motion.button>
  );
}

function SelectionSummaryCard({
  selectedCount,
  maxCount,
  accent,
  glow,
  title = "Selection Summary",
  label = "Skills Chosen",
}: {
  selectedCount: number;
  maxCount: number;
  accent: string;
  glow: string;
  title?: string;
  label?: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-[1.45rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(38,34,42,0.98),rgba(17,17,22,0.99))] p-[0.28rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)]"
      style={{ boxShadow: `0 22px 40px rgba(0,0,0,0.28), 0 0 22px ${glow}` }}
    >
      <div className="rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] px-4 py-4 text-[#f1ddbc]">
        <div className="border-b border-white/10 pb-3 text-center">
          <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em] text-[#e6c88f]">{title}</div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(214,177,111,0.55),rgba(214,177,111,0))]" />
            <div
              className="flex h-20 w-20 flex-col items-center justify-center rounded-full border text-[#fff9ea] shadow-[inset_0_2px_0_rgba(255,244,225,0.22),0_12px_24px_rgba(0,0,0,0.24)]"
              style={{
                borderColor: accent,
                background: `radial-gradient(circle at 35% 30%, rgba(247,214,145,0.98), ${accent})`,
              }}
            >
              <div className="flex items-end leading-none">
                <span className="font-fth-cc-display text-[2.2rem]">{selectedCount}</span>
                <span className="ml-1 font-fth-cc-display text-[1.55rem] opacity-90">/{maxCount}</span>
              </div>
            </div>
            <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(214,177,111,0.55),rgba(214,177,111,0))]" />
          </div>
          <div className="mt-3 font-fth-cc-body text-[1.02rem] text-[#d9d0c5]">{label}</div>
        </div>
      </div>
    </section>
  );
}

function ClassAdvancementOptionRow({
  option,
  onToggle,
  prefersReducedMotion,
  rowIndex,
}: {
  option: ClassAdvancementChoiceOption;
  onToggle: (optionId: string) => void;
  prefersReducedMotion: boolean;
  rowIndex: number;
}) {
  return (
    <motion.button
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      aria-pressed={option.checked}
      className={cn(
        "group relative grid w-full grid-cols-[3rem_minmax(0,1fr)_3.6rem] items-center gap-3 overflow-hidden rounded-[1rem] border px-3 py-3 text-left shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition",
        option.checked
          ? "border-[#e9c176]/42 bg-[linear-gradient(180deg,rgba(77,62,38,0.64),rgba(36,31,24,0.96))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
        option.disabled && !option.checked && "opacity-60",
      )}
      disabled={option.disabled && !option.checked}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      onClick={() => onToggle(option.id)}
      transition={{ delay: 0.04 + rowIndex * 0.015, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      type="button"
      whileHover={
        prefersReducedMotion || (option.disabled && !option.checked)
          ? undefined
          : { scale: 1.01, y: -2, boxShadow: "0 18px 28px rgba(67,43,23,0.12)" }
      }
      whileTap={prefersReducedMotion || (option.disabled && !option.checked) ? undefined : { scale: 0.992 }}
    >
      <span
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-[0.85rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked ? "border-[#e9c176]/52 bg-[linear-gradient(180deg,#f0ca81_0%,#8f6427_100%)] text-[#36240d]" : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#e9c176]",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.7rem] border border-white/20" />
        <i className={cn(option.iconClass ?? "fa-solid fa-sparkles", "relative z-10 text-base")} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-fth-cc-body text-[1.02rem] font-semibold leading-6 text-[#f3e7d3]">
          {option.label}
        </span>
        {option.description ? (
          <span className="mt-0.5 block font-fth-cc-body text-[0.92rem] leading-6 text-[#bcb4bf]">
            {option.description}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative flex h-10 w-12 items-center justify-center rounded-[0.75rem] border font-fth-cc-ui text-[0.88rem] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked
            ? "border-[#e9c176]/42 bg-[rgba(233,193,118,0.14)] text-[#f4e6c4]"
            : "border-white/10 bg-[rgba(255,255,255,0.03)] text-[#857d89]",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.6rem] border border-white/10" />
        {option.checked ? <i className="fa-solid fa-check" aria-hidden="true" /> : <i className="fa-solid fa-hexagon" aria-hidden="true" />}
      </span>
    </motion.button>
  );
}

function ClassAdvancementSelectedCard({
  title,
  entries,
  emptyMessage,
}: {
  title: string;
  entries: SelectedClassToken[];
  emptyMessage: string;
}) {
  return (
    <section className="overflow-hidden rounded-[1.45rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(38,34,42,0.98),rgba(17,17,22,0.99))] p-[0.28rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)]">
      <div className="rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] px-4 py-4 text-[#f1ddbc]">
        <div className="border-b border-white/10 pb-3 text-center">
          <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em] text-[#e6c88f]">{title}</div>
        </div>
        <div className="mt-4 grid gap-2.5">
          {entries.length > 0 ? entries.map((entry) => (
            <div
              className="flex flex-wrap items-center gap-2 rounded-[0.95rem] border border-white/10 bg-[rgba(255,255,255,0.03)] px-3 py-3"
              key={entry.id ?? entry.key ?? entry.label}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e9c176]/42 bg-[linear-gradient(180deg,#f0ca81_0%,#8f6427_100%)] text-[#36240d]">
                <i className={cn(entry.iconClass ?? "fa-solid fa-sparkles", "text-sm")} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-fth-cc-body text-[1rem] font-semibold text-[#fff0d6]">{entry.label}</span>
                {entry.description ? (
                  <span className="block font-fth-cc-body text-[0.86rem] leading-5 text-[#d7bb8a]">{entry.description}</span>
                ) : null}
              </span>
            </div>
          )) : (
            <div className="rounded-[0.95rem] border border-dashed border-white/10 bg-[rgba(255,255,255,0.03)] px-3 py-4 text-center font-fth-cc-body text-sm text-[#d8c2a0]">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getSelectionSummaryLabel(type: ClassAdvancementCommonStepViewModel["type"]): string {
  switch (type) {
    case "expertise":
      return "Expertise Picks";
    case "languages":
      return "Languages Chosen";
    case "tools":
      return "Tool Picks";
  }
}

function getSelectedCardTitle(type: ClassAdvancementCommonStepViewModel["type"]): string {
  switch (type) {
    case "expertise":
      return "Chosen Expertise";
    case "languages":
      return "Chosen Languages";
    case "tools":
      return "Chosen Tools";
  }
}

function getEmptySelectionMessage(type: ClassAdvancementCommonStepViewModel["type"]): string {
  switch (type) {
    case "expertise":
      return "No expertise choices selected yet.";
    case "languages":
      return "No class languages selected yet.";
    case "tools":
      return "No class tools selected yet.";
  }
}

function WeaponMasteryRow({
  option,
  onToggle,
  prefersReducedMotion,
  rowIndex,
}: {
  option: WeaponMasteryChoiceOption;
  onToggle: (weaponId: string) => void;
  prefersReducedMotion: boolean;
  rowIndex: number;
}) {
  return (
    <motion.button
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      aria-pressed={option.checked}
      className={cn(
        "group relative grid w-full grid-cols-[3.7rem_minmax(0,1fr)_3.6rem] items-center gap-3 overflow-hidden rounded-[1rem] border px-2 py-2 text-left shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition",
        option.checked
          ? "border-[#e9c176]/42 bg-[linear-gradient(180deg,rgba(77,62,38,0.64),rgba(36,31,24,0.96))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
        option.disabled && !option.checked && "opacity-60",
      )}
      disabled={option.disabled && !option.checked}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      onClick={() => onToggle(option.id)}
      transition={{ delay: 0.04 + rowIndex * 0.015, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      type="button"
      whileHover={
        prefersReducedMotion || (option.disabled && !option.checked)
          ? undefined
          : { scale: 1.01, y: -2, boxShadow: "0 18px 28px rgba(67,43,23,0.12)" }
      }
      whileTap={prefersReducedMotion || (option.disabled && !option.checked) ? undefined : { scale: 0.992 }}
    >
      <span
        className={cn(
          "relative flex h-12 w-12 overflow-hidden rounded-[0.8rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked ? "border-[#e9c176]/52" : "border-white/12",
        )}
      >
        <img alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" src={option.img} />
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,236,0.12),rgba(16,10,7,0.22))]" />
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.65rem] border border-white/10" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-fth-cc-body text-[1.02rem] font-semibold leading-6 text-[#f3e7d3]">
          {option.name}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-2 py-0.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em] text-[#c7bdca]">
            {formatWeaponTypeBadge(option.weaponType)}
          </span>
          <span className="inline-flex items-center rounded-full border border-[#e9c176]/20 bg-[rgba(233,193,118,0.08)] px-2 py-0.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em] text-[#e3c88c]">
            {option.mastery}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "relative flex h-10 w-12 items-center justify-center rounded-[0.75rem] border font-fth-cc-ui text-[0.88rem] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked
            ? "border-[#e9c176]/42 bg-[rgba(233,193,118,0.14)] text-[#f4e6c4]"
            : "border-white/10 bg-[rgba(255,255,255,0.03)] text-[#857d89]",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.6rem] border border-white/10" />
        {option.checked ? <i className="fa-solid fa-check" aria-hidden="true" /> : <i className="fa-solid fa-hexagon" aria-hidden="true" />}
      </span>
    </motion.button>
  );
}

function SelectedMasteriesCard({ selectedEntries }: { selectedEntries: WeaponMasteryChoiceOption[] }) {
  return (
    <section className="overflow-hidden rounded-[1.45rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(38,34,42,0.98),rgba(17,17,22,0.99))] p-[0.28rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)]">
      <div className="rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] px-4 py-4 text-[#f1ddbc]">
        <div className="border-b border-white/10 pb-3 text-center">
          <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em] text-[#e6c88f]">Chosen Weapons</div>
        </div>
        <div className="mt-4 grid gap-2.5">
          {selectedEntries.length > 0 ? selectedEntries.map((entry) => (
            <div
              className="grid grid-cols-[2.8rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[0.95rem] border border-white/10 bg-[rgba(255,255,255,0.03)] px-2 py-2"
              key={entry.id}
            >
              <span className="overflow-hidden rounded-[0.7rem] border border-[#e9c176]/20">
                <img alt="" aria-hidden="true" className="h-10 w-10 object-cover" loading="lazy" src={entry.img} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-fth-cc-body text-[1rem] font-semibold text-[#fff0d6]">{entry.name}</span>
                <span className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.14em] text-[#d7bb8a]">{entry.mastery}</span>
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e9c176]/42 bg-[rgba(233,193,118,0.14)] text-[#f4e6c4]">
                <i className="fa-solid fa-check" aria-hidden="true" />
              </span>
            </div>
          )) : (
            <div className="rounded-[0.95rem] border border-dashed border-white/10 bg-[rgba(255,255,255,0.03)] px-3 py-4 text-center font-fth-cc-body text-sm text-[#d8c2a0]">
              No weapon masteries chosen yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MasteryReferenceCard({ entries }: { entries: MasteryReferenceEntry[] }) {
  return (
    <section className="overflow-hidden rounded-[1.45rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(38,34,42,0.98),rgba(17,17,22,0.99))] p-[0.28rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)]">
      <div className="rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] px-4 py-4 text-[#f1ddbc]">
        <div className="border-b border-white/10 pb-3 text-center">
          <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em] text-[#e6c88f]">Mastery Techniques</div>
        </div>
        <div className="mt-4 grid gap-2.5">
          {entries.map((entry) => (
            <div
              className={cn(
                "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-[0.95rem] border px-3 py-3",
                entry.sourceWeapons.length > 0
                  ? "border-[#e9c176]/22 bg-[rgba(233,193,118,0.07)]"
                  : "border-transparent bg-transparent",
              )}
              key={entry.mastery}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center self-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] text-[#f2deb6]">
                <i className={entry.iconClass} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="block font-fth-cc-body text-[1rem] font-semibold text-[#fff0d6]">{entry.mastery}</span>
                  {entry.sourceWeapons.length > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-[#e9c176]/28 bg-[rgba(233,193,118,0.08)] px-2 py-0.5 font-fth-cc-ui text-[0.52rem] uppercase tracking-[0.16em] text-[#f3ddb0]">
                      Known via weapon mastery
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="col-span-2 min-w-0">
                {entry.sourceWeapons.length > 0 ? (
                  <div className="mb-1.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em] text-[#d9bc8f]">
                    From {entry.sourceWeapons.join(", ")}
                  </div>
                ) : null}
                <span className="block font-fth-cc-body text-[0.84rem] leading-5 text-[#c7c0cb]">{entry.masteryDescription}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClassProficienciesCard({ savingThrows }: { savingThrows: string[] }) {
  return (
    <section className="overflow-hidden rounded-[1.45rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(38,34,42,0.98),rgba(17,17,22,0.99))] p-[0.28rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)]">
      <div className="rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] px-4 py-4 text-[#f1ddbc]">
        <div className="border-b border-white/10 pb-3 text-center">
          <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em] text-[#e6c88f]">Saving Throw Proficiencies</div>
        </div>
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {savingThrows.map((value) => (
              <span
                className="inline-flex items-center rounded-full border border-[#e9c176]/24 bg-[rgba(255,255,255,0.04)] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#f2deb6]"
                key={value}
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function getClassTheme(identifier: string) {
  return CLASS_THEMES[identifier.trim().toLowerCase()] ?? CLASS_THEMES.fighter;
}

function getMasteryIcon(mastery: string): string {
  switch (mastery.trim().toLowerCase()) {
    case "cleave":
      return "fa-solid fa-arrows-left-right";
    case "graze":
      return "fa-solid fa-wind";
    case "nick":
      return "fa-solid fa-scissors";
    case "push":
      return "fa-solid fa-arrow-right";
    case "sap":
      return "fa-solid fa-hand";
    case "slow":
      return "fa-solid fa-hourglass-half";
    case "topple":
      return "fa-solid fa-person-falling";
    case "vex":
      return "fa-solid fa-eye";
    default:
      return "fa-solid fa-swords";
  }
}

function formatWeaponTypeBadge(weaponType: string): string {
  const normalized = weaponType.trim().toLowerCase();
  if (normalized.endsWith("melee")) return "Melee";
  if (normalized.endsWith("ranged")) return "Ranged";
  return weaponType;
}

function abilityLabel(abbrev: string): string {
  switch (abbrev.toUpperCase()) {
    case "STR":
      return "Strength";
    case "DEX":
      return "Dexterity";
    case "CON":
      return "Constitution";
    case "INT":
      return "Intelligence";
    case "WIS":
      return "Wisdom";
    case "CHA":
      return "Charisma";
    default:
      return abbrev.toUpperCase();
  }
}
