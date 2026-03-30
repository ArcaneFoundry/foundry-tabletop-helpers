import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import type { ReactWizardStepProps } from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { buildClassAggregateStepperModel } from "../../progress/build-class-aggregate-stepper-model";
import { ClassAggregateStepper } from "./class-step-screen";
import { useClassStepperLayoutMode } from "./class-stepper-layout";
import classStepHeaderBackground from "../../../assets/class-step-header-bg.webp";
import classStepFieldBackground from "../../../assets/class-step-field-bg.webp";

type SkillChoiceOption = {
  key: string;
  label: string;
  abilityAbbrev: string;
  checked: boolean;
  disabled: boolean;
  iconClass: string;
  tooltip: string;
};

type ClassChoicesStepViewModel = {
  stepId: string;
  stepTitle: string;
  stepLabel: string;
  stepIcon: string;
  stepDescription: string;
  hideStepIndicator: boolean;
  hideShellHeader: boolean;
  shellContentClass: string;
  className: string;
  classIdentifier: string;
  primaryAbilityHint: string;
  savingThrows: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  skillSection: {
    hasChoices: boolean;
    chosenCount: number;
    maxCount: number;
    selectedEntries: Array<{
      label: string;
      iconClass?: string;
      tooltip: string;
      abilityAbbrev?: string;
    }>;
    options: SkillChoiceOption[];
    emptyMessage: string;
  };
};

const CLASS_THEMES: Record<string, { accent: string; glow: string; sigil: string }> = {
  barbarian: { accent: "#b57d4d", glow: "rgba(201,124,58,0.24)", sigil: "fa-solid fa-fire" },
  bard: { accent: "#be9361", glow: "rgba(216,165,103,0.22)", sigil: "fa-solid fa-music" },
  cleric: { accent: "#bca26e", glow: "rgba(212,185,104,0.22)", sigil: "fa-solid fa-sun" },
  druid: { accent: "#96a663", glow: "rgba(123,156,82,0.26)", sigil: "fa-solid fa-leaf" },
  fighter: { accent: "#b48959", glow: "rgba(196,145,89,0.24)", sigil: "fa-solid fa-swords" },
  monk: { accent: "#c89f6d", glow: "rgba(215,164,104,0.24)", sigil: "fa-solid fa-hand-fist" },
  paladin: { accent: "#d3b27b", glow: "rgba(220,190,121,0.24)", sigil: "fa-solid fa-shield-halved" },
  ranger: { accent: "#a8b95f", glow: "rgba(155,189,88,0.26)", sigil: "fa-solid fa-bow-arrow" },
  rogue: { accent: "#b08995", glow: "rgba(174,127,146,0.24)", sigil: "fa-solid fa-mask" },
  sorcerer: { accent: "#c18377", glow: "rgba(210,125,112,0.24)", sigil: "fa-solid fa-wand-sparkles" },
  warlock: { accent: "#b285bb", glow: "rgba(173,118,186,0.24)", sigil: "fa-solid fa-book-open" },
  wizard: { accent: "#7ea3d5", glow: "rgba(111,154,215,0.24)", sigil: "fa-solid fa-hat-wizard" },
};

const PROFICIENCY_BONUS = "+2";
const CLASS_SKILL_ABILITY_ORDER = ["STR", "DEX", "CON", "WIS", "INT", "CHA"] as const;

