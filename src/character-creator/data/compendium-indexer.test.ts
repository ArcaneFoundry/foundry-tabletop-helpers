import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PackSourceConfig } from "../character-creator-types";

const logDebugMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();
const logErrorMock = vi.fn();
const getGameMock = vi.fn();
const fromUuidMock = vi.fn();

vi.mock("../../logger", () => ({
  Log: {
    debug: logDebugMock,
    info: logInfoMock,
    warn: logWarnMock,
    error: logErrorMock,
  },
}));

vi.mock("../../types", () => ({
  getGame: getGameMock,
  fromUuid: fromUuidMock,
}));

function defaultSources(): PackSourceConfig {
  return {
    classes: ["pack.classes"],
    subclasses: [],
    races: [],
    backgrounds: [],
    feats: [],
    spells: ["pack.spells"],
    items: ["pack.items"],
  };
}

function createPack(
  entries: Array<Record<string, unknown>>,
  metadata: { label?: string; name?: string } = { label: "Test Pack" },
) {
  return {
    metadata,
    getIndex: vi.fn(async () => entries),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  getGameMock.mockReset();
  fromUuidMock.mockReset();
  delete (globalThis as Record<string, unknown>).TextEditor;
  delete (globalThis as Record<string, unknown>).foundry;
});

describe("compendium indexer", () => {
  it("loads and normalizes pack entries, skipping unnamed rows", async () => {
    const classPack = createPack([
      {
        _id: "class-1",
        name: "Wizard",
        img: "wizard.png",
        type: "class",
        "system.identifier": "wizard",
      },
      {
        _id: "class-2",
        type: "class",
      },
    ], { label: "Classes" });

    getGameMock.mockReturnValue({
      packs: new Map([["pack.classes", classPack]]),
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    const entries = await indexer.loadPack("pack.classes", "class");

    expect(entries).toEqual([
      {
        uuid: "Compendium.pack.classes.Item.class-1",
        name: "Wizard",
        img: "wizard.png",
        packId: "pack.classes",
        packLabel: "Classes",
        type: "class",
        itemType: "class",
        identifier: "wizard",
      },
    ]);
  });

  it("filters indexed entries by accepted dnd5e item types across configured sources", async () => {
    const itemPack = createPack([
      { _id: "weapon-1", name: "Longsword", type: "weapon" },
      { _id: "feat-1", name: "Alert", type: "feat" },
    ], { label: "Items" });
    const spellPack = createPack([
      { _id: "spell-1", name: "Magic Missile", type: "spell", "system.level": 1 },
      { _id: "feat-2", name: "Not a Spell", type: "feat" },
    ], { label: "Spells" });

    getGameMock.mockReturnValue({
      packs: new Map([
        ["pack.items", itemPack],
        ["pack.spells", spellPack],
      ]),
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    await indexer.loadPacks(defaultSources());

    expect(indexer.getIndexedEntries("item", defaultSources()).map((entry) => entry.name)).toEqual(["Longsword"]);
    expect(indexer.getIndexedEntries("spell", defaultSources()).map((entry) => entry.name)).toEqual(["Magic Missile"]);
    expect(indexer.getAllIndexedEntries()).toHaveLength(4);
  });

  it("normalizes feat prerequisite and category metadata from index fields", async () => {
    const featPack = createPack([
      {
        _id: "feat-1",
        name: "Magic Initiate",
        img: "feat.png",
        type: "feat",
        "system.prerequisites.level": null,
        "system.type.subtype": "origin",
      },
    ], { label: "Feats" });

    getGameMock.mockReturnValue({
      packs: new Map([["pack.feats", featPack]]),
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    await indexer.loadPack("pack.feats", "feat");

    expect(indexer.getAllIndexedEntries()).toEqual([
      expect.objectContaining({
        name: "Magic Initiate",
        featCategory: "origin",
        prerequisiteLevel: null,
      }),
    ]);
  });

  it("caches fetched documents and enriches cached descriptions through the namespaced TextEditor implementation", async () => {
    fromUuidMock.mockResolvedValue({
      id: "uuid-1",
      system: {
        description: {
          value: "Feat: @UUID[Compendium.foo]{Magic Initiate}\nEquipment: [[/award 13GP]]\nUses: [[lookup @prof]]",
        },
      },
    });
    const enrichHTMLMock = vi.fn(async (html: string) => html);
    (globalThis as Record<string, unknown>).foundry = {
      applications: {
        ux: {
          TextEditor: {
            implementation: {
              enrichHTML: enrichHTMLMock,
            },
          },
        },
      },
    };

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();

    const first = await indexer.fetchDocument("Compendium.foo.bar");
    const second = await indexer.fetchDocument("Compendium.foo.bar");
    const description = await indexer.getCachedDescription("Compendium.foo.bar");

    expect(first).toBe(second);
    expect(fromUuidMock).toHaveBeenCalledTimes(1);
    expect(enrichHTMLMock).toHaveBeenCalledTimes(1);
    expect(description).toBe(
      "<p><strong class=\"cc-card-detail__fact-label\">Feat:</strong> Magic Initiate</p>"
      + "<p><strong class=\"cc-card-detail__fact-label\">Equipment:</strong> 13 GP</p>"
      + "<p><strong class=\"cc-card-detail__fact-label\">Uses:</strong> your proficiency bonus</p>"
    );
  });

  it("falls back safely for missing packs, raw descriptions, and invalidate", async () => {
    fromUuidMock.mockResolvedValue({
      id: "uuid-2",
      system: {
        description: {
          value: "<p>Raw description</p>",
        },
      },
    });
    getGameMock.mockReturnValue({
      packs: new Map(),
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();

    await expect(indexer.loadPack("missing.pack", "feat")).resolves.toEqual([]);
    await indexer.fetchDocument("Compendium.foo.raw");
    await expect(indexer.getCachedDescription("Compendium.foo.raw")).resolves.toBe("<p>Raw description</p>");

    indexer.invalidate();
    await indexer.fetchDocument("Compendium.foo.raw");

    expect(logWarnMock).toHaveBeenCalledWith('CompendiumIndexer: pack "missing.pack" not found');
    expect(logDebugMock).toHaveBeenCalledWith("CompendiumIndexer: cache invalidated");
    expect(fromUuidMock).toHaveBeenCalledTimes(2);
  });

  it("builds and hydrates a persistent snapshot when the environment matches", async () => {
    const itemPack = createPack([
      {
        _id: "weapon-1",
        name: "Longsword",
        img: "longsword.webp",
        type: "weapon",
        "system.identifier": "longsword",
        "system.weaponType": "martialM",
        "system.ammunition.type": "arrow",
        "system.mastery": "sap",
        "system.rarity": "mundane",
        "system.properties": ["ver"],
      },
    ], { label: "Items" });

    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map([["pack.items", itemPack]]),
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    const snapshot = await indexer.buildPersistentSnapshot(defaultSources(), { contentKeys: ["items"] });

    expect(snapshot.packSignature).toBe(JSON.stringify({ items: ["pack.items"] }));
    expect(snapshot.packs["pack.items"]).toEqual([
      expect.objectContaining({
        name: "Longsword",
        identifier: "longsword",
        weaponType: "martialM",
        mastery: "sap",
        isFirearm: false,
      }),
    ]);

    indexer.invalidate();
    expect(indexer.hydratePersistentSnapshot(snapshot, defaultSources(), { contentKeys: ["items"] })).toBe(true);
    expect(indexer.getIndexedEntries("item", defaultSources()).map((entry) => entry.name)).toEqual(["Longsword"]);
  });

  it("keeps source warm-up index-only by default so it does not fetch weapon documents in the click path", async () => {
    const itemPack = createPack([
      {
        _id: "weapon-1",
        name: "Longsword",
        img: "longsword.webp",
        type: "weapon",
      },
    ], { label: "Items" });

    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map([["pack.items", itemPack]]),
    });
    fromUuidMock.mockResolvedValue({
      system: {
        identifier: "longsword",
        weaponType: "martialM",
        ammunition: { type: "arrow" },
        mastery: "sap",
        properties: { ver: true },
      },
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();

    await indexer.ensureIndexedSources(defaultSources(), { contentKeys: ["items"] });

    expect(indexer.getIndexedEntries("item", defaultSources())).toEqual([
      expect.objectContaining({
        name: "Longsword",
      }),
    ]);
    expect(indexer.getIndexedEntries("item", defaultSources())[0]).not.toHaveProperty("mastery");
    expect(fromUuidMock).not.toHaveBeenCalled();
  });

  it("can explicitly enrich in-session item indexes with weapon mastery metadata when requested", async () => {
    const itemPack = createPack([
      {
        _id: "weapon-1",
        name: "Longsword",
        img: "longsword.webp",
        type: "weapon",
      },
    ], { label: "Items" });

    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map([["pack.items", itemPack]]),
    });
    fromUuidMock.mockResolvedValue({
      system: {
        identifier: "longsword",
        weaponType: "martialM",
        ammunition: { type: "arrow" },
        mastery: "sap",
        properties: { ver: true },
      },
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();

    await indexer.ensureIndexedSources(defaultSources(), { contentKeys: ["items"], enrichWeaponMetadata: true });

    expect(indexer.getIndexedEntries("item", defaultSources())).toEqual([
      expect.objectContaining({
        name: "Longsword",
        identifier: "longsword",
        weaponType: "martialM",
        mastery: "sap",
        isFirearm: false,
        properties: ["ver"],
        baselineWeapon: true,
      }),
    ]);
    expect(fromUuidMock).toHaveBeenCalledWith("Compendium.pack.items.Item.weapon-1");
  });

  it("can explicitly enrich in-session background indexes with origin feat metadata without fetching feat display docs", async () => {
    const backgroundPack = createPack([
      {
        _id: "background-1",
        name: "Sage",
        img: "sage.webp",
        type: "background",
      },
    ], { label: "Backgrounds" });

    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map([["pack.backgrounds", backgroundPack]]),
    });
    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.pack.backgrounds.Item.background-1") {
        return {
          system: {
            advancement: [
              {
                type: "ItemGrant",
                title: "Origin Feat",
                configuration: {
                  items: [{ uuid: "Compendium.pack.feats.Item.feat-1" }],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();

    await indexer.ensureIndexedSources({
      ...defaultSources(),
      backgrounds: ["pack.backgrounds"],
    }, {
      contentKeys: ["backgrounds"],
      enrichOriginFeatMetadata: true,
    });

    expect(indexer.getIndexedEntries("background", {
      ...defaultSources(),
      backgrounds: ["pack.backgrounds"],
    })).toEqual([
      expect.objectContaining({
        name: "Sage",
        grantsOriginFeatUuid: "Compendium.pack.feats.Item.feat-1",
      }),
    ]);
    expect(fromUuidMock).toHaveBeenCalledTimes(1);
    expect(fromUuidMock).toHaveBeenCalledWith("Compendium.pack.backgrounds.Item.background-1");
  });

  it("enriches persistent item snapshots with weapon mastery metadata from full documents", async () => {
    const itemPack = createPack([
      {
        _id: "weapon-1",
        name: "Longsword",
        img: "longsword.webp",
        type: "weapon",
      },
    ], { label: "Items" });

    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map([["pack.items", itemPack]]),
    });
    fromUuidMock.mockResolvedValue({
      system: {
        identifier: "longsword",
        weaponType: "martialM",
        ammunition: { type: "arrow" },
        mastery: "sap",
        properties: { ver: true },
      },
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    const snapshot = await indexer.buildPersistentSnapshot(defaultSources(), { contentKeys: ["items"] });

    expect(snapshot.packs["pack.items"]).toEqual([
      expect.objectContaining({
        name: "Longsword",
        identifier: "longsword",
        weaponType: "martialM",
        mastery: "sap",
        isFirearm: false,
        properties: ["ver"],
        baselineWeapon: true,
      }),
    ]);
    expect(fromUuidMock).toHaveBeenCalledWith("Compendium.pack.items.Item.weapon-1");
  });

  it("persists and hydrates origin feat metadata in background and feat snapshots", async () => {
    const backgroundPack = createPack([
      {
        _id: "background-1",
        name: "Criminal",
        img: "criminal.webp",
        type: "background",
      },
    ], { label: "Backgrounds" });
    const featPack = createPack([
      {
        _id: "feat-1",
        name: "Alert",
        img: "alert.webp",
        type: "feat",
        "system.prerequisites.level": null,
        "system.type.subtype": "origin",
      },
    ], { label: "Feats" });

    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map([
        ["pack.backgrounds", backgroundPack],
        ["pack.feats", featPack],
      ]),
    });
    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.pack.backgrounds.Item.background-1") {
        return {
          system: {
            advancement: [
              {
                type: "ItemGrant",
                title: "Origin Feat",
                configuration: {
                  items: [{ uuid: "Compendium.pack.feats.Item.feat-1" }],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    const sources = {
      ...defaultSources(),
      backgrounds: ["pack.backgrounds"],
      feats: ["pack.feats"],
      items: [],
      spells: [],
    };

    const snapshot = await indexer.buildPersistentSnapshot(sources, { contentKeys: ["backgrounds", "feats"] });

    expect(snapshot.packs["pack.backgrounds"]).toEqual([
      expect.objectContaining({
        name: "Criminal",
        grantsOriginFeatUuid: "Compendium.pack.feats.Item.feat-1",
      }),
    ]);
    expect(snapshot.packs["pack.feats"]).toEqual([
      expect.objectContaining({
        name: "Alert",
        featCategory: "origin",
        prerequisiteLevel: null,
      }),
    ]);

    indexer.invalidate();
    expect(indexer.hydratePersistentSnapshot(snapshot, sources, { contentKeys: ["backgrounds", "feats"] })).toBe(true);
    expect(indexer.getIndexedEntries("background", sources)[0]).toEqual(
      expect.objectContaining({ grantsOriginFeatUuid: "Compendium.pack.feats.Item.feat-1" }),
    );
    expect(indexer.getIndexedEntries("feat", sources)[0]).toEqual(
      expect.objectContaining({ featCategory: "origin", prerequisiteLevel: null }),
    );
  });

  it("marks firearms in the persistent snapshot from indexed ammunition metadata", async () => {
    const itemPack = createPack([
      {
        _id: "weapon-1",
        name: "Pistol",
        img: "pistol.webp",
        type: "weapon",
        "system.identifier": "pistol",
        "system.weaponType": "martialR",
        "system.mastery": "vex",
        "system.ammunition.type": "firearmBullet",
      },
    ], { label: "Items" });

    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map([["pack.items", itemPack]]),
    });

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    const snapshot = await indexer.buildPersistentSnapshot(defaultSources(), { contentKeys: ["items"] });

    expect(snapshot.packs["pack.items"]).toEqual([
      expect.objectContaining({
        name: "Pistol",
        identifier: "pistol",
        isFirearm: true,
      }),
    ]);
  });

  it("rejects stale persistent snapshots when pack sources change", async () => {
    getGameMock.mockReturnValue({
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.7" },
      modules: new Map([["foundry-tabletop-helpers", { id: "foundry-tabletop-helpers", version: "1.2.1", active: true }]]),
      packs: new Map(),
    });

    const { CompendiumIndexer, PERSISTENT_INDEX_CACHE_FORMAT_VERSION } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();
    const validation = indexer.validatePersistentSnapshot({
      formatVersion: PERSISTENT_INDEX_CACHE_FORMAT_VERSION,
      moduleVersion: "1.2.1",
      foundryVersion: "13.351",
      systemId: "dnd5e",
      systemVersion: "5.3.7",
      packSignature: JSON.stringify({ items: ["some.other.pack"] }),
      generatedAt: new Date().toISOString(),
      packs: {},
    }, defaultSources(), { contentKeys: ["items"] });

    expect(validation).toEqual({
      valid: false,
      reason: "The selected compendium sources changed since the cache was built.",
    });
  });
});
