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
        "cc-wizard-shell fth-react-app-shell flex h-full min-h-0 flex-col overflow-hidden",
        "bg-[radial-gradient(circle_at_top,rgba(255,244,225,0.28),transparent_28%),linear-gradient(180deg,#4f3522_0%,#25170f_9%,#140d09_100%)] text-fth-cc-light shadow-2xl",
        shellContext.atmosphereClass,
      )}
      data-current-step={shellContext.currentStepId}
    >
      {!shellContext.hideStepIndicator ? (
        <nav
          aria-label="Wizard Steps"
          className={cn(
            "flex items-center gap-2 overflow-x-auto border-b border-fth-cc-gold/25 px-5 py-4",
            "bg-[linear-gradient(180deg,rgba(63,41,28,0.98),rgba(29,18,12,0.98))] backdrop-blur-sm fth-react-scrollbar",
          )}
        >
          {shellContext.steps.map((step, index) => (
            <div key={step.id} className="contents">
              <button
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm transition",
                  "border-fth-cc-gold/25 bg-[radial-gradient(circle_at_30%_30%,rgba(255,248,238,0.12),rgba(55,35,24,0.96))] text-fth-cc-muted shadow-[inset_0_1px_0_rgba(255,240,220,0.16)]",
                  step.active && "border-fth-cc-gold bg-[radial-gradient(circle_at_30%_30%,rgba(255,220,160,0.34),rgba(95,60,24,0.96))] text-fth-cc-light shadow-[0_0_0_1px_rgba(239,215,162,0.45),0_14px_24px_rgba(0,0,0,0.28)]",
                  step.status === "complete" && "border-fth-cc-gold bg-[radial-gradient(circle_at_30%_30%,rgba(185,223,186,0.26),rgba(58,83,47,0.96))] text-white",
                  step.status === "invalid" && "border-fth-cc-gold/55 bg-[radial-gradient(circle_at_30%_30%,rgba(202,103,86,0.24),rgba(95,29,22,0.96))] text-white",
                  shellContext.isReviewStep && "cursor-pointer hover:border-fth-cc-gold hover:text-white",
                  !shellContext.isReviewStep && "cursor-default",
                )}
                disabled={!shellContext.isReviewStep}
                onClick={() => onJumpToStep(step.id)}
                type="button"
                title={step.label}
              >
                <span className="sr-only">{step.label}</span>
                <i className={step.icon} aria-hidden="true" />
              </button>
              {index < shellContext.steps.length - 1 ? (
                <div
                  className={cn(
                    "h-px min-w-6 flex-1 bg-fth-cc-gold/18",
                    step.status === "complete" && "bg-fth-cc-gold/60",
                  )}
                />
              ) : null}
            </div>
          ))}
        </nav>
      ) : null}

      {!shellContext.hideShellHeader ? (
        <header className="border-b border-fth-cc-gold/18 bg-[linear-gradient(180deg,rgba(60,40,28,0.92),rgba(27,18,12,0.9))] px-6 py-5 backdrop-blur-sm">
          {shellContext.headerTitle ? (
            <div className="flex items-start gap-4">
              {shellContext.headerIcon ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-fth-cc-gold/35 bg-black/20 text-fth-cc-gold">
                  <i className={cn(shellContext.headerIcon, "text-lg")} aria-hidden="true" />
                </div>
              ) : null}
              <div className="min-w-0">
                <h2 className="m-0 font-fth-cc-display text-2xl tracking-[0.16em] text-fth-cc-light uppercase">
                  {shellContext.headerTitle}
                  {shellContext.headerSubtitle ? (
                    <span className="ml-3 font-fth-cc-body text-base tracking-[0.08em] text-fth-cc-gold-bright/90 normal-case">
                      {shellContext.headerSubtitle}
                    </span>
                  ) : null}
                </h2>
                {shellContext.headerDescription ? (
                  <p className="mt-2 max-w-3xl font-fth-cc-body text-[15px] leading-6 text-fth-cc-muted">
                    {shellContext.headerDescription}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <i className={cn(shellContext.currentStepIcon, "text-fth-cc-gold")} aria-hidden="true" />
              <h2 className="m-0 font-fth-cc-display text-xl uppercase tracking-[0.16em] text-fth-cc-light">
                {shellContext.currentStepLabel}
              </h2>
            </div>
          )}
        </header>
      ) : null}

      {stepContent}

      <motion.footer
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        className="relative mt-auto flex items-center justify-between gap-4 overflow-hidden border-t border-fth-cc-gold/18 bg-[linear-gradient(180deg,rgba(62,41,28,0.98),rgba(30,19,13,0.99)_42%,rgba(21,14,10,1)_100%)] px-6 py-4 backdrop-blur-sm"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,234,196,0.12),transparent_42%),linear-gradient(180deg,rgba(255,244,220,0.06),transparent_26%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(214,177,111,0.65),rgba(214,177,111,0))]" />
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-5 bg-[radial-gradient(circle_at_bottom,rgba(0,0,0,0.28),transparent_72%)]" />
        <motion.button
          className={cn(
            "cc-shell-footer-btn cc-shell-footer-btn--back relative z-10 inline-flex min-w-32 items-center justify-center gap-2 rounded-[1rem] border px-5 py-2.5 font-fth-cc-ui text-sm uppercase tracking-[0.12em] transition",
            "border-fth-cc-gold/40 bg-[linear-gradient(180deg,#4a6285_0%,#29384f_52%,#17202e_100%)] text-fth-cc-light shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_20px_rgba(0,0,0,0.22)]",
            "hover:border-fth-cc-gold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45",
          )}
          disabled={!shellContext.canGoBack}
          onClick={onBack}
          type="button"
          whileHover={prefersReducedMotion || !shellContext.canGoBack ? undefined : { y: -2, scale: 1.01 }}
          whileTap={prefersReducedMotion || !shellContext.canGoBack ? undefined : { scale: 0.985 }}
        >
          <span className="pointer-events-none absolute inset-[2px] rounded-[0.85rem] border border-white/10" />
          <ButtonOrnament side="left" />
          <span>Back</span>
          <ButtonOrnament side="right" />
        </motion.button>

        <motion.div
          animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
          className="relative z-10 min-h-5 flex-1 text-center font-fth-cc-body text-sm text-fth-cc-muted/90"
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
          transition={{ delay: 0.06, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mx-auto flex max-w-sm items-center justify-center gap-3">
            <FooterDivider />
            <span>{shellContext.statusHint}</span>
            <FooterDivider />
          </div>
        </motion.div>

        {shellContext.isReviewStep ? (
          <motion.button
            className={cn(
              "cc-shell-footer-btn cc-shell-footer-btn--primary relative z-10 inline-flex min-w-40 items-center justify-center gap-2 rounded-[1rem] border px-6 py-2.5 font-fth-cc-ui text-sm uppercase tracking-[0.12em] transition",
              "border-fth-cc-gold/70 bg-[linear-gradient(180deg,#c04732_0%,#9f231a_52%,#6e1715_100%)] text-fth-cc-light shadow-[inset_0_1px_0_rgba(255,238,222,0.16),0_12px_24px_rgba(0,0,0,0.24)]",
              "hover:brightness-110 disabled:cursor-progress disabled:opacity-70",
            )}
            disabled={isCreating}
            onClick={() => void handleCreateCharacter()}
            type="button"
            whileHover={prefersReducedMotion || isCreating ? undefined : { y: -2, scale: 1.01 }}
            whileTap={prefersReducedMotion || isCreating ? undefined : { scale: 0.985 }}
          >
            <span className="pointer-events-none absolute inset-[2px] rounded-[0.85rem] border border-white/10" />
            <ButtonOrnament side="left" />
            <i className={cn(isCreating ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-sparkles")} aria-hidden="true" />
            <span>{isCreating ? "Creating..." : "Create Character"}</span>
            <ButtonOrnament side="right" />
          </motion.button>
        ) : (
          <motion.button
            className={cn(
              "cc-shell-footer-btn cc-shell-footer-btn--primary relative z-10 inline-flex min-w-40 items-center justify-center gap-2 rounded-[1rem] border px-6 py-2.5 font-fth-cc-ui text-sm uppercase tracking-[0.12em] transition",
              "border-fth-cc-gold/70 bg-[linear-gradient(180deg,#c04732_0%,#9f231a_52%,#6e1715_100%)] text-fth-cc-light shadow-[inset_0_1px_0_rgba(255,238,222,0.16),0_12px_24px_rgba(0,0,0,0.24)]",
              "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45",
            )}
            disabled={!shellContext.canGoNext}
            onClick={onNext}
            type="button"
            whileHover={prefersReducedMotion || !shellContext.canGoNext ? undefined : { y: -2, scale: 1.01 }}
            whileTap={prefersReducedMotion || !shellContext.canGoNext ? undefined : { scale: 0.985 }}
          >
            <span className="pointer-events-none absolute inset-[2px] rounded-[0.85rem] border border-white/10" />
            <ButtonOrnament side="left" />
            <span>{shellContext.nextButtonLabel ?? "Next"}</span>
            <ButtonOrnament side="right" />
          </motion.button>
        )}
      </motion.footer>
    </div>
  );
}

function FooterDivider() {
  return (
    <span aria-hidden="true" className="hidden items-center gap-2 sm:inline-flex">
      <span className="h-px w-8 bg-[linear-gradient(90deg,rgba(214,177,111,0),rgba(214,177,111,0.65),rgba(214,177,111,0))]" />
      <span className="h-1.5 w-1.5 rotate-45 border border-fth-cc-gold/55 bg-fth-cc-gold/20" />
    </span>
  );
}

function ButtonOrnament({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border border-fth-cc-gold/55 bg-fth-cc-gold/10",
        side === "left" ? "left-2.5" : "right-2.5",
      )}
    />
  );
}
