import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { ClassFlowHeroHeader } from "./class-flow-hero-header";
import { ClassCard } from "./class-card";
import { ClassSelectionGalleryPane } from "./class-selection-gallery-pane";
import { ClassSummaryStepScreen } from "./class-summary-step-screen";
import {
  buildClassSelectionFromEntry,
  getClassStepViewModel,
} from "../../../steps/step-class-model";
import { applyLegalClassSkillSelections } from "../../../steps/origin-flow-utils";
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

type ClassAdvancementPaneCopy = {
  eyebrow: string;
  statusLabel: string;
  summaryLabel: string;
  selectedTitle: string;
  emptyMessage: string;
  guidance: string;
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
const CC_TEXT_HERO = "text-[color:var(--cc-text-hero)]";
const CC_TEXT_PRIMARY = "text-[color:var(--cc-text-primary)]";
const CC_TEXT_SECONDARY = "text-[color:var(--cc-text-secondary)]";
const CC_TEXT_KICKER = "text-[color:var(--cc-text-kicker)]";
const CC_MOUNTED_PANEL_STYLE: CSSProperties = {
  borderColor: "var(--cc-mounted-panel-border)",
  backgroundImage: "var(--cc-mounted-panel-image)",
};
const CC_MOUNTED_FRAME_STYLE: CSSProperties = {
  borderColor: "var(--cc-mounted-frame-border)",
  backgroundImage: "var(--cc-mounted-frame-image)",
};
const CC_MOUNTED_BADGE_STYLE: CSSProperties = {
  borderColor: "var(--cc-mounted-badge-border)",
  backgroundImage: "var(--cc-mounted-badge-image)",
};
const CC_MOUNTED_MUTED_BADGE_STYLE: CSSProperties = {
  borderColor: "var(--cc-mounted-muted-badge-border)",
  backgroundImage: "var(--cc-mounted-muted-badge-image)",
};
const CC_MOUNTED_PROGRESS_TRACK_STYLE: CSSProperties = {
  background: "var(--cc-mounted-progress-track)",
};
const CC_MOUNTED_IMAGE_FRAME_STYLE: CSSProperties = {
  borderColor: "var(--cc-mounted-image-frame-border)",
};
const CC_MOUNTED_IMAGE_SCRIM_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-mounted-image-scrim)",
};
const CC_MOUNTED_EMBOSS_STYLE: CSSProperties = {
  boxShadow: "inset 0 1px 0 var(--cc-mounted-emboss)",
};

function getMountedCardSurfaceStyle(selected = false): CSSProperties {
  return selected
    ? {
      borderColor: "var(--cc-mounted-card-selected-border)",
      backgroundImage: "var(--cc-mounted-card-selected-image)",
    }
    : {
      borderColor: "var(--cc-mounted-card-border)",
      backgroundImage: "var(--cc-mounted-card-image)",
    };
}

function getMountedIconSurfaceStyle(selected = false): CSSProperties {
  return selected
    ? {
      borderColor: "var(--cc-mounted-icon-active-border)",
      backgroundImage: "var(--cc-mounted-icon-active-image)",
    }
    : {
      borderColor: "var(--cc-mounted-card-border)",
      backgroundImage: "var(--cc-mounted-card-image)",
    };
}

function getMountedSigilSurfaceStyle(selected = false): CSSProperties {
  return selected
    ? {
      borderColor: "var(--cc-mounted-sigil-active-border)",
      backgroundImage: "var(--cc-mounted-sigil-active-image)",
    }
    : {
      borderColor: "var(--cc-mounted-sigil-border)",
      backgroundImage: "var(--cc-mounted-sigil-image)",
    };
}

