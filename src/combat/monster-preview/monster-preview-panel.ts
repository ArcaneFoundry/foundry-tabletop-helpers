/**
 * Combat Monster Preview — Auto-showing NPC Stat Block Panel
 *
 * Displays the full NPC stat block during their combat turn. Two modes:
 *
 * 1. **Inline** (default): Injected into the Combat Tracker sidebar below the
 *    combatant list. Scrolls naturally with the sidebar content.
 *
 * 2. **Floating** (after drag): Popped out as a draggable fixed-position panel.
 *    Position is remembered via localStorage. Reset to inline via close button.
 *
 * Reuses the print-sheet extractor and ViewModel pipeline.
 * Includes an "Up Next" compact preview for the next combatant.
 *
 * - Auto-shows on NPC turns, auto-hides on PC turns
 * - Dismissible (resets on next turn change)
 * - GM-only, controlled by enableMonsterPreview setting
 */

import { Log, MOD } from "../../logger";
import { getGame, getHooks, isGM, isDnd5eWorld, getSetting, isObject } from "../../types";
import { applyFthThemeToNode } from "../../ui/theme/fth-theme";
import { COMBAT_SETTINGS } from "../combat-settings";
import { getExtractor } from "../../print-sheet/extractors/base-extractor";
import { transformNPCToViewModel } from "../../print-sheet/renderers/viewmodels/npc-transformer";
import type { NPCData } from "../../print-sheet/extractors/dnd5e-types";
import type { PrintOptions } from "../../print-sheet/types";
import {
  buildMonsterPreviewContentHTML,
  type MonsterPreviewHeaderCue,
  buildMonsterPreviewMinimizedPanelHTML,
  buildMonsterPreviewPanelHTML,
  buildMonsterPreviewUpNextHTML,
} from "./monster-preview-rendering";
import {
  makeMonsterPreviewDraggable,
  restoreMonsterPreviewPosition,
  saveMonsterPreviewPosition,
} from "./monster-preview-floating";
import {
  attachMonsterPreviewFloatingListeners,
  attachMonsterPreviewInlineListeners,
  type MonsterPreviewQuickAction,
} from "./monster-preview-interactions";
import {
  findMonsterPreviewTrackerElement,
  injectMonsterPreviewIntoTracker,
} from "./monster-preview-tracker";
import { getMonsterPreviewUpNextData } from "./monster-preview-up-next";
import { createMonsterPreviewLiveRefreshController } from "./monster-preview-live-refresh";
import { getMonsterPreviewStatusInfo } from "./monster-preview-status";
import { getMonsterPreviewContextInfo } from "./monster-preview-context";
import { getInitialMonsterPreviewDisplayState, type MonsterPreviewDisplayMode } from "./monster-preview-display";
import { resolveMonsterPreviewQuickActions } from "./monster-preview-quick-actions";
import { shouldKeepMonsterPreviewVisible } from "./monster-preview-availability";

/* ── State ────────────────────────────────────────────────── */

/** The floating panel element (only exists when in floating mode) */
let floatingEl: HTMLElement | null = null;
/** Cached inner HTML for the stat block — re-injected on Combat Tracker re-renders */
let cachedContentHTML: string = "";
/** The actor currently displayed */
let currentActorId: string | null = null;
/** Whether the user dismissed the panel this turn */
let dismissed = false;
/** Whether the panel is in floating mode (user dragged it out) */
let isFloating = false;
/** Whether the floating panel is minimized */
let isMinimized = false;
/** Whether the preview is pinned open between turns */
let isPinned = false;
/** Short-lived feedback message shown in the preview header */
let headerFlashMessage: string | null = null;
let headerFlashTimeoutId: ReturnType<typeof setTimeout> | null = null;

const POSITION_KEY = `${MOD}:monster-preview-pos`;
const MODE_KEY = `${MOD}:monster-preview-mode`;
const MINIMIZED_KEY = `${MOD}:monster-preview-minimized`;
const PINNED_KEY = `${MOD}:monster-preview-pinned`;

interface MonsterPreviewActor {
  id?: string;
  name?: string;
  type?: string;
  system?: {
    attributes?: {
      ac?: { value?: number };
      hp?: { max?: number; value?: number };
    };
    details?: {
      cr?: string | number;
    };
  };
}

