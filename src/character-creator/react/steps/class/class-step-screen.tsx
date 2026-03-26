import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import type {
  ClassSelection,
  CreatorIndexEntry,
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import {
  buildClassAggregateStepperModel,
  type ClassAggregateMilestoneNode,
  type ClassAggregatePresentationStatus,
  type ClassAggregateSubstepNode,
} from "../../progress/build-class-aggregate-stepper-model";
import { shouldShowClassStepperSubsteps, type ClassStepperLayoutMode } from "./class-stepper-layout";
import { buildClassSelectionFromEntry, getClassStepViewModel } from "../../../steps/step-class-model";
import classStepHeaderBackground from "../../../assets/class-step-header-bg.webp";
import classStepFieldBackground from "../../../assets/class-step-field-bg.webp";

type ClassStepViewModel = Awaited<ReturnType<typeof getClassStepViewModel>>;
type ClassEntryViewModel = ClassStepViewModel["entries"][number];

const CLASS_THEMES: Record<string, { ribbon: string; frame: string; glow: string; crest: string }> = {
  barbarian: { ribbon: "from-[#714126] to-[#382015]", frame: "#b57d4d", glow: "rgba(201,124,58,0.35)", crest: "fa-solid fa-fire" },
  bard: { ribbon: "from-[#6e4934] to-[#302018]", frame: "#be9361", glow: "rgba(216,165,103,0.3)", crest: "fa-solid fa-music" },
  cleric: { ribbon: "from-[#665b3b] to-[#2f2819]", frame: "#bca26e", glow: "rgba(212,185,104,0.3)", crest: "fa-solid fa-sun" },
  druid: { ribbon: "from-[#46562f] to-[#202715]", frame: "#96a663", glow: "rgba(123,156,82,0.34)", crest: "fa-solid fa-leaf" },
  fighter: { ribbon: "from-[#5f4431] to-[#2a1c14]", frame: "#b48959", glow: "rgba(196,145,89,0.32)", crest: "fa-solid fa-swords" },
  monk: { ribbon: "from-[#74543a] to-[#352316]", frame: "#c89f6d", glow: "rgba(215,164,104,0.34)", crest: "fa-solid fa-hand-fist" },
  paladin: { ribbon: "from-[#625342] to-[#2a221a]", frame: "#d3b27b", glow: "rgba(220,190,121,0.32)", crest: "fa-solid fa-shield-halved" },
  ranger: { ribbon: "from-[#4f5f2f] to-[#233015]", frame: "#a8b95f", glow: "rgba(155,189,88,0.36)", crest: "fa-solid fa-bow-arrow" },
  rogue: { ribbon: "from-[#4f4447] to-[#241d1f]", frame: "#b08995", glow: "rgba(174,127,146,0.32)", crest: "fa-solid fa-mask" },
  sorcerer: { ribbon: "from-[#74413c] to-[#341b17]", frame: "#c18377", glow: "rgba(210,125,112,0.34)", crest: "fa-solid fa-wand-sparkles" },
  warlock: { ribbon: "from-[#5c3d5f] to-[#29182a]", frame: "#b285bb", glow: "rgba(173,118,186,0.34)", crest: "fa-solid fa-book-open" },
  wizard: { ribbon: "from-[#3f506a] to-[#1a2230]", frame: "#7ea3d5", glow: "rgba(111,154,215,0.34)", crest: "fa-solid fa-hat-wizard" },
};

export function ClassStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const initialViewModel = shellContext.stepViewModel as ClassStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;

  const [entries, setEntries] = useState<ClassEntryViewModel[]>(initialViewModel?.entries ?? []);
  const [emptyMessage, setEmptyMessage] = useState(
    initialViewModel?.emptyMessage ?? "No classes available. Check your GM configuration.",
  );

  useEffect(() => {
    let cancelled = false;

    void getClassStepViewModel(state).then((viewModel: ClassStepViewModel) => {
      if (cancelled) return;
      setEntries(viewModel.entries);
      setEmptyMessage(viewModel.emptyMessage);
    });

    return () => {
      cancelled = true;
    };
  }, [state]);

  const selectedUuid = (state.selections.class as ClassSelection | undefined)?.uuid ?? null;
  const hasEntries = entries.length > 0;
  const aggregateStepper = useMemo(
    () => buildClassAggregateStepperModel(state, shellContext.steps, shellContext.currentStepId),
    [shellContext.currentStepId, shellContext.steps, state],
  );

  const onSelectEntry = async (entry: CreatorIndexEntry) => {
    const selection = await buildClassSelectionFromEntry(state, entry);

    controller.updateCurrentStepData(selection, { silent: true });
    setEntries((currentEntries) => currentEntries.map((candidate) => ({
      ...candidate,
      selected: candidate.uuid === entry.uuid,
    })));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[#e9c176]/25 bg-[linear-gradient(180deg,rgba(25,25,30,0.96),rgba(15,15,19,0.99))] p-[0.35rem] shadow-[0_30px_80px_rgba(0,0,0,0.38)]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
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
            <motion.div
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[1.15rem] border border-fth-cc-gold/50 shadow-[inset_0_1px_0_rgba(255,236,206,0.22),0_10px_22px_rgba(0,0,0,0.18),0_18px_34px_rgba(77,46,18,0.2)]"
              initial={prefersReducedMotion ? false : { opacity: 0, y: -12, scale: 0.988 }}
              transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.img
                alt=""
                animate={prefersReducedMotion ? undefined : { scale: 1 }}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                initial={prefersReducedMotion ? false : { scale: 1.035 }}
                src={classStepHeaderBackground}
                transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,11,0.24),rgba(16,12,11,0.42))]" />
              <motion.div
                animate={prefersReducedMotion ? undefined : { opacity: [0.18, 0.32, 0.18] }}
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,220,170,0.08),transparent_40%)]"
                transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
              />
              <div className="relative z-10 flex items-center justify-center px-4 py-3">
                <HeaderFlourish prefersReducedMotion={prefersReducedMotion} side="left" />
                <h2
                  className="m-0 font-fth-cc-display text-[1.55rem] uppercase tracking-[0.12em] text-fth-cc-gold-bright md:text-[2.15rem]"
                  style={{
                    textShadow:
                      "0 0 8px rgba(255,225,164,0.4), 0 0 18px rgba(255,211,130,0.2), 0 2px 10px rgba(16, 9, 6, 0.72)",
                  }}
                >
                  Choose Your Class
                </h2>
                <HeaderFlourish prefersReducedMotion={prefersReducedMotion} side="right" />
              </div>
            </motion.div>
          </motion.header>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-3 md:px-6">
            <img
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16]"
              src={classStepFieldBackground}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(211,190,235,0.1),rgba(15,15,19,0)_52%,rgba(233,193,118,0.06)_100%)]" />
            <ClassAggregateStepper model={aggregateStepper} prefersReducedMotion={prefersReducedMotion} />

            {hasEntries ? (
              <div className="fth-react-scrollbar relative z-10 mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-2 pt-2">
                <motion.div
                  animate={prefersReducedMotion ? undefined : "show"}
                  className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
                  initial={prefersReducedMotion ? false : "hidden"}
                  variants={{
                    hidden: {},
                    show: {
                      transition: {
                        staggerChildren: 0.045,
                        delayChildren: 0.14,
                      },
                    },
                  }}
                >
                  {entries.map((entry) => (
                    <ClassCard
                      entry={entry}
                      key={entry.uuid}
                      onSelect={onSelectEntry}
                      prefersReducedMotion={prefersReducedMotion}
                      selected={selectedUuid === entry.uuid}
                    />
                  ))}
                </motion.div>
              </div>
            ) : (
              <EmptyState message={emptyMessage} prefersReducedMotion={prefersReducedMotion} />
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function HeaderFlourish({ side, prefersReducedMotion }: { side: "left" | "right"; prefersReducedMotion: boolean }) {
  const containerClasses =
    side === "left"
      ? "mr-2 flex min-w-0 flex-1 items-center justify-end gap-1.5 md:mr-4 md:gap-2"
      : "ml-2 flex min-w-0 flex-1 items-center justify-start gap-1.5 md:ml-4 md:gap-2";
  const lineClasses =
    side === "left"
      ? "bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(214,177,111,0.88),rgba(255,233,188,0.42))]"
      : "bg-[linear-gradient(90deg,rgba(255,233,188,0.42),rgba(214,177,111,0.88),rgba(214,177,111,0))]";

  return (
    <motion.span
      animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
      aria-hidden="true"
      className={containerClasses}
      initial={prefersReducedMotion ? false : { opacity: 0, x: side === "left" ? 10 : -10 }}
      transition={{ delay: 0.18, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      {side === "right" ? <FlourishGem prefersReducedMotion={prefersReducedMotion} /> : null}
      <span className="relative block h-4 w-full max-w-[4.25rem] md:max-w-[10.5rem]">
        <motion.span
          animate={prefersReducedMotion ? undefined : { scaleX: 1, opacity: 1 }}
          className={cn("absolute inset-x-0 top-1/2 h-px origin-center -translate-y-1/2", lineClasses)}
          initial={prefersReducedMotion ? false : { scaleX: 0.7, opacity: 0.3 }}
          transition={{ delay: 0.24, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </span>
      {side === "left" ? <FlourishGem prefersReducedMotion={prefersReducedMotion} /> : null}
    </motion.span>
  );
}

function FlourishGem({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <motion.span
      animate={prefersReducedMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.92, 1, 0.92] }}
      className="relative block h-3.5 w-3.5 md:h-4.5 md:w-4.5"
      transition={{ duration: 3.8, ease: "easeInOut", repeat: Infinity }}
    >
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[0.15rem] border border-[#d6b16f]/85 bg-[linear-gradient(180deg,rgba(121,87,37,0.35),rgba(214,177,111,0.18))] shadow-[0_0_8px_rgba(242,216,157,0.14)] md:h-3.5 md:w-3.5" />
      <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#f4ddb1]/85 md:h-1.5 md:w-1.5" />
    </motion.span>
  );
}

export function ClassAggregateStepper({
  model,
  layoutMode = "wide",
  prefersReducedMotion,
}: {
  model: ReturnType<typeof buildClassAggregateStepperModel>;
  layoutMode?: ClassStepperLayoutMode;
  prefersReducedMotion: boolean;
}) {
  const shouldRenderSubsteps = shouldShowClassStepperSubsteps({
    layoutMode,
    hasSubsteps: model.showSubsteps && model.substeps.length > 0,
  });
  const isCompactLayout = layoutMode === "compact";
  const compactMilestoneRows = isCompactLayout
    ? [model.milestones.slice(0, 2), model.milestones.slice(2)]
    : [];

  return (
    <motion.nav
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      aria-label="Class Selection Progress"
      className={cn(
        "fth-class-stepper relative mx-auto flex w-full flex-col border-b border-[#bea37d]/55 text-[#5e4330]",
        isCompactLayout
          ? "fth-class-stepper--compact max-w-3xl gap-2 pb-3"
          : "fth-class-stepper--wide max-w-5xl gap-3 pb-4",
      )}
      data-layout-mode={layoutMode}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      transition={{ delay: 0.14, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      {isCompactLayout ? (
        <div className="relative z-10 flex flex-col gap-2 px-1">
          {compactMilestoneRows.map((row, rowIndex) => (
            <div className="fth-class-stepper__compact-row flex items-center justify-center gap-2.5" key={`compact-row-${rowIndex}`}>
              {row.map((milestone, index) => (
                <div className="flex min-w-0 items-center gap-2.5" key={milestone.id}>
                  <MilestoneNode milestone={milestone} prefersReducedMotion={prefersReducedMotion} compact />
                  {index < row.length - 1 ? <RailConnector compact /> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10 flex items-center justify-center gap-3">
          <RailEndcap side="left" />
          {model.milestones.map((milestone, index) => (
            <div className="flex items-center gap-3" key={milestone.id}>
              <MilestoneNode milestone={milestone} prefersReducedMotion={prefersReducedMotion} />
              {index < model.milestones.length - 1 ? <RailConnector /> : null}
            </div>
          ))}
          <RailEndcap side="right" />
        </div>
      )}
      {shouldRenderSubsteps ? (
        <motion.div
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          className="relative z-10 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-1 pt-1"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          transition={{ delay: 0.2, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {model.substeps.map((step) => (
            <SubstepChip key={step.id} prefersReducedMotion={prefersReducedMotion} step={step} />
          ))}
        </motion.div>
      ) : null}
    </motion.nav>
  );
}

function MilestoneNode({
  milestone,
  prefersReducedMotion,
  compact = false,
}: {
  milestone: ClassAggregateMilestoneNode;
  prefersReducedMotion: boolean;
  compact?: boolean;
}) {
  return (
    <motion.div
      animate={prefersReducedMotion ? undefined : getMilestoneAnimate(milestone.status)}
      className={cn(
        "fth-class-stepper__milestone relative flex items-center",
        compact ? "gap-2" : "gap-2.5",
      )}
      transition={getMilestoneTransition(milestone.status, prefersReducedMotion)}
    >
      <span
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden rounded-full border shadow-[inset_0_1px_0_rgba(255,245,226,0.75),0_10px_18px_rgba(76,53,36,0.14)]",
          compact ? "h-9 w-9 text-[0.76rem] md:h-10 md:w-10 md:text-sm" : "h-10 w-10 text-sm md:h-12 md:w-12 md:text-base",
          getMilestoneClassName(milestone.status),
        )}
        title={milestone.label}
      >
        <span
          className={cn(
            "pointer-events-none absolute inset-[-5px] rounded-full transition-opacity",
            getMilestoneHaloClassName(milestone.status),
          )}
        />
        <span className="pointer-events-none absolute inset-[2px] rounded-full border border-white/20" />
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.32),transparent_42%)]" />
        <span className="sr-only">{milestone.label}</span>
        <i className={cn(milestone.icon, "relative z-10")} aria-hidden="true" />
      </span>
      <span
        className={cn(
          "fth-class-stepper__milestone-label relative pb-1 font-fth-cc-ui uppercase",
          compact
            ? "min-w-[4.75rem] text-[0.58rem] tracking-[0.14em] md:min-w-[5.25rem] md:text-[0.63rem]"
            : "min-w-[6.25rem] text-[0.66rem] tracking-[0.18em] md:text-[0.72rem]",
          getMilestoneLabelClassName(milestone.status),
        )}
      >
        {milestone.status !== "pending" && milestone.status !== "skipped" ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-[0.1rem] h-px",
              milestone.status === "in-progress"
                ? "bg-[linear-gradient(90deg,rgba(78,140,124,0),rgba(78,140,124,0.82),rgba(78,140,124,0))]"
                : "bg-[linear-gradient(90deg,rgba(203,152,69,0),rgba(203,152,69,0.82),rgba(203,152,69,0))]",
            )}
          />
        ) : null}
        <span className="relative z-10">{milestone.label}</span>
      </span>
    </motion.div>
  );
}

function SubstepChip({
  step,
  prefersReducedMotion,
}: {
  step: ClassAggregateSubstepNode;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-1 py-1.5",
        step.active
          ? "text-[#1d453b]"
          : step.status === "complete"
            ? "text-[#5c3c16]"
            : "text-[#6a4f3c]",
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      title={step.label}
    >
      <i className={cn(step.icon, "text-[0.68rem]")} aria-hidden="true" />
      <span className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.14em] md:text-[0.62rem]">{step.label}</span>
      {step.status !== "pending" ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-px",
            step.active
              ? "bg-[linear-gradient(90deg,rgba(78,140,124,0),rgba(78,140,124,0.82),rgba(78,140,124,0))]"
              : "bg-[linear-gradient(90deg,rgba(203,152,69,0),rgba(203,152,69,0.82),rgba(203,152,69,0))]",
          )}
        />
      ) : null}
    </motion.div>
  );
}

function RailConnector({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "fth-class-stepper__connector",
        "bg-[linear-gradient(90deg,rgba(190,163,125,0.2),rgba(190,163,125,0.8),rgba(190,163,125,0.2))]",
        compact ? "h-px w-7 opacity-65" : "h-px w-10",
      )}
    />
  );
}

function RailEndcap({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-3 w-3 rotate-45 border border-[#d0b07b]/75 bg-[rgba(255,236,204,0.34)]",
        side === "left" ? "mr-1" : "ml-1",
      )}
    />
  );
}

function getMilestoneAnimate(status: ClassAggregatePresentationStatus) {
  if (status === "selection-active" || status === "in-progress") {
    return {
      boxShadow: [
        "inset 0 1px 0 rgba(255,245,226,0.78),0 8px 16px rgba(76,53,36,0.14),0 0 0 rgba(68,169,143,0)",
        "inset 0 1px 0 rgba(255,245,226,0.78),0 10px 20px rgba(76,53,36,0.16),0 0 18px rgba(68,169,143,0.28)",
        "inset 0 1px 0 rgba(255,245,226,0.78),0 8px 16px rgba(76,53,36,0.14),0 0 0 rgba(68,169,143,0)",
      ],
      scale: [1, 1.03, 1],
    };
  }

  if (status === "complete" || status === "collapsed-complete") {
    return {
      boxShadow: [
        "inset 0 1px 0 rgba(255,245,226,0.78),0 8px 16px rgba(76,53,36,0.14),0 0 0 rgba(214,169,77,0)",
        "inset 0 1px 0 rgba(255,245,226,0.78),0 10px 20px rgba(76,53,36,0.16),0 0 12px rgba(214,169,77,0.18)",
        "inset 0 1px 0 rgba(255,245,226,0.78),0 8px 16px rgba(76,53,36,0.14),0 0 0 rgba(214,169,77,0)",
      ],
    };
  }

  return undefined;
}

function getMilestoneTransition(status: ClassAggregatePresentationStatus, prefersReducedMotion: boolean) {
  if (prefersReducedMotion) return { duration: 0.2 };
  if (status === "selection-active" || status === "in-progress" || status === "complete" || status === "collapsed-complete") {
    return { duration: 2.4, ease: [0.42, 0, 0.58, 1] as const, repeat: Infinity };
  }
  return { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };
}

function getMilestoneClassName(status: ClassAggregatePresentationStatus) {
  switch (status) {
    case "selection-active":
      return "border-[#bf8b37] bg-[radial-gradient(circle_at_35%_28%,#fff4d6,#f1d18a_52%,#cb9643)] text-[#5b3816]";
    case "in-progress":
      return "border-[#4c9180] bg-[radial-gradient(circle_at_35%_28%,#f2fffb,#c6ebe1_42%,#67b19f)] text-[#173931]";
    case "complete":
    case "collapsed-complete":
      return "border-[#8e6426] bg-[linear-gradient(180deg,#f6e7bc,#d7ab59)] text-[#4b3114]";
    case "skipped":
      return "border-[#c8b7a1]/65 bg-[linear-gradient(180deg,rgba(236,229,218,0.88),rgba(210,198,180,0.94))] text-[#8f7e69]";
    default:
      return "border-[#c7ab83] bg-[linear-gradient(180deg,#f5ebdc,#e3d0b3)] text-[#6b4d37]";
  }
}

function getMilestoneHaloClassName(status: ClassAggregatePresentationStatus) {
  switch (status) {
    case "selection-active":
      return "bg-[radial-gradient(circle,rgba(219,177,94,0.28),rgba(219,177,94,0))]";
    case "in-progress":
      return "bg-[radial-gradient(circle,rgba(89,177,154,0.3),rgba(89,177,154,0))]";
    case "complete":
    case "collapsed-complete":
      return "bg-[radial-gradient(circle,rgba(214,169,77,0.18),rgba(214,169,77,0))]";
    default:
      return "";
  }
}

function getMilestoneLabelClassName(status: ClassAggregatePresentationStatus) {
  switch (status) {
    case "selection-active":
      return "text-[#6b4722]";
    case "in-progress":
      return "text-[#295247]";
    case "complete":
    case "collapsed-complete":
      return "text-[#7c5a31]";
    default:
      return "text-[#8d7257]";
  }
}

function ClassCard({
  entry,
  onSelect,
  prefersReducedMotion,
  selected,
}: {
  entry: ClassEntryViewModel;
  onSelect: (entry: CreatorIndexEntry) => Promise<void>;
  prefersReducedMotion: boolean;
  selected: boolean;
}) {
  const theme = getClassTheme(entry.name);

  return (
    <motion.div
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "group relative overflow-hidden rounded-[0.95rem] border border-[#6e4b30] bg-[linear-gradient(180deg,#6e4b31_0%,#3f291d_9%,#241711_100%)] p-[0.22rem] text-left shadow-[0_18px_34px_rgba(66,40,21,0.36)] transition duration-200",
        "hover:brightness-[1.04] hover:shadow-[0_24px_40px_rgba(66,40,21,0.42)]",
        selected &&
          "border-[#d4b06c] shadow-[0_0_0_2px_rgba(212,176,108,0.45),0_0_28px_rgba(212,176,108,0.3),0_24px_42px_rgba(64,37,20,0.46)]",
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.975 }}
      layout={!prefersReducedMotion}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
    >
      <motion.button
        aria-pressed={selected}
        className="block w-full rounded-[0.8rem] text-left"
        onClick={() => void onSelect(entry)}
        type="button"
        whileFocus={prefersReducedMotion ? undefined : { scale: 1.004 }}
      >
        <div className="pointer-events-none absolute inset-[0.2rem] rounded-[0.78rem] border border-[#d9b074]/22 shadow-[inset_0_1px_0_rgba(255,240,219,0.14)]" />
        <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-6 rounded-full bg-[linear-gradient(180deg,rgba(255,244,216,0.22),rgba(255,244,216,0))]" />
        <motion.div
          className={cn(
            "absolute inset-x-1 top-1 z-10 rounded-[0.72rem_0.72rem_0.25rem_0.25rem] border border-[#a27747]/65 bg-gradient-to-b px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,235,204,0.24),0_4px_10px_rgba(0,0,0,0.18)]",
            theme.ribbon,
          )}
        >
          <div className="pointer-events-none absolute inset-x-2 top-0 h-px bg-[rgba(255,238,207,0.52)]" />
          <div className="font-fth-cc-display text-center text-[1.05rem] uppercase tracking-[0.04em] text-[#f7e5bf] md:text-[1.2rem]">
            {entry.name}
          </div>
        </motion.div>

        <div
          className="relative overflow-hidden rounded-[0.72rem] border bg-[#20130e] pt-[2.9rem] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.12),inset_0_-16px_24px_rgba(0,0,0,0.2)]"
          style={{
            borderColor: theme.frame,
            boxShadow: selected
              ? `inset 0 0 0 1px rgba(250,229,194,0.12), inset 0 -16px 24px rgba(0,0,0,0.2), 0 0 34px ${theme.glow}`
              : undefined,
          }}
        >
          <div className="aspect-[0.84] overflow-hidden">
            <motion.img
              alt={entry.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.035 }}
              loading="lazy"
              src={entry.cardImg}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-[0.72rem] bg-[linear-gradient(180deg,rgba(255,247,233,0.08)_0%,transparent_18%,transparent_58%,rgba(26,12,8,0.22)_100%)] shadow-[inset_0_0_0_1px_rgba(240,209,153,0.45)]" />
          <div className="pointer-events-auto absolute inset-x-3 bottom-3">
            <motion.div
              animate={prefersReducedMotion ? undefined : "show"}
              className="flex max-w-[80%] flex-col gap-1.5"
              initial={prefersReducedMotion ? false : "hidden"}
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.045,
                    delayChildren: 0.06,
                  },
                },
              }}
            >
              <InfoChip icon="fa-solid fa-dice-d20" label={`Hit Die ${entry.hitDie}`} prefersReducedMotion={prefersReducedMotion} value={entry.hitDie} />
              <InfoChip icon="fa-solid fa-star" label={`Primary Abilities ${entry.primaryAbilityText}`} prefersReducedMotion={prefersReducedMotion} value={entry.primaryAbilityBadgeText} />
              <InfoChip icon="fa-solid fa-shield" label={`Saving Throws ${entry.savingThrowText}`} prefersReducedMotion={prefersReducedMotion} value={entry.savingThrowBadgeText} />
            </motion.div>
          </div>
          {selected ? (
            <motion.div
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#f2d48f]/70 bg-[radial-gradient(circle_at_35%_35%,rgba(247,214,145,0.95),rgba(182,120,38,0.92))] text-white shadow-[0_6px_12px_rgba(0,0,0,0.24)]"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, y: 6 }}
              transition={prefersReducedMotion ? { duration: 0.16 } : { type: "spring", stiffness: 460, damping: 24, mass: 0.75 }}
            >
              <i className={cn(theme.crest, "text-[0.8rem]")} aria-hidden="true" />
            </motion.div>
          ) : null}
        </div>
      </motion.button>
    </motion.div>
  );
}

