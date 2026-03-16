/**
 * Batch Initiative — Advantage Dialog + Roll Caching
 *
 * Provides a compact 3-button advantage/disadvantage/normal dialog and
 * D20Roll caching helpers used by the Combat prototype wrappers in
 * combat-init.ts.
 *
 * Architecture:
 * - Combat.prototype.rollAll / rollNPC / rollPC are wrapped in combat-init.ts
 * - Wrapper calls showAdvantageDialog() to get the chosen mode
 * - Then calls cacheRollsOnCombatants() to pre-cache D20Rolls with that mode
 * - Then delegates to the original Combat method
 * - The cached rolls are picked up by actor.getInitiativeRoll()
 *
 * This module also exports rollPC() — a new method added to Combat.prototype
 * that rolls initiative for player-owned combatants only.
 */

import { Log } from "../../logger";
import { getConfig, isObject } from "../../types";
import { ADV_MODE, type AdvMode } from "../combat-types";

interface DialogRenderable {
  render(force: boolean): void;
}

interface DialogClassLike {
  new (data: Record<string, unknown>, options?: Record<string, unknown>): DialogRenderable;
}

interface DiceConstructorsLike {
  D20Roll?: new (formula: string, data: unknown, options: unknown) => unknown;
  BasicRoll?: new (formula: string, data: unknown, options: unknown) => unknown;
}

interface InitiativeActorLike extends Record<string, unknown> {
  getInitiativeRollConfig?(): Record<string, unknown>;
  _cachedInitiativeRoll?: unknown;
}

interface InitiativeCombatantLike extends Record<string, unknown> {
  initiative?: number | null;
  actor?: InitiativeActorLike;
}

interface CombatantCollectionLike {
  forEach?(callback: (combatant: InitiativeCombatantLike) => void): void;
  [Symbol.iterator]?(): Iterator<InitiativeCombatantLike>;
}

interface CombatLike extends Record<string, unknown> {
  combatants?: CombatantCollectionLike;
}

/* ── Advantage Dialog ─────────────────────────────────────── */

/**
 * Show a compact 3-button advantage dialog.
 * Returns the chosen AdvMode, or null if cancelled.
 *
 * @param scopeLabel  Description shown in the dialog (e.g. "Rolling for all combatants")
 */
export function showAdvantageDialog(scopeLabel: string): Promise<AdvMode | null> {
  return new Promise<AdvMode | null>((resolve) => {
    const DialogClass = getDialogClass();

    if (!DialogClass) {
      Log.warn("Advantage Dialog: Dialog class not available");
      resolve(null);
      return;
    }

    let resolved = false;
    const once = (value: AdvMode | null) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    const content = `<p class="batch-init-scope">${escapeHtml(scopeLabel)}</p>`;

    new DialogClass(
      {
        title: "Roll Initiative",
        content,
        buttons: {
          disadvantage: {
            icon: '<i class="fa-solid fa-angles-down"></i>',
            label: "Disadvantage",
            callback: () => once(ADV_MODE.DISADVANTAGE),
          },
          normal: {
            icon: '<i class="fa-solid fa-dice-d20"></i>',
            label: "Normal",
            callback: () => once(ADV_MODE.NORMAL),
          },
          advantage: {
            icon: '<i class="fa-solid fa-angles-up"></i>',
            label: "Advantage",
            callback: () => once(ADV_MODE.ADVANTAGE),
          },
        },
        default: "normal",
        close: () => once(null),
      },
      { classes: ["batch-initiative-dialog"], width: 320 }
    ).render(true);
  });
}

/* ── D20Roll Caching ──────────────────────────────────────── */

/**
 * Cache a D20Roll with the chosen advantage mode on each target combatant's
 * actor, so that when combat.rollInitiative() internally calls
 * actor.getInitiativeRoll(), the cached roll is used.
 *
 * This follows the same pattern as src/initiative/initiative-dialog.ts.
 *
 * @param combat    The active Combat document
 * @param filter    Predicate to select which combatants to cache for.
 *                  If omitted, caches for ALL combatants without initiative.
 * @param advMode   The advantage mode to apply
 */
