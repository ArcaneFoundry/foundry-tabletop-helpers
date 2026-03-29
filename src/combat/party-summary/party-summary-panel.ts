/**
 * Party Summary — GM-Facing PC Quick-Reference Panel
 *
 * Horizontal card grid showing all player characters with live-updating
 * combat stats. Each card shows AC, HP (tier-colored bar), saves, passives,
 * spell DC, concentration, and active conditions.
 *
 * Interactive:
 *   - Tap a save → rolls that ability save for the actor (standard dnd5e dialog)
 *   - Tap a name → opens the actor's character sheet
 *
 * Triggered via Combat Tracker button or macro API, not auto-showing.
 * Draggable with localStorage position memory.
 */

import { Log, MOD } from "../../logger";
import { getHooks, isGM, isDnd5eWorld, getSetting, getGame } from "../../types";
import { applyFthThemeToNode } from "../../ui/theme/fth-theme";
import { COMBAT_SETTINGS } from "../combat-settings";
import { extractCardData, type PartySummaryCard } from "./party-summary-types";
import type { SaveAbility } from "../combat-types";

interface PartySummaryActor {
  id?: string;
  name?: string;
  type?: string;
  hasPlayerOwner?: boolean;
  sheet?: { render(force?: boolean): void };
  rollSavingThrow?(ability: SaveAbility): Promise<unknown> | unknown;
  rollAbilitySave?(ability: SaveAbility): Promise<unknown> | unknown;
}

interface PartySummaryEffect {
  parent?: unknown;
}

interface ActorCollectionLike {
  get?(id: string): unknown;
  forEach?(callback: (value: unknown) => void): void;
}

interface PrimaryPartyMemberLike {
  actor?: unknown;
}

interface GroupActorLike {
  type?: string;
  system?: {
    members?: PrimaryPartyMemberLike[];
  };
}

interface GameLike {
  actors?: ActorCollectionLike;
  settings?: {
    get?(scope: string, key: string): unknown;
  };
}

/* ── State ────────────────────────────────────────────────── */

let panelEl: HTMLElement | null = null;
let visible = false;
let cards: PartySummaryCard[] = [];
const POSITION_KEY = `${MOD}:party-summary-pos`;

/** Debounce timer for batched updates */
let updateTimer: ReturnType<typeof setTimeout> | null = null;
const pendingActorIds = new Set<string>();
const UPDATE_DEBOUNCE_MS = 100;

/* ── PC Actor IDs (cached for hook filtering) ─────────────── */

let pcActorIds = new Set<string>();

/* ── Public API ───────────────────────────────────────────── */

/**
 * Register hooks for the party summary panel.
 * Called from registerCombatHooks() during init.
 */
export function registerPartySummaryHooks(): void {
  const hooks = getHooks();
  if (!hooks) return;

  // Live update hooks
  hooks.on("updateActor", onUpdateActor);
  hooks.on("createActiveEffect", onEffectChange);
  hooks.on("deleteActiveEffect", onEffectChange);
  hooks.on("updateActiveEffect", onEffectChange);

  Log.debug("Party summary hooks registered");
}

/**
 * Toggle the party summary panel visibility.
 * Called from Combat Tracker button or macro API.
 */
export function togglePartySummary(): void {
  if (!isPartySummaryEnabled()) return;

  if (visible && panelEl) {
    hidePanel();
  } else {
    showPanel();
  }
}

/* ── Feature Enabled Check ────────────────────────────────── */

function isPartySummaryEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_PARTY_SUMMARY) ?? true)
    && isGM()
    && isDnd5eWorld();
}

/* ── Live Update Hooks ────────────────────────────────────── */

function onUpdateActor(actor: unknown): void {
  if (!visible || !panelEl) return;
  if (!isPartySummaryActor(actor)) return;
  if (!pcActorIds.has(actor.id)) return;
  scheduleUpdate(actor.id);
}

function onEffectChange(effect: PartySummaryEffect): void {
  if (!visible || !panelEl) return;
  const actor = effect?.parent;
  if (!isPartySummaryActor(actor)) return;
  if (!pcActorIds.has(actor.id)) return;
  scheduleUpdate(actor.id);
}

