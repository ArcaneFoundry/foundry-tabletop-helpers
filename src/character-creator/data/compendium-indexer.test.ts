import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PackSourceConfig } from "../character-creator-types";

const logDebugMock = vi.fn();
const logWarnMock = vi.fn();
const logErrorMock = vi.fn();
const getGameMock = vi.fn();
const fromUuidMock = vi.fn();

vi.mock("../../logger", () => ({
  Log: {
    debug: logDebugMock,
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
  delete (globalThis as Record<string, unknown>).TextEditor;
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

  it("caches fetched documents and enriches cached descriptions through TextEditor", async () => {
    fromUuidMock.mockResolvedValue({
      id: "uuid-1",
      system: {
        description: {
          value: "Feat: @UUID[Compendium.foo]{Magic Initiate}\nEquipment: [[/award 13GP]]\nUses: [[lookup @prof]]",
        },
      },
    });
    (globalThis as Record<string, unknown>).TextEditor = {
      enrichHTML: vi.fn(async (html: string) => html),
    };

    const { CompendiumIndexer } = await import("./compendium-indexer");
    const indexer = new CompendiumIndexer();

    const first = await indexer.fetchDocument("Compendium.foo.bar");
    const second = await indexer.fetchDocument("Compendium.foo.bar");
    const description = await indexer.getCachedDescription("Compendium.foo.bar");

    expect(first).toBe(second);
    expect(fromUuidMock).toHaveBeenCalledTimes(1);
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
});
