/**
 * LPCS Auto-Open logic.
 *
 * When the `lpcsAutoOpen` setting is enabled and the user has an assigned
 * character in a dnd5e world, automatically opens the LPCS sheet on ready.
 * GMs are excluded — they typically manage multiple actors and do not need
 * an auto-open behavior.
 *
 * Called from Hooks.once("ready") in src/index.ts.
 */

import { Log } from "../logger";
import { isDnd5eWorld, isGM, getGame } from "../types";
import { lpcsEnabled, lpcsAutoOpen } from "./lpcs-settings";
import { isKioskPlayer } from "../settings";

interface LpcsSheetLike {
  render(options?: { force?: boolean }): void;
}

interface LpcsCharacterLike {
  name?: string;
  sheet?: LpcsSheetLike;
}

/**
 * Attempt to auto-open the LPCS sheet for the current user's assigned character.
 *
 * Guards (in order):
 *   1. Feature must be enabled (lpcsEnabled)
 *   2. Auto-open setting must be on (lpcsAutoOpen)
 *   3. World must be dnd5e
 *   4. Current user must NOT be GM
 *   5. User must have an assigned character
 */
export function autoOpenLPCS(): void {
  const skipReason = getAutoOpenSkipReason();
  if (skipReason) {
    Log.debug(skipReason);
    return;
  }

  const character = getAssignedCharacter();
  if (!character) {
    Log.debug("LPCS auto-open: no assigned character");
    return;
  }

  try {
    character.sheet?.render({ force: true });
    Log.info("LPCS auto-open: opened sheet for", character.name);
  } catch (err) {
    Log.warn("LPCS auto-open: failed to open sheet", err);
  }
}

function getAutoOpenSkipReason(): string | null {
  if (!lpcsEnabled()) return "LPCS auto-open: feature disabled";
  if (!lpcsAutoOpen()) return "LPCS auto-open: setting disabled";
  if (!isDnd5eWorld()) return "LPCS auto-open: not a dnd5e world";
  if (isGM()) return "LPCS auto-open: skipped for GM";
  if (isKioskPlayer()) return "LPCS auto-open: skipped for kiosk player (kiosk handles sheet)";
  return null;
}

function getAssignedCharacter(): LpcsCharacterLike | null {
  const user = getGame()?.user;
  if (!user || typeof user !== "object" || !("character" in user)) return null;
  const character = (user as { character?: unknown }).character;
  if (!character || typeof character !== "object") return null;
  return character as LpcsCharacterLike;
}

export const __lpcsAutoOpenInternals = {
  getAutoOpenSkipReason,
  getAssignedCharacter,
};
