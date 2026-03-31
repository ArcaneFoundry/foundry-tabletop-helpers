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
import { buildClassFlowShellModel } from "./build-class-flow-shell-model";
import {
  shouldShowClassStepperSubsteps,
  type ClassStepperLayoutMode,
  useClassStepperLayoutMode,
} from "./class-stepper-layout";
import { ClassFlowHeroHeader } from "./class-flow-hero-header";
import { getClassTheme } from "./class-presentation";
import { ClassSelectionGalleryPane } from "./class-selection-gallery-pane";
import { buildClassSelectionFromEntry, getClassStepViewModel } from "../../../steps/step-class-model";
import classStepFieldBackground from "../../../assets/class-step-field-bg.webp";

type ClassStepViewModel = Awaited<ReturnType<typeof getClassStepViewModel>>;
type ClassEntryViewModel = ClassStepViewModel["entries"][number];

const CC_TEXT_HERO = "text-[color:var(--cc-text-hero)]";
const CC_TEXT_PRIMARY = "text-[color:var(--cc-text-primary)]";
const CC_TEXT_SECONDARY = "text-[color:var(--cc-text-secondary)]";

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
  const shellModel = useMemo(
    () => buildClassFlowShellModel(state, shellContext.steps, shellContext.currentStepId),
    [shellContext.currentStepId, shellContext.steps, state],
  );
  const [layoutMode, setStepperContainer] = useClassStepperLayoutMode();

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
        className="cc-theme-shell relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] p-[0.35rem]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="cc-theme-hero-shell absolute inset-[0.35rem] rounded-[1.45rem]" />

        <div className="cc-theme-shell-inner relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] border">
          <ClassFlowHeroHeader
            description={shellModel.hero.description}
            headerTone={shellModel.headerTone}
            prefersReducedMotion={prefersReducedMotion}
            primaryBadgeLabel={shellModel.hero.primaryBadgeLabel}
            secondaryBadgeLabel={selectedUuid ? "Class selected" : shellModel.hero.secondaryBadgeLabel}
            title={shellModel.hero.title}
          />

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
              <ClassSelectionGalleryPane
                emptyState={<EmptyState message={emptyMessage} prefersReducedMotion={prefersReducedMotion} />}
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
            </div>
          </div>
        </div>
      </motion.div>
    </section>
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
        "fth-class-stepper relative mx-auto flex w-full flex-col border-b border-[color:color-mix(in_srgb,var(--cc-border-subtle)_92%,transparent)] text-[color:var(--cc-class-stepper-label-muted)]",
        isCompactLayout
          ? "fth-class-stepper--compact max-w-4xl gap-3 pb-4"
          : "fth-class-stepper--wide max-w-5xl gap-3 pb-4",
      )}
      data-layout-mode={layoutMode}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      transition={{ delay: 0.14, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      {isCompactLayout ? (
        <div className="relative z-10 flex flex-col gap-3 px-2 md:px-4">
          {compactMilestoneRows.map((row, rowIndex) => {
            const [leftMilestone, rightMilestone] = row;

            return (
              <div
                className="fth-class-stepper__compact-row grid grid-cols-[minmax(0,1fr)_minmax(2.5rem,0.4fr)_minmax(0,1fr)] items-center gap-3"
                key={`compact-row-${rowIndex}`}
              >
                <div className="flex min-w-0 items-center justify-end">
                  {leftMilestone ? <MilestoneNode milestone={leftMilestone} prefersReducedMotion={prefersReducedMotion} compact /> : null}
                </div>
                <RailConnector compact />
                <div className="flex min-w-0 items-center justify-start">
                  {rightMilestone ? <MilestoneNode milestone={rightMilestone} prefersReducedMotion={prefersReducedMotion} compact /> : null}
                </div>
              </div>
            );
          })}
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
        compact ? "w-full gap-2.5" : "gap-2.5",
      )}
      transition={getMilestoneTransition(milestone.status, prefersReducedMotion)}
    >
      <span
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden rounded-full border shadow-[inset_0_1px_0_rgba(255,245,226,0.75),0_10px_18px_rgba(76,53,36,0.14)]",
          compact ? "h-11 w-11 shrink-0 text-[0.9rem]" : "h-10 w-10 text-sm md:h-12 md:w-12 md:text-base",
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
          "fth-class-stepper__milestone-label relative flex min-w-0 pb-1 font-fth-cc-ui uppercase",
          compact
            ? "flex-1 text-[0.68rem] tracking-[0.16em]"
            : "text-[0.7rem] tracking-[0.18em] md:text-[0.76rem]",
          getMilestoneLabelClassName(milestone.status),
        )}
      >
        <span
          className={cn(
            "relative z-10 inline-flex min-w-0 items-center rounded-full border px-2.5 py-1 shadow-[0_10px_22px_rgba(0,0,0,0.16)] backdrop-blur-sm",
            compact ? "min-h-[2.85rem] w-full justify-center px-3.5 py-1.5 text-center leading-tight" : "min-h-[2.1rem] items-center",
            getMilestoneLabelSurfaceClassName(milestone.status),
          )}
        >
          <span className="min-w-0 truncate">{milestone.label}</span>
        </span>
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
        "relative inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-[0_10px_20px_rgba(0,0,0,0.16)] backdrop-blur-sm",
        getSubstepChipClassName(step),
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      title={step.label}
    >
      <i className={cn(step.icon, "text-[0.74rem]")} aria-hidden="true" />
      <span className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.14em] md:text-[0.66rem]">{step.label}</span>
    </motion.div>
  );
}

