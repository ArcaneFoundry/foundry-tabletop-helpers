import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import type { WizardShellContext } from "../../character-creator-types";
import { cn } from "../../../ui/lib/cn";

interface WizardShellProps {
  shellContext: WizardShellContext;
  stepContent: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onJumpToStep: (stepId: string) => void;
  onCreateCharacter: () => Promise<void>;
}

const CHAPTER_LABELS: Record<string, string> = {
  class: "Class",
  species: "Species",
  background: "Background",
  skills: "Skills",
  abilities: "Abilities",
  spells: "Spells",
  equipment: "Equipment",
  lore: "Lore",
  origins: "Background",
  build: "Build",
  finalize: "Lore",
};

const DISPLAY_CHAPTER_ORDER = [
  "class",
  "species",
  "background",
  "skills",
  "abilities",
  "spells",
  "equipment",
  "lore",
] as const;

type DisplayChapterKey = (typeof DISPLAY_CHAPTER_ORDER)[number];

type WizardDisplayStep = WizardShellContext["steps"][number];

function getDisplayChapterKey(stepId: string): DisplayChapterKey {
  if (stepId === "origins") return "background";
  if (stepId === "build") return "abilities";
  if (stepId === "finalize") return "lore";
  if (stepId === "classChoices") return "skills";
  if (stepId === "species" || stepId === "speciesSkills" || stepId === "speciesLanguages" || stepId === "speciesItemChoices") return "species";
  if (stepId === "background" || stepId === "backgroundSkillConflicts" || stepId === "backgroundAsi" || stepId === "backgroundLanguages" || stepId === "originChoices" || stepId === "originSummary") return "background";
  if (stepId === "abilities" || stepId === "feats") return "abilities";
  if (stepId === "spells") return "spells";
  if (stepId === "equipment" || stepId === "equipmentShop") return "equipment";
  if (stepId === "portrait" || stepId === "review") return "lore";
  return "class";
}

function mergeDisplayStepStatus(statuses: Array<WizardDisplayStep["status"]>): WizardDisplayStep["status"] {
  if (statuses.includes("invalid")) return "invalid";
  if (statuses.every((status) => status === "complete")) return "complete";
  return "pending";
}

function buildDisplaySteps(
  steps: WizardShellContext["steps"],
  currentStepId: string,
): WizardDisplayStep[] {
  const groups = new Map<DisplayChapterKey, WizardDisplayStep[]>();
  for (const step of steps) {
    const chapterKey = getDisplayChapterKey(step.id);
    const existing = groups.get(chapterKey) ?? [];
    existing.push(step);
    groups.set(chapterKey, existing);
  }

  const activeChapter = getDisplayChapterKey(currentStepId);

  return DISPLAY_CHAPTER_ORDER.flatMap((chapterKey) => {
    const groupedSteps = groups.get(chapterKey);
    if (!groupedSteps?.length) return [];

    const representativeStep = groupedSteps[0];
    return [{
      ...representativeStep,
      label: CHAPTER_LABELS[chapterKey],
      status: mergeDisplayStepStatus(groupedSteps.map((step) => step.status)),
      active: chapterKey === activeChapter,
      index: 0,
    }];
  }).map((step, index) => ({
    ...step,
    index,
  }));
}

function shouldResetWizardScroll(previousStepId: string | undefined, currentStepId: string | undefined): boolean {
  return previousStepId !== currentStepId;
}

interface WizardScrollContainer {
  scrollTop: number;
  scrollTo?(options: ScrollToOptions): void;
}

function applyWizardScrollReset(scrollContainer: WizardScrollContainer): void {
  scrollContainer.scrollTop = 0;
  scrollContainer.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
}

function queueWizardScrollReset(scrollContainer: WizardScrollContainer): () => void {
  applyWizardScrollReset(scrollContainer);

  if (typeof globalThis.requestAnimationFrame !== "function") {
    return () => {};
  }

  const frameId = globalThis.requestAnimationFrame(() => {
    applyWizardScrollReset(scrollContainer);
  });

  return () => {
    globalThis.cancelAnimationFrame?.(frameId);
  };
}

