import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkflowInput, WorkflowResult, WorkflowType } from "../combat-types";

const hooksOn = vi.fn();
const executeWorkflowMock = vi.fn<(...args: unknown[]) => Promise<WorkflowResult>>();
const postWorkflowChatMock = vi.fn<(...args: unknown[]) => Promise<void>>();
const updatePanelVisibilityMock = vi.fn();
const flashInputErrorMock = vi.fn();
const buildInputMock = vi.fn<
  (panelEl: HTMLElement, currentMode: WorkflowType, action: "damage" | "heal" | "applyCondition" | "removeCondition") =>
    | { ok: true; input: WorkflowInput }
    | { ok: false; error: { field: "#dwf-amount" | "#dwf-dc" } }
>();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../types", () => ({
  getHooks: () => ({ on: hooksOn }),
  isGM: () => true,
  isDnd5eWorld: () => true,
  getSetting: () => true,
}));

vi.mock("./damage-workflow-engine", () => ({
  executeWorkflow: executeWorkflowMock,
}));

vi.mock("./damage-workflow-chat", () => ({
  postWorkflowChat: postWorkflowChatMock,
}));

vi.mock("./damage-workflow-dialog-helpers", () => ({
  getDamageWorkflowPanelHTML: () => "<div>panel</div>",
  isDamageWorkflowDamageMode: (mode: WorkflowType) =>
    mode === "flatDamage" || mode === "saveForHalf" || mode === "saveOrNothing" || mode === "healing",
  updateDamageWorkflowPanelVisibility: updatePanelVisibilityMock,
}));

vi.mock("./damage-workflow-dialog-interactions", () => ({
  attachDamageWorkflowPanelListeners: (
    el: FakePanelElement,
    handlers: {
      onClose(): void;
      onAction(action: "damage" | "heal" | "applyCondition" | "removeCondition"): void;
      onModeChange(mode: WorkflowType): void;
      onConditionChange(conditionId: string): void;
    },
  ) => {
    el.handlers = handlers;
  },
}));

vi.mock("./damage-workflow-inputs", () => ({
  buildDamageWorkflowInput: buildInputMock,
  flashDamageWorkflowInputError: flashInputErrorMock,
}));

class FakeClassList {
  add = vi.fn();
  remove = vi.fn();
}

class FakeNode {
  textContent = "";
  style: Record<string, string> = {};
  classList = new FakeClassList();
}

class FakeInputElement extends FakeNode {
  value = "";
  focus = vi.fn();
  select = vi.fn();
}

class FakePanelElement extends FakeNode {
  id = "";
  className = "";
  innerHTML = "";
  handlers?: {
    onClose(): void;
    onAction(action: "damage" | "heal" | "applyCondition" | "removeCondition"): void;
    onModeChange(mode: WorkflowType): void;
    onConditionChange(conditionId: string): void;
  };

  readonly targetCount = new FakeNode();
  readonly amountInput = new FakeInputElement();
  readonly damageButton = new FakeNode();
  readonly healButton = new FakeNode();
  readonly applyConditionButton = new FakeNode();
  readonly removeConditionButton = new FakeNode();

  querySelector<T>(selector: string): T | null {
    if (selector === ".dwf-target-count") return this.targetCount as T;
    if (selector === "#dwf-amount") return this.amountInput as T;
    if (selector === "[data-action='damage']") return this.damageButton as T;
    if (selector === "[data-action='heal']") return this.healButton as T;
    if (selector === "[data-action='applyCondition']") return this.applyConditionButton as T;
    if (selector === "[data-action='removeCondition']") return this.removeConditionButton as T;
    return null;
  }
}

class FakeBody {
  children: FakePanelElement[] = [];

  appendChild(el: FakePanelElement): void {
    if (!this.children.includes(el)) this.children.push(el);
  }
}

class FakeDocument {
  body = new FakeBody();

  createElement(tag: string): FakePanelElement {
    if (tag !== "div") throw new Error(`Unsupported tag ${tag}`);
    return new FakePanelElement();
  }

  querySelector<T>(selector: string): T | null {
    if (selector === "#fth-damage-panel") {
      return (this.body.children[0] ?? null) as T | null;
    }
    return this.body.children[0]?.querySelector<T>(selector) ?? null;
  }