function RailConnector({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "fth-class-stepper__connector",
        "bg-[image:var(--cc-class-stepper-rail)]",
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
        "h-3 w-3 rotate-45 border bg-[color:color-mix(in_srgb,var(--cc-surface-accent-soft)_82%,white_18%)]",
        side === "left" ? "mr-1" : "ml-1",
      )}
      style={{ borderColor: "color-mix(in srgb, var(--cc-border-accent) 64%, transparent)" }}
    />
  );
}

function getMilestoneAnimate(status: ClassAggregatePresentationStatus) {
  if (status === "selection-active" || status === "in-progress") {
    return {
      scale: [1, 1.03, 1],
    };
  }

  if (status === "complete" || status === "collapsed-complete") {
    return undefined;
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
      return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_72%,transparent)] bg-[radial-gradient(circle_at_35%_28%,color-mix(in_srgb,var(--cc-accent-gold)_58%,white_42%),var(--cc-accent-gold)_58%,var(--cc-accent-bronze))] text-[color:var(--cc-text-ink-900)]";
    case "in-progress":
      return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_66%,transparent)] bg-[radial-gradient(circle_at_35%_28%,color-mix(in_srgb,var(--cc-accent-gold)_52%,white_48%),color-mix(in_srgb,var(--cc-accent-gold)_82%,var(--cc-accent-bronze)_18%))] text-[color:var(--cc-text-ink-900)]";
    case "complete":
    case "collapsed-complete":
      return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_62%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cc-surface-accent-soft)_72%,white_28%),color-mix(in_srgb,var(--cc-accent-gold)_68%,var(--cc-accent-bronze)_32%))] text-[color:var(--cc-text-ink-900)]";
    case "skipped":
      return "border-[color:color-mix(in_srgb,var(--cc-border-subtle)_88%,transparent)] bg-[image:var(--cc-class-stepper-node-idle)] text-[color:var(--cc-class-stepper-node-idle-text)]";
    default:
      return "border-[color:color-mix(in_srgb,var(--cc-border-subtle)_92%,transparent)] bg-[image:var(--cc-class-stepper-node-idle)] text-[color:var(--cc-class-stepper-node-idle-text)]";
  }
}

function getMilestoneHaloClassName(status: ClassAggregatePresentationStatus) {
  switch (status) {
    case "selection-active":
      return "bg-[radial-gradient(circle,rgba(219,177,94,0.28),rgba(219,177,94,0))]";
    case "in-progress":
      return "bg-[radial-gradient(circle,rgba(229,187,108,0.24),rgba(229,187,108,0))]";
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
      return "text-[color:var(--cc-class-stepper-label-text)]";
    case "in-progress":
      return "text-[color:var(--cc-class-stepper-label-text)]";
    case "complete":
    case "collapsed-complete":
      return "text-[color:var(--cc-class-stepper-label-text)]";
    default:
      return "text-[color:var(--cc-class-stepper-label-muted)]";
  }
}