interface MonsterPreviewCombatant {
  actor?: MonsterPreviewActor | null;
  defeated?: boolean;
  isDefeated?: boolean;
  name?: string;
  initiative?: number | string | null;
  token?: {
    name?: string;
  } | null;
}

interface MonsterPreviewCombat {
  id?: string;
  combatant?: MonsterPreviewCombatant | null;
  turns?: MonsterPreviewCombatant[];
  turn?: number;
  round?: number;
}

interface MonsterPreviewGame {
  combat?: MonsterPreviewCombat | null;
  system?: {
    id?: string;
  };
}

function getCurrentGame(): MonsterPreviewGame | null {
  const game = getGame();
  return isObject(game) ? game as MonsterPreviewGame : null;
}

function getActiveCombat(): MonsterPreviewCombat | null {
  return getCurrentGame()?.combat ?? null;
}

function getCurrentSystemId(): string {
  return getCurrentGame()?.system?.id ?? "dnd5e";
}

/** Options for the extraction pipeline — show everything, use token image */
const PREVIEW_OPTIONS: PrintOptions = {
  paperSize: "letter",
  portrait: "token",
  sections: { stats: true, abilities: true, traits: true, features: true, actions: true },
};

const liveRefresh = createMonsterPreviewLiveRefreshController({
  getCurrentActorId: () => currentActorId,
  isDismissed: () => dismissed,
  hasCachedContent: () => Boolean(cachedContentHTML),
  isEnabled: isMonsterPreviewEnabled,
  refreshActiveActorPreview: extractAndRender,
});

let lastAvailabilityPersistence = false;

/* ── Public API ───────────────────────────────────────────── */

/**
 * Register hooks for the monster preview panel.
 * Called from registerCombatHooks() during init.
 */
export function registerMonsterPreviewHooks(): void {
  const hooks = getHooks();
  if (!hooks) return;

  hooks.on("updateCombat", onUpdateCombat);
  hooks.on("deleteCombat", onDeleteCombat);
  hooks.on("combatStart", onCombatStart);
  hooks.on("renderCombatTracker", onRenderCombatTracker);
  hooks.on("updateActor", onUpdateActor);
  hooks.on("createActiveEffect", onEffectChange);
  hooks.on("deleteActiveEffect", onEffectChange);
  hooks.on("updateActiveEffect", onEffectChange);

  // Restore mode preference
  try {
    const defaultDisplay = getSetting<string>(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_DEFAULT_DISPLAY) as MonsterPreviewDisplayMode | undefined;
    const initialState = getInitialMonsterPreviewDisplayState(defaultDisplay, localStorage, MODE_KEY, MINIMIZED_KEY);
    isFloating = initialState.isFloating;
    isMinimized = initialState.isMinimized;
    isPinned = localStorage.getItem(PINNED_KEY) === "true";
  } catch { /* ignore */ }

  Log.debug("Monster preview hooks registered");
}

/* ── Feature Enabled Check ────────────────────────────────── */

function isMonsterPreviewEnabled(): boolean {
  return (getSetting<boolean>(MOD, COMBAT_SETTINGS.ENABLE_MONSTER_PREVIEW) ?? true)
    && isGM()
    && isDnd5eWorld();
}

/* ── Hook Handlers ────────────────────────────────────────── */

function onUpdateCombat(combat: MonsterPreviewCombat, change: { turn?: number; round?: number }): void {
  if (!isMonsterPreviewEnabled()) return;
  if (change.turn === undefined && change.round === undefined) return;

  const gameCombat = getActiveCombat();
  if (combat.id !== gameCombat?.id) return;

  dismissed = false;
  void handleTurnChange(combat);
}

function onDeleteCombat(combat: MonsterPreviewCombat): void {
  const gameCombat = getActiveCombat();
  if (combat.id === gameCombat?.id || !gameCombat) {
    clearPreview();
  }
}

