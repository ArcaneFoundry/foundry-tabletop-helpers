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
        "cc-wizard-shell fth-react-app-shell flex h-full min-h-0 flex-col overflow-hidden text-fth-cc-light",
        "bg-[#131313]",
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(211,190,235,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(233,193,118,0.08),transparent_24%),linear-gradient(180deg,rgba(17,17,20,0.98),rgba(10,10,13,1))]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_35%,rgba(255,255,255,0.015)_60%,transparent)] mix-blend-screen" />
      </div>

      {!shellContext.hideStepIndicator ? (
        <nav
          aria-label="Wizard Steps"
          className="relative z-10 mx-4 mt-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(28,28,33,0.9),rgba(16,16,21,0.94))] px-4 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl md:mx-5"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.28em] text-[#e9c176]">
                Character Creation
              </div>
              <div className="mt-2 font-fth-cc-display text-[1.6rem] leading-none text-[#f4e8d0]">
                {chapterLabel}
              </div>
            </div>
            {shellContext.statusHint ? (
              <div className="max-w-xs rounded-full border border-[#e9c176]/18 bg-[rgba(233,193,118,0.06)] px-3 py-2 text-right font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em] text-[#d8d4d1]">
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
                    "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]",
                    step.active && "border-[#e9c176]/55 bg-[linear-gradient(180deg,rgba(211,190,235,0.14),rgba(233,193,118,0.08))] shadow-[0_0_0_1px_rgba(233,193,118,0.12),0_20px_34px_rgba(0,0,0,0.24)]",
                    step.status === "complete" && "border-[#87a36a]/45 bg-[linear-gradient(180deg,rgba(135,163,106,0.16),rgba(255,255,255,0.02))]",
                    step.status === "invalid" && "border-[#bf6c60]/45 bg-[linear-gradient(180deg,rgba(191,108,96,0.14),rgba(255,255,255,0.02))]",
                    shellContext.isReviewStep ? "cursor-pointer hover:border-[#e9c176]/55 hover:-translate-y-0.5" : "cursor-default",
                  )}
                  disabled={!shellContext.isReviewStep}
                  onClick={() => onJumpToStep(step.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm transition",
                      "border-white/10 bg-[rgba(255,255,255,0.04)] text-[#e6dfd8]",
                      step.active && "border-[#e9c176] bg-[radial-gradient(circle_at_35%_35%,#f3d28e,#d5a84d)] text-[#38260f] shadow-[0_0_18px_rgba(233,193,118,0.25)]",
                      step.status === "complete" && "border-[#87a36a]/55 bg-[radial-gradient(circle_at_35%_35%,#cce0b0,#76955e)] text-[#1f3118]",
                    )}
                  >
                    <i className={step.icon} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em] text-[#9c95a4]">
                      {index + 1}
                    </span>
                    <span className="mt-1 block truncate font-fth-cc-display text-[1.02rem] leading-none text-[#f1e5cf]">
                      {step.label}
                    </span>
                  </span>
                </button>
                {index < shellContext.steps.length - 1 ? (
                  <div className="relative h-px min-w-6 flex-1 overflow-hidden rounded-full bg-white/6">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(233,193,118,0),rgba(233,193,118,0.38),rgba(233,193,118,0))] opacity-45",
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
        <header className="relative z-10 mx-4 mt-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(25,25,30,0.92),rgba(15,15,19,0.96))] px-6 py-5 shadow-[0_22px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl md:mx-5">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,rgba(233,193,118,0),rgba(233,193,118,0.72),rgba(233,193,118,0))]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(211,190,235,0.1),transparent_34%)]" />
          {shellContext.headerTitle ? (
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                {shellContext.headerIcon ? (
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#e9c176]/45 bg-[rgba(233,193,118,0.08)] text-[#e9c176] shadow-[0_0_18px_rgba(233,193,118,0.12)]">
                    <i className={cn(shellContext.headerIcon, "text-lg")} aria-hidden="true" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em] text-[#e9c176]">
                    {shellContext.headerSubtitle || chapterLabel}
                  </div>
                  <h2 className="mt-3 font-fth-cc-display text-[clamp(1.8rem,3vw,3rem)] leading-[0.95] text-[#f4e8d0]">
                    {shellContext.headerTitle}
                  </h2>
                  {shellContext.headerDescription ? (
                    <p className="mt-4 max-w-3xl font-fth-cc-body text-[1rem] leading-7 text-[#d2cbc5]">
                      {shellContext.headerDescription}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex items-center gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e9c176]/45 bg-[rgba(233,193,118,0.08)] text-[#e9c176] shadow-[0_0_18px_rgba(233,193,118,0.12)]">
                <i className={cn(shellContext.currentStepIcon, "text-lg")} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em] text-[#e9c176]">{chapterLabel}</div>
                <h2 className="mt-2 font-fth-cc-display text-[1.85rem] leading-none text-[#f4e8d0]">
                  {shellContext.currentStepLabel}
                </h2>
              </div>
            </div>
          )}
        </header>
      ) : null}

      <div className="relative z-10 min-h-0 flex-1">{stepContent}</div>

      <motion.footer
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        className="relative z-10 mx-4 mb-4 mt-auto overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,31,0.94),rgba(14,14,18,0.98))] px-5 py-4 shadow-[0_22px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl md:mx-5"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,rgba(233,193,118,0),rgba(233,193,118,0.68),rgba(233,193,118,0))]" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <ActionButton
            disabled={!shellContext.canGoBack}
            label="Back"
            onClick={onBack}
            variant="secondary"
          />

          <div className="hidden flex-1 items-center justify-center xl:flex">
            {shellContext.statusHint ? (
              <div className="rounded-full border border-[#e9c176]/18 bg-[rgba(233,193,118,0.06)] px-4 py-2 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em] text-[#c9c2bc]">
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
          ? "border-[#e9c176]/75 bg-[linear-gradient(180deg,#f2cb84,#d6a447)] text-[#3b280f] shadow-[0_18px_34px_rgba(0,0,0,0.2)]"
          : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#efe7df] hover:border-[#e9c176]/35",
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