  querySelectorAll(selector: string): FakePanelElement[] {
    if (selector === "#fth-damage-panel") return [...this.body.children];
    return [];
  }
}

function installFakeDOM(): FakeDocument {
  const document = new FakeDocument();
  const storage = new Map<string, string>();
  (globalThis as Record<string, unknown>).document = document;
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    clear: () => {
      storage.clear();
    },
  };
  return document;
}

function setControlledTokens(tokens: unknown[]): void {
  (globalThis as Record<string, unknown>).canvas = {
    tokens: { controlled: tokens },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  installFakeDOM();
  delete (globalThis as Record<string, unknown>).canvas;
  delete (globalThis as Record<string, unknown>).ui;

  executeWorkflowMock.mockResolvedValue({
    input: { type: "flatDamage", amount: 0 },
    targets: [],
  });
  postWorkflowChatMock.mockResolvedValue();
  buildInputMock.mockReturnValue({
    ok: true,
    input: { type: "flatDamage", amount: 9 },
  });
});

describe("damage workflow dialog shell", () => {
  it("registers the controlToken hook and auto-shows/hides the panel", async () => {
    const dialog = await import("./damage-workflow-dialog");

    dialog.registerDamageWorkflowHooks();

    expect(hooksOn).toHaveBeenCalledWith("controlToken", expect.any(Function));
    const onControlToken = hooksOn.mock.calls[0][1] as () => void;

    setControlledTokens([{ id: "token-1", actor: { id: "actor-1", update: vi.fn() } }]);
    onControlToken();

    const panel = ((globalThis.document as unknown) as FakeDocument).querySelector<FakePanelElement>("#fth-damage-panel");
    expect(panel).not.toBeNull();
    expect(panel?.style.display).toBe("");
    expect(panel?.targetCount.textContent).toBe("1 target");

    setControlledTokens([]);
    onControlToken();

    expect(panel?.style.display).toBe("none");
  });

  it("warns when triggered without controlled tokens", async () => {
    const warn = vi.fn();
    (globalThis as Record<string, unknown>).ui = { notifications: { warn } };

    const dialog = await import("./damage-workflow-dialog");
    await dialog.triggerDamageWorkflow();

    expect(warn).toHaveBeenCalledWith("Select one or more tokens first.");
    expect(((globalThis.document as unknown) as FakeDocument).querySelector("#fth-damage-panel")).toBeNull();
  });

  it("executes actions through the panel shell and reuses the panel element", async () => {
    const tokens = [{ id: "token-1", actor: { id: "actor-1", update: vi.fn() } }];
    setControlledTokens(tokens);
    executeWorkflowMock.mockResolvedValue({
      input: { type: "flatDamage", amount: 9 },
      targets: [],
    });

    const dialog = await import("./damage-workflow-dialog");
    await dialog.triggerDamageWorkflow();

    const document = (globalThis.document as unknown) as FakeDocument;
    const panel = document.querySelector<FakePanelElement>("#fth-damage-panel");
    expect(panel).not.toBeNull();

    panel!.amountInput.value = "9";
    panel!.handlers?.onAction("damage");

    await vi.waitFor(() => {
      expect(executeWorkflowMock).toHaveBeenCalledWith({ type: "flatDamage", amount: 9 }, tokens);
    });
    await vi.waitFor(() => {
      expect(postWorkflowChatMock).toHaveBeenCalledTimes(1);
      expect(panel!.amountInput.value).toBe("");
      expect(panel!.damageButton.classList.add).toHaveBeenCalledWith("dwf-action-success");
    });

    setControlledTokens([
      { id: "token-1", actor: { id: "actor-1", update: vi.fn() } },
      { id: "token-2", actor: { id: "actor-2", update: vi.fn() } },
    ]);
    await dialog.triggerDamageWorkflow();

    expect(document.querySelectorAll("#fth-damage-panel")).toHaveLength(1);
    expect(document.querySelector<FakePanelElement>("#fth-damage-panel")).toBe(panel);
    expect(panel?.targetCount.textContent).toBe("2 targets");
  });
});