function scheduleUpdate(actorId: string): void {
  pendingActorIds.add(actorId);
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(flushUpdates, UPDATE_DEBOUNCE_MS);
}

function flushUpdates(): void {
  updateTimer = null;
  if (!panelEl || !visible) {
    pendingActorIds.clear();
    return;
  }

  const game = getGame();
  const actors = game?.actors;
  if (!actors) { pendingActorIds.clear(); return; }

  for (const actorId of pendingActorIds) {
    const actor = getActorById(actors, actorId);
    if (!isPartySummaryActor(actor)) continue;

    const cardData = extractCardData(actor as Parameters<typeof extractCardData>[0]);
    // Update the card in our cached array
    const idx = cards.findIndex((c) => c.actorId === actorId);
    if (idx >= 0) cards[idx] = cardData;

    // Re-render just this card in the DOM
    const cardEl = panelEl.querySelector<HTMLElement>(`[data-actor-id="${actorId}"]`);
    if (cardEl) {
      const newCardEl = createCardElement(cardData);
      cardEl.replaceWith(newCardEl);
    }
  }

  pendingActorIds.clear();
}

/* ── Panel Lifecycle ──────────────────────────────────────── */

function showPanel(): void {
  // Refresh PC list and card data
  refreshCards();

  if (!panelEl) {
    panelEl = document.createElement("div");
    panelEl.id = "fth-party-summary";
    panelEl.className = "fth-party-summary";
    applyFthThemeToNode(panelEl);
    document.body.appendChild(panelEl);
    restorePosition();
  }

  panelEl.innerHTML = buildPanelHTML();
  attachPanelListeners(panelEl);
  makeDraggable(panelEl);
  panelEl.style.display = "";
  visible = true;
}

function hidePanel(): void {
  if (panelEl) panelEl.style.display = "none";
  visible = false;
}

function refreshCards(): void {
  const game = getGame();
  if (!game) { cards = []; pcActorIds.clear(); return; }

  const pcActors = getPartyActors(game);

  // Sort alphabetically for stable order
  pcActors.sort((a, b) => getActorName(a).localeCompare(getActorName(b)));

  cards = pcActors.map((actor) => extractCardData(actor as Parameters<typeof extractCardData>[0]));
  pcActorIds = new Set(cards.map((c) => c.actorId));
}

/* ── Party Source Resolution ──────────────────────────────── */

/**
 * Get the party actors based on the configured party source setting.
 *
 * - "primaryParty": Uses the dnd5e primary party group's members.
 *   Falls back to player-owned characters if no primary party is set.
 * - "playerOwned": All player-owned character actors in the world.
 */
function getPartyActors(game: GameLike): PartySummaryActor[] {
  const source = getSetting<string>(MOD, COMBAT_SETTINGS.PARTY_SOURCE) ?? "primaryParty";

  if (source === "primaryParty") {
    const actors = getPrimaryPartyMembers(game);
    if (actors.length > 0) return actors;
    // Fall back to player-owned if no primary party is configured
    Log.debug("Party Summary: no primary party set, falling back to player-owned");
  }

  return getPlayerOwnedActors(game);
}

/**
 * Get members from the dnd5e primary party group.
 * Uses `game.settings.get("dnd5e", "primaryParty")` which returns a
 * PrimaryPartySetting data model with an `actor` field pointing to
 * the Group actor. The group's `system.members` contains `{ actor }` entries.
 */
function getPrimaryPartyMembers(game: GameLike): PartySummaryActor[] {
  try {
    const partySetting = game.settings?.get?.("dnd5e", "primaryParty");
    const groupActor = getPrimaryPartyGroupActor(partySetting);
    if (!groupActor || groupActor.type !== "group") return [];

    // group.system.members is an array of { actor: Actor5e }
    const members = groupActor.system?.members;
    if (!Array.isArray(members)) return [];

    return members
      .map((member) => member.actor)
      .filter(isPartySummaryActor);
  } catch {
    Log.debug("Party Summary: could not read primary party setting");
    return [];
  }
}

/**
 * Get all player-owned character actors in the world.
 */
