/**
 * Character Creator — Spell List Resolver
 *
 * Resolves which spells are available to a class by querying
 * the dnd5e system's spell list API at runtime.
 *
 * Tries multiple API patterns (dnd5e has evolved across versions)
 * and falls back gracefully when no spell list can be determined.
 */

import { Log } from "../../logger";

interface SpellEntryLike {
  uuid?: string;
}

interface SpellListResultShape {
  spells?: Array<string | SpellEntryLike>;
  entries?: Array<string | SpellEntryLike>;
  uuids?: Set<string> | string[];
}

interface SpellListMethodCollection {
  forClass?(classIdentifier: string): Promise<unknown> | unknown;
  getListForClass?(classIdentifier: string): Promise<unknown> | unknown;
  get?(classIdentifier: string): Promise<unknown> | unknown;
  forType?(type: string, identifier?: string): Promise<unknown> | unknown;
}

interface Dnd5eRegistryLike {
  spellLists?: SpellListMethodCollection;
}

interface Dnd5eGlobalLike {
  registry?: Dnd5eRegistryLike;
}

/**
 * Attempt to resolve the set of spell UUIDs available to a class.
 *
 * Tries the following approaches in order:
 * 1. `dnd5e.registry.spellLists` — dnd5e 5.x registry API
 * 2. Walk the class document's `SpellList` advancement for a list reference
 *
 * Returns null if no spell list can be determined (caller should fall back
 * to showing all spells).
 */
export async function resolveClassSpellUuids(
  classIdentifier: string,
): Promise<Set<string> | null> {
  // Method 1: dnd5e.registry.spellLists API
  const fromRegistry = await tryRegistryLookup(classIdentifier);
  if (fromRegistry) return fromRegistry;

  return null;
}

/* ── Method 1: dnd5e Registry ────────────────────────────── */

async function tryRegistryLookup(classIdentifier: string): Promise<Set<string> | null> {
  try {
    const dnd5e = getDnd5eGlobal();
    if (!dnd5e?.registry) return null;

    const registry = dnd5e.registry;

    // dnd5e variants expose spellLists as either:
    // - a registry object with forClass/get helpers
    // - a class with static forType("class", identifier)
    if (registry.spellLists) {
      const spellLists = registry.spellLists;

      if (typeof spellLists.forType === "function") {
        const result = await spellLists.forType("class", classIdentifier);
        const uuids = extractUuidsFromResult(result);
        if (uuids) {
          Log.debug("Spell list resolved via registry.spellLists.forType()", {
            classIdentifier,
            count: uuids.size,
          });
          return uuids;
        }
      }

      // Try known API method names
      for (const method of ["forClass", "getListForClass", "get"] as const) {
        const lookup = spellLists[method];
        if (typeof lookup === "function") {
          const result = await lookup(classIdentifier);
          const uuids = extractUuidsFromResult(result);
          if (uuids) {
            Log.debug(`Spell list resolved via registry.spellLists.${method}()`, {
              classIdentifier,
              count: uuids.size,
            });
            return uuids;
          }
        }
      }

      // Try direct map access
      if (typeof spellLists.get === "function") {
        const result = spellLists.get(classIdentifier);
        const uuids = extractUuidsFromResult(result);
        if (uuids) {
          Log.debug("Spell list resolved via registry.spellLists.get()", {
            classIdentifier,
            count: uuids.size,
          });
          return uuids;
        }
      }
    }
  } catch (err) {
    Log.debug("Spell list registry lookup failed:", err);
  }

  return null;
}

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Extract a Set of UUID strings from various possible spell list result shapes.
 */
function extractUuidsFromResult(result: unknown): Set<string> | null {
  if (!result) return null;

  if (hasUuidSet(result)) {
    const uuids = normalizeUuidValues(result.uuids);
    return uuids.size > 0 ? uuids : null;
  }

  // Shape: { spells: string[] } or { spells: [{ uuid: string }] }
  if (hasSpellArray(result, "spells")) {
    const uuids = normalizeUuidValues(result.spells.map(getSpellUuid).filter(isNonEmptyString));
    return uuids.size > 0 ? uuids : null;
  }

  // Shape: { entries: string[] } or { entries: [{ uuid: string }] }
  if (hasSpellArray(result, "entries")) {
    const uuids = normalizeUuidValues(result.entries.map(getSpellUuid).filter(isNonEmptyString));
    return uuids.size > 0 ? uuids : null;
  }

  // Shape: Set<string> or Array<string> directly
  if (result instanceof Set) {
    const uuids = normalizeUuidValues(result);
    return uuids.size > 0 ? uuids : null;
  }
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === "string") {
    const uuids = normalizeUuidValues(result);
    return uuids.size > 0 ? uuids : null;
  }

  return null;
}

function getDnd5eGlobal(): Dnd5eGlobalLike | undefined {
  const g = globalThis as Record<string, unknown>;
  const dnd5e = g.dnd5e;
  if (!dnd5e || typeof dnd5e !== "object") return undefined;
  return dnd5e as Dnd5eGlobalLike;
}

function hasSpellArray<K extends keyof SpellListResultShape>(
  result: unknown,
  key: K,
): result is Required<Pick<SpellListResultShape, K>> {
  return typeof result === "object" && result !== null && Array.isArray((result as SpellListResultShape)[key]);
}

function hasUuidSet(result: unknown): result is Required<Pick<SpellListResultShape, "uuids">> {
  const uuids = typeof result === "object" && result !== null
    ? (result as SpellListResultShape).uuids
    : null;
  return uuids instanceof Set || Array.isArray(uuids);
}

function getSpellUuid(entry: string | SpellEntryLike): string | undefined {
  return typeof entry === "string" ? entry : entry.uuid;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function normalizeUuidValues(values: Iterable<unknown>): Set<string> {
  return new Set(Array.from(values).filter(isNonEmptyString));
}