export function ClassChoicesStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as ClassChoicesStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    viewModel.skillSection.selectedEntries.map((entry) => viewModel.skillSection.options.find((option) => option.label === entry.label)?.key)
      .filter((value): value is string => Boolean(value)),
  );

  const theme = getClassTheme(viewModel.classIdentifier);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const aggregateStepper = useMemo(
    () => buildClassAggregateStepperModel(state, shellContext.steps, shellContext.currentStepId),
    [shellContext.currentStepId, shellContext.steps, state],
  );
  const [layoutMode, setStepperContainer] = useClassStepperLayoutMode();
  const maxCount = viewModel.skillSection.maxCount;
  const options = useMemo(
    () => viewModel.skillSection.options.map((option) => ({
      ...option,
      checked: selectedSet.has(option.key),
      disabled: !selectedSet.has(option.key) && selectedSet.size >= maxCount,
    })),
    [maxCount, selectedSet, viewModel.skillSection.options],
  );
  const groupedOptions = useMemo(() => groupSkillChoicesByAbility(options), [options]);

  const onToggleSkill = (skillKey: string) => {
    const option = options.find((candidate) => candidate.key === skillKey);
    if (!option) return;
    const nextSelected = new Set(selectedKeys);
    if (nextSelected.has(skillKey)) {
      nextSelected.delete(skillKey);
    } else {
      if (nextSelected.size >= maxCount) return;
      nextSelected.add(skillKey);
    }

    const chosenSkills = Array.from(nextSelected);
    state.selections.skills = { chosen: chosenSkills };
    controller.updateCurrentStepData({ chosenSkills }, { silent: true });
    setSelectedKeys(chosenSkills);
  };

  return (
    <section className="flex flex-col px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="relative flex flex-col rounded-[1.75rem] border border-fth-cc-gold/45 bg-[linear-gradient(180deg,rgba(249,237,216,0.98),rgba(236,219,191,0.98))] p-[0.35rem] shadow-[0_24px_60px_rgba(0,0,0,0.34)]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-[0.35rem] rounded-[1.45rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),transparent_28%),linear-gradient(180deg,rgba(255,248,236,0.98),rgba(232,214,187,0.98))]" />

        <div className="relative flex flex-col rounded-[1.45rem] border border-[#b78d56]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.92),rgba(236,220,197,0.96))] shadow-[inset_0_0_0_1px_rgba(255,245,226,0.72)]">
          <motion.header
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            className="mx-2 mt-2 px-4 pb-3 pt-3 md:px-6"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
            transition={{ delay: 0.05, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative overflow-hidden rounded-[1.15rem] border border-fth-cc-gold/50 shadow-[inset_0_1px_0_rgba(255,236,206,0.22),0_10px_22px_rgba(0,0,0,0.18),0_18px_34px_rgba(77,46,18,0.2)]">
              <img
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                src={classStepHeaderBackground}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,11,0.24),rgba(16,12,11,0.42))]" />
              <div className="relative z-10 flex items-center justify-center px-4 py-3">
                <HeaderFlourish side="left" />
                <h2
                  className="m-0 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.12em] text-fth-cc-gold-bright md:text-[2.05rem]"
                  style={{
                    textShadow:
                      "0 0 8px rgba(255,225,164,0.4), 0 0 18px rgba(255,211,130,0.2), 0 2px 10px rgba(16, 9, 6, 0.72)",
                  }}
                >
                  Choose Your Skills
                </h2>
                <HeaderFlourish side="right" />
              </div>
            </div>
          </motion.header>

          <div className="relative flex flex-col px-3 pb-4 pt-3 md:px-6">
            <img
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18] mix-blend-multiply"
              src={classStepFieldBackground}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,252,245,0.6),rgba(255,248,236,0.18)_52%,rgba(219,190,145,0.08)_100%)]" />
            <div ref={setStepperContainer} className="relative z-10 w-full">
              <ClassAggregateStepper
                layoutMode={layoutMode}
                model={aggregateStepper}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>

            <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col gap-4">
              <SelectionSummaryCard
                accent={theme.accent}
                glow={theme.glow}
                sigil={theme.sigil}
                maxCount={maxCount}
                primaryAbilityHint={viewModel.primaryAbilityHint}
                savingThrows={viewModel.savingThrows}
                selectedCount={selectedKeys.length}
                selectedEntries={viewModel.skillSection.selectedEntries}
              />

              <section className="flex min-h-0 flex-col rounded-[1.45rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.94),rgba(239,224,198,0.94))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
                {viewModel.skillSection.hasChoices ? (
                  <div className="flex flex-col px-1 pb-3 pt-2 pr-2">
                    <div className="grid gap-4">
                      {groupedOptions.map((group, groupIndex) => (
                        <section className="grid gap-2.5" key={group.abilityAbbrev}>
                          <div className="flex items-center gap-3 px-1">
                            <span className="inline-flex items-center rounded-full border border-[#8c6a47]/75 bg-[linear-gradient(180deg,#5b3d2b_0%,#3a271b_100%)] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#f1d9b3] shadow-[0_10px_18px_rgba(47,29,18,0.14)]">
                              {group.abilityAbbrev}
                            </span>
                            <span className="font-fth-cc-body text-[0.95rem] font-semibold text-[#6a4f3c]">
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
                  <div className="rounded-[1.1rem] border border-dashed border-[#c7aa80]/65 bg-[rgba(255,250,241,0.7)] px-4 py-5 font-fth-cc-body text-[#6b5040]">
                    {viewModel.skillSection.emptyMessage}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
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
        "group relative grid w-full grid-cols-[3.4rem_minmax(0,1fr)_3.6rem] items-center gap-3 overflow-hidden rounded-[1rem] border px-2 py-2 text-left shadow-[0_12px_22px_rgba(67,43,23,0.08)] transition",
        option.checked
          ? "border-[#9daa58] bg-[linear-gradient(180deg,rgba(243,245,212,0.98),rgba(227,232,180,0.94))]"
          : "border-[#ceb18a] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(244,231,209,0.94))]",
        option.disabled && !option.checked && "opacity-60",
      )}
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
          "relative flex h-12 w-12 items-center justify-center rounded-[0.8rem] border text-[1.1rem] shadow-[inset_0_1px_0_rgba(255,244,220,0.16)]",
          option.checked
            ? "border-[#7e8c3f] bg-[linear-gradient(180deg,#536425_0%,#364317_100%)] text-[#f6efc4]"
            : "border-[#8c6a47] bg-[linear-gradient(180deg,#5c3d2b_0%,#3a271b_100%)] text-[#f1d9b3]",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.65rem] border border-white/10" />
        <i className={cn("fa-solid", option.iconClass)} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-fth-cc-body text-[1.02rem] font-semibold leading-6 text-[#3f2c22]">
          {option.label}
        </span>
      </span>
      <span
        className={cn(
          "relative flex h-10 w-12 items-center justify-center rounded-[0.75rem] border font-fth-cc-ui text-[0.88rem] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,244,220,0.12)]",
          option.checked
            ? "border-[#8da044] bg-[linear-gradient(180deg,#6d8a2d_0%,#4a5f1f_100%)] text-[#fff8ea]"
            : "border-[#d1b58f] bg-[linear-gradient(180deg,rgba(248,238,220,0.9),rgba(227,210,183,0.92))] text-[#ad8f6f]",
        )}
      >
        <span className="pointer-events-none absolute inset-[2px] rounded-[0.6rem] border border-white/10" />
        {option.checked ? (
          <span>{PROFICIENCY_BONUS}</span>
        ) : (
          <i className="fa-solid fa-hexagon" aria-hidden="true" />
        )}
      </span>
    </motion.button>
  );
}

function SelectionSummaryCard({
  selectedCount,
  maxCount,
  accent,
  glow,
  sigil,
  primaryAbilityHint,
  selectedEntries,
  savingThrows,
}: {
  selectedCount: number;
  maxCount: number;
  accent: string;
  glow: string;
  sigil: string;
  primaryAbilityHint: string;
  selectedEntries: ClassChoicesStepViewModel["skillSection"]["selectedEntries"];
  savingThrows: string[];
}) {
  return (
    <section
      className="overflow-hidden rounded-[1.45rem] border border-[#5b3e2a] bg-[linear-gradient(180deg,rgba(67,45,31,0.98),rgba(24,15,11,0.99))] p-[0.28rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)]"
      style={{ boxShadow: `0 22px 40px rgba(0,0,0,0.28), 0 0 22px ${glow}` }}
    >
      <div className="rounded-[1.18rem] border border-[#8e6a47]/70 bg-[linear-gradient(180deg,rgba(63,41,28,0.98),rgba(25,16,12,0.98))] px-4 py-4 text-[#f1ddbc]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8f6c47]/40 pb-4">
          <div className="min-w-0 flex-1">
            {primaryAbilityHint ? (
              <div className="inline-flex max-w-full items-start gap-2 rounded-full border border-[#d5b98b]/70 bg-[rgba(255,247,233,0.78)] px-3 py-1.5 font-fth-cc-body text-sm text-[#6b503f]">
                <i className={cn(sigil, "mt-0.5 text-[#8a613e]")} aria-hidden="true" />
                <span className="min-w-0">
                  <strong>Prime Attribute Guidance:</strong> {primaryAbilityHint}
                </span>
              </div>
            ) : null}
          </div>
          <div
            className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[#fff9ea] shadow-[inset_0_2px_0_rgba(255,244,225,0.22),0_12px_24px_rgba(0,0,0,0.24)]"
            style={{
              borderColor: accent,
              background: `radial-gradient(circle at 35% 30%, rgba(247,214,145,0.98), ${accent})`,
            }}
          >
            <span className="font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.22em]">Selection Summary</span>
            <span className="font-fth-cc-display text-[1.55rem] leading-none">{selectedCount}/{maxCount}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#8e6a47]/65 bg-[rgba(255,250,241,0.14)] px-3 py-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em] text-[#f0dcb9]">
              Saving Throws
            </span>
            {savingThrows.map((value) => (
              <span
                className="inline-flex items-center rounded-full border border-[#8a6a48] bg-[linear-gradient(180deg,rgba(101,70,49,0.94),rgba(54,35,25,0.98))] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#f2deb6]"
                key={value}
              >
                {value}
              </span>
            ))}
          </div>
          <span aria-hidden="true" className="hidden h-6 w-px bg-[rgba(255,233,188,0.18)] md:block" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#8e6a47]/65 bg-[rgba(255,250,241,0.14)] px-3 py-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em] text-[#f0dcb9]">
              Chosen Skills
            </span>
            {selectedEntries.length > 0 ? (
              selectedEntries.map((entry) => (
                <span
                  className="inline-flex items-center rounded-full border border-[#8c6a47]/55 bg-[rgba(255,247,233,0.76)] px-3 py-1.5 font-fth-cc-body text-[0.88rem] text-[#6a4f3c]"
                  key={entry.label}
                >
                  {entry.label}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center rounded-full border border-dashed border-[#8c6a47]/45 bg-[rgba(255,247,233,0.6)] px-3 py-1.5 font-fth-cc-body text-[0.88rem] text-[#7a5d49]">
                No skills selected yet
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
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

function getClassTheme(identifier: string) {
  return CLASS_THEMES[identifier.trim().toLowerCase()] ?? CLASS_THEMES.fighter;
}

export function groupSkillChoicesByAbility(options: SkillChoiceOption[]) {
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
