import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LevelUpState } from "./level-up-types";

const logInfoMock = vi.fn();
const logDebugMock = vi.fn();
const logErrorMock = vi.fn();

const getGameMock = vi.fn();
const fromUuidMock = vi.fn();

vi.mock("../../logger", () => ({
  Log: {
    info: logInfoMock,
    debug: logDebugMock,
    error: logErrorMock,
  },
}));

vi.mock("../../types", () => ({
  getGame: getGameMock,
  fromUuid: fromUuidMock,
}));

function makeState(overrides: Partial<LevelUpState> = {}): LevelUpState {
  return {
    actorId: "actor-1",
    currentLevel: 4,
    targetLevel: 5,
    applicableSteps: ["classChoice", "hp", "review"],
    currentStep: 0,
    selections: {
      classChoice: {
        mode: "existing",
        classItemId: "fighter-1",
        className: "Fighter",
        classIdentifier: "fighter",
      },
      hp: {
        method: "average",
        hpGained: 6,
        hitDie: "d10",
      },
    },
    stepStatus: new Map(),
    classItems: [],
    ...overrides,
  };
}

function makeActor() {
  const classItem = {
    id: "fighter-1",
    type: "class",
    name: "Fighter",
    system: { levels: 4 },
    update: vi.fn(async () => null),
  };

  const spellShield = { id: "spell-shield", type: "spell", name: "Shield" };
  const spellMagicMissile = { id: "spell-mm", type: "spell", name: "Magic Missile" };

  const items = [classItem, spellShield, spellMagicMissile];
  const itemCollection = {
    get(id: string) {
      return items.find((item) => item.id === id) ?? null;
    },
    [Symbol.iterator]: function* () {
      yield* items;
    },
  };

  return {
    id: "actor-1",
    name: "Tarin",
    system: {
      attributes: {
        hp: {
          value: 32,
          max: 40,
        },
      },
      abilities: {
        str: { value: 16 },
        con: { value: 15 },
      },
    },
    items: itemCollection,
    classItem,
    update: vi.fn(async () => null),
    createEmbeddedDocuments: vi.fn(async () => []),
    deleteEmbeddedDocuments: vi.fn(async () => []),
  };
}

function makeCompendiumDoc(name: string, data: Record<string, unknown> = {}) {
  return {
    name,
    toObject() {
      return {
        _id: `${name}-id`,
        name,
        type: "feat",
        system: {},
        ...data,
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("actor update engine", () => {
  it("updates an existing class, hp, features, asi, new spells, and swapped spells", async () => {
    const actor = makeActor();
    getGameMock.mockReturnValue({
      actors: {
        get(id: string) {
          return id === actor.id ? actor : null;
        },
      },
    });

    fromUuidMock.mockImplementation(async (uuid: string) => {
      switch (uuid) {
        case "Compendium.feature.second-wind":
          return makeCompendiumDoc("Second Wind");
        case "Compendium.spell.absorb-elements":
          return makeCompendiumDoc("Absorb Elements", { type: "spell" });
        case "Compendium.spell.fire-bolt":
          return makeCompendiumDoc("Fire Bolt", { type: "spell" });
        case "Compendium.spell.shield":
          return makeCompendiumDoc("Shield", { type: "spell" });
        default:
          return null;
      }
    });

    const { applyLevelUp } = await import("./actor-update-engine");
    const success = await applyLevelUp(makeState({
      selections: {
        classChoice: {
          mode: "existing",
          classItemId: "fighter-1",
          className: "Fighter",
          classIdentifier: "fighter",
        },
        hp: {
          method: "average",
          hpGained: 6,
          hitDie: "d10",
        },
        features: {
          acceptedFeatureUuids: ["Compendium.feature.second-wind"],
          featureNames: ["Second Wind"],
        },
        feats: {
          choice: "asi",
          asiAbilities: ["str", "con"],
        },
        spells: {
          newSpellUuids: ["Compendium.spell.absorb-elements"],
          newCantripUuids: ["Compendium.spell.fire-bolt"],
          swappedInUuids: [],
          swappedOutUuids: ["Compendium.spell.shield"],
        },
      },
    }));

    expect(success).toBe(true);
    expect(actor.classItem.update).toHaveBeenCalledWith({ "system.levels": 5 });
    expect(actor.update).toHaveBeenNthCalledWith(1, {
      "system.attributes.hp.max": 46,
      "system.attributes.hp.value": 38,
    });
    expect(actor.update).toHaveBeenNthCalledWith(2, {
      "system.abilities.str.value": 17,
      "system.abilities.con.value": 16,
    });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(2);
    expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(
      1,
      "Item",
      [expect.objectContaining({ name: "Second Wind" })]
    );
    expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(
      2,
      "Item",
      [
        expect.objectContaining({ name: "Absorb Elements" }),
        expect.objectContaining({ name: "Fire Bolt" }),
      ]
    );
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["spell-shield"]);
  });

  it("creates a new multiclass item and feat grant when selected", async () => {
    const actor = makeActor();
    getGameMock.mockReturnValue({
      actors: {
        get: () => actor,
      },
    });

    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.class.wizard") {
        return makeCompendiumDoc("Wizard", {
          type: "class",
          system: { identifier: "wizard", levels: 7 },
        });
      }
      if (uuid === "Compendium.feat.alert") {
        return makeCompendiumDoc("Alert");
      }
      return null;
    });

    const { applyLevelUp } = await import("./actor-update-engine");
    const success = await applyLevelUp(makeState({
      selections: {
        classChoice: {
          mode: "multiclass",
          className: "Wizard",
          classIdentifier: "wizard",
          newClassUuid: "Compendium.class.wizard",
        },
        feats: {
          choice: "feat",
          featUuid: "Compendium.feat.alert",
          featName: "Alert",
        },
      },
    }));

    expect(success).toBe(true);
    expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(
      1,
      "Item",
      [expect.objectContaining({ name: "Wizard", system: expect.objectContaining({ levels: 1 }) })]
    );
    expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(
      2,
      "Item",
      [expect.objectContaining({ name: "Alert" })]
    );
  });

  it("returns false when the actor does not exist", async () => {
    getGameMock.mockReturnValue({
      actors: {
        get: () => null,
      },
    });

    const { applyLevelUp } = await import("./actor-update-engine");
    await expect(applyLevelUp(makeState())).resolves.toBe(false);
    expect(logErrorMock).toHaveBeenCalledWith("ActorUpdateEngine: Actor not found", { actorId: "actor-1" });
  });
});