function sameKeys(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

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

  useEffect(() => {
    if (!["class", "classChoices", "classExpertise", "classLanguages", "classTools", "classItemChoices"].includes(shellModel.currentPane)) return;
    if (!state.selections.class?.hasWeaponMastery || getRequiredWeaponMasteryCount(state) <= 0) return;
    void ensureCharacterCreatorIndexesReady(getWeaponMasteryPackSources(state.config.packSources), {
      contentKeys: ["items"],
      persistIfMissing: true,
    });
  }, [shellModel.currentPane, state.config.packSources, state.selections.class?.hasWeaponMastery, state.selections.class?.weaponMasteryCount]);

  return (
    <section className="flex flex-col px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="cc-theme-shell relative flex min-h-0 flex-1 flex-col rounded-[1.75rem] border p-[0.35rem]"
        initial={false}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="cc-theme-hero-shell absolute inset-[0.35rem] rounded-[1.45rem]" />

        <div className="cc-theme-shell-inner relative flex min-h-0 flex-1 flex-col rounded-[1.45rem] border">
          <ClassFlowHeroHeader
            description={shellModel.hero.description}
            headerTone={shellModel.headerTone}
            prefersReducedMotion={prefersReducedMotion}
            primaryBadgeLabel={shellModel.hero.primaryBadgeLabel}
            secondaryBadgeLabel={shellModel.hero.secondaryBadgeLabel}
            title={shellModel.hero.title}
          />

          <div className="cc-class-flow-chapter relative z-10 mt-3 flex min-h-0 flex-1 flex-col">
            <div className="relative flex flex-col px-3 pb-4 pt-3 md:px-6">
              <img
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                src={classStepFieldBackground}
                style={{ opacity: "var(--cc-class-field-art-opacity)" }}
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--cc-surface-accent-soft)_34%,transparent),transparent_28%),radial-gradient(circle_at_70%_18%,color-mix(in_srgb,var(--cc-surface-arcane-soft)_24%,transparent),transparent_30%),linear-gradient(180deg,color-mix(in_srgb,var(--cc-bg-surface)_4%,transparent),transparent_68%,color-mix(in_srgb,var(--cc-bg-surface)_18%,transparent))]" />
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
          <div className="cc-theme-empty max-w-2xl rounded-[1.5rem] border px-8 py-10 text-center shadow-[0_24px_50px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)] backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--cc-border-accent)_44%,transparent)] bg-[radial-gradient(circle_at_35%_35%,color-mix(in_srgb,var(--cc-accent-gold)_72%,white_28%),var(--cc-accent-bronze))] text-[color:var(--cc-text-ink-900)] shadow-[0_0_20px_color-mix(in_srgb,var(--cc-surface-accent-soft)_48%,transparent)]">
              <i className="fa-solid fa-triangle-exclamation text-xl" aria-hidden="true" />
            </div>
            <p className="cc-theme-title m-0 font-fth-cc-display text-[1.5rem] uppercase tracking-[0.08em]">
              No Classes Available
            </p>
            <p className="cc-theme-body-muted mt-3 font-fth-cc-body text-[1.02rem] leading-7">{emptyMessage}</p>
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

  const legalSelectedKeys = useMemo(
    () => viewModel.skillSection.options.filter((option) => option.checked).map((option) => option.key),
    [viewModel.skillSection.options],
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>(legalSelectedKeys);

  useEffect(() => {
    const currentChosen = state.selections.skills?.chosen ?? [];
    if (!sameKeys(currentChosen, legalSelectedKeys)) {
      const chosenSkills = applyLegalClassSkillSelections(state, legalSelectedKeys);
      controller.updateCurrentStepData({ chosenSkills }, { silent: true });
      setSelectedKeys(chosenSkills);
      return;
    }

    setSelectedKeys((current) => sameKeys(current, legalSelectedKeys) ? current : legalSelectedKeys);
  }, [controller, legalSelectedKeys, state]);

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
    const legalChosenSkills = applyLegalClassSkillSelections(state, chosenSkills);
    controller.updateCurrentStepData({ chosenSkills: legalChosenSkills }, { silent: true });
    setSelectedKeys(legalChosenSkills);
  };

  return (
    <div className="cc-class-choice-layout">
      <section className="cc-theme-panel cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border p-4">
        <div className="border-b border-[color:color-mix(in_srgb,var(--cc-border-subtle)_86%,transparent)] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {viewModel.primaryAbilityHint ? (
                <div className="cc-theme-pill inline-flex max-w-[32rem] items-start gap-2 rounded-full border px-3 py-1.5 font-fth-cc-body text-[0.88rem] leading-5">
                  <i className={cn(theme.sigil, "mt-0.5 text-[0.8rem]")} aria-hidden="true" />
                  <span><strong>Prime:</strong> {viewModel.primaryAbilityHint}</span>
                </div>
              ) : null}
              <span className="cc-theme-badge rounded-full border px-3 py-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em]">
                Saving Throws
              </span>
              {viewModel.savingThrows.map((value) => (
                <span
                  className="cc-theme-pill--muted inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em]"
                  key={value}
                >
                  {value}
                </span>
              ))}
            </div>

            <div
              className="cc-theme-card cc-theme-card--raised flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5"
              data-class-skill-summary="true"
            >
              <div className="cc-theme-kicker font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.22em]">
                Selection Summary
              </div>
              <div className="cc-theme-body font-fth-cc-display text-[1.1rem] uppercase tracking-[0.08em]">
                {selectedKeys.length}/{maxCount}
              </div>
            </div>
          </div>
        </div>

        {viewModel.skillSection.hasChoices ? (
          <div className="cc-class-choice-layout__content-scroll mt-4 flex flex-col px-1 pb-3 pt-2 pr-2">
            <div className="grid gap-4">
              {groupedOptions.map((group, groupIndex) => (
                <section className="grid gap-2.5" data-class-skill-group={group.abilityAbbrev} key={group.abilityAbbrev}>
                  <div className="flex items-center gap-3 px-1">
                    <span className="cc-theme-badge inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] shadow-[0_10px_18px_color-mix(in_srgb,var(--cc-bg-base)_10%,transparent)]">
                      {group.abilityAbbrev}
                    </span>
                    <span className="cc-theme-body font-fth-cc-body text-[0.95rem] font-semibold">
                      {abilityLabel(group.abilityAbbrev)}
                    </span>
                    <span className="h-px flex-1 bg-[image:var(--cc-class-stepper-rail)] opacity-75" />
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
          <div className="cc-theme-empty mt-4 rounded-[1.1rem] border border-dashed px-4 py-5 font-fth-cc-body">
            {viewModel.skillSection.emptyMessage}
          </div>
        )}
      </section>
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

  const masteryGroupStyles = [
    {
      label: "Simple Weapons",
      pillClass: `cc-theme-badge ${CC_TEXT_HERO}`,
      panelTone: "simple",
    },
    {
      label: "Martial Weapons",
      pillClass: `cc-theme-badge cc-theme-badge--muted ${CC_TEXT_PRIMARY}`,
      panelTone: "martial",
    },
  ] as const;

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, WeaponMasteryChoiceOption[]>();
    for (const option of options) {
      const groupKey = option.weaponType.startsWith("Martial") ? "Martial Weapons" : "Simple Weapons";
      const existing = groups.get(groupKey) ?? [];
      existing.push(option);
      groups.set(groupKey, existing);
    }

    return masteryGroupStyles
      .map((group) => ({ label: group.label, entries: groups.get(group.label) ?? [] }))
      .filter((group) => group.entries.length > 0);
  }, [options]);
  const orderedOptions = useMemo(
    () => groupedOptions.flatMap((group) => group.entries),
    [groupedOptions],
  );
  const selectedEntries = useMemo(
    () => orderedOptions.filter((option) => selectedSet.has(option.id)),
    [orderedOptions, selectedSet],
  );
  const previewableOptions = useMemo(
    () => [
      ...selectedEntries,
      ...orderedOptions.filter((option) => !selectedSet.has(option.id)),
    ],
    [orderedOptions, selectedEntries, selectedSet],
  );
  const [previewId, setPreviewId] = useState<string | null>(previewableOptions[0]?.id ?? null);
  const previewOption = useMemo(
    () => options.find((option) => option.id === previewId) ?? previewableOptions[0] ?? null,
    [options, previewId, previewableOptions],
  );

  useEffect(() => {
    if (previewableOptions.length === 0) {
      if (previewId !== null) setPreviewId(null);
      return;
    }

    if (previewId && previewableOptions.some((option) => option.id === previewId)) return;
    setPreviewId(previewableOptions[0]?.id ?? null);
  }, [previewId, previewableOptions]);

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
    setPreviewId(weaponId);
  };

  return (
    <div className="cc-class-choice-layout cc-class-choice-layout--weapon-masteries">
      <section
        className="cc-theme-panel cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border p-4 shadow-[0_24px_44px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]"
        data-weapon-mastery-options-panel="true"
        style={CC_MOUNTED_PANEL_STYLE}
      >
        {viewModel.weaponMasterySection.hasChoices ? (
          <div className="cc-class-choice-layout__content-scroll flex flex-col px-1 pb-3 pt-2 pr-2">
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1"
              data-weapon-mastery-progress="true"
            >
              <div className={cn("inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em] shadow-[0_10px_18px_color-mix(in_srgb,var(--cc-bg-base)_12%,transparent)]", CC_TEXT_SECONDARY)} style={CC_MOUNTED_BADGE_STYLE}>
                Simple first, Martial second
              </div>
              <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-[0_10px_18px_color-mix(in_srgb,var(--cc-bg-base)_12%,transparent)]", CC_TEXT_HERO)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
                <span className={cn("font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]", CC_TEXT_SECONDARY)}>Progress</span>
                <span className={cn("font-fth-cc-display text-[1rem] uppercase tracking-[0.08em]", CC_TEXT_HERO)}>
                  {selectedEntries.length} / {maxCount}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              {groupedOptions.map((group, groupIndex) => (
                <section
                  className="cc-theme-choice-group grid gap-2.5 rounded-[1.35rem] border p-3"
                  data-weapon-mastery-group={group.label}
                  data-tone={masteryGroupStyles.find((pill) => pill.label === group.label)?.panelTone}
                  key={group.label}
                >
                  <div className="flex items-center gap-3 px-1">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em]",
                        masteryGroupStyles.find((pill) => pill.label === group.label)?.pillClass,
                      )}
                      style={group.label === "Martial Weapons" ? CC_MOUNTED_MUTED_BADGE_STYLE : CC_MOUNTED_BADGE_STYLE}
                    >
                      {group.label}
                    </span>
                    <span className="cc-theme-choice-divider h-px flex-1" />
                    <span className={cn("cc-theme-badge cc-theme-badge--muted inline-flex items-center rounded-full px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.14em]", CC_TEXT_SECONDARY)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
                      {group.entries.length} options
                    </span>
                  </div>
                  <div className="grid gap-2.5">
                    {group.entries.map((option, optionIndex) => (
                      <WeaponMasteryRow
                        isPreviewed={previewOption?.id === option.id}
                        key={option.id}
                        onPreview={setPreviewId}
                        onToggle={onToggleMastery}
                        option={option}
                        prefersReducedMotion={prefersReducedMotion}
                        rowIndex={groupIndex * 12 + optionIndex}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn("mt-4 rounded-[1.1rem] border border-dashed px-4 py-5 font-fth-cc-body", CC_TEXT_SECONDARY)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
            {viewModel.weaponMasterySection.emptyMessage}
          </div>
        )}
      </section>

      {previewOption ? (
        <aside
          className="cc-class-choice-layout__rail flex min-h-0 flex-col gap-4"
          data-weapon-mastery-rail="true"
        >
          <WeaponMasteryDetailCard option={previewOption} />
          <SelectedMasteriesCard selectedEntries={selectedEntries} />
        </aside>
      ) : null}
    </div>
  );
}

function ClassAdvancementChoicePane({ shellContext, state, controller }: Pick<ReactWizardStepProps, "shellContext" | "state" | "controller">) {
  const viewModel = shellContext.stepViewModel as ClassAdvancementCommonStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;
  const paneCopy = getClassAdvancementPaneCopy(viewModel.type);

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
      <section className="cc-theme-panel cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border p-4 shadow-[0_24px_44px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]" style={CC_MOUNTED_PANEL_STYLE}>
        <div className="border-b pb-4" style={{ borderColor: "var(--cc-mounted-frame-border)" }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] shadow-[0_10px_18px_color-mix(in_srgb,var(--cc-bg-base)_12%,transparent)]", CC_TEXT_HERO)} style={CC_MOUNTED_BADGE_STYLE}>
              {paneCopy.eyebrow}
            </span>
            <span className={cn("rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.65rem] uppercase tracking-[0.16em]", CC_TEXT_SECONDARY)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
              {paneCopy.statusLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className={cn("font-fth-cc-display text-[1.28rem] uppercase tracking-[0.08em]", CC_TEXT_PRIMARY)}>
                {viewModel.title}
              </div>
              <p className={cn("mt-2 max-w-3xl font-fth-cc-body text-[1rem] leading-7", CC_TEXT_SECONDARY)}>
                {viewModel.description}
              </p>
            </div>
            <div className="rounded-[1rem] border px-4 py-3 text-right shadow-[0_14px_24px_color-mix(in_srgb,var(--cc-bg-base)_10%,transparent)]" style={CC_MOUNTED_BADGE_STYLE}>
              <div className={cn("font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.2em]", CC_TEXT_SECONDARY)}>
                {paneCopy.summaryLabel}
              </div>
              <div className={cn("mt-1 font-fth-cc-display text-[1.55rem] uppercase tracking-[0.08em]", CC_TEXT_HERO)}>
                {selectedIds.length}/{viewModel.requiredCount}
              </div>
              <div className={cn("mt-1 font-fth-cc-body text-[0.88rem]", CC_TEXT_SECONDARY)}>
                {selectedIds.length >= viewModel.requiredCount ? "Selection complete." : paneCopy.guidance}
              </div>
            </div>
          </div>
        </div>
        <div className="cc-class-choice-layout__content-scroll mt-4 flex flex-col px-1 pb-3 pt-2 pr-2">
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
        <AdvancementSummaryCard
          glow={theme.glow}
          guidance={paneCopy.guidance}
          label={paneCopy.summaryLabel}
          maxCount={viewModel.requiredCount}
          selectedCount={selectedIds.length}
        />
        <ClassAdvancementSelectedCard
          emptyMessage={paneCopy.emptyMessage}
          entries={options.filter((option) => selectedSet.has(option.id))}
          title={paneCopy.selectedTitle}
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
  const selectedEntries = useMemo(
    () =>
      viewModel.requirements.flatMap((requirement) => {
        const selectedSet = new Set(selectedByRequirement[requirement.id] ?? []);
        return requirement.options
          .filter((option) => selectedSet.has(option.id))
          .map((option) => ({
            id: option.id,
            key: `${requirement.id}:${option.id}`,
            label: option.label,
            description: `${requirement.title} choice`,
            iconClass: option.iconClass ?? "fa-solid fa-sparkles",
          }));
      }),
    [selectedByRequirement, viewModel.requirements],
  );

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
      <section className="cc-theme-panel cc-class-choice-layout__content-panel flex min-h-0 flex-col rounded-[1.45rem] border p-4 shadow-[0_24px_44px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]" style={CC_MOUNTED_PANEL_STYLE}>
        <div className="cc-class-choice-layout__content-scroll mt-4 flex flex-col px-1 pb-3 pt-2 pr-2">
          <div className="grid gap-4">
            {viewModel.requirements.map((requirement, groupIndex) => {
              const selectedSet = new Set(selectedByRequirement[requirement.id] ?? []);
              const options = requirement.options.map((option) => ({
                ...option,
                checked: selectedSet.has(option.id),
                disabled: !selectedSet.has(option.id) && selectedSet.size >= requirement.requiredCount,
              }));
              const selectedCount = selectedSet.size;
              return (
                <section
                  className="cc-class-item-choice-group cc-theme-choice-group rounded-[1.35rem] border p-4 shadow-[0_18px_34px_color-mix(in_srgb,var(--cc-bg-base)_14%,transparent)]"
                  data-class-item-choice-group={requirement.id}
                  key={requirement.id}
                  style={{ ...CC_MOUNTED_FRAME_STYLE, ...CC_MOUNTED_EMBOSS_STYLE }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--cc-mounted-frame-border)" }}>
                    <div className="min-w-0 max-w-3xl">
                      <div className={cn("font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.26em]", CC_TEXT_SECONDARY)}>
                        Group {groupIndex + 1}
                      </div>
                      <div className={cn("mt-1 font-fth-cc-body text-[1rem] font-semibold", CC_TEXT_PRIMARY)}>
                        {requirement.title}
                      </div>
                      <div className={cn("mt-1 font-fth-cc-body text-[0.92rem] leading-6", CC_TEXT_SECONDARY)}>
                        Choose up to {requirement.requiredCount} option{requirement.requiredCount === 1 ? "" : "s"} from this grant.
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className={cn("inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.63rem] uppercase tracking-[0.22em]", CC_TEXT_HERO)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
                        {selectedCount >= requirement.requiredCount
                          ? "Ready"
                          : `${selectedCount} / ${requirement.requiredCount}`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {options.map((option, optionIndex) => (
                      <ClassAdvancementOptionRow
                        key={option.id}
                        onToggle={(optionId) => onToggleOption(requirement.id, optionId, requirement.requiredCount)}
                        option={option}
                        prefersReducedMotion={prefersReducedMotion}
                        rowIndex={groupIndex * 10 + optionIndex}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <SelectionSummaryCard
          glow={theme.glow}
          maxCount={totalRequired}
          selectedCount={totalSelected}
          compact
        />
        <ClassAdvancementSelectedCard
          emptyMessage="No class options selected yet."
          entries={selectedEntries}
          title="Selected Features"
        />
      </aside>
    </div>
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
        "group relative grid w-full grid-cols-[3.4rem_minmax(0,1fr)_3.6rem] items-center gap-3 overflow-hidden rounded-[1rem] border py-2 pl-5 pr-2 text-left shadow-[0_14px_24px_color-mix(in_srgb,var(--cc-bg-base)_10%,transparent)] transition md:pl-6",
        "cc-theme-card cc-theme-card--interactive",
        option.checked && "cc-theme-card--selected",
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
          "relative flex h-12 w-12 items-center justify-center rounded-[0.8rem] border text-[1.1rem] shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent)]",
          "cc-theme-icon-chip",
          option.checked && "cc-theme-icon-chip--active",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.65rem] border" style={{ borderColor: "var(--cc-mounted-frame-border)" }} />
        <i className={cn("fa-solid", option.iconClass)} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="cc-theme-body block font-fth-cc-body text-[1.02rem] font-semibold leading-6">
          {option.label}
        </span>
      </span>
      <span
        className={cn(
          "relative flex h-10 w-12 items-center justify-center rounded-[0.75rem] border font-fth-cc-ui text-[0.88rem] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_color-mix(in_srgb,white_12%,transparent)]",
          "cc-theme-sigil",
          option.checked && "cc-theme-sigil--selected",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.6rem] border" style={{ borderColor: "var(--cc-mounted-frame-border)" }} />
        {option.checked ? <span>{PROFICIENCY_BONUS}</span> : <i className="fa-solid fa-hexagon" aria-hidden="true" />}
      </span>
    </motion.button>
  );
}

function AdvancementSummaryCard({
  selectedCount,
  maxCount,
  glow,
  guidance,
  title = "Selection Summary",
  label = "Choices Selected",
}: {
  selectedCount: number;
  maxCount: number;
  glow: string;
  guidance: string;
  title?: string;
  label?: string;
}) {
  return (
    <section
      className="cc-theme-panel overflow-hidden rounded-[1.45rem] border p-[0.28rem] shadow-[0_22px_40px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]"
      data-choice-summary-card="true"
      style={{ ...CC_MOUNTED_PANEL_STYLE, boxShadow: `0 22px 40px color-mix(in srgb, var(--cc-bg-base) 18%, transparent), 0 0 22px ${glow}` }}
    >
      <div className={cn("cc-theme-shell-inner rounded-[1.18rem] border px-4 py-4", CC_TEXT_PRIMARY)} style={CC_MOUNTED_FRAME_STYLE}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em]", CC_TEXT_KICKER)}>{title}</div>
            <div className={cn("cc-theme-title mt-2 font-fth-cc-display text-[1.65rem] leading-none", CC_TEXT_HERO)}>
              {selectedCount}
              <span className="ml-1 text-[1rem] opacity-75">/ {maxCount}</span>
            </div>
            <div className={cn("cc-theme-body mt-2 font-fth-cc-body text-[1rem]", CC_TEXT_SECONDARY)}>{label}</div>
          </div>
          <div className={cn("cc-theme-badge cc-theme-badge--muted inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]", CC_TEXT_HERO)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
            {selectedCount >= maxCount ? "Ready" : `${Math.max(0, maxCount - selectedCount)} left`}
          </div>
        </div>
        <div className="cc-theme-progress-track mt-3 h-2 overflow-hidden rounded-full" style={CC_MOUNTED_PROGRESS_TRACK_STYLE}>
          <div
            className="cc-theme-progress-fill h-full rounded-full"
            style={{
              width: `${maxCount > 0 ? (selectedCount / maxCount) * 100 : 0}%`,
              background: `linear-gradient(90deg, color-mix(in srgb, var(--cc-action-primary-bright) 88%, white 12%), ${glow})`,
            }}
          />
        </div>
        <div className={cn("cc-theme-body-muted mt-3 font-fth-cc-body text-[0.88rem] leading-6", CC_TEXT_SECONDARY)}>{guidance}</div>
      </div>
    </section>
  );
}

function SelectionSummaryCard({
  selectedCount,
  maxCount,
  glow,
  title = "Selection Summary",
  compact = false,
}: {
  selectedCount: number;
  maxCount: number;
  glow: string;
  title?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <section
        className="cc-theme-panel overflow-hidden rounded-[1.3rem] border p-[0.28rem] shadow-[0_22px_40px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]"
        data-choice-summary-card="true"
        style={{ ...CC_MOUNTED_PANEL_STYLE, boxShadow: `0 22px 40px color-mix(in srgb, var(--cc-bg-base) 18%, transparent), 0 0 22px ${glow}` }}
      >
        <div className={cn("cc-theme-shell-inner rounded-[1.02rem] border px-4 py-3", CC_TEXT_PRIMARY)} style={CC_MOUNTED_FRAME_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em]", CC_TEXT_KICKER)}>{title}</div>
              <div className={cn("cc-theme-body mt-1 font-fth-cc-body text-[0.92rem] leading-6", CC_TEXT_SECONDARY)}>
                {selectedCount} of {maxCount} selected
              </div>
            </div>
            <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.18em]", CC_TEXT_SECONDARY)}>
              {selectedCount >= maxCount ? "Ready" : `${Math.max(0, maxCount - selectedCount)} left`}
            </div>
          </div>
          <div className="cc-theme-progress-track mt-3 h-1.5 overflow-hidden rounded-full" style={CC_MOUNTED_PROGRESS_TRACK_STYLE}>
            <div
              className="cc-theme-progress-fill h-full rounded-full"
              style={{
                width: `${maxCount > 0 ? (selectedCount / maxCount) * 100 : 0}%`,
                background: `linear-gradient(90deg, color-mix(in srgb, var(--cc-action-primary-bright) 88%, white 12%), ${glow})`,
              }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="cc-theme-panel overflow-hidden rounded-[1.45rem] border p-[0.28rem] shadow-[0_22px_40px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]"
      data-choice-summary-card="true"
      style={{ ...CC_MOUNTED_PANEL_STYLE, boxShadow: `0 22px 40px color-mix(in srgb, var(--cc-bg-base) 18%, transparent), 0 0 22px ${glow}` }}
    >
      <div className={cn("cc-theme-shell-inner rounded-[1.18rem] border px-4 py-4", CC_TEXT_PRIMARY)} style={CC_MOUNTED_FRAME_STYLE}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em]", CC_TEXT_KICKER)}>{title}</div>
            <div className={cn("cc-theme-title mt-2 font-fth-cc-display text-[1.65rem] leading-none", CC_TEXT_HERO)}>
              {selectedCount}
              <span className="ml-1 text-[1rem] opacity-75">/ {maxCount}</span>
            </div>
          </div>
          <div className={cn("cc-theme-badge cc-theme-badge--muted inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]", CC_TEXT_HERO)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
            {selectedCount >= maxCount ? "Ready" : `${Math.max(0, maxCount - selectedCount)} left`}
          </div>
        </div>
        <div className="cc-theme-progress-track mt-3 h-2 overflow-hidden rounded-full" style={CC_MOUNTED_PROGRESS_TRACK_STYLE}>
          <div
            className="cc-theme-progress-fill h-full rounded-full"
            style={{
              width: `${maxCount > 0 ? (selectedCount / maxCount) * 100 : 0}%`,
              background: `linear-gradient(90deg, color-mix(in srgb, var(--cc-action-primary-bright) 88%, white 12%), ${glow})`,
            }}
            />
          </div>
        <div className={cn("cc-theme-body-muted mt-3 font-fth-cc-body text-[0.88rem] leading-6", CC_TEXT_SECONDARY)}>
          {selectedCount} of {maxCount} selected
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
        "group relative grid w-full grid-cols-[3rem_minmax(0,1fr)_4.75rem] items-center gap-3 overflow-hidden rounded-[1rem] border px-3 py-3 text-left shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition",
        "cc-theme-card cc-theme-card--interactive",
        option.checked && "cc-theme-card--selected",
        option.disabled && !option.checked && "opacity-60",
      )}
      disabled={option.disabled && !option.checked}
      data-choice-state={option.checked ? "selected" : "available"}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      onClick={() => onToggle(option.id)}
      transition={{ delay: 0.04 + rowIndex * 0.015, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      style={getMountedCardSurfaceStyle(option.checked)}
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
          CC_TEXT_HERO,
          "cc-theme-icon-chip",
          option.checked && "cc-theme-icon-chip--active",
        )}
        style={getMountedIconSurfaceStyle(option.checked)}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.7rem] border" style={{ borderColor: "var(--cc-mounted-frame-border)" }} />
        <i className={cn(option.iconClass ?? "fa-solid fa-sparkles", "relative z-10 text-base")} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={cn("cc-theme-body block font-fth-cc-body text-[1.02rem] font-semibold leading-6", CC_TEXT_PRIMARY)}>
          {option.label}
        </span>
        {option.description ? (
          <span className={cn("cc-theme-body-muted mt-0.5 block font-fth-cc-body text-[0.92rem] leading-6", CC_TEXT_SECONDARY)}>
            {option.description}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative flex h-10 w-12 items-center justify-center rounded-[0.75rem] border px-3 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked ? CC_TEXT_HERO : CC_TEXT_SECONDARY,
          "cc-theme-sigil",
          option.checked && "cc-theme-sigil--selected",
        )}
        style={getMountedSigilSurfaceStyle(option.checked)}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.6rem] border" style={{ borderColor: "var(--cc-mounted-frame-border)" }} />
        {option.checked ? (
          <i className="fa-solid fa-check" aria-hidden="true" />
        ) : (
          <i className="fa-solid fa-hexagon" aria-hidden="true" />
        )}
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
    <section className="cc-theme-panel overflow-hidden rounded-[1.45rem] border p-[0.28rem] shadow-[0_22px_40px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]" style={CC_MOUNTED_PANEL_STYLE}>
      <div className={cn("cc-theme-shell-inner rounded-[1.18rem] border px-4 py-4", CC_TEXT_PRIMARY)} style={CC_MOUNTED_FRAME_STYLE}>
        <div className="border-b pb-3 text-center" style={{ borderColor: "var(--cc-mounted-frame-border)" }}>
          <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em]", CC_TEXT_KICKER)}>{title}</div>
        </div>
        <div className="mt-4 grid gap-2.5">
          {entries.length > 0 ? entries.map((entry) => (
            <div
              className="cc-theme-card flex flex-wrap items-center gap-2 rounded-[0.95rem] border px-3 py-3"
              key={entry.id ?? entry.key ?? entry.label}
              style={getMountedCardSurfaceStyle()}
            >
              <span className={cn("cc-theme-icon-chip cc-theme-icon-chip--active inline-flex h-10 w-10 items-center justify-center rounded-full border", CC_TEXT_HERO)} style={getMountedIconSurfaceStyle(true)}>
                <i className={cn(entry.iconClass ?? "fa-solid fa-sparkles", "text-sm")} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("cc-theme-body block font-fth-cc-body text-[1rem] font-semibold", CC_TEXT_PRIMARY)}>{entry.label}</span>
                {entry.description ? (
                  <span className={cn("cc-theme-body-muted block font-fth-cc-body text-[0.86rem] leading-5", CC_TEXT_SECONDARY)}>{entry.description}</span>
                ) : null}
              </span>
            </div>
          )) : (
            <div className={cn("cc-theme-empty rounded-[0.95rem] border border-dashed px-3 py-4 text-center font-fth-cc-body text-sm", CC_TEXT_SECONDARY)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getClassAdvancementPaneCopy(type: ClassAdvancementCommonStepViewModel["type"]): ClassAdvancementPaneCopy {
  switch (type) {
    case "expertise":
      return {
        eyebrow: "Expertise",
        statusLabel: "Choose Expert Skills",
        summaryLabel: "Expertise Picks",
        selectedTitle: "Chosen Expertise",
        emptyMessage: "No expertise choices selected yet.",
        guidance: "Choose the expertise upgrades that define the class's strongest edge.",
      };
    case "languages":
      return {
        eyebrow: "Languages",
        statusLabel: "Choose Languages",
        summaryLabel: "Languages Chosen",
        selectedTitle: "Chosen Languages",
        emptyMessage: "No class languages selected yet.",
        guidance: "Choose the languages your class features grant and keep the count readable.",
      };
    case "tools":
      return {
        eyebrow: "Tools",
        statusLabel: "Choose Tool Proficiencies",
        summaryLabel: "Tool Picks",
        selectedTitle: "Chosen Tools",
        emptyMessage: "No class tools selected yet.",
        guidance: "Choose the tool proficiencies your class trains into your kit.",
      };
  }
}

function WeaponMasteryRow({
  isPreviewed,
  option,
  onPreview,
  onToggle,
  prefersReducedMotion,
  rowIndex,
}: {
  isPreviewed: boolean;
  option: WeaponMasteryChoiceOption;
  onPreview: (weaponId: string) => void;
  onToggle: (weaponId: string) => void;
  prefersReducedMotion: boolean;
  rowIndex: number;
}) {
  return (
    <motion.button
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      aria-pressed={option.checked}
      className={cn(
        "group relative grid w-full grid-cols-[4.15rem_minmax(0,1fr)_3.6rem] items-center gap-3 overflow-hidden rounded-[1rem] border px-3 py-2 text-left shadow-[0_14px_24px_rgba(0,0,0,0.18)] transition md:px-4",
        "cc-theme-card cc-theme-card--interactive",
        option.checked && "cc-theme-card--selected",
        isPreviewed && !option.checked && "border-[color:var(--cc-mounted-card-selected-border)]",
        option.disabled && !option.checked && "opacity-60",
      )}
      data-previewed={isPreviewed ? "true" : undefined}
      data-weapon-mastery-row="true"
      disabled={option.disabled && !option.checked}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      onClick={() => onToggle(option.id)}
      onFocus={() => onPreview(option.id)}
      onMouseEnter={() => onPreview(option.id)}
      transition={{ delay: 0.04 + rowIndex * 0.015, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      style={getMountedCardSurfaceStyle(option.checked || isPreviewed)}
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
        )}
        style={CC_MOUNTED_IMAGE_FRAME_STYLE}
      >
        <img alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" src={option.img} />
        <span className="pointer-events-none absolute inset-0" style={CC_MOUNTED_IMAGE_SCRIM_STYLE} />
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.65rem] border" style={{ borderColor: "var(--cc-mounted-frame-border)" }} />
      </span>
      <span className="min-w-0">
        <span className={cn("cc-theme-body block truncate font-fth-cc-body text-[1.02rem] font-semibold leading-6", CC_TEXT_PRIMARY)}>
          {option.name}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1.5">
        <span className={cn("cc-theme-pill--muted inline-flex items-center rounded-full border px-2 py-0.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em]", CC_TEXT_SECONDARY)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
            {formatWeaponTypeBadge(option.weaponType)}
          </span>
        <span className={cn("cc-theme-pill inline-flex items-center rounded-full border px-2 py-0.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em]", CC_TEXT_HERO)} style={CC_MOUNTED_BADGE_STYLE}>
            {option.mastery}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "relative flex h-10 w-12 items-center justify-center rounded-[0.75rem] border font-fth-cc-ui text-[0.88rem] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          option.checked ? CC_TEXT_HERO : CC_TEXT_SECONDARY,
          "cc-theme-sigil",
          option.checked && "cc-theme-sigil--selected",
        )}
        style={getMountedSigilSurfaceStyle(option.checked)}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.6rem] border" style={{ borderColor: "var(--cc-mounted-frame-border)" }} />
        {option.checked ? <i className="fa-solid fa-check" aria-hidden="true" /> : <i className="fa-solid fa-hexagon" aria-hidden="true" />}
      </span>
    </motion.button>
  );
}

function WeaponMasteryDetailCard({ option }: { option: WeaponMasteryChoiceOption }) {
  const weaponNotes = option.weaponDescription.trim() || option.tooltip.trim() || "Preview this weapon to compare it with the rest of the mastery list.";

  return (
    <section
      className="cc-theme-panel overflow-hidden rounded-[1.45rem] border p-[0.28rem] shadow-[0_22px_40px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]"
      data-weapon-mastery-preview="true"
      style={CC_MOUNTED_PANEL_STYLE}
    >
      <div className={cn("cc-theme-shell-inner rounded-[1.18rem] border px-4 py-4", CC_TEXT_PRIMARY)} style={CC_MOUNTED_FRAME_STYLE}>
        <div className="flex items-start gap-3 border-b pb-3" style={{ borderColor: "var(--cc-mounted-frame-border)" }}>
          <span className="relative flex h-16 w-16 shrink-0 overflow-hidden rounded-[1rem] border" style={CC_MOUNTED_IMAGE_FRAME_STYLE}>
            <img alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" src={option.img} />
            <span className="pointer-events-none absolute inset-0" style={CC_MOUNTED_IMAGE_SCRIM_STYLE} />
          </span>
          <div className="min-w-0">
            <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em]", CC_TEXT_KICKER)}>Weapon Preview</div>
            <div className={cn("cc-theme-body mt-1 text-[1.2rem] font-semibold leading-6", CC_TEXT_PRIMARY)}>{option.name}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn("cc-theme-pill--muted inline-flex items-center rounded-full border px-2 py-0.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em]", CC_TEXT_SECONDARY)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
                {formatWeaponTypeBadge(option.weaponType)}
              </span>
              <span className={cn("cc-theme-pill inline-flex items-center rounded-full border px-2 py-0.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em]", CC_TEXT_HERO)} style={CC_MOUNTED_BADGE_STYLE}>
                {option.mastery}
              </span>
              <span className={cn("cc-theme-pill--muted inline-flex items-center rounded-full border px-2 py-0.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em]", option.checked ? CC_TEXT_HERO : CC_TEXT_SECONDARY)} style={option.checked ? CC_MOUNTED_BADGE_STYLE : CC_MOUNTED_MUTED_BADGE_STYLE}>
                {option.checked ? "Selected" : "Previewing"}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="cc-theme-card rounded-[1rem] border px-3 py-3" style={getMountedCardSurfaceStyle(option.checked)}>
            <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em]", CC_TEXT_SECONDARY)}>Weapon Notes</div>
            <div className={cn("cc-theme-body mt-1.5 font-fth-cc-body text-[0.92rem] leading-6", CC_TEXT_PRIMARY)}>{weaponNotes}</div>
          </div>
          <div className="cc-theme-card rounded-[1rem] border px-3 py-3" style={getMountedCardSurfaceStyle(true)}>
            <div className="flex items-center gap-2">
              <span className={cn("cc-theme-icon-chip inline-flex h-8 w-8 items-center justify-center rounded-full border", CC_TEXT_HERO)} style={getMountedIconSurfaceStyle(true)}>
                <i className={getMasteryIcon(option.mastery)} aria-hidden="true" />
              </span>
              <div>
                <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em]", CC_TEXT_SECONDARY)}>Mastery Technique</div>
                <div className={cn("cc-theme-body font-fth-cc-body text-[1rem] font-semibold", CC_TEXT_PRIMARY)}>{option.mastery}</div>
              </div>
            </div>
            <div className={cn("cc-theme-body mt-2 font-fth-cc-body text-[0.92rem] leading-6", CC_TEXT_PRIMARY)}>{option.masteryDescription}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectedMasteriesCard({ selectedEntries }: { selectedEntries: WeaponMasteryChoiceOption[] }) {
  return (
    <section className="cc-theme-panel overflow-hidden rounded-[1.45rem] border p-[0.28rem] shadow-[0_22px_40px_color-mix(in_srgb,var(--cc-bg-base)_18%,transparent)]" style={CC_MOUNTED_PANEL_STYLE}>
      <div className={cn("cc-theme-shell-inner rounded-[1.18rem] border px-4 py-4", CC_TEXT_PRIMARY)} style={CC_MOUNTED_FRAME_STYLE}>
        <div className="border-b pb-3 text-center" style={{ borderColor: "var(--cc-mounted-frame-border)" }}>
          <div className={cn("cc-theme-kicker font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em]", CC_TEXT_KICKER)}>Chosen Weapons</div>
          <div className={cn("cc-theme-body-muted mt-2 font-fth-cc-body text-[0.82rem] leading-5", CC_TEXT_SECONDARY)}>
            Weapons you have already mastered in this class path.
          </div>
        </div>
        <div className="mt-4 grid gap-2.5">
          {selectedEntries.length > 0 ? selectedEntries.map((entry) => (
            <div
              className="cc-theme-card grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1rem] border px-2.5 py-2.5 shadow-[0_10px_18px_color-mix(in_srgb,var(--cc-bg-base)_10%,transparent)]"
              key={entry.id}
              style={getMountedCardSurfaceStyle()}
            >
              <span className="overflow-hidden rounded-[0.8rem] border" style={CC_MOUNTED_IMAGE_FRAME_STYLE}>
                <img alt="" aria-hidden="true" className="h-10 w-10 object-cover" loading="lazy" src={entry.img} />
              </span>
              <span className="min-w-0">
                <span className={cn("cc-theme-body block truncate font-fth-cc-body text-[1rem] font-semibold", CC_TEXT_PRIMARY)}>{entry.name}</span>
                <span className={cn("cc-theme-kicker font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.14em]", CC_TEXT_SECONDARY)}>{entry.mastery}</span>
              </span>
              <span className={cn("cc-theme-sigil cc-theme-sigil--selected inline-flex h-8 w-8 items-center justify-center rounded-full border", CC_TEXT_HERO)} style={getMountedSigilSurfaceStyle(true)}>
                <i className="fa-solid fa-check" aria-hidden="true" />
              </span>
            </div>
          )) : (
            <div className={cn("cc-theme-empty rounded-[0.95rem] border border-dashed px-3 py-4 text-center font-fth-cc-body text-sm", CC_TEXT_SECONDARY)} style={CC_MOUNTED_MUTED_BADGE_STYLE}>
              Preview a weapon here, then select the ones you want to lock in.
            </div>
          )}
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