function InfoChip({
  icon,
  label,
  prefersReducedMotion,
  value,
}: {
  icon: string;
  label: string;
  prefersReducedMotion: boolean;
  value: string;
}) {
  if (!value) return null;
  return (
    <motion.span
      animate={prefersReducedMotion ? undefined : "show"}
      aria-label={label}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 self-start rounded-full border border-[#efd29a]/60 bg-[linear-gradient(180deg,rgba(35,22,15,0.55),rgba(22,14,10,0.86))] px-2 py-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em] text-[#f6deb0] shadow-[0_8px_16px_rgba(0,0,0,0.2)] backdrop-blur-[2px]"
      initial={prefersReducedMotion ? false : "hidden"}
      variants={{
        hidden: { opacity: 0, x: -6, scale: 0.96 },
        show: { opacity: 1, x: 0, scale: 1 },
      }}
    >
      <i aria-hidden="true" className={cn(icon, "shrink-0 text-[0.7rem] text-[#f7d691]")} />
      <span className="min-w-0 truncate">{value}</span>
    </motion.span>
  );
}

function EmptyState({ message, prefersReducedMotion }: { message: string; prefersReducedMotion: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="max-w-2xl rounded-[1.2rem] border border-[#c0a27b]/65 bg-[linear-gradient(180deg,rgba(249,240,224,0.98),rgba(233,215,190,0.98))] px-8 py-10 text-center shadow-[0_14px_30px_rgba(108,72,38,0.12)]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#ba8e5d]/65 bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b67826)] text-white shadow-lg">
          <i className="fa-solid fa-triangle-exclamation text-xl" aria-hidden="true" />
        </div>
        <p className="font-fth-cc-display text-[1.55rem] uppercase tracking-[0.08em] text-[#4c3524]">
          No Classes Available
        </p>
        <p className="mt-3 font-fth-cc-body text-[1.1rem] leading-7 text-[#5f4738]">{message}</p>
      </motion.div>
    </div>
  );
}

function getClassTheme(name: string) {
  return CLASS_THEMES[name.trim().toLowerCase()] ?? CLASS_THEMES.fighter;
}
