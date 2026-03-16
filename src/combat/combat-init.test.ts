import { beforeEach, describe, expect, it } from "vitest";

import { MOD } from "../logger";
import { __combatInternals } from "./combat-init";
import { resetRuntimePatches } from "../runtime/runtime-patches";

class CombatDocumentStub {
  static rollAllCalls = 0;
  static rollNPCCalls = 0;

  async rollAll(...args: unknown[]): Promise<string> {
    CombatDocumentStub.rollAllCalls += 1;
    return `rollAll:${args.join(",")}`;
  }

  async rollNPC(...args: unknown[]): Promise<string> {
    CombatDocumentStub.rollNPCCalls += 1;
    return `rollNPC:${args.join(",")}`;
  }
}

class FakeClassList {
  private values = new Set<string>();

  add(...tokens: string[]): void {
    for (const token of tokens) this.values.add(token);
  }

  contains(token: string): boolean {
    return this.values.has(token);
  }

  [Symbol.iterator](): Iterator<string> {
    return this.values.values();
  }
}

class FakeElement {
  tagName: string;
  classList = new FakeClassList();
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  innerHTML = "";

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  appendChild(child: FakeElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  insertBefore(child: FakeElement, reference: FakeElement | null): void {
    child.parentNode = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index === -1) {
      this.children.push(child);
      return;
    }
    this.children.splice(index, 0, child);
  }

  get nextSibling(): FakeElement | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return this.parentNode.children[index + 1] ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    const match = selector.match(/^\[data-action='(.+)'\]$/);
    const action = match?.[1];
    if (action && this.attributes.get("data-action") === action) return this;
    for (const child of this.children) {
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

function createFakeDocument() {
  return {
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
  };
}

describe("combat prototype wrapping", () => {
  beforeEach(() => {
    resetRuntimePatches();
    CombatDocumentStub.rollAllCalls = 0;
    CombatDocumentStub.rollNPCCalls = 0;

    (globalThis as Record<string, unknown>).CONFIG = {
      Combat: {
        documentClass: CombatDocumentStub,
      },
    };

    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: false },
      settings: {
        get(module: string, key: string) {
          if (module === MOD && key === "enableAdvantageInitiative") return true;
          return undefined;
        },
      },
    };
  });

  it("wraps combat prototype methods only once", async () => {
    __combatInternals.wrapCombatPrototype();
    const firstRollAll = CombatDocumentStub.prototype.rollAll;
    const firstRollNPC = CombatDocumentStub.prototype.rollNPC;
    const firstRollPC = (CombatDocumentStub.prototype as { rollPC?: unknown }).rollPC;

    __combatInternals.wrapCombatPrototype();

    expect(CombatDocumentStub.prototype.rollAll).toBe(firstRollAll);
    expect(CombatDocumentStub.prototype.rollNPC).toBe(firstRollNPC);
    expect((CombatDocumentStub.prototype as { rollPC?: unknown }).rollPC).toBe(firstRollPC);

    const combat = new CombatDocumentStub();
    await expect(combat.rollAll("alpha")).resolves.toBe("rollAll:alpha");
    await expect(combat.rollNPC("beta")).resolves.toBe("rollNPC:beta");
    expect(CombatDocumentStub.rollAllCalls).toBe(1);
    expect(CombatDocumentStub.rollNPCCalls).toBe(1);
  });

  it("skips batch initiative when no active combat is available", async () => {
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: true },
      combat: null,
      settings: {
        get(module: string, key: string) {
          if (module === MOD && key === "enableAdvantageInitiative") return true;
          return undefined;
        },
      },
    };

    await expect(__combatInternals.buildCombatApi().batchInitiative()).resolves.toBeUndefined();
  });

  it("injects the roll PCs tracker button from a wrapped html host", () => {
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: true },
      settings: {
        get(module: string, key: string) {
          if (module === MOD && key === "enableAdvantageInitiative") return true;
          return undefined;
        },
      },
    };

    (globalThis as Record<string, unknown>).document = createFakeDocument();

    const tracker = new FakeElement("section");
    const controls = new FakeElement("div");
    const rollAll = new FakeElement("button");
    rollAll.setAttribute("data-action", "rollAll");
    rollAll.classList.add("combat-button");
    controls.appendChild(rollAll);
    tracker.appendChild(controls);

    __combatInternals.onRenderCombatTracker({}, { get: () => tracker });

    const inserted = tracker.querySelector("[data-action='rollPC']");
    expect(inserted).not.toBeNull();
    expect(inserted?.classList.contains("combat-button")).toBe(true);
  });

  it("adds a rules reference scene control tool when enabled", () => {
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: true },
      settings: {
        get(module: string, key: string) {
          if (module !== MOD) return undefined;
          if (key === "enableRulesReference") return true;
          return undefined;
        },
      },
    };

    const controls: {
      tokens: {
        tools: Record<string, {
          name: string;
          title: string;
          icon: string;
          order: number;
          button: boolean;
          visible: boolean;
          onChange: () => void;
        }>;
      };
    } = {
      tokens: {
        tools: {
          select: {
            name: "select",
            title: "Select",
            icon: "fa-solid fa-expand",
            order: 0,
            button: true,
            visible: true,
            onChange: () => undefined,
          },
        },
      },
    };

    __combatInternals.onGetSceneControlButtonsRulesReference(controls);

    expect(controls.tokens.tools["fth-rules-reference"]).toMatchObject({
      name: "fth-rules-reference",
      title: "Rules Reference",
      order: 1,
      button: true,
      visible: true,
    });
  });
});
