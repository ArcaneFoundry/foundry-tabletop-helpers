import { Log } from "../logger";
import { getGame, isGM } from "../types";
import type {
  PackSourceConfig,
  PersistentCompendiumIndexSnapshot,
  PersistentCompendiumIndexStatus,
} from "./character-creator-types";
import { getIndexedPackCache, setIndexedPackCache } from "./character-creator-settings-accessors";
import { compendiumIndexer } from "./data/compendium-indexer";

const rebuildPromises = new Map<string, Promise<PersistentCompendiumIndexSnapshot>>();

type IndexReadyOptions = {
  contentKeys?: Array<keyof PackSourceConfig>;
  persistIfMissing?: boolean;
};

export function getCharacterCreatorIndexStatus(sources: PackSourceConfig): PersistentCompendiumIndexStatus {
  const snapshot = getIndexedPackCache();
  if (!snapshot) {
    return {
      state: "missing",
      label: "Not indexed",
      detail: "Build the cache once to avoid first-load delays in compendium-backed character creation steps.",
      packCount: 0,
    };
  }

  const validation = compendiumIndexer.validatePersistentSnapshot(snapshot, sources);
  const packCount = Object.keys(snapshot.packs ?? {}).length;
  if (!validation.valid) {
    return {
      state: "stale",
      label: "Out of date",
      detail: validation.reason,
      generatedAt: snapshot.generatedAt,
      packCount,
    };
  }

  return {
    state: "ready",
    label: "Indexed",
    detail: `${packCount} pack${packCount === 1 ? "" : "s"} cached for the current Character Creator sources.`,
    generatedAt: snapshot.generatedAt,
    packCount,
  };
}

export function hydrateCharacterCreatorIndexesFromSettings(sources: PackSourceConfig): boolean {
  const snapshot = getIndexedPackCache();
  if (!snapshot) return false;
  return compendiumIndexer.hydratePersistentSnapshot(snapshot, sources);
}

export async function rebuildCharacterCreatorIndexCache(
  sources: PackSourceConfig,
  options?: { contentKeys?: Array<keyof PackSourceConfig> },
): Promise<PersistentCompendiumIndexSnapshot> {
  const rebuildKey = compendiumIndexer.createPackSignature(sources, options);
  const existingPromise = rebuildPromises.get(rebuildKey);
  if (existingPromise) {
    Log.info("Character Creator: awaiting in-flight compendium cache rebuild", {
      rebuildKey,
    });
    return existingPromise;
  }

  const rebuildPromise = (async () => {
    compendiumIndexer.invalidate();
    const snapshot = await compendiumIndexer.buildPersistentSnapshot(sources, options);
    await setIndexedPackCache(snapshot);
    compendiumIndexer.hydratePersistentSnapshot(snapshot, sources, options);
    Log.info("Character Creator: persistent compendium cache rebuilt", {
      packCount: Object.keys(snapshot.packs).length,
      generatedAt: snapshot.generatedAt,
    });
    return snapshot;
  })();

  rebuildPromises.set(rebuildKey, rebuildPromise);

  try {
    return await rebuildPromise;
  } finally {
    rebuildPromises.delete(rebuildKey);
  }
}

export async function ensureCharacterCreatorIndexesReady(
  sources: PackSourceConfig,
  options?: IndexReadyOptions,
): Promise<void> {
  hydrateCharacterCreatorIndexesFromSettings(sources);
  await compendiumIndexer.ensureIndexedSources(sources, options);

  if (!options?.persistIfMissing || !isGM()) return;

  const snapshot = getIndexedPackCache();
  const validation = compendiumIndexer.validatePersistentSnapshot(snapshot, sources, options);
  if (validation.valid) return;

  try {
    await rebuildCharacterCreatorIndexCache(sources, options);
  } catch (error) {
    Log.warn("Character Creator: failed to persist rebuilt compendium cache during fallback", error);
  }
}

export function getCharacterCreatorCacheEnvironment(): {
  moduleVersion: string;
  foundryVersion: string;
  systemId: string;
  systemVersion: string;
} {
  const game = getGame();
  const moduleVersion = game?.modules?.get("foundry-tabletop-helpers")?.version ?? "0.0.0";
  return {
    moduleVersion,
    foundryVersion: game?.version ?? "0.0.0",
    systemId: game?.system?.id ?? "unknown",
    systemVersion: game?.system?.version ?? "0.0.0",
  };
}