function getMilestoneLabelSurfaceClassName(status: ClassAggregatePresentationStatus) {
  switch (status) {
    case "selection-active":
      return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_52%,transparent)] bg-[image:var(--cc-class-stepper-label-active)]";
    case "in-progress":
      return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_44%,transparent)] bg-[image:var(--cc-class-stepper-label-active)]";
    case "complete":
    case "collapsed-complete":
      return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_38%,transparent)] bg-[image:var(--cc-class-stepper-label)]";
    case "skipped":
      return "border-[color:color-mix(in_srgb,var(--cc-border-subtle)_88%,transparent)] bg-[image:var(--cc-class-stepper-label)]";
    default:
      return "border-[color:color-mix(in_srgb,var(--cc-border-subtle)_92%,transparent)] bg-[image:var(--cc-class-stepper-label)]";
  }
}

function getSubstepChipClassName(step: ClassAggregateSubstepNode) {
  if (step.active) {
    return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_52%,transparent)] bg-[image:var(--cc-class-stepper-label-active)] text-[color:var(--cc-class-stepper-label-text)]";
  }

  if (step.status === "complete") {
    return "border-[color:color-mix(in_srgb,var(--cc-border-accent)_34%,transparent)] bg-[image:var(--cc-class-stepper-label)] text-[color:var(--cc-class-stepper-label-text)]";
  }

  return "border-[color:color-mix(in_srgb,var(--cc-border-subtle)_92%,transparent)] bg-[image:var(--cc-class-stepper-label)] text-[color:var(--cc-class-stepper-label-muted)]";
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
          <div className={cn("font-fth-cc-display text-center text-[1.05rem] uppercase tracking-[0.04em] md:text-[1.2rem]", CC_TEXT_HERO)}>
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
              className={cn("pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#f2d48f]/70 bg-[radial-gradient(circle_at_35%_35%,rgba(247,214,145,0.95),rgba(182,120,38,0.92))] shadow-[0_6px_12px_rgba(0,0,0,0.24)]", CC_TEXT_HERO)}
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
      className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 self-start rounded-full border border-[#efd29a]/60 bg-[linear-gradient(180deg,rgba(35,22,15,0.55),rgba(22,14,10,0.86))] px-2 py-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em] shadow-[0_8px_16px_rgba(0,0,0,0.2)] backdrop-blur-[2px]", CC_TEXT_SECONDARY)}
      initial={prefersReducedMotion ? false : "hidden"}
      variants={{
        hidden: { opacity: 0, x: -6, scale: 0.96 },
        show: { opacity: 1, x: 0, scale: 1 },
      }}
    >
      <i aria-hidden="true" className={cn(icon, "shrink-0 text-[0.7rem]", CC_TEXT_HERO)} />
      <span className="min-w-0 truncate">{value}</span>
    </motion.span>
  );
}

function EmptyState({ message, prefersReducedMotion }: { message: string; prefersReducedMotion: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <motion.div
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        className="cc-theme-empty max-w-2xl rounded-[1.2rem] border border-[#c0a27b]/65 bg-[linear-gradient(180deg,rgba(249,240,224,0.98),rgba(233,215,190,0.98))] px-8 py-10 text-center shadow-[0_14px_30px_rgba(108,72,38,0.12)]"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={cn("mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#ba8e5d]/65 bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b67826)] shadow-lg", CC_TEXT_HERO)}>
          <i className="fa-solid fa-triangle-exclamation text-xl" aria-hidden="true" />
        </div>
        <p className={cn("cc-theme-title font-fth-cc-display text-[1.55rem] uppercase tracking-[0.08em]", CC_TEXT_PRIMARY)}>
          No Classes Available
        </p>
        <p className={cn("cc-theme-body-muted mt-3 font-fth-cc-body text-[1.1rem] leading-7", CC_TEXT_SECONDARY)}>{message}</p>
      </motion.div>
    </div>
  );
}
