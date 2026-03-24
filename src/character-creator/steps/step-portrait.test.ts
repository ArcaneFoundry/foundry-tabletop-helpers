import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../portrait/portrait-client", () => ({
  isPortraitAvailable: vi.fn(async () => true),
  generatePortraits: vi.fn(async () => []),
}));

vi.mock("../portrait/portrait-prompt-builder", () => ({
  buildPortraitPrompt: vi.fn(() => "Arcane portrait prompt"),
}));

describe("step portrait", () => {
  it("uses the React rendering path for the optional visage chamber", async () => {
    const { createPortraitStep } = await import("./step-portrait");
    const step = createPortraitStep();

    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeTypeOf("function");
  });
});
