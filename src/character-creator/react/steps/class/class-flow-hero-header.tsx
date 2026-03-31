import { AnimatePresence, motion } from "motion/react";

import { cn } from "../../../../ui/lib/cn";
import type { ClassFlowHeaderTone } from "./build-class-flow-shell-model";

type ClassFlowHeroHeaderProps = {
  title: string;
  description: string;
  primaryBadgeLabel: string;
  secondaryBadgeLabel: string;
  headerTone?: ClassFlowHeaderTone;
  prefersReducedMotion: boolean;
  className?: string;
};

export function ClassFlowHeroHeader({
  title,
  description,
  primaryBadgeLabel,
  secondaryBadgeLabel,
  headerTone = "default",
  prefersReducedMotion,
  className,
}: ClassFlowHeroHeaderProps) {
  return (
    <motion.header
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      className={cn(
        "mx-2 mt-2 px-4 pb-3 pt-3 md:px-6 [@media(max-height:900px)]:mx-1 [@media(max-height:900px)]:mt-1 [@media(max-height:900px)]:px-2 [@media(max-height:900px)]:pb-2 [@media(max-height:900px)]:pt-2",
        className,
      )}
      data-class-flow-hero="true"
      initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
      transition={{ delay: 0.05, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="cc-theme-header cc-theme-header--hero cc-class-flow-hero-banner relative isolate overflow-hidden rounded-[1.35rem] border"
        data-class-hero-banner="true"
        data-tone={headerTone}
      >
        <div className="cc-class-flow-hero-banner__sheen pointer-events-none absolute inset-[0.35rem] rounded-[1rem]" />
        <div className="cc-class-flow-hero-banner__glow pointer-events-none absolute inset-0" />
        <div className="cc-class-flow-hero-banner__frame pointer-events-none absolute inset-[0.35rem] rounded-[1rem]" />
        <div
          className="relative z-10 flex flex-col gap-4 px-4 py-4 md:px-6 md:py-5 lg:flex-row lg:items-end lg:justify-between [@media(max-height:900px)]:gap-2 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:py-3"
          data-class-flow-hero-body="true"
        >
          <div className="min-w-0 max-w-3xl">
            <div className="cc-theme-kicker font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.3em]">
              Character Creation
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={title}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                className="m-0 font-fth-cc-display uppercase tracking-[0.12em]"
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ fontSize: "clamp(1.075rem, 8cqi, 2.15rem)", lineHeight: 1.05 }}
              >
                {title}
              </motion.h2>
            </AnimatePresence>
            <p className="cc-theme-copy mt-3 max-w-2xl font-fth-cc-body text-[0.96rem] leading-7 [@media(max-height:900px)]:hidden" data-class-flow-hero-description="true">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 [@media(max-height:900px)]:gap-1.5">
            <span className="cc-theme-badge cc-class-flow-hero-banner__badge inline-flex rounded-full px-3 py-1.5 font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.2em] [@media(max-height:900px)]:px-2.5 [@media(max-height:900px)]:py-1">
              {primaryBadgeLabel}
            </span>
            <span className="cc-theme-badge cc-theme-badge--muted cc-class-flow-hero-banner__badge cc-class-flow-hero-banner__badge--muted inline-flex rounded-full px-3 py-1.5 font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.18em] [@media(max-height:900px)]:px-2.5 [@media(max-height:900px)]:py-1">
              {secondaryBadgeLabel}
            </span>
          </div>
        </div>
        <div className="cc-class-flow-hero-banner__rule pointer-events-none absolute inset-x-4 bottom-0 h-px" />
        <div className="relative z-10 flex items-center justify-center px-4 py-3 [@media(max-height:900px)]:hidden" data-class-flow-hero-flourish="true">
          <HeaderFlourish side="left" />
          <HeaderFlourish side="right" />
        </div>
      </div>
    </motion.header>
  );
}

function HeaderFlourish({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className="cc-class-flow-hero-banner__flourish flex items-center gap-2"
    >
      <span className="cc-class-flow-hero-banner__flourish-line h-px w-10" />
      <span className="cc-class-flow-hero-banner__flourish-gem inline-flex h-2.5 w-2.5 rotate-45 rounded-[0.2rem] border" />
      <span className="cc-class-flow-hero-banner__flourish-line h-px w-10" />
      {side === "left" ? null : <span className="sr-only">Class flow flourish</span>}
    </span>
  );
}
