/**
 * Transforms PartySummaryData (raw extracted data) into PartySummaryViewModel (render-ready).
 * All formatting, escaping, and conditional logic happens here.
 */

import type { PartySummaryData, PartyMemberSummary } from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import type {
  PartySummaryViewModel,
  PartyMemberRowViewModel,
  PartySaveViewModel,
  PartyTrackingCardViewModel,
  SpellSlotRowViewModel,
} from "./party-viewmodel";
import { esc, signStr } from "./character-transformer-common";

/* ── Main Transformer ───────────────────────────────────────── */

export function transformPartySummaryToViewModel(
  data: PartySummaryData,
  options: PrintOptions,
): PartySummaryViewModel {
  return {
    name: esc(data.name),
    members: data.members.map(buildMemberRow),
    trackingCards: data.members.map(buildTrackingCard),
    paperClass: `fth-paper-${options.paperSize}`,
  };
}

/* ── Member Row ─────────────────────────────────────────────── */

function buildMemberRow(m: PartyMemberSummary): PartyMemberRowViewModel {
  // Build saves
  const saves: PartySaveViewModel[] = m.saves.map(s => ({
    profIcon: s.proficient ? "●" : "",
    key: s.key.toUpperCase(),
    mod: signStr(s.mod),
  }));

  // Build skills display
  const skillsDisplay = m.proficientSkills
    .map(s => `${s.abbr} ${signStr(s.mod)}`)
    .join(", ") || "—";

  return {
    name: esc(m.name),
    classInfo: `${esc(m.classes)} • Lvl ${m.level}`,
    speciesBackground: `${esc(m.species)} • ${esc(m.background)}`,
    senses: esc(m.senses),
    ac: m.ac,
    hpMax: m.hp.max,
    proficiency: signStr(m.proficiency),
    initiative: signStr(m.initiative),
    passivePerception: `👁${m.passives.perception}`,
    passiveInsight: `💭${m.passives.insight}`,
    passiveInvestigation: `🔍${m.passives.investigation}`,
    spellDcDisplay: m.spellDC ? `DC ${m.spellDC}` : "—",
    saves,
    skillsDisplay,
  };
}

/* ── Tracking Card ──────────────────────────────────────────── */

function buildTrackingCard(m: PartyMemberSummary): PartyTrackingCardViewModel {
  const spellSlots: SpellSlotRowViewModel[] = m.spellSlots.map(s => ({
    level: s.level,
    checkboxes: "☐".repeat(s.max),
  }));

  let pactSlotDisplay = "";
  if (m.pactSlots) {
    pactSlotDisplay = `P${m.pactSlots.level} ${"☐".repeat(m.pactSlots.max)}`;
  }

  return {
    name: esc(m.name),
    ac: m.ac,
    hpMax: m.hp.max,
    spellSlots,
    hasSpellSlots: spellSlots.length > 0 || !!m.pactSlots,
    pactSlotDisplay,
    hasPactSlot: !!m.pactSlots,
  };
}
