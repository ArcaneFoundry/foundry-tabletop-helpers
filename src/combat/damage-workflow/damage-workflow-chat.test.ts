import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkflowResult } from "../combat-types";
import { postWorkflowChat } from "./damage-workflow-chat";

const { warnMock, errorMock, getGameMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
  errorMock: vi.fn(),
  getGameMock: vi.fn(),
}));

vi.mock("../../logger", () => ({
  Log: {
    warn: warnMock,
    error: errorMock,
  },
}));

vi.mock("../../types", () => ({
  getGame: getGameMock,
}));

function makeDamageResult(overrides: Partial<WorkflowResult> = {}): WorkflowResult {
  return {
    input: {
      type: "saveForHalf",
      amount: 18,
      dc: 14,
      ability: "dex",
      damageType: "fire",
    },
    targets: [
      {
        tokenId: "t1",
        actorId: "a1",
        name: "Goblin <Boss>",
        saveRoll: 16,
        saveMod: 2,
        saveSuccess: true,
        damageApplied: 9,
        hpBefore: 20,
        hpMax: 20,
        hpAfter: 11,
      },
      {
        tokenId: "t2",
        actorId: "a2",
        name: "Ogre",
        saveRoll: 7,
        saveMod: 0,
        saveSuccess: false,
        damageApplied: 18,
        hpBefore: 59,
        hpMax: 59,
        hpAfter: 41,
      },
    ],
    concentrationChecks: [
      { name: "Ogre", roll: 8, dc: 10, success: false },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (globalThis as Record<string, unknown>).ChatMessage;
  getGameMock.mockReturnValue({ user: { id: "gm-user" } });
});

describe("damage workflow chat", () => {
  it("warns when ChatMessage is unavailable", async () => {
    await postWorkflowChat(makeDamageResult());

    expect(warnMock).toHaveBeenCalledWith("Damage Workflow: ChatMessage not available");
  });

  it("posts a damage/save result chat card with whisper and concentration content", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    (globalThis as Record<string, unknown>).ChatMessage = { create };

    await postWorkflowChat(makeDamageResult());

    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][0] as { content: string; speaker: { alias: string }; whisper: string[] };
    expect(payload.speaker.alias).toBe("Combat Workflow");
    expect(payload.whisper).toEqual(["gm-user"]);
    expect(payload.content).toContain("Save for Half");
    expect(payload.content).toContain("DC 14 DEX");
    expect(payload.content).toContain("Goblin &lt;Boss&gt;");
    expect(payload.content).toContain("27 total damage");
    expect(payload.content).toContain("1 passed, 1 failed");
    expect(payload.content).toContain("Concentration");
    expect(payload.content).toContain("LOST");
  });

  it("posts condition application and removal cards with the expected summaries", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    (globalThis as Record<string, unknown>).ChatMessage = { create };

    await postWorkflowChat({
      input: {
        type: "saveForCondition",
        amount: 0,
        dc: 15,
        ability: "wis",
        conditionId: "frightened",
        conditionLabel: "Frightened",
      },
      targets: [
        {
          tokenId: "t1",
          actorId: "a1",
          name: "Cultist",
          saveRoll: 11,
          saveMod: 1,
          saveSuccess: false,
          damageApplied: 0,
          hpBefore: 0,
          hpMax: 0,
          hpAfter: 0,
          conditionApplied: true,
        },
      ],
    });

    await postWorkflowChat({
      input: {
        type: "removeCondition",
        amount: 0,
        conditionId: "prone",
        conditionLabel: "Prone",
      },
      targets: [
        {
          tokenId: "t2",
          actorId: "a2",
          name: "Wolf",
          damageApplied: 0,
          hpBefore: 0,
          hpMax: 0,
          hpAfter: 0,
          conditionApplied: false,
        },
      ],
    });

    const firstPayload = create.mock.calls[0][0] as { content: string };
    const secondPayload = create.mock.calls[1][0] as { content: string };

    expect(firstPayload.content).toContain("Save vs Condition");
    expect(firstPayload.content).toContain("Frightened");
    expect(firstPayload.content).toContain("0 resisted, 1 affected");
    expect(secondPayload.content).toContain("Remove Condition");
    expect(secondPayload.content).toContain("Prone");
    expect(secondPayload.content).toContain("0 of 1 removed");
  });
});
