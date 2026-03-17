import { beforeEach, describe, expect, it, vi } from "vitest";

function makeActor(id: string, type = "character") {
  return {
    id,
    type,
    update: vi.fn(),
    createEmbeddedDocuments: vi.fn(),
    toObject: vi.fn(() => ({ id, type })),
  };
}

class FakeElement {
  className = "";
  type = "";
  title = "";
  innerHTML = "";
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  private readonly listeners = new Map<string, Array<(event: FakeEvent) => void>>();
  private readonly selectorMap = new Map<string, FakeElement | null>();

  addEventListener(event: string, listener: (event: FakeEvent) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
  }

  appendChild(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  insertBefore(child: FakeElement, reference: FakeElement | null): void {
    child.parent = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index === -1) {
      this.children.push(child);
      return;
    }
    this.children.splice(index, 0, child);
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === ".fth-level-up-btn") {
      return this.children.find((child) => child.className === "fth-level-up-btn") ?? null;
    }
    return this.selectorMap.get(selector) ?? null;
  }

  setQuerySelector(selector: string, value: FakeElement | null): void {
    this.selectorMap.set(selector, value);
  }

  trigger(event: string): FakeEvent {
    const fakeEvent = new FakeEvent();
    for (const listener of this.listeners.get(event) ?? []) listener(fakeEvent);
    return fakeEvent;
  }
}

class FakeEvent {
  defaultPrevented = false;
  propagationStopped = false;

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.propagationStopped = true;
  }
}

const buildLevelUpAppClassMock = vi.fn();
const openLevelUpWizardMock = vi.fn();
const shouldShowLevelUpMock = vi.fn(() => true);
const ccEnabledMock = vi.fn(() => true);
const ccLevelUpEnabledMock = vi.fn(() => true);

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../character-creator-settings", () => ({
  ccEnabled: ccEnabledMock,
  ccLevelUpEnabled: ccLevelUpEnabledMock,
}));

vi.mock("./level-up-app", () => ({
  buildLevelUpAppClass: buildLevelUpAppClassMock,
  openLevelUpWizard: openLevelUpWizardMock,
}));

vi.mock("./level-up-detection", () => ({
  shouldShowLevelUp: shouldShowLevelUpMock,
}));

describe("level-up init shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ccLevelUpEnabledMock.mockReturnValue(true);

    (globalThis as Record<string, unknown>).loadTemplates = vi.fn();
    (globalThis as Record<string, unknown>).foundry = {
      applications: {
        handlebars: {
          loadTemplates: vi.fn(),
        },
      },
    };
    (globalThis as Record<string, unknown>).Hooks = {
      on: vi.fn(),
    };
    (globalThis as Record<string, unknown>).document = {
      createElement: vi.fn(() => new FakeElement()),
    };
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      actors: {
        get: vi.fn((id: string) => (id === "actor-1" ? makeActor(id) : undefined)),
      },
    };
  });

  it("builds the app class, preloads templates, and registers the sheet and directory hooks", async () => {
    const mod = await import("./level-up-init");
    const namespacedLoadTemplatesMock = (
      (globalThis as Record<string, unknown>).foundry as {
        applications: { handlebars: { loadTemplates: ReturnType<typeof vi.fn> } };
      }
    ).applications.handlebars.loadTemplates;
    const loadTemplatesMock = (globalThis as Record<string, unknown>).loadTemplates as ReturnType<typeof vi.fn>;
    const hooksOn = ((globalThis as Record<string, unknown>).Hooks as { on: ReturnType<typeof vi.fn> }).on;

    mod.registerLevelUpHooks();

    expect(buildLevelUpAppClassMock).toHaveBeenCalledTimes(1);
    expect(namespacedLoadTemplatesMock).toHaveBeenCalledWith([
      "modules/foundry-tabletop-helpers/templates/character-creator/lu-step-class-choice.hbs",
      "modules/foundry-tabletop-helpers/templates/character-creator/lu-step-hp.hbs",
      "modules/foundry-tabletop-helpers/templates/character-creator/lu-step-features.hbs",
      "modules/foundry-tabletop-helpers/templates/character-creator/lu-step-spells.hbs",
      "modules/foundry-tabletop-helpers/templates/character-creator/lu-step-review.hbs",
    ]);
    expect(loadTemplatesMock).not.toHaveBeenCalled();
    expect(hooksOn).toHaveBeenCalledWith("renderActorSheet", expect.any(Function));
    expect(hooksOn).toHaveBeenCalledWith("getActorDirectoryEntryContext", expect.any(Function));
  });

  it("injects a level-up button into character sheets and routes clicks to the wizard", async () => {
    const mod = await import("./level-up-init");
    const header = new FakeElement();
    const close = new FakeElement();
    header.setQuerySelector(".header-control.close, [data-action='close']", close);

    const html = {
      querySelector: vi.fn((selector: string) => (
        selector === ".window-header, header" ? header : null
      )),
    };

    mod.__levelUpInitInternals.onRenderActorSheet(
      { document: makeActor("actor-1") },
      html,
    );

    const button = header.querySelector(".fth-level-up-btn");
    expect(button).not.toBeNull();
    expect(header.children[0]).toBe(button);

    const clickEvent = button?.trigger("click");
    expect(openLevelUpWizardMock).toHaveBeenCalledWith("actor-1");
    expect(clickEvent?.defaultPrevented).toBe(true);
    expect(clickEvent?.propagationStopped).toBe(true);
  });

  it("supports wrapped html hosts and avoids duplicate button injection", async () => {
    const mod = await import("./level-up-init");
    const header = new FakeElement();
    header.appendChild(Object.assign(new FakeElement(), { className: "fth-level-up-btn" }));

    mod.__levelUpInitInternals.onRenderActorSheet(
      { actor: makeActor("actor-1") },
      [{ querySelector: vi.fn(() => header) }],
    );

    expect(header.children).toHaveLength(1);
    expect(openLevelUpWizardMock).not.toHaveBeenCalled();
  });

  it("adds a directory entry option that gates on eligibility and opens the wizard", async () => {
    const mod = await import("./level-up-init");
    const options: Array<{
      name: string;
      icon: string;
      condition: (li: unknown) => boolean;
      callback: (li: unknown) => void;
    }> = [];

    mod.__levelUpInitInternals.onGetActorDirectoryEntryContext({}, options);

    expect(options).toHaveLength(1);
    expect(options[0]?.name).toBe("Level Up");

    const entry = { dataset: { documentId: "actor-1" } };
    expect(options[0]?.condition(entry)).toBe(true);

    options[0]?.callback(entry);
    expect(openLevelUpWizardMock).toHaveBeenCalledWith("actor-1");
  });

  it("skips sheet and directory integrations when level-up is disabled", async () => {
    ccLevelUpEnabledMock.mockReturnValue(false);

    const mod = await import("./level-up-init");
    const header = new FakeElement();
    const options: Array<{
      name: string;
      icon: string;
      condition: (li: unknown) => boolean;
      callback: (li: unknown) => void;
    }> = [];

    mod.__levelUpInitInternals.onRenderActorSheet(
      { document: makeActor("actor-1") },
      { querySelector: vi.fn(() => header) },
    );
    mod.__levelUpInitInternals.onGetActorDirectoryEntryContext({}, options);

    expect(header.children).toHaveLength(0);
    expect(options).toHaveLength(0);
    expect(openLevelUpWizardMock).not.toHaveBeenCalled();
  });
});