export function cacheRollsOnCombatants(
  combat: CombatLike,
  advMode: AdvMode,
  filter?: (combatant: InitiativeCombatantLike) => boolean
): void {
  const rawDice = getConfig()?.Dice;
  const Dice = isDiceConstructorsLike(rawDice) ? rawDice : undefined;
  const D20Roll = Dice?.D20Roll;

  if (!D20Roll) {
    Log.warn("Batch Initiative: CONFIG.Dice.D20Roll not available");
    return;
  }

  const combatants = combat.combatants;
  if (!combatants) return;

  // Iterate via forEach (Foundry collections support it)
  const forEachCombatant = combatants.forEach;
  const iterate = typeof forEachCombatant === "function"
    ? (cb: (c: InitiativeCombatantLike) => void) => forEachCombatant.call(combatants, cb)
    : (cb: (c: Record<string, unknown>) => void) => {
        for (const c of iterateCombatants(combatants)) cb(c);
      };

  iterate((c: InitiativeCombatantLike) => {
    // Skip combatants that already have initiative (unless we want to re-roll)
    if (c.initiative !== null && c.initiative !== undefined) return;

    // Apply filter if provided
    if (filter && !filter(c)) return;

    const actor = c.actor;
    if (!actor) return;

    // Get the initiative roll config from the actor
    const getConfigFn = actor.getInitiativeRollConfig;
    let rollConfig: Record<string, unknown> | undefined;

    if (typeof getConfigFn === "function") {
      try {
        rollConfig = getConfigFn.call(actor) as Record<string, unknown>;
      } catch {
        // Fallback: build manually
      }
    }

    // Build the D20Roll with advantage mode
    const parts =
      rollConfig && Array.isArray(rollConfig.parts)
        ? (rollConfig.parts as string[])
        : [];
    const data = rollConfig?.data ?? {};
    const options: Record<string, unknown> = isObject(rollConfig?.options)
      ? { ...(rollConfig!.options as Record<string, unknown>) }
      : {};
    options.advantageMode = advMode;

    // Check for fixed initiative (NPC score mode in dnd5e settings)
    if (options.fixed !== undefined) {
      const BasicRoll = Dice?.BasicRoll;
      if (BasicRoll) {
        actor._cachedInitiativeRoll = new BasicRoll(
          String(options.fixed),
          data,
          options
        );
      }
    } else {
      const formula = ["1d20"].concat(parts).join(" + ");
      actor._cachedInitiativeRoll = new D20Roll(formula, data, options);
    }
  });
}

/**
 * Clean up cached initiative rolls on all combatant actors.
 * Called in a `finally` block after rolling to prevent stale caches.
 */
export function cleanupCachedRolls(combat: CombatLike): void {
  const combatants = combat.combatants;
  if (!combatants) return;

  const cleanup = (c: InitiativeCombatantLike) => {
    const actor = c.actor;
    if (actor) {
      delete actor._cachedInitiativeRoll;
    }
  };

  if (typeof combatants.forEach === "function") {
    combatants.forEach(cleanup);
  } else {
    for (const c of iterateCombatants(combatants)) cleanup(c);
  }
}

/* ── Helpers ──────────────────────────────────────────────── */

/** Minimal HTML escaping for display strings. */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getDialogClass(): DialogClassLike | undefined {
  const dialog = (globalThis as Record<string, unknown>).Dialog;
  return typeof dialog === "function" ? (dialog as DialogClassLike) : undefined;
}

function isDiceConstructorsLike(value: unknown): value is DiceConstructorsLike {
  return isObject(value);
}

function* iterateCombatants(collection: CombatantCollectionLike): Iterable<InitiativeCombatantLike> {
  if (typeof collection[Symbol.iterator] === "function") {
    yield* collection as Iterable<InitiativeCombatantLike>;
  }
}