function getPlayerOwnedActors(game: GameLike): PartySummaryActor[] {
  const actors = game.actors;
  if (!actors) return [];

  const result: PartySummaryActor[] = [];
  actors.forEach?.((actor) => {
    if (isPartySummaryActor(actor)) result.push(actor);
  });
  return result;
}

/* ── HTML Builders ────────────────────────────────────────── */

function buildPanelHTML(): string {
  const cardHTML = cards.map((c) => buildCardHTML(c)).join("");

  return `
    <div class="ps-header" data-ps-drag>
      <span class="ps-title"><i class="fa-solid fa-users-viewfinder"></i> Party Summary</span>
      <span class="ps-count">${cards.length} PCs</span>
      <button class="ps-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="ps-body">
      <div class="ps-card-grid">${cardHTML}</div>
    </div>
  `;
}

function buildCardHTML(card: PartySummaryCard): string {
  const hpBarWidth = Math.max(0, Math.min(100, card.hpPercent));
  const tierColor = card.healthTier.color;

  // Saves grid
  const saveCells = card.saves.map((s) => {
    const profClass = s.proficient ? "ps-save-prof" : "";
    return `<button class="ps-save-btn ${profClass}" data-actor-id="${card.actorId}" data-ability="${s.ability}" type="button">
      <span class="ps-save-label">${s.label}</span>
      <span class="ps-save-mod">${s.modifier}</span>
    </button>`;
  }).join("");

  // Conditions
  let statusHTML = "";
  if (card.isConcentrating) {
    statusHTML += `<span class="ps-badge ps-badge-conc" title="Concentrating"><i class="fa-solid fa-bullseye"></i> Conc</span>`;
  }
  for (const cond of card.conditions) {
    statusHTML += `<span class="ps-badge ps-badge-cond" title="${cond.label}">${cond.label}</span>`;
  }

  // Spell DC
  const spellDCHTML = card.spellDC
    ? `<div class="ps-spell-dc" title="Spell Save DC"><span class="ps-dc-label">DC</span> ${card.spellDC}</div>`
    : "";

  // Temp HP indicator
  const tempHPHTML = card.hpTemp > 0
    ? `<span class="ps-temp-hp" title="Temp HP">+${card.hpTemp}</span>`
    : "";

  return `
    <div class="ps-card" data-actor-id="${card.actorId}">
      <div class="ps-card-identity">
        <img class="ps-card-portrait" src="${card.portraitUrl}" alt="" />
        <div class="ps-card-name-block">
          <button class="ps-card-name" data-actor-id="${card.actorId}" type="button">${esc(card.name)}</button>
          <div class="ps-card-class">${esc(card.classLabel)}</div>
        </div>
      </div>

      <div class="ps-card-core">
        <div class="ps-core-stat">
          <span class="ps-core-icon"><i class="fa-solid fa-shield-halved"></i></span>
          <span class="ps-core-val">${card.ac}</span>
        </div>
        <div class="ps-core-hp">
          <div class="ps-hp-text">
            <span class="ps-hp-current" style="color: ${tierColor}">${card.hpValue}</span>
            <span class="ps-hp-sep">/</span>
            <span class="ps-hp-max">${card.hpMax}</span>
            ${tempHPHTML}
          </div>
          <div class="ps-hp-bar-track">
            <div class="ps-hp-bar-fill" style="width: ${hpBarWidth}%; background: ${tierColor};"></div>
          </div>
        </div>
        <div class="ps-core-stat">
          <span class="ps-core-icon"><i class="fa-solid fa-person-running"></i></span>
          <span class="ps-core-val">${card.speed}</span>
        </div>
        ${spellDCHTML}
      </div>

      <div class="ps-card-saves">${saveCells}</div>

      <div class="ps-card-passives">
        <span class="ps-passive" title="Passive Perception"><i class="fa-solid fa-eye"></i> ${card.passivePerception}</span>
        <span class="ps-passive" title="Passive Investigation"><i class="fa-solid fa-magnifying-glass"></i> ${card.passiveInvestigation}</span>
        <span class="ps-passive" title="Passive Insight"><i class="fa-solid fa-brain"></i> ${card.passiveInsight}</span>
      </div>

      ${statusHTML ? `<div class="ps-card-status">${statusHTML}</div>` : ""}
    </div>
  `;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Create a card DOM element (for targeted re-rendering) */
function createCardElement(card: PartySummaryCard): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildCardHTML(card);
  const el = wrapper.firstElementChild as HTMLElement;
  attachCardListeners(el);
  return el;
}

