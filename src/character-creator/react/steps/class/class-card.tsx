import { motion } from "motion/react";

import type { CreatorIndexEntry } from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { getClassTheme } from "./class-presentation";

const CARD_RESTING_SHADOW = "0 24px 50px rgba(0,0,0,0.28)";
const CARD_HOVER_SHADOW = "0 30px 55px rgba(0,0,0,0.34)";
const CARD_TAP_SHADOW = "0 18px 32px rgba(0,0,0,0.22)";
const CARD_SELECTED_SHADOW =
  "0 0 0 1px rgba(233,193,118,0.28),0 0 28px rgba(233,193,118,0.18),0 30px 55px rgba(0,0,0,0.38)";
const CARD_SELECTED_HOVER_SHADOW =
  "0 0 0 1px rgba(233,193,118,0.32),0 0 32px rgba(233,193,118,0.22),0 34px 58px rgba(0,0,0,0.4)";
const CARD_SELECTED_TAP_SHADOW =
  "0 0 0 1px rgba(233,193,118,0.24),0 0 24px rgba(233,193,118,0.16),0 22px 40px rgba(0,0,0,0.32)";

const CARD_VARIANTS = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.975,
  },
  rest: {
    opacity: 1,
    y: 0,
    scale: 1,
    boxShadow: CARD_RESTING_SHADOW,
  },
  selected: {
    opacity: 1,
    y: 0,
    scale: 1,
    boxShadow: CARD_SELECTED_SHADOW,
  },
  hover: {
    y: -6,
    scale: 1.015,
    boxShadow: CARD_HOVER_SHADOW,
  },
  selectedHover: {
    y: -6,
    scale: 1.015,
    boxShadow: CARD_SELECTED_HOVER_SHADOW,
  },
  tap: {
    y: -2,
    scale: 0.992,
    boxShadow: CARD_TAP_SHADOW,
  },
  selectedTap: {
    y: -2,
    scale: 0.992,
    boxShadow: CARD_SELECTED_TAP_SHADOW,
  },
} as const;

const CARD_ART_VARIANTS = {
  hidden: {
    scale: 1.01,
  },
  rest: {
    scale: 1,
  },
  selected: {
    scale: 1.004,
  },
  hover: {
    scale: 1.03,
  },
  selectedHover: {
    scale: 1.03,
  },
  tap: {
    scale: 1.014,
  },
  selectedTap: {
    scale: 1.014,
  },
} as const;

export type ClassCardEntry = CreatorIndexEntry & {
  cardImg: string;
  selected: boolean;
  hitDie: string;
  primaryAbilityText: string;
  primaryAbilityBadgeText: string;
  primaryAbilityHint: string;
  savingThrowText: string;
  savingThrowBadgeText: string;
};

export function getClassCardMediaClassName(_selected: boolean): string {
  return "aspect-[0.96]";
}

export function ClassCard({
  entry,
  onSelect,
  prefersReducedMotion,
  selected,
}: {
  entry: ClassCardEntry;
  onSelect: (entry: CreatorIndexEntry) => Promise<void>;
  prefersReducedMotion: boolean;
  selected: boolean;
}) {
  const theme = getClassTheme(entry.name);

  return (
    <motion.div
      animate={selected ? "selected" : "rest"}
      className={cn(
        "relative overflow-hidden rounded-[1.25rem] border border-fth-border bg-[image:var(--fth-theme-card-shell-image)] p-[0.22rem] text-left",
        selected && "border-fth-border-strong",
      )}
      initial={prefersReducedMotion ? false : "hidden"}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : {
              type: "spring",
              stiffness: 440,
              damping: 34,
              mass: 0.9,
            }
      }
      variants={CARD_VARIANTS}
      whileHover={prefersReducedMotion ? undefined : selected ? "selectedHover" : "hover"}
      whileTap={prefersReducedMotion ? undefined : selected ? "selectedTap" : "tap"}
      style={{
        willChange: prefersReducedMotion ? undefined : "transform, box-shadow",
      }}
    >
      <button
        aria-pressed={selected}
        className="block w-full rounded-[0.8rem] text-left"
        onClick={() => void onSelect(entry)}
        type="button"
      >
        <div className="pointer-events-none absolute inset-[0.2rem] rounded-[0.78rem] border border-fth-border shadow-[inset_0_1px_0_rgba(255,240,219,0.14)]" />
        <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-6 rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fth-color-accent-strong)_24%,transparent),transparent)]" />
        <div
          className="relative overflow-hidden rounded-[1.06rem] border bg-fth-surface-inset shadow-[inset_0_0_0_1px_rgba(250,229,194,0.08),inset_0_-16px_24px_rgba(0,0,0,0.26)]"
          style={{
            borderColor: theme.frame,
            boxShadow: selected
              ? `inset 0 0 0 1px rgba(250,229,194,0.12), inset 0 -16px 24px rgba(0,0,0,0.2), 0 0 34px ${theme.glow}`
              : undefined,
          }}
        >
          <div className={cn("overflow-hidden", getClassCardMediaClassName(selected))}>
            <motion.img
              alt={entry.name}
              className="h-full w-full object-cover"
              loading="lazy"
              src={entry.cardImg}
              variants={CARD_ART_VARIANTS}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-[1.06rem] bg-[image:var(--fth-theme-card-inner-image)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[image:var(--fth-theme-card-top-fade)]" />
          <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-4">
            <div>
              <div className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.3em]" style={{ color: "color-mix(in srgb, var(--fth-color-accent) 78%, transparent)" }}>
                Class
              </div>
              <div className="mt-1 font-fth-cc-display text-[1.4rem] leading-none text-fth-text md:text-[1.7rem]">
                {entry.name}
              </div>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-fth-border bg-[color:var(--fth-color-surface-glass)] text-fth-accent backdrop-blur-sm">
              <i className={theme.crest} aria-hidden="true" />
            </span>
          </div>
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex flex-wrap items-center gap-2">
            <InfoChip value={entry.hitDie} icon="fa-solid fa-dice-d20" />
            <InfoChip value={entry.primaryAbilityBadgeText} icon="fa-solid fa-star" />
            <InfoChip value={entry.savingThrowBadgeText} icon="fa-solid fa-shield" />
          </div>
          {selected ? (
            <div className="pointer-events-none absolute right-4 top-16 flex items-center gap-2 rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em] backdrop-blur-sm shadow-[0_0_16px_rgba(233,193,118,0.16)]"
              style={{
                borderColor: "var(--fth-theme-card-selected-border)",
                backgroundColor: "var(--fth-theme-card-selected-bg)",
                color: "var(--fth-theme-card-selected-text)",
              }}
            >
              <i className="fa-solid fa-sparkles text-[0.72rem]" aria-hidden="true" />
              Selected Class
            </div>
          ) : null}
        </div>
      </button>
    </motion.div>
  );
}

function InfoChip({ icon, value }: { icon: string; value: string }) {
  if (!value) return null;

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 self-start rounded-full border px-2.5 py-1.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em] shadow-[0_8px_16px_rgba(0,0,0,0.16)] backdrop-blur-md"
      style={{
        borderColor: "var(--fth-theme-card-chip-border)",
        backgroundColor: "var(--fth-theme-card-chip-bg)",
        color: "var(--fth-theme-card-chip-text)",
      }}
    >
      <i className={cn(icon, "shrink-0 text-[0.7rem]")} style={{ color: "var(--fth-theme-card-chip-icon)" }} aria-hidden="true" />
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}
