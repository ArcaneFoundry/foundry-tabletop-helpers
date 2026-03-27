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
        "relative overflow-hidden rounded-[1.25rem] border border-[#e9c176]/16 bg-[linear-gradient(180deg,rgba(46,42,48,0.94),rgba(15,15,19,0.98))] p-[0.22rem] text-left",
        selected && "border-[#e9c176]/55",
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
        <div className="pointer-events-none absolute inset-[0.2rem] rounded-[0.78rem] border border-[#d9b074]/22 shadow-[inset_0_1px_0_rgba(255,240,219,0.14)]" />
        <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-6 rounded-full bg-[linear-gradient(180deg,rgba(255,244,216,0.22),rgba(255,244,216,0))]" />
        <div
          className="relative overflow-hidden rounded-[1.06rem] border bg-[#140f16] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.08),inset_0_-16px_24px_rgba(0,0,0,0.26)]"
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
          <div className="pointer-events-none absolute inset-0 rounded-[1.06rem] bg-[linear-gradient(180deg,rgba(255,247,233,0.04)_0%,transparent_22%,rgba(8,7,12,0.02)_42%,rgba(8,7,12,0.82)_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(14,14,18,0.74),rgba(14,14,18,0))]" />
          <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-4">
            <div>
              <div className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.3em] text-[#e9c176]/78">
                Class
              </div>
              <div className="mt-1 font-fth-cc-display text-[1.4rem] leading-none text-[#f5ead5] md:text-[1.7rem]">
                {entry.name}
              </div>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(8,8,12,0.42)] text-[#e9c176] backdrop-blur-sm">
              <i className={theme.crest} aria-hidden="true" />
            </span>
          </div>
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex flex-wrap items-center gap-2">
            <InfoChip value={entry.hitDie} icon="fa-solid fa-dice-d20" />
            <InfoChip value={entry.primaryAbilityBadgeText} icon="fa-solid fa-star" />
            <InfoChip value={entry.savingThrowBadgeText} icon="fa-solid fa-shield" />
          </div>
          {selected ? (
            <div className="pointer-events-none absolute right-4 top-16 flex items-center gap-2 rounded-full border border-[#e9c176]/45 bg-[rgba(233,193,118,0.14)] px-3 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em] text-[#f6e6c4] backdrop-blur-sm shadow-[0_0_16px_rgba(233,193,118,0.16)]">
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
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 self-start rounded-full border border-[#e9c176]/22 bg-[rgba(255,255,255,0.05)] px-2.5 py-1.5 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em] text-[#e9dcc6] shadow-[0_8px_16px_rgba(0,0,0,0.16)] backdrop-blur-md">
      <i className={cn(icon, "shrink-0 text-[0.7rem] text-[#f7d691]")} aria-hidden="true" />
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}
