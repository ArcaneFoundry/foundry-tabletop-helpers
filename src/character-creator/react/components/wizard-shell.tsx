import type { ReactNode } from "react";
import { useState } from "react";
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
  origins: "Origins",
  build: "Build",
  finalize: "Finalize",
};

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
  const chapterLabel = CHAPTER_LABELS[shellContext.chapterKey ?? "finalize"] ?? shellContext.currentStepLabel;

  const handleCreateCharacter = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onCreateCharacter();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className={cn(
        "cc-wizard-shell fth-react-app-shell flex h-full min-h-0 flex-col overflow-hidden bg-fth-canvas text-fth-text",
        shellContext.atmosphereClass,
      )}
      data-accent-token={shellContext.chapterAccentToken ?? shellContext.chapterKey ?? "finalize"}
      data-current-step={shellContext.currentStepId}
      data-motion-profile={shellContext.motionProfile ?? "ceremonial"}
      data-panel-style={shellContext.panelStyleVariant ?? "artifact"}
      data-scene-key={shellContext.chapterSceneKey ?? shellContext.chapterKey ?? "finalize"}
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
            </div>
            {shellContext.statusHint ? (
              <div className="fth-theme-status-pill max-w-xs rounded-full px-3 py-2 text-right font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em]">
                {shellContext.statusHint}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {shellContext.steps.map((step, index) => (
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
                          ? "#1f3118"
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
        <header className="fth-theme-panel fth-theme-panel--alt relative z-10 mx-4 mt-4 overflow-hidden rounded-[1.75rem] px-6 py-5 backdrop-blur-xl md:mx-5">
          <div className="fth-theme-panel-accent-line pointer-events-none absolute inset-x-6 top-0 h-px" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--fth-color-arcane)_14%,transparent),transparent_34%)]" />
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

      <div className="fth-react-scrollbar relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain">{stepContent}</div>

      <motion.footer
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        className="fth-theme-panel fth-theme-panel--alt relative z-10 mx-4 mb-4 mt-auto overflow-hidden rounded-[1.75rem] px-5 py-4 backdrop-blur-xl md:mx-5"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="fth-theme-panel-accent-line pointer-events-none absolute inset-x-8 top-0 h-px" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <ActionButton
            disabled={!shellContext.canGoBack}
            label="Back"
            onClick={onBack}
            variant="secondary"
          />

          <div className="hidden flex-1 items-center justify-center xl:flex">
            {shellContext.statusHint ? (
              <div className="fth-theme-status-pill rounded-full px-4 py-2 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em]">
                {shellContext.statusHint}
              </div>
            ) : null}
          </div>

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
      </motion.footer>
    </div>
  );
}

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
        "cc-shell-footer-btn inline-flex min-w-36 items-center justify-center rounded-[1rem] border px-6 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] transition",
        variant === "primary"
          ? "border-fth-border-strong bg-[linear-gradient(180deg,var(--fth-color-accent-strong),var(--fth-color-accent))] text-[color:var(--fth-color-accent-contrast)] shadow-[0_18px_34px_rgba(0,0,0,0.2)]"
          : "border-fth-border bg-[color:var(--fth-color-surface-glass)] text-fth-text hover:border-fth-border-strong",
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
