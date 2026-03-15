/**
 * Helper for querying SRD / PHB / DMG compendiums.
 * Used to pull combat action descriptions, weapon mastery text,
 * conditions reference, etc.
 *
 * Fully implemented in Phase 5 – this is the scaffold.
 */

import { Log } from "../../logger";
import { getGame } from "../../types";
import type { FoundryCompendiumCollection, FoundryDocument, FoundryIndexEntry } from "../../types";

interface CompendiumPackLike extends FoundryCompendiumCollection {
  index?: FoundryIndexEntry[];
  getDocument?(id: string): Promise<FoundryDocument | null>;
}

type CompendiumLookupResult = FoundryDocument | null;

/**
 * Query a Foundry compendium pack by collection id and entry name.
 * Returns the document if found, or null.
 */
export async function getCompendiumEntry(
  packId: string,
  entryName: string,
): Promise<CompendiumLookupResult> {
  try {
    const pack = getCompendiumPack(packId);
    if (!pack) {
      Log.debug(`compendium pack not found: ${packId}`);
      return null;
    }
    const index = await ensurePackIndex(pack);
    const entry = findEntryByName(index, entryName);
    if (!entry) {
      Log.debug(`compendium entry not found: ${entryName} in ${packId}`);
      return null;
    }
    return pack.getDocument?.(entry._id) ?? null;
  } catch (err) {
    Log.warn("compendium query failed", { packId, entryName, err });
    return null;
  }
}

/**
 * Bulk-fetch multiple entries from a pack.
 */
export async function getCompendiumEntries(
  packId: string,
  entryNames: string[],
): Promise<Map<string, FoundryDocument>> {
  const results = new Map<string, FoundryDocument>();
  try {
    const pack = getCompendiumPack(packId);
    if (!pack) return results;
    const index = await ensurePackIndex(pack);
    for (const name of entryNames) {
      const entry = findEntryByName(index, name);
      if (entry) {
        const doc = await pack.getDocument?.(entry._id);
        if (doc) results.set(name, doc);
      }
    }
  } catch (err) {
    Log.warn("bulk compendium query failed", { packId, err });
  }
  return results;
}

function getCompendiumPack(packId: string): CompendiumPackLike | undefined {
  const pack = getGame()?.packs?.get?.(packId);
  return isCompendiumPack(pack) ? pack : undefined;
}

function isCompendiumPack(value: unknown): value is CompendiumPackLike {
  return typeof value === "object" && value !== null && typeof (value as FoundryCompendiumCollection).getIndex === "function";
}

async function ensurePackIndex(pack: CompendiumPackLike): Promise<FoundryIndexEntry[]> {
  const index = await pack.getIndex();
  pack.index = Array.isArray(index) ? index : [];
  return pack.index;
}

function findEntryByName(index: FoundryIndexEntry[], entryName: string): FoundryIndexEntry | undefined {
  const normalizedName = entryName.toLowerCase();
  return index.find((entry) => entry.name?.toLowerCase() === normalizedName);
}