export function WizardShell({
  shellContext,
  stepContent,
  onBack,
  onNext,
  onJumpToStep,
  onCreateCharacter,
}: WizardShellProps) {
  const [isCreating, setIsCreating] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const previousStepIdRef = useRef<string | undefined>(shellContext.currentStepId);
  const chapterLabel = CHAPTER_LABELS[shellContext.chapterKey ?? "lore"] ?? shellContext.currentStepLabel;
  const displaySteps = buildDisplaySteps(shellContext.steps, shellContext.currentStepId);
  const currentStepIndex = Math.max(
    displaySteps.findIndex((step) => step.active),
    0,
  );
  const currentStepNumber = currentStepIndex + 1;
  const displayProgress = shellContext.localProgress
    ? {
      ...shellContext.localProgress,
      current: currentStepNumber,
      total: displaySteps.length,
      percent: displaySteps.length > 0 ? Math.round((currentStepNumber / displaySteps.length) * 100) : 0,
      label: `Step ${currentStepNumber} of ${displaySteps.length}`,
    }
    : undefined;

  const handleCreateCharacter = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onCreateCharacter();
    } finally {
      setIsCreating(false);
    }
  };

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let cleanup: (() => void) | undefined;
    if (shouldResetWizardScroll(previousStepIdRef.current, shellContext.currentStepId)) {
      cleanup = queueWizardScrollReset(scrollContainer);
    }

    previousStepIdRef.current = shellContext.currentStepId;
    return cleanup;
  }, [shellContext.currentStepId]);

  return (
    <div
      className={cn(
        "cc-wizard-shell fth-react-app-shell flex h-full min-h-0 flex-col overflow-hidden bg-fth-canvas text-fth-text",
        shellContext.atmosphereClass,
      )}
      data-accent-token={shellContext.chapterAccentToken ?? shellContext.chapterKey ?? "lore"}
      data-current-step={shellContext.currentStepId}
      data-motion-profile={shellContext.motionProfile ?? "ceremonial"}
      data-panel-style={shellContext.panelStyleVariant ?? "artifact"}
      data-scene-key={shellContext.chapterSceneKey ?? shellContext.chapterKey ?? "lore"}
      data-status-hint-style={shellContext.statusHintStyle ?? "progress"}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="fth-theme-shell-backdrop absolute inset-0" />
        <div className="fth-theme-shell-sheen absolute inset-0" />
      </div>

      {!shellContext.hideStepIndicator ? (
        <nav
          aria-label="Wizard Steps"
          className="fth-theme-panel relative z-10 mx-4 mt-4 overflow-hidden rounded-[1.75rem] px-4 py-4 backdrop-blur-xl md:mx-5"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.28em] text-fth-accent">
                Character Creation
              </div>
              <div className="mt-2 font-fth-cc-display text-[1.6rem] leading-none text-fth-text">
                {chapterLabel}
              </div>
              {displayProgress ? (
                <div className="mt-3 max-w-md">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="fth-theme-status-pill rounded-full px-3 py-1.5 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">
                      {displayProgress.label}
                    </div>
                    {displayProgress.detail ? (
                      <span className="font-fth-cc-body text-[0.88rem] leading-6 text-fth-text-muted">
                        {displayProgress.detail}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--fth-color-border)]">
                    <div
                      className="fth-theme-panel-accent-line h-full rounded-full"
                      style={{ width: `${displayProgress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            {shellContext.statusHint ? (
              <div className="fth-theme-status-pill max-w-xs rounded-full px-3 py-2 text-right font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em]">
                {shellContext.statusHint}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {displaySteps.map((step, index) => (
              <div className="contents" key={step.id}>
                <button
                  className={cn(
                    "group relative inline-flex min-w-[7rem] shrink-0 items-center gap-3 rounded-[1.35rem] border px-3 py-3 text-left transition",
                    "border-fth-border bg-[color:var(--fth-color-surface-glass)]",
                    shellContext.isReviewStep ? "cursor-pointer hover:border-fth-border-strong hover:-translate-y-0.5" : "cursor-default",
                  )}
                  disabled={!shellContext.isReviewStep}
                  onClick={() => onJumpToStep(step.id)}
                  style={{
                    backgroundImage: step.active
                      ? "var(--fth-theme-step-active-image)"
                      : step.status === "complete"
                        ? "var(--fth-theme-step-complete-image)"
                        : step.status === "invalid"
                          ? "var(--fth-theme-step-invalid-image)"
                          : undefined,
                    borderColor: step.active || step.status === "complete" || step.status === "invalid"
                      ? "var(--fth-color-border-strong)"
                      : undefined,
                    boxShadow: step.active
                      ? "0 0 0 1px color-mix(in srgb, var(--fth-color-accent) 12%, transparent), 0 20px 34px rgb(0 0 0 / 0.24)"
                      : undefined,
                  }}
                  type="button"
                >
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm transition",
                      "border-fth-border bg-[color:var(--fth-color-surface-glass)] text-fth-text",
                    )}
                    style={{
                      backgroundImage: step.active
                        ? "var(--fth-theme-step-icon-image)"
                        : step.status === "complete"
                          ? "var(--fth-theme-step-icon-complete-image)"
                          : undefined,
                      borderColor: step.active || step.status === "complete"
                        ? "var(--fth-color-border-strong)"
                        : undefined,
                      color: step.active
                        ? "var(--fth-color-accent-contrast)"
                        : step.status === "complete"
                          ? "var(--fth-theme-step-icon-complete-color)"
                          : undefined,
                      boxShadow: step.active
                        ? "0 0 18px color-mix(in srgb, var(--fth-color-accent) 25%, transparent)"
                        : undefined,
                    }}
                  >
                    <i className={step.icon} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em] text-fth-text-subtle">
                      {index + 1}
                    </span>
                    <span className="mt-1 block truncate font-fth-cc-display text-[1.02rem] leading-none text-fth-text">
                      {step.label}
                    </span>
                  </span>
                </button>
                {index < shellContext.steps.length - 1 ? (
                  <div className="relative h-px min-w-6 flex-1 overflow-hidden rounded-full bg-[color:var(--fth-color-border)]">
                    <div
                      className={cn(
                        "fth-theme-panel-accent-line absolute inset-y-0 left-0 w-full opacity-45",
                        step.status === "complete" && "opacity-90",
                      )}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </nav>
      ) : null}

      {!shellContext.hideShellHeader ? (
        <header className="fth-theme-panel fth-theme-panel--header relative z-10 mx-4 mt-4 overflow-hidden rounded-[1.75rem] px-6 py-5 backdrop-blur-lg md:mx-5">
          <div className="fth-theme-panel-accent-line pointer-events-none absolute inset-x-6 top-0 h-px" />
          <div className="fth-theme-header-glow pointer-events-none absolute inset-0" />
          {shellContext.headerTitle ? (
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                {shellContext.headerIcon ? (
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-fth-border-strong bg-[color:var(--fth-theme-icon-surface)] text-fth-accent shadow-[0_0_18px_color-mix(in_srgb,var(--fth-color-accent)_14%,transparent)]">
                    <i className={cn(shellContext.headerIcon, "text-lg")} aria-hidden="true" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em] text-fth-accent">
                    {shellContext.headerSubtitle || chapterLabel}
                  </div>
                  <h2 className="mt-3 font-fth-cc-display text-[clamp(1.8rem,3vw,3rem)] leading-[0.95] text-fth-text">
                    {shellContext.headerTitle}
                  </h2>
                  {shellContext.headerDescription ? (
                    <p className="mt-4 max-w-3xl font-fth-cc-body text-[1rem] leading-7 text-fth-text-muted">
                      {shellContext.headerDescription}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex items-center gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-fth-border-strong bg-[color:var(--fth-theme-icon-surface)] text-fth-accent shadow-[0_0_18px_color-mix(in_srgb,var(--fth-color-accent)_14%,transparent)]">
                <i className={cn(shellContext.currentStepIcon, "text-lg")} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em] text-fth-accent">{chapterLabel}</div>
                <h2 className="mt-2 font-fth-cc-display text-[1.85rem] leading-none text-fth-text">
                  {shellContext.currentStepLabel}
                </h2>
              </div>
            </div>
          )}
        </header>
      ) : null}

      <div
        ref={scrollContainerRef}
        className="fth-react-scrollbar relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain"
      >
        {stepContent}
      </div>

      <motion.footer
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        className="cc-theme-panel relative z-10 mx-4 mb-4 mt-auto overflow-hidden rounded-[1.75rem] border px-4 py-4 backdrop-blur-xl md:mx-5 md:px-5"
        style={{
          backgroundImage: "var(--cc-shell-footer-panel)",
        }}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--cc-surface-accent-soft)_64%,transparent),transparent_48%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--cc-shell-footer-button-primary)] opacity-35" />
        <div className="fth-theme-panel-accent-line pointer-events-none absolute inset-x-8 top-0 h-px opacity-75" />
        <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-[linear-gradient(90deg,color-mix(in_srgb,var(--cc-border-accent)_0%,transparent),color-mix(in_srgb,var(--cc-border-accent)_48%,transparent),color-mix(in_srgb,var(--cc-border-accent)_0%,transparent))] opacity-60" />
        <div className="relative z-10 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
          <div className="order-2 md:order-1">
            <ActionButton
              disabled={!shellContext.canGoBack}
              label="Back"
              onClick={onBack}
              variant="secondary"
            />
          </div>

          <div
            className="order-1 min-w-0 md:order-2"
            data-wizard-footer-summary="true"
          >
            <div
              className="cc-theme-card cc-theme-card--raised relative overflow-hidden rounded-[1.35rem] border px-4 py-4 md:px-5"
              style={{
                backgroundImage: "var(--cc-shell-footer-summary)",
              }}
            >
              <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--cc-surface-accent-soft)_58%,transparent),transparent)] opacity-75" />
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="fth-theme-status-pill rounded-full px-3 py-1.5 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">
                      {chapterLabel}
                    </div>
                    <div className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.22em] text-[color:var(--cc-text-secondary)]">
                      Step {currentStepNumber} of {displaySteps.length}
                    </div>
                  </div>
                  <div className="mt-3 font-fth-cc-display text-[1.08rem] leading-none text-[color:var(--cc-text-primary)]">
                    {shellContext.currentStepLabel}
                  </div>
                  {displayProgress?.detail ? (
                    <div className="mt-2 max-w-2xl font-fth-cc-body text-[0.88rem] leading-6 text-[color:var(--cc-text-secondary)]">
                      {displayProgress.detail}
                    </div>
                  ) : null}
                </div>
                {shellContext.statusHint ? (
                  <div className="fth-theme-status-pill rounded-full px-3 py-1.5 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">
                    {shellContext.statusHint}
                  </div>
                ) : null}
              </div>
              {displayProgress ? (
                <div className="relative z-10 mt-4 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--cc-border-subtle)_82%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[image:var(--cc-shell-footer-button-primary)]"
                    style={{ width: `${displayProgress.percent}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="order-3 md:justify-self-end">
            {shellContext.isReviewStep ? (
              <ActionButton
                disabled={isCreating}
                label={isCreating ? "Binding..." : "Forge Character"}
                onClick={() => void handleCreateCharacter()}
                variant="primary"
              />
            ) : (
              <ActionButton
                disabled={!shellContext.canGoNext}
                label={shellContext.nextButtonLabel ?? "Next"}
                onClick={onNext}
                variant="primary"
              />
            )}
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

export const __wizardShellInternals = {
  applyWizardScrollReset,
  buildDisplaySteps,
  queueWizardScrollReset,
  shouldResetWizardScroll,
};

function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary";
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <motion.button
      className={cn(
        "cc-shell-footer-btn inline-flex min-w-36 items-center justify-center rounded-[1rem] border px-6 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] transition shadow-[var(--cc-shadow-button)]",
        variant === "primary"
          ? "min-w-40 border-[color:color-mix(in_srgb,var(--cc-border-accent)_58%,transparent)] bg-[image:var(--cc-shell-footer-button-primary)] text-[color:var(--cc-text-ink-900)]"
          : "min-w-32 border-[color:color-mix(in_srgb,var(--cc-border-subtle)_92%,transparent)] bg-[image:var(--cc-shell-footer-button-secondary)] text-[color:var(--cc-text-primary)] hover:border-[color:color-mix(in_srgb,var(--cc-border-accent)_42%,transparent)]",
        disabled && "cursor-not-allowed opacity-40",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
      whileHover={prefersReducedMotion || disabled ? undefined : { y: -2, scale: 1.01 }}
      whileTap={prefersReducedMotion || disabled ? undefined : { scale: 0.985 }}
    >
      {label}
    </motion.button>
  );
}
