import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SaveAbility, WorkflowInput } from "../combat-types";
import { executeWorkflow } from "./damage-workflow-engine";

class MockD20Roll {
  static totals: number[] = [];

  total = 0;

  constructor(
    _formula: string,
    _data: Record<string, unknown>,
    _options: Record<string, unknown>,
  ) {}

  async evaluate(): Promise<void> {
    this.total = MockD20Roll.totals.shift() ?? 10;
  }
}

interface TestActorOptions {
  id: string;
  name: string;
  hp?: { value: number; max: number };
  abilities?: Partial<Record<SaveAbility, { save?: number | { value?: number }; mod?: number }>>;
  effects?: string[][];
  canToggle?: boolean;
}

function makeActor(options: TestActorOptions) {
  const update = vi.fn(async () => undefined);
  const toggleStatusEffect = options.canToggle === false
    ? undefined
    : vi.fn(async () => undefined);

  return {
    id: options.id,
    name: options.name,
    system: {
      attributes: {
        hp: options.hp ?? { value: 20, max: 20 },
      },
      abilities: options.abilities ?? {},
    },
    effects: (options.effects ?? []).map((statuses) => ({ statuses: new Set(statuses) })),
    update,
    toggleStatusEffect,
  };
}

function makeToken(id: string, actor: ReturnType<typeof makeActor>, name?: string) {
  return {
    id,
    name,
    actor,
  };
}

describe("damage workflow engine", () => {
  beforeEach(() => {
    MockD20Roll.totals = [];
    (globalThis as Record<string, unknown>).CONFIG = {
      Dice: {
        D20Roll: MockD20Roll,
      },
    };
  });

  it("applies flat damage, updates hp, and drops concentration on a failed check", async () => {
    MockD20Roll.totals = [7];
    const actor = makeActor({
      id: "actor-1",
      name: "Mage",
      hp: { value: 18, max: 24 },
      abilities: { con: { save: 2 } },
      effects: [["concentrating"]],
    });

    const result = await executeWorkflow(
      { type: "flatDamage", amount: 12 },
      [makeToken("token-1", actor)],
    );

    expect(actor.update).toHaveBeenCalledWith({ "system.attributes.hp.value": 6 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith("concentrating", { active: false });
    expect(result.targets).toEqual([
      {
        tokenId: "token-1",
        actorId: "actor-1",
        name: "Mage",
        damageApplied: 12,
        hpBefore: 18,
        hpMax: 24,
        hpAfter: 6,
      },
    ]);
    expect(result.concentrationChecks).toEqual([
      {
        name: "Mage",
        roll: 7,
        dc: 10,
        success: false,
      },
    ]);
  });

  it("applies healing up to max hp without concentration checks", async () => {
    const actor = makeActor({
      id: "actor-2",
      name: "Cleric",
      hp: { value: 17, max: 20 },
    });

    const result = await executeWorkflow(
      { type: "healing", amount: 8 },
      [makeToken("token-2", actor)],
    );

    expect(actor.update).toHaveBeenCalledWith({ "system.attributes.hp.value": 20 });
    expect(result.targets[0]).toMatchObject({
      damageApplied: -3,
      hpBefore: 17,
      hpAfter: 20,
    });
    expect(result.concentrationChecks).toBeUndefined();
  });

  it("applies a failed save condition and records the save details", async () => {
    MockD20Roll.totals = [9];
    const actor = makeActor({
      id: "actor-3",
      name: "Goblin",
      abilities: { wis: { mod: 1 } },
    });

    const input: WorkflowInput = {
      type: "saveForCondition",
      amount: 0,
      dc: 12,
      ability: "wis",
      conditionId: "frightened",
    };

    const result = await executeWorkflow(input, [makeToken("token-3", actor)]);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith("frightened", { active: true });
    expect(result.targets).toEqual([
      {
        tokenId: "token-3",
        actorId: "actor-3",
        name: "Goblin",
        damageApplied: 0,
        hpBefore: 0,
        hpMax: 0,
        hpAfter: 0,
        saveRoll: 9,
        saveMod: 1,
        saveSuccess: false,
        conditionApplied: true,
      },
    ]);
  });

  it("removes a condition only when the actor has it", async () => {
    const proneActor = makeActor({
      id: "actor-4",
      name: "Bandit",
      effects: [["prone"]],
    });
    const clearActor = makeActor({
      id: "actor-5",
      name: "Scout",
      effects: [["poisoned"]],
    });

    const result = await executeWorkflow(
      { type: "removeCondition", amount: 0, conditionId: "prone" },
      [makeToken("token-4", proneActor), makeToken("token-5", clearActor)],
    );

    expect(proneActor.toggleStatusEffect).toHaveBeenCalledWith("prone", { active: false });
    expect(clearActor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(result.targets).toEqual([
      expect.objectContaining({
        name: "Bandit",
        conditionApplied: true,
      }),
      expect.objectContaining({
        name: "Scout",
        conditionSkipped: true,
      }),
    ]);
  });
});
