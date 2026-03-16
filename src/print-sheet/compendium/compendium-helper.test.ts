import { beforeEach, describe, expect, it, vi } from "vitest";

const logDebugMock = vi.fn();
const logWarnMock = vi.fn();
const getGameMock = vi.fn();

vi.mock("../../logger", () => ({
  Log: {
    debug: logDebugMock,
    warn: logWarnMock,
  },
}));

vi.mock("../../types", () => ({
  getGame: getGameMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("compendium helper", () => {
  it("finds a single entry by name with case-insensitive matching", async () => {
    const pack = {
      index: [] as Array<{ _id: string; name?: string }>,
      getIndex: vi.fn(async () => {
        const index = [{ _id: "1", name: "Longsword" }];
        pack.index = index;
        return index;
      }),
      getDocument: vi.fn(async () => ({ id: "1", name: "Longsword" })),
    };
    getGameMock.mockReturnValue({
      packs: {
        get: (packId: string) => (packId === "dnd5e.items" ? pack : null),
      },
    });

    const { getCompendiumEntry } = await import("./compendium-helper");
    const result = await getCompendiumEntry("dnd5e.items", "longsword");

    expect(result).toEqual({ id: "1", name: "Longsword" });
    expect(pack.getIndex).toHaveBeenCalled();
    expect(pack.getDocument).toHaveBeenCalledWith("1");
  });

  it("bulk-loads matching entries and preserves the requested names as map keys", async () => {
    const pack = {
      index: [] as Array<{ _id: string; name?: string }>,
      getIndex: vi.fn(async () => {
        const index = [
          { _id: "1", name: "Blinded" },
          { _id: "2", name: "Poisoned" },
        ];
        pack.index = index;
        return index;
      }),
      getDocument: vi.fn(async (id: string) => ({ id, loaded: true })),
    };
    getGameMock.mockReturnValue({
      packs: {
        get: () => pack,
      },
    });

    const { getCompendiumEntries } = await import("./compendium-helper");
    const result = await getCompendiumEntries("dnd5e.conditions", ["blinded", "Missing", "Poisoned"]);

    expect([...result.entries()]).toEqual([
      ["blinded", { id: "1", loaded: true }],
      ["Poisoned", { id: "2", loaded: true }],
    ]);
    expect(pack.getDocument).toHaveBeenCalledTimes(2);
  });

  it("returns null or empty results cleanly when packs or lookups fail", async () => {
    const pack = {
      index: [] as Array<{ _id: string; name?: string }>,
      getIndex: vi.fn(async () => {
        throw new Error("index failed");
      }),
      getDocument: vi.fn(),
    };
    getGameMock.mockReturnValue({
      packs: {
        get: (packId: string) => (packId === "broken.pack" ? pack : null),
      },
    });

    const { getCompendiumEntry, getCompendiumEntries } = await import("./compendium-helper");

    await expect(getCompendiumEntry("missing.pack", "anything")).resolves.toBeNull();
    await expect(getCompendiumEntry("broken.pack", "anything")).resolves.toBeNull();
    await expect(getCompendiumEntries("broken.pack", ["one", "two"])).resolves.toEqual(new Map());

    expect(logDebugMock).toHaveBeenCalledWith("compendium pack not found: missing.pack");
    expect(logWarnMock).toHaveBeenCalledWith("compendium query failed", expect.objectContaining({ packId: "broken.pack" }));
    expect(logWarnMock).toHaveBeenCalledWith("bulk compendium query failed", expect.objectContaining({ packId: "broken.pack" }));
  });
});
