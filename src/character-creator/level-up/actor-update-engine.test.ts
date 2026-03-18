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

  const items: Array<{
    id?: string;
    type?: string;
    name?: string;
    system?: Record<string, unknown>;
    update?: ReturnType<typeof vi.fn>;
  }> = [classItem, spellShield, spellMagicMissile];
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
    itemsList: items,
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
  const topLevelType = typeof data.type === "string" ? data.type : "feat";
  const topLevelSystem = typeof data.system === "object" && data.system !== null
    ? data.system as Record<string, unknown>
    : {};
  return {
    name,
    type: topLevelType,
    system: topLevelSystem,
    toObject() {
      return {
        _id: `${name}-id`,
        name,
        type: topLevelType,
        system: topLevelSystem,
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
          system: {
            identifier: "wizard",
            levels: 7,
            advancement: [
              {
                type: "ItemGrant",
                level: 1,
                configuration: {
                  items: [{ uuid: "Compendium.feature.arcane-recovery", name: "Arcane Recovery" }],
                },
              },
            ],
          },
        });
      }
      if (uuid === "Compendium.feature.arcane-recovery") {
        return makeCompendiumDoc("Arcane Recovery");
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
      [expect.objectContaining({ name: "Arcane Recovery" })]
    );
    expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(
      3,
      "Item",
      [expect.objectContaining({ name: "Alert" })]
    );
  });

  it("grants subclass features for the current target level without duplicating an existing subclass item", async () => {
    const actor = makeActor();
    actor.itemsList.push({
      id: "subclass-1",
      type: "subclass",
      name: "Bladesinger",
      system: { classIdentifier: "wizard", identifier: "bladesinger" },
      update: vi.fn(async () => null),
    });

    getGameMock.mockReturnValue({
      actors: {
        get: () => actor,
      },
    });

    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.subclass.bladesinger") {
        return makeCompendiumDoc("Bladesinger", {
          type: "subclass",
          system: {
            classIdentifier: "wizard",
            advancement: [
              {
                type: "ItemGrant",
                level: 3,
                configuration: {
                  items: [
                    { uuid: "Compendium.feature.bladesong", name: "Bladesong" },
                    { uuid: "Compendium.feature.training-in-war-and-song", name: "Training in War and Song" },
                  ],
                },
              },
            ],
          },
        });
      }
      if (uuid === "Compendium.feature.bladesong") {
        return makeCompendiumDoc("Bladesong");
      }
      if (uuid === "Compendium.feature.training-in-war-and-song") {
        return makeCompendiumDoc("Training in War and Song");
      }
      return null;
    });

    const { applyLevelUp } = await import("./actor-update-engine");
    const success = await applyLevelUp(makeState({
      currentLevel: 2,
      targetLevel: 3,
      selections: {
        classChoice: {
          mode: "existing",
          classItemId: "fighter-1",
          className: "Wizard",
          classIdentifier: "wizard",
        },
        subclass: {
          uuid: "Compendium.subclass.bladesinger",
          name: "Bladesinger",
          img: "bladesinger.png",
        },
      },
    }));

    expect(success).toBe(true);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      expect.arrayContaining([
        expect.objectContaining({ name: "Bladesong" }),
        expect.objectContaining({ name: "Training in War and Song" }),
      ]),
    );
  });

  it("skips duplicate subclass spell grants when matching spell items already exist on the actor", async () => {
    const actor = makeActor();
    actor.itemsList.push(
      {
        id: "subclass-life-domain",
        type: "subclass",
        name: "Life Domain",
        system: { classIdentifier: "cleric", identifier: "life-domain" },
      },
      {
        id: "spell-bless",
        type: "spell",
        name: "Bless",
        system: { identifier: "bless" },
      },
      {
        id: "spell-cure-wounds",
        type: "spell",
        name: "Cure Wounds",
        system: { identifier: "cure-wounds" },
      },
      {
        id: "spell-aid",
        type: "spell",
        name: "Aid",
        system: { identifier: "aid" },
      },
      {
        id: "spell-lesser-restoration",
        type: "spell",
        name: "Lesser Restoration",
        system: { identifier: "lesser-restoration" },
      },
    );

    getGameMock.mockReturnValue({
      actors: {
        get: () => actor,
      },
    });

    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.subclass.life-domain") {
        return makeCompendiumDoc("Life Domain", {
          type: "subclass",
          system: {
            classIdentifier: "cleric",
            advancement: [
              {
                type: "ItemGrant",
                level: 3,
                configuration: {
                  items: [
                    { uuid: "Compendium.spell.bless", name: "Bless" },
                    { uuid: "Compendium.spell.cure-wounds", name: "Cure Wounds" },
                    { uuid: "Compendium.spell.aid", name: "Aid" },
                    { uuid: "Compendium.spell.lesser-restoration", name: "Lesser Restoration" },
                  ],
                },
              },
            ],
          },
        });
      }
      if (uuid === "Compendium.spell.bless") {
        return makeCompendiumDoc("Bless", { type: "spell", system: { identifier: "bless" } });
      }
      if (uuid === "Compendium.spell.cure-wounds") {
        return makeCompendiumDoc("Cure Wounds", { type: "spell", system: { identifier: "cure-wounds" } });
      }
      if (uuid === "Compendium.spell.aid") {
        return makeCompendiumDoc("Aid", { type: "spell", system: { identifier: "aid" } });
      }
      if (uuid === "Compendium.spell.lesser-restoration") {
        return makeCompendiumDoc("Lesser Restoration", { type: "spell", system: { identifier: "lesser-restoration" } });
      }
      return null;
    });

    const { applyLevelUp } = await import("./actor-update-engine");
    const success = await applyLevelUp(makeState({
      currentLevel: 2,
      targetLevel: 3,
      selections: {
        classChoice: {
          mode: "existing",
          classItemId: "fighter-1",
          className: "Cleric",
          classIdentifier: "cleric",
        },
        subclass: {
          uuid: "Compendium.subclass.life-domain",
          name: "Life Domain",
          img: "life-domain.png",
        },
      },
    }));

    expect(success).toBe(true);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
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

  it("sets an existing class directly to the requested target level", async () => {
    const actor = makeActor();
    actor.classItem.system.levels = 1;

    getGameMock.mockReturnValue({
      actors: {
        get(id: string) {
          return id === actor.id ? actor : null;
        },
      },
    });

    const { applyLevelUp } = await import("./actor-update-engine");
    const success = await applyLevelUp(makeState({
      currentLevel: 2,
      targetLevel: 3,
      selections: {
        classChoice: {
          mode: "existing",
          classItemId: "fighter-1",
          className: "Fighter",
          classIdentifier: "fighter",
        },
      },
    }));

    expect(success).toBe(true);
    expect(actor.classItem.update).toHaveBeenCalledWith({ "system.levels": 3 });
  });
});
