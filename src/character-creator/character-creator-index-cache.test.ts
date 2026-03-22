import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PackSourceConfig, PersistentCompendiumIndexSnapshot } from "./character-creator-types";
import { ensureCharacterCreatorIndexesReady, rebuildCharacterCreatorIndexCache } from "./character-creator-index-cache";

const {
  getIndexedPackCacheMock,
  setIndexedPackCacheMock,
  isGMMock,
  createPackSignatureMock,
  buildPersistentSnapshotMock,
  ensureIndexedSourcesMock,
  hydratePersistentSnapshotMock,
  invalidateMock,
  validatePersistentSnapshotMock,
} = vi.hoisted(() => ({
  getIndexedPackCacheMock: vi.fn<() => PersistentCompendiumIndexSnapshot | null>(() => null),
  setIndexedPackCacheMock: vi.fn(async () => {}),
  isGMMock: vi.fn(() => true),
  createPackSignatureMock: vi.fn(() => "items-signature"),
  buildPersistentSnapshotMock: vi.fn<() => Promise<PersistentCompendiumIndexSnapshot>>(),
  ensureIndexedSourcesMock: vi.fn(async () => {}),
  hydratePersistentSnapshotMock: vi.fn(() => true),
  invalidateMock: vi.fn(),
  validatePersistentSnapshotMock: vi.fn(() => ({ valid: false, reason: "missing" })),
}));

vi.mock("./character-creator-settings-accessors", () => ({
  getIndexedPackCache: getIndexedPackCacheMock,
  setIndexedPackCache: setIndexedPackCacheMock,
}));

vi.mock("../types", () => ({
  getGame: vi.fn(() => ({
    modules: new Map([["foundry-tabletop-helpers", { version: "1.0.0" }]]),
    version: "13.0.0",
    system: { id: "dnd5e", version: "5.3.0" },
  })),
  isGM: isGMMock,
}));

vi.mock("./data/compendium-indexer", () => ({
  compendiumIndexer: {
    createPackSignature: createPackSignatureMock,
    buildPersistentSnapshot: buildPersistentSnapshotMock,
    ensureIndexedSources: ensureIndexedSourcesMock,
    hydratePersistentSnapshot: hydratePersistentSnapshotMock,
    invalidate: invalidateMock,
    validatePersistentSnapshot: validatePersistentSnapshotMock,
  },
}));

function makeSources(): PackSourceConfig {
  return {
    classes: ["dnd-players-handbook.classes"],
    subclasses: [],
    races: [],
    backgrounds: [],
    feats: [],
    spells: [],
    items: ["dnd-players-handbook.equipment"],
  };
}

describe("character-creator-index-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIndexedPackCacheMock.mockReturnValue(null);
    isGMMock.mockReturnValue(true);
    createPackSignatureMock.mockReturnValue("all-sources-signature");
    buildPersistentSnapshotMock.mockImplementation(async () => ({
      formatVersion: 2,
      moduleVersion: "1.0.0",
      foundryVersion: "13.0.0",
      systemId: "dnd5e",
      systemVersion: "5.3.0",
      packSignature: "all-sources-signature",
      generatedAt: "2026-03-22T12:00:00.000Z",
      packs: {
        "dnd-players-handbook.equipment": [],
      },
    }));
  });

  it("deduplicates concurrent rebuilds for the same source signature", async () => {
    let resolveSnapshot!: (snapshot: PersistentCompendiumIndexSnapshot) => void;
    const pendingSnapshot = new Promise<PersistentCompendiumIndexSnapshot>((resolve) => {
      resolveSnapshot = resolve;
    });
    buildPersistentSnapshotMock.mockReturnValueOnce(pendingSnapshot);

    const sources = makeSources();
    const rebuildA = rebuildCharacterCreatorIndexCache(sources);
    const rebuildB = rebuildCharacterCreatorIndexCache(sources);

    expect(buildPersistentSnapshotMock).toHaveBeenCalledTimes(1);
    expect(invalidateMock).toHaveBeenCalledTimes(1);

    resolveSnapshot({
      formatVersion: 2,
      moduleVersion: "1.0.0",
      foundryVersion: "13.0.0",
      systemId: "dnd5e",
      systemVersion: "5.3.0",
      packSignature: "all-sources-signature",
      generatedAt: "2026-03-22T12:00:00.000Z",
      packs: {
        "dnd-players-handbook.equipment": [],
      },
    });

    await Promise.all([rebuildA, rebuildB]);

    expect(setIndexedPackCacheMock).toHaveBeenCalledTimes(1);
    expect(hydratePersistentSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("persists a missing cache during ensure and only rebuilds once across concurrent callers", async () => {
    let resolveSnapshot!: (snapshot: PersistentCompendiumIndexSnapshot) => void;
    const pendingSnapshot = new Promise<PersistentCompendiumIndexSnapshot>((resolve) => {
      resolveSnapshot = resolve;
    });
    buildPersistentSnapshotMock.mockReturnValueOnce(pendingSnapshot);

    const sources = makeSources();
    const ensureA = ensureCharacterCreatorIndexesReady(sources, { contentKeys: ["items"], persistIfMissing: true });
    const ensureB = ensureCharacterCreatorIndexesReady(sources, { contentKeys: ["items"], persistIfMissing: true });

    expect(ensureIndexedSourcesMock).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    expect(buildPersistentSnapshotMock).toHaveBeenCalledTimes(1);

    resolveSnapshot({
      formatVersion: 2,
      moduleVersion: "1.0.0",
      foundryVersion: "13.0.0",
      systemId: "dnd5e",
      systemVersion: "5.3.0",
      packSignature: "all-sources-signature",
      generatedAt: "2026-03-22T12:00:00.000Z",
      packs: {
        "dnd-players-handbook.equipment": [],
      },
    });

    await Promise.all([ensureA, ensureB]);

    expect(validatePersistentSnapshotMock).toHaveBeenCalledWith(null, sources, {
      contentKeys: ["items"],
      persistIfMissing: true,
    });
    expect(setIndexedPackCacheMock).toHaveBeenCalledTimes(1);
    expect(hydratePersistentSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("skips rebuild when the requested content-key slice is already valid", async () => {
    const sources = makeSources();
    const snapshot = {
      formatVersion: 2,
      moduleVersion: "1.0.0",
      foundryVersion: "13.0.0",
      systemId: "dnd5e",
      systemVersion: "5.3.0",
      packSignature: "items-signature",
      generatedAt: "2026-03-22T12:00:00.000Z",
      packs: {
        "dnd-players-handbook.equipment": [],
      },
    } satisfies PersistentCompendiumIndexSnapshot;

    getIndexedPackCacheMock.mockReturnValue(snapshot);
    validatePersistentSnapshotMock.mockReturnValue({ valid: true, reason: "ready" });

    await ensureCharacterCreatorIndexesReady(sources, { contentKeys: ["items"], persistIfMissing: true });

    expect(validatePersistentSnapshotMock).toHaveBeenCalledWith(snapshot, sources, {
      contentKeys: ["items"],
      persistIfMissing: true,
    });
    expect(buildPersistentSnapshotMock).not.toHaveBeenCalled();
    expect(setIndexedPackCacheMock).not.toHaveBeenCalled();
  });
});
