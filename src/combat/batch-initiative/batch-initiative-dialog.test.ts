import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADV_MODE } from "../combat-types";

const logWarnMock = vi.fn();
const getConfigMock = vi.fn();

vi.mock("../../logger", () => ({
  Log: {
    warn: logWarnMock,
  },
}));

vi.mock("../../types", () => ({
  getConfig: getConfigMock,
  isObject: (value: unknown) => typeof value === "object" && value !== null,
}));

class FakeDialog {
  static lastInstance: FakeDialog | null = null;

  constructor(
    public readonly data: Record<string, unknown>,
    public readonly options?: Record<string, unknown>,
  ) {
    FakeDialog.lastInstance = this;
  }

  render = vi.fn();
}

class FakeD20Roll {
  constructor(
    public readonly formula: string,
    public readonly data: unknown,
    public readonly options: unknown,
  ) {}
}

class FakeBasicRoll {
  constructor(
    public readonly formula: string,
    public readonly data: unknown,
    public readonly options: unknown,
  ) {}
}

interface TestActor extends Record<string, unknown> {
  getInitiativeRollConfig?(): Record<string, unknown>;
  _cachedInitiativeRoll?: unknown;
}

function setDialogClass(value: unknown): void {
  (globalThis as Record<string, unknown>).Dialog = value;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  FakeDialog.lastInstance = null;
  setDialogClass(FakeDialog);
  getConfigMock.mockReturnValue({
    Dice: {
      D20Roll: FakeD20Roll,
      BasicRoll: FakeBasicRoll,
    },
  });
});

describe("batch initiative dialog", () => {
  it("renders the advantage dialog and resolves the chosen mode", async () => {
    const mod = await import("./batch-initiative-dialog");
    const promise = mod.showAdvantageDialog("Roll <everyone>");

    const instance = FakeDialog.lastInstance;
    expect(instance).not.toBeNull();
    expect(instance?.render).toHaveBeenCalledWith(true);
    expect(instance?.data.content).toContain("Roll &lt;everyone&gt;");
    expect(instance?.options).toEqual({ classes: ["batch-initiative-dialog"], width: 320 });

    const buttons = instance?.data.buttons as Record<string, { callback(): void }>;
    buttons.advantage.callback();

    await expect(promise).resolves.toBe(ADV_MODE.ADVANTAGE);
  });

  it("caches initiative rolls for matching combatants and cleans them up", async () => {
    const mod = await import("./batch-initiative-dialog");
    const actor: TestActor = {
      getInitiativeRollConfig: () => ({
        parts: ["2"],
        data: { dex: 3 },
        options: {},
      }),
    };
    const combatants = [
      {
        initiative: null,
        actor,
      },
      {
        initiative: 12,
        actor: {} as TestActor,
      },
    ];
    const combat = { combatants } as Parameters<typeof mod.cacheRollsOnCombatants>[0];

    mod.cacheRollsOnCombatants(
      combat,
      ADV_MODE.DISADVANTAGE,
      (combatant) => combatant.initiative == null,
    );

    const cachedRoll = actor._cachedInitiativeRoll as FakeD20Roll;
    expect(cachedRoll).toBeInstanceOf(FakeD20Roll);
    expect(cachedRoll.formula).toBe("1d20 + 2");
    expect(cachedRoll.options).toEqual({ advantageMode: ADV_MODE.DISADVANTAGE });
    expect(combatants[1].actor._cachedInitiativeRoll).toBeUndefined();

    mod.cleanupCachedRolls(combat);
    expect(actor._cachedInitiativeRoll).toBeUndefined();
  });

  it("uses BasicRoll for fixed initiative and warns when dialog or dice are unavailable", async () => {
    setDialogClass(undefined);
    getConfigMock.mockReturnValue({ Dice: {} });
    const mod = await import("./batch-initiative-dialog");

    await expect(mod.showAdvantageDialog("NPCs")).resolves.toBeNull();
    expect(logWarnMock).toHaveBeenCalledWith("Advantage Dialog: Dialog class not available");

    const actor: TestActor = {
      getInitiativeRollConfig: () => ({
        parts: [],
        data: {},
        options: { fixed: 14 },
      }),
    };
    mod.cacheRollsOnCombatants(
      { combatants: [{ initiative: null, actor }] } as Parameters<typeof mod.cacheRollsOnCombatants>[0],
      ADV_MODE.NORMAL,
    );
    expect(logWarnMock).toHaveBeenCalledWith("Batch Initiative: CONFIG.Dice.D20Roll not available");

    getConfigMock.mockReturnValue({
      Dice: {
        D20Roll: FakeD20Roll,
        BasicRoll: FakeBasicRoll,
      },
    });
    mod.cacheRollsOnCombatants(
      { combatants: [{ initiative: null, actor }] } as Parameters<typeof mod.cacheRollsOnCombatants>[0],
      ADV_MODE.NORMAL,
    );
    expect(actor._cachedInitiativeRoll).toBeInstanceOf(FakeBasicRoll);
    expect((actor._cachedInitiativeRoll as FakeBasicRoll).formula).toBe("14");
  });
});