function onCombatStart(combat: MonsterPreviewCombat): void {
  if (!isMonsterPreviewEnabled()) return;
  dismissed = false;
  void handleTurnChange(combat);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onUpdateActor(actor: any): void {
  liveRefresh.handleActorUpdate(actor);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onEffectChange(effect: any): void {
  liveRefresh.handleEffectChange(effect);
}

/**
 * Re-inject the cached stat block into the Combat Tracker on each re-render.
 * This is needed because Foundry rebuilds the sidebar HTML on every render.
 */
function onRenderCombatTracker(_app: unknown, html: HTMLElement | { get(i: number): HTMLElement } | ArrayLike<HTMLElement> | null): void {
  if (!isMonsterPreviewEnabled()) return;
  if (isFloating || dismissed || !cachedContentHTML) return;

  const el: HTMLElement | null =
    html instanceof HTMLElement
      ? html
      : isObject(html) && typeof html.get === "function"
        ? (html as { get(i: number): HTMLElement }).get(0)
        : html && "length" in html && typeof html.length === "number" && html.length > 0
          ? html[0] ?? null
          : null;

  if (!el) return;
  injectIntoTracker(el);
}

/* ── Turn Change Logic ────────────────────────────────────── */

async function handleTurnChange(combat: MonsterPreviewCombat): Promise<void> {
  try {
    const combatant = combat.combatant;
    const actor = combatant?.actor;
    const keepVisible = shouldKeepMonsterPreviewVisible({
      isNPCTurn: actor?.type === "npc",
      persistBetweenTurns: getPersistentBetweenTurnsSetting(),
      pinned: isPinned,
      hasCachedContent: Boolean(cachedContentHTML),
      dismissed,
    });

    if (!actor || actor.type !== "npc") {
      if (keepVisible) {
        currentActorId = null;
        updateUpNext(combat);
        showPreview();
        return;
      }
      hidePreview();
      currentActorId = null;
      return;
    }

    if (dismissed) return;

    // Skip re-extraction if same actor (just update up-next)
    if (actor.id === currentActorId && cachedContentHTML) {
      updateUpNext(combat);
      showPreview();
      return;
    }

    currentActorId = actor.id ?? null;
    await extractAndRender(actor, combat);
  } catch (err) {
    Log.error("Monster Preview: failed to handle turn change", err);
  }
}

/* ── NPC Extraction + Rendering ───────────────────────────── */

async function extractAndRender(actor: MonsterPreviewActor, combat: MonsterPreviewCombat): Promise<void> {
  const extractor = getExtractor(getCurrentSystemId());
  if (!extractor) {
    Log.warn("Monster Preview: no extractor for system", getCurrentSystemId());
    return;
  }

  const npcData = await extractor.extractNPC(actor, PREVIEW_OPTIONS) as NPCData;
  const vm = transformNPCToViewModel(npcData, PREVIEW_OPTIONS, false);
  const upNext = getMonsterPreviewUpNextData(combat);
  const status = getMonsterPreviewStatusInfo(actor, combat?.combatant);
  const context = getMonsterPreviewContextInfo(combat?.combatant, combat);
  const quickActions = resolveMonsterPreviewQuickActions(
    getSetting<string>(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_QUICK_ACTIONS),
  );
  lastAvailabilityPersistence = getPersistentBetweenTurnsSetting();

  // Cache the rendered HTML
  cachedContentHTML = buildMonsterPreviewContentHTML(vm, upNext, actor.id, status, context, quickActions);

  // Display in the appropriate mode
  if (isFloating) {
    showFloating();
  } else {
    showInline();
  }
}

function updateUpNext(combat: MonsterPreviewCombat): void {
  const upNext = getMonsterPreviewUpNextData(combat);
  const upNextHTML = buildMonsterPreviewUpNextHTML(upNext);

  // Update in whichever container is active
  const containers = [
    floatingEl?.querySelector(".mp-up-next"),
    document.querySelector("#fth-mp-inline .mp-up-next"),
  ];
  for (const c of containers) {
    if (c) c.innerHTML = upNextHTML;
  }

  // Also update the cached HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = cachedContentHTML;
  const cached = tempDiv.querySelector(".mp-up-next");
  if (cached) {
    cached.innerHTML = upNextHTML;
    cachedContentHTML = tempDiv.innerHTML;
  }
}

/* ── Display Modes ────────────────────────────────────────── */

/** Show the stat block inline in the combat tracker sidebar */
function showInline(): void {
  // Remove floating if it exists
  if (floatingEl) {
    floatingEl.remove();
    floatingEl = null;
  }

  // Try to find and inject into the combat tracker
  const tracker = findCombatTrackerElement();
  if (tracker) {
    injectIntoTracker(tracker);
  }
}

/** Show the stat block as a floating draggable panel */
function showFloating(): void {
  // Remove any inline instance
  document.querySelector("#fth-mp-inline")?.remove();

  if (!floatingEl) {
    floatingEl = document.createElement("div");
    floatingEl.id = "fth-monster-preview";
    floatingEl.className = "fth-monster-preview fth-mp-floating";
    applyFthThemeToNode(floatingEl);
    document.body.appendChild(floatingEl);
    restorePosition();
  }

  floatingEl.innerHTML = isMinimized
    ? buildMonsterPreviewMinimizedPanelHTML(cachedContentHTML, isPinned, getHeaderCue(), headerFlashMessage)
    : buildMonsterPreviewPanelHTML(cachedContentHTML, isPinned, getHeaderCue(), headerFlashMessage);
  floatingEl.classList.toggle("fth-mp-minimized", isMinimized);
  attachFloatingListeners(floatingEl);
  makeDraggable(floatingEl);
  floatingEl.style.display = "";
}

/** Hide the preview from both modes */
function hidePreview(): void {
  if (floatingEl) floatingEl.style.display = "none";
  document.querySelector("#fth-mp-inline")?.remove();
  cachedContentHTML = "";
}

/** Show the preview in whichever mode is active */
function showPreview(): void {
  if (isFloating) {
    if (floatingEl) floatingEl.style.display = "";
  } else {
    showInline();
  }
}

/** Full cleanup on combat end */
function clearPreview(): void {
  clearHeaderFlash();
  if (floatingEl) {
    floatingEl.remove();
    floatingEl = null;
  }
  document.querySelector("#fth-mp-inline")?.remove();
  cachedContentHTML = "";
  currentActorId = null;
  dismissed = false;
}

/* ── Combat Tracker Injection ─────────────────────────────── */

/** Find the combat tracker sidebar element */
function findCombatTrackerElement(): HTMLElement | null {
  return findMonsterPreviewTrackerElement();
}

/** Inject the stat block into the combat tracker sidebar */
function injectIntoTracker(trackerEl: HTMLElement): void {
  injectMonsterPreviewIntoTracker(trackerEl, {
    cachedContentHTML,
    dismissed,
    pinned: isPinned,
    headerCue: getHeaderCue(),
    headerFlash: headerFlashMessage,
    attachInlineListeners,
  });
}

/* ── Inline Mode Listeners ────────────────────────────────── */

function attachInlineListeners(el: HTMLElement): void {
  attachMonsterPreviewInlineListeners(el, {
    onDismiss: () => {
      dismissed = true;
      el.remove();
    },
    onTogglePin: () => {
      isPinned = !isPinned;
      savePinned();
      flashHeaderFeedback(isPinned ? "Pinned" : "Unpinned");
      showInline();
    },
    onPopout: () => {
      isFloating = true;
      saveMode();
      el.remove();
      showFloating();
    },
    onOpenActor: openActorSheet,
    onRunQuickAction: runQuickAction,
  });
}

/* ── Floating Mode Listeners ──────────────────────────────── */

function attachFloatingListeners(el: HTMLElement): void {
  attachMonsterPreviewFloatingListeners(el, {
    onDismiss: () => {
      dismissed = true;
      el.style.display = "none";
    },
    onTogglePin: () => {
      isPinned = !isPinned;
      savePinned();
      flashHeaderFeedback(isPinned ? "Pinned" : "Unpinned");
      showFloating();
    },
    onDock: () => {
      isFloating = false;
      saveMode();
      el.remove();
      floatingEl = null;
      try { localStorage.removeItem(POSITION_KEY); } catch { /* ignore */ }
      flashHeaderFeedback("Docked");
      showInline();
    },
    onResetLayout: () => {
      flashHeaderFeedback("Layout Reset");
      resetFloatingLayout();
    },
    onToggleMinimize: () => {
      isMinimized = !isMinimized;
      saveMinimized();
      showFloating();
    },
    onOpenActor: openActorSheet,
    onRunQuickAction: runQuickAction,
  });
}

/* ── Dragging (floating mode only) ────────────────────────── */

function makeDraggable(el: HTMLElement): void {
  makeMonsterPreviewDraggable(el, savePosition);
}

function savePosition(): void {
  saveMonsterPreviewPosition(floatingEl, POSITION_KEY);
}

function restorePosition(): void {
  restoreMonsterPreviewPosition(floatingEl, POSITION_KEY);
}

function resetFloatingLayout(): void {
  isMinimized = false;
  try {
    localStorage.removeItem(POSITION_KEY);
    localStorage.removeItem(MINIMIZED_KEY);
  } catch {
    /* ignore */
  }

  if (floatingEl) {
    floatingEl.style.left = "";
    floatingEl.style.bottom = "";
    floatingEl.style.right = "320px";
    floatingEl.style.top = "80px";
  }

  showFloating();
}

function saveMode(): void {
  try { localStorage.setItem(MODE_KEY, isFloating ? "floating" : "inline"); } catch { /* ignore */ }
}

function saveMinimized(): void {
  try { localStorage.setItem(MINIMIZED_KEY, isMinimized ? "true" : "false"); } catch { /* ignore */ }
}

function savePinned(): void {
  try { localStorage.setItem(PINNED_KEY, isPinned ? "true" : "false"); } catch { /* ignore */ }
}

function flashHeaderFeedback(message: string): void {
  headerFlashMessage = message;
  if (headerFlashTimeoutId) clearTimeout(headerFlashTimeoutId);
  headerFlashTimeoutId = setTimeout(() => {
    headerFlashMessage = null;
    headerFlashTimeoutId = null;
    if (cachedContentHTML) showPreview();
  }, 1800);
}

function clearHeaderFlash(): void {
  headerFlashMessage = null;
  if (!headerFlashTimeoutId) return;
  clearTimeout(headerFlashTimeoutId);
  headerFlashTimeoutId = null;
}

function getPersistentBetweenTurnsSetting(): boolean {
  return getSetting<boolean>(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_PERSIST_BETWEEN_TURNS) ?? false;
}

function getHeaderCue(): MonsterPreviewHeaderCue {
  if (currentActorId) return null;
  if (isPinned) return "pinned";
  if (lastAvailabilityPersistence) return "persistent";
  return null;
}

function openActorSheet(actorId: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actor = (getGame()?.actors as any)?.get?.(actorId);
  if (!actor?.sheet) return;
  actor.sheet.render(true);
}

function runQuickAction(action: MonsterPreviewQuickAction): void {
  void handleQuickAction(action);
}

async function handleQuickAction(action: MonsterPreviewQuickAction): Promise<void> {
  const actor = getActorById(action.actorId);
  if (!actor) return;

  try {
    switch (action.action) {
      case "open-sheet":
        openActorSheet(action.actorId);
        return;
      case "roll-initiative":
        if (typeof actor.rollInitiativeDialog === "function") {
          await actor.rollInitiativeDialog({});
        } else if (typeof actor.rollInitiative === "function") {
          await actor.rollInitiative({});
        } else {
          Log.warn("Monster Preview: no initiative roll method found on actor");
        }
        return;
      case "roll-skill":
        if (!action.skill) return;
        if (typeof actor.rollSkill === "function") {
          try {
            await actor.rollSkill({ skill: action.skill });
          } catch {
            await actor.rollSkill(action.skill);
          }
        } else {
          Log.warn("Monster Preview: no skill roll method found on actor");
        }
        return;
      case "roll-save":
        if (!action.ability) return;
        if (typeof actor.rollSavingThrow === "function") {
          await actor.rollSavingThrow(action.ability);
        } else if (typeof actor.rollAbilitySave === "function") {
          await actor.rollAbilitySave(action.ability);
        } else {
          Log.warn("Monster Preview: no save roll method found on actor");
        }
        return;
      default:
        Log.warn("Monster Preview: unknown quick action", action.action);
    }
  } catch (err) {
    Log.error("Monster Preview: quick action failed", err);
  }
}

function getActorById(actorId: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getGame()?.actors as any)?.get?.(actorId);
}
