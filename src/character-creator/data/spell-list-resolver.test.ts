import { beforeEach, describe, expect, it, vi } from "vitest";

const logDebugMock = vi.fn();

vi.mock("../../logger", () => ({
  Log: {
    debug: logDebugMock,
  },
}));

function setDnd5eRegistry(spellLists: Record<string, unknown> | null): void {
  const globalRecord = globalThis as Record<string, unknown>;
  if (!spellLists) {
    delete globalRecord.dnd5e;
    return;
  }
  globalRecord.dnd5e = {
    registry: {
      spellLists,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  setDnd5eRegistry(null);
});

describe("spell list resolver", () => {
  it("resolves uuids from the first working registry method", async () => {
    const forClass = vi.fn(async () => ({
      spells: [
        "Compendium.dnd5e.spells.fire-bolt",
        { uuid: "Compendium.dnd5e.spells.magic-missile" },
      ],
    }));
    const getListForClass = vi.fn();
    const get = vi.fn();
    setDnd5eRegistry({ forClass, getListForClass, get });

    const { resolveClassSpellUuids } = await import("./spell-list-resolver");
    const result = await resolveClassSpellUuids("wizard");

    expect(result).toEqual(new Set([
      "Compendium.dnd5e.spells.fire-bolt",
      "Compendium.dnd5e.spells.magic-missile",
    ]));
    expect(forClass).toHaveBeenCalledWith("wizard");
    expect(getListForClass).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("falls through to later registry methods and normalizes entry/set shapes", async () => {
    const forClass = vi.fn(async () => null);
    const getListForClass = vi.fn(async () => ({
      entries: [
        { uuid: "Compendium.dnd5e.spells.shield" },
        "Compendium.dnd5e.spells.absorb-elements",
      ],
    }));
    setDnd5eRegistry({ forClass, getListForClass });

    const { resolveClassSpellUuids } = await import("./spell-list-resolver");
    const result = await resolveClassSpellUuids("wizard");

    expect(result).toEqual(new Set([
      "Compendium.dnd5e.spells.shield",
      "Compendium.dnd5e.spells.absorb-elements",
    ]));
    expect(forClass).toHaveBeenCalledWith("wizard");
    expect(getListForClass).toHaveBeenCalledWith("wizard");
  });

  it("supports direct get access and returns null when nothing usable is found", async () => {
    const get = vi.fn((classIdentifier: string) =>
      classIdentifier === "cleric"
        ? new Set(["Compendium.dnd5e.spells.guiding-bolt"])
        : []);
    setDnd5eRegistry({ get });

    const { resolveClassSpellUuids } = await import("./spell-list-resolver");

    await expect(resolveClassSpellUuids("cleric")).resolves.toEqual(
      new Set(["Compendium.dnd5e.spells.guiding-bolt"]),
    );
    await expect(resolveClassSpellUuids("fighter")).resolves.toBeNull();
  });

  it("returns null when the registry is unavailable or throws", async () => {
    setDnd5eRegistry({
      forClass: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const { resolveClassSpellUuids } = await import("./spell-list-resolver");

    await expect(resolveClassSpellUuids("wizard")).resolves.toBeNull();
    expect(logDebugMock).toHaveBeenCalledWith("Spell list registry lookup failed:", expect.any(Error));
  });
});