/* ── Event Listeners ──────────────────────────────────────── */

function attachPanelListeners(el: HTMLElement): void {
  // Close
  el.querySelector(".ps-close")?.addEventListener("click", () => hidePanel());

  // Delegate card interactions
  attachCardListeners(el);
}

function attachCardListeners(el: HTMLElement): void {
  // Save buttons — roll save
  el.querySelectorAll<HTMLButtonElement>(".ps-save-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const actorId = btn.dataset.actorId;
      const ability = btn.dataset.ability as SaveAbility;
      if (actorId && ability) void rollSaveForActor(actorId, ability);
    });
  });

  // Name buttons — open sheet
  el.querySelectorAll<HTMLButtonElement>(".ps-card-name").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const actorId = btn.dataset.actorId;
      if (actorId) openActorSheet(actorId);
    });
  });
}

/* ── Actions ──────────────────────────────────────────────── */

async function rollSaveForActor(actorId: string, ability: SaveAbility): Promise<void> {
  const game = getGame();
  const actor = getActorById(game?.actors, actorId);
  if (!isPartySummaryActor(actor)) return;

  try {
    // dnd5e 5.x: rollSavingThrow; fallback: rollAbilitySave
    if (typeof actor.rollSavingThrow === "function") {
      await actor.rollSavingThrow(ability);
    } else if (typeof actor.rollAbilitySave === "function") {
      await actor.rollAbilitySave(ability);
    } else {
      Log.warn("Party Summary: no save roll method found on actor");
    }
  } catch (err) {
    Log.error("Party Summary: failed to roll save", err);
  }
}

function openActorSheet(actorId: string): void {
  const game = getGame();
  const actor = getActorById(game?.actors, actorId);
  if (!isPartySummaryActor(actor) || !actor.sheet) return;
  actor.sheet.render(true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPartySummaryActor(actor: unknown): actor is PartySummaryActor & { id: string } {
  return isRecord(actor)
    && typeof actor.id === "string"
    && actor.type === "character"
    && actor.hasPlayerOwner === true;
}

function getActorName(actor: PartySummaryActor): string {
  return typeof actor.name === "string" ? actor.name : "";
}

function getActorById(actors: ActorCollectionLike | undefined, actorId: string): unknown {
  return actors?.get?.(actorId);
}

function getPrimaryPartyGroupActor(partySetting: unknown): GroupActorLike | null {
  if (!isRecord(partySetting)) return null;
  const actor = partySetting.actor;
  return isRecord(actor) ? (actor as GroupActorLike) : null;
}

/* ── Dragging ─────────────────────────────────────────────── */

function makeDraggable(el: HTMLElement): void {
  const handle = el.querySelector<HTMLElement>("[data-ps-drag]");
  if (!handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.style.cursor = "grab";

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".ps-close")) return;
    dragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    handle.style.cursor = "grabbing";
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener("pointermove", (e: PointerEvent) => {
    if (!dragging) return;
    el.style.left = `${e.clientX - offsetX}px`;
    el.style.top = `${e.clientY - offsetY}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  });

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = "grab";
    savePosition();
  };

  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}

function savePosition(): void {
  if (!panelEl) return;
  const pos = { left: panelEl.style.left, top: panelEl.style.top };
  try { localStorage.setItem(POSITION_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

function restorePosition(): void {
  if (!panelEl) return;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) {
      const pos = JSON.parse(raw) as { left?: string; top?: string };
      if (pos.left && pos.top) {
        panelEl.style.left = pos.left;
        panelEl.style.top = pos.top;
        panelEl.style.right = "auto";
        panelEl.style.bottom = "auto";
        return;
      }
    }
  } catch { /* ignore */ }
  // Default: top-center
  panelEl.style.top = "60px";
  panelEl.style.left = "50%";
  panelEl.style.transform = "translateX(-50%)";
}
