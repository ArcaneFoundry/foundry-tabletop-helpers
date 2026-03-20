import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PackSourceConfig } from "../character-creator-types";

const getGameMock = vi.fn();

vi.mock("../../types", () => ({
  getGame: getGameMock,
}));

function createSources(): PackSourceConfig {
  return {
    classes: [],
    subclasses: [],
    races: [],
    backgrounds: ["dnd-heroes-faerun.options"],
    feats: ["dnd-heroes-faerun.options", "dnd5e.feats24"],
    spells: [],
    items: [],
  };
}

function createPack(options: {
  collection: string;
  label: string;
  packageName: string;
  size?: number;
  sourceBook?: string;
  entries: Array<Record<string, unknown>>;
  folders?: unknown;
}) {
  return {
    collection: options.collection,
    documentName: "Item",
    metadata: {
      label: options.label,
      packageName: options.packageName,
      flags: options.sourceBook ? { dnd5e: { sourceBook: options.sourceBook } } : undefined,
    },
    size: options.size ?? options.entries.length,
    folders: options.folders,
    getIndex: vi.fn(async () => options.entries),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("pack analysis", () => {
  it("builds shared pack groups with source badges, mixed-content summaries, and feat-specific folder labels", async () => {
    getGameMock.mockReturnValue({
      packs: [
        createPack({
          collection: "dnd-heroes-faerun.options",
          label: "Character Options",
          packageName: "dnd-heroes-faerun",
          entries: [
            { _id: "feat-1", name: "Lucky Step", type: "feat", folder: "f-origin" },
            { _id: "feat-2", name: "River Guide", type: "feat", folder: "f-origin" },
            { _id: "feat-3", name: "Harper Agent", type: "feat", folder: "f-origin" },
            { _id: "bg-1", name: "Waterdhavian Noble", type: "background", folder: "f-bg" },
            { _id: "sc-1", name: "Purple Dragon Knight", type: "subclass", folder: "f-sub" },
          ],
          folders: [
            { id: "f-origin", name: "Origin Feats" },
            { id: "f-bg", name: "Backgrounds" },
            { id: "f-sub", name: "Subclasses" },
          ],
        }),
        createPack({
          collection: "dnd5e.feats24",
          label: "Feats",
          packageName: "dnd5e",
          sourceBook: "SRD 5.2",
          entries: [
            { _id: "feat-a", name: "Alert", type: "feat" },
            { _id: "feat-b", name: "Crafter", type: "feat" },
          ],
        }),
      ],
    });

    const { buildPackSourceGroups } = await import("./pack-analysis");
    const groups = await buildPackSourceGroups(createSources());

    const featGroup = groups.find((group) => group.sourceKey === "feats");
    const backgroundGroup = groups.find((group) => group.sourceKey === "backgrounds");

    expect(featGroup?.packs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: "dnd-heroes-faerun.options",
        label: "Heroes of Faerun: Origin Feats",
        packageLabel: "Heroes of Faerun",
        sourceBadge: "Premium 2024",
        mixedContent: true,
        previewSummary: "3 feats • 1 backgrounds • 1 subclasses",
        sampleItems: ["Lucky Step", "River Guide", "Harper Agent", "Waterdhavian Noble", "Purple Dragon Knight"],
        folderHints: ["Origin Feats", "Backgrounds", "Subclasses"],
        previewHint: "From Character Options",
        enabled: true,
      }),
      expect.objectContaining({
        collection: "dnd5e.feats24",
        label: "Feats",
        sourceBadge: "SRD 2024",
        mixedContent: false,
        enabled: true,
      }),
    ]));

    expect(backgroundGroup?.packs).toEqual([
      expect.objectContaining({
        collection: "dnd-heroes-faerun.options",
        label: "Heroes of Faerun: Character Options",
        sourceBadge: "Premium 2024",
        enabled: true,
      }),
    ]);
  });

  it("keeps official core 2024 labels concise while still surfacing the package in metadata", async () => {
    getGameMock.mockReturnValue({
      packs: new Map([
        ["dnd-players-handbook.origins", createPack({
          collection: "dnd-players-handbook.origins",
          label: "Character Origins",
          packageName: "dnd-players-handbook",
          entries: [
            { _id: "race-1", name: "Elf", type: "race" },
            { _id: "bg-1", name: "Sage", type: "background" },
            { _id: "feat-1", name: "Magic Initiate", type: "feat" },
          ],
        })],
      ]),
    });

    const { buildPackSourceGroups } = await import("./pack-analysis");
    const groups = await buildPackSourceGroups(createSources());
    const raceGroup = groups.find((group) => group.sourceKey === "races");

    expect(raceGroup?.packs).toEqual([
      expect.objectContaining({
        collection: "dnd-players-handbook.origins",
        label: "Character Origins",
        packageLabel: "Player's Handbook",
        sourceBadge: "Core 2024",
      }),
    ]);
  });

  it("excludes incidental monster and equipment support packs from feat-source groups", async () => {
    getGameMock.mockReturnValue({
      packs: [
        createPack({
          collection: "dnd5e.monsterfeatures24",
          label: "Monster Features",
          packageName: "dnd5e",
          sourceBook: "SRD 5.2",
          entries: [
            { _id: "feat-1", name: "Rampage", type: "feat" },
            { _id: "feat-2", name: "Flyby", type: "feat" },
          ],
        }),
        createPack({
          collection: "dnd5e.equipment24",
          label: "Equipment",
          packageName: "dnd5e",
          sourceBook: "SRD 5.2",
          entries: [
            { _id: "item-1", name: "Longsword", type: "weapon" },
            { _id: "item-2", name: "Backpack", type: "equipment" },
            { _id: "feat-1", name: "Weapon Mastery: Cleave", type: "feat" },
          ],
        }),
        createPack({
          collection: "dnd-heroes-faerun.options",
          label: "Character Options",
          packageName: "dnd-heroes-faerun",
          entries: [
            { _id: "feat-1", name: "Lucky Step", type: "feat", folder: "f-origin" },
            { _id: "feat-2", name: "River Guide", type: "feat", folder: "f-origin" },
            { _id: "bg-1", name: "Waterdhavian Noble", type: "background", folder: "f-bg" },
          ],
          folders: [
            { id: "f-origin", name: "Origin Feats" },
            { id: "f-bg", name: "Backgrounds" },
          ],
        }),
      ],
    });

    const { buildPackSourceGroups } = await import("./pack-analysis");
    const groups = await buildPackSourceGroups(createSources());
    const featGroup = groups.find((group) => group.sourceKey === "feats");

    expect((featGroup?.packs ?? []).map((pack) => pack.collection)).toEqual([
      "dnd-heroes-faerun.options",
    ]);
  });
});
