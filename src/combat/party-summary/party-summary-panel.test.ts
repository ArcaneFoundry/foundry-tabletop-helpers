import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SaveAbility } from "../combat-types";
import type { PartySummaryCard } from "./party-summary-types";

const hooksOn = vi.fn();
const applyFthThemeToNodeMock = vi.fn();
const getGameMock = vi.fn();
const getSettingMock = vi.fn();
const extractCardDataMock = vi.fn<(actor: { id: string; name?: string }) => PartySummaryCard>();
const logWarnMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    debug: vi.fn(),
    warn: logWarnMock,
    error: logErrorMock,
  },
}));

vi.mock("../../types", () => ({
  getHooks: () => ({ on: hooksOn }),
  getGame: getGameMock,
  getSetting: getSettingMock,
  isGM: () => true,
  isDnd5eWorld: () => true,
}));

vi.mock("../../ui/theme/fth-theme", () => ({
  applyFthThemeToNode: applyFthThemeToNodeMock,
}));

vi.mock("./party-summary-types", () => ({
  extractCardData: extractCardDataMock,
}));

class FakeButtonElement {
  readonly dataset: Record<string, string>;
  private listeners = new Map<string, Array<(event: { preventDefault(): void }) => void>>();

  constructor(dataset: Record<string, string> = {}) {
    this.dataset = dataset;
  }

  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  click(): void {
    for (const listener of this.listeners.get("click") ?? []) {
      listener({ preventDefault() {} });
    }
  }

  closest(selector: string): FakeButtonElement | null {
    return selector === ".ps-close" ? this : null;
  }
}

class FakeDragHandle {
  style: Record<string, string> = {};
  private listeners = new Map<string, Array<(event: PointerEventLike) => void>>();

  addEventListener(type: string, listener: (event: PointerEventLike) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }
}

interface PointerEventLike {
  target: FakeButtonElement | null;
  clientX: number;
  clientY: number;
  pointerId: number;
  preventDefault(): void;
}

class FakeCardElement {
  readonly actorId: string;
  replacedWithCalls = 0;
  lastReplacement: FakeCardElement | null = null;
  private readonly saveButtons: FakeButtonElement[];
  private readonly nameButtons: FakeButtonElement[];

  constructor(actorId: string, html: string) {
    this.actorId = actorId;
    this.saveButtons = parseSaveButtons(html);
    this.nameButtons = parseNameButtons(html);
  }

  querySelectorAll<T>(selector: string): T[] {
    if (selector === ".ps-save-btn") return this.saveButtons as T[];
    if (selector === ".ps-card-name") return this.nameButtons as T[];
    return [];
  }

  replaceWith(el: FakeCardElement): void {
    this.replacedWithCalls += 1;
    this.lastReplacement = el;
  }
}

class FakePanelElement {
  id = "";
  className = "";
  style: Record<string, string> = {};
  private html = "";
  private cards = new Map<string, FakeCardElement>();
  private readonly closeButton = new FakeButtonElement();
  private readonly dragHandle = new FakeDragHandle();
  private saveButtons: FakeButtonElement[] = [];
  private nameButtons: FakeButtonElement[] = [];

  get innerHTML(): string {
    return this.html;
  }

  set innerHTML(value: string) {
    this.html = value;
    this.saveButtons = parseSaveButtons(value);
    this.nameButtons = parseNameButtons(value);
    this.cards = parseCards(value);
  }

  querySelector<T>(selector: string): T | null {
    if (selector === ".ps-close") return this.closeButton as T;
    if (selector === "[data-ps-drag]") return this.dragHandle as T;
    const cardMatch = selector.match(/^\[data-actor-id="(.+)"\]$/);
    if (cardMatch) return (this.cards.get(cardMatch[1]) as T | undefined) ?? null;
    return null;
  }

  querySelectorAll<T>(selector: string): T[] {
    if (selector === ".ps-save-btn") return this.saveButtons as T[];
    if (selector === ".ps-card-name") return this.nameButtons as T[];
    return [];
  }

  getCard(actorId: string): FakeCardElement | undefined {
    return this.cards.get(actorId);
  }

  setCard(actorId: string, card: FakeCardElement): void {
    this.cards.set(actorId, card);
  }

  get offsetLeft(): number {
    return 0;
  }

  get offsetTop(): number {
    return 0;
  }
}

class FakeWrapperElement {
  style: Record<string, string> = {};
  private html = "";
  firstElementChild: FakeCardElement | null = null;

  get innerHTML(): string {
    return this.html;
  }

  set innerHTML(value: string) {
    this.html = value;
    const card = parseCards(value).values().next().value as FakeCardElement | undefined;
    this.firstElementChild = card ?? null;
  }

  querySelector<T>(_selector: string): T | null {
    return null;
  }

  querySelectorAll<T>(_selector: string): T[] {
    return [];
  }
}

class FakeDocument {
  readonly body = {
    children: [] as FakePanelElement[],
    appendChild: (el: FakePanelElement) => {
      if (!this.body.children.includes(el)) this.body.children.push(el);
    },
  };

  createElement(tag: string): FakePanelElement | FakeWrapperElement {
    if (tag !== "div") throw new Error(`Unsupported tag ${tag}`);
    if (this.body.children.length === 0) return new FakePanelElement();
    return new FakeWrapperElement();
  }

  querySelector<T>(selector: string): T | null {
    if (selector === "#fth-party-summary") {
      return (this.body.children[0] as T | undefined) ?? null;
    }
    return null;
  }
}

function parseCards(html: string): Map<string, FakeCardElement> {
  const cards = new Map<string, FakeCardElement>();
  const ids = html.matchAll(/<div class="ps-card" data-actor-id="([^"]+)"/g);
  for (const [, actorId] of ids) {
    cards.set(actorId, new FakeCardElement(actorId, ""));
  }
  return cards;
}

function parseSaveButtons(html: string): FakeButtonElement[] {
  return Array.from(
    html.matchAll(/<button class="ps-save-btn[^"]*" data-actor-id="([^"]+)" data-ability="([^"]+)"/g),
    ([, actorId, ability]) => new FakeButtonElement({ actorId, ability }),
  );
}

function parseNameButtons(html: string): FakeButtonElement[] {
  return Array.from(
    html.matchAll(/<button class="ps-card-name" data-actor-id="([^"]+)"/g),
    ([, actorId]) => new FakeButtonElement({ actorId }),
  );
}

function installDocument(): FakeDocument {
  const document = new FakeDocument();
  const storage = new Map<string, string>();
  (globalThis as Record<string, unknown>).document = document;
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  return document;
}

function createActorsCollection(actors: Array<Record<string, unknown>>) {
  const map = new Map(actors.map((actor) => [actor.id as string, actor]));
  return {
    get: (id: string) => map.get(id),
    forEach: (callback: (actor: unknown) => void) => {
      for (const actor of map.values()) callback(actor);
    },
  };
}

function makeCard(actor: { id: string; name?: string }): PartySummaryCard {
  return {
    actorId: actor.id,
    name: actor.name ?? actor.id,
    portraitUrl: `${actor.id}.png`,
    classLabel: "Wizard 5",
    level: 5,
    ac: 15,
    hpValue: 27,
    hpMax: 30,
    hpTemp: 0,
    hpPercent: 90,
    healthTier: {
      id: "healthy",
      label: "Healthy",
      icon: "fa-heart",
      color: "#0f0",
      minPercent: 76,
      maxPercent: 100,
    },
    speed: 30,
    saves: [{
      ability: "dex",
      label: "DEX",
      modifier: "+3",
      modValue: 3,
      proficient: true,
    }],
    passivePerception: 14,
    passiveInvestigation: 12,
    passiveInsight: 13,
    spellDC: 15,
    isConcentrating: false,
    conditions: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.useFakeTimers();
  installDocument();

  getSettingMock.mockImplementation((_module: string, key: string) => {
    if (key === "enablePartySummary") return true;
    if (key === "partySource") return "primaryParty";
    return undefined;
  });
  extractCardDataMock.mockImplementation((actor) => makeCard(actor));
});

describe("party summary panel shell", () => {
  it("registers hooks and renders sorted primary-party characters", async () => {
    const groupMembers = [
      { actor: { id: "pc-b", name: "Borin", type: "character", hasPlayerOwner: true } },
      { actor: { id: "pc-a", name: "Arannis", type: "character", hasPlayerOwner: true } },
      { actor: { id: "npc-1", name: "Goblin", type: "npc", hasPlayerOwner: false } },
    ];

    getGameMock.mockReturnValue({
      actors: createActorsCollection([]),
      settings: {
        get: (_scope: string, key: string) => (key === "primaryParty"
          ? { actor: { type: "group", system: { members: groupMembers } } }
          : null),
      },
    });

    const panel = await import("./party-summary-panel");
    panel.registerPartySummaryHooks();
    panel.togglePartySummary();

    expect(hooksOn).toHaveBeenCalledWith("updateActor", expect.any(Function));
    expect(hooksOn).toHaveBeenCalledWith("createActiveEffect", expect.any(Function));
    expect(extractCardDataMock.mock.calls.map(([actor]) => actor.id)).toEqual(["pc-a", "pc-b"]);

    const renderedPanel = ((globalThis.document as unknown) as FakeDocument).querySelector<FakePanelElement>("#fth-party-summary");
    expect(applyFthThemeToNodeMock).toHaveBeenCalledWith(renderedPanel);
    expect(renderedPanel?.innerHTML).toContain("2 PCs");
  });

  it("falls back to player-owned actors and wires save/name actions to actor methods", async () => {
    getSettingMock.mockImplementation((_module: string, key: string) => {
      if (key === "enablePartySummary") return true;
      if (key === "partySource") return "primaryParty";
      return undefined;
    });

    const rollSavingThrow = vi.fn(async (_ability: SaveAbility) => {});
    const renderSheet = vi.fn();
    const actor = {
      id: "pc-1",
      name: "Seraphina",
      type: "character",
      hasPlayerOwner: true,
      rollSavingThrow,
      sheet: { render: renderSheet },
    };

    getGameMock.mockReturnValue({
      actors: createActorsCollection([
        actor,
        { id: "npc-1", name: "Ogre", type: "npc", hasPlayerOwner: false },
      ]),
      settings: {
        get: () => ({ actor: { type: "group", system: { members: [] } } }),
      },
    });

    const panel = await import("./party-summary-panel");
    panel.togglePartySummary();

    const renderedPanel = ((globalThis.document as unknown) as FakeDocument).querySelector<FakePanelElement>("#fth-party-summary");
    const saveButton = renderedPanel?.querySelectorAll<FakeButtonElement>(".ps-save-btn")[0];
    const nameButton = renderedPanel?.querySelectorAll<FakeButtonElement>(".ps-card-name")[0];

    saveButton?.click();
    await vi.runAllTimersAsync();
    nameButton?.click();

    expect(rollSavingThrow).toHaveBeenCalledWith("dex");
    expect(renderSheet).toHaveBeenCalledWith(true);
  });

  it("debounces actor and effect-driven card refreshes for tracked party members", async () => {
    const actor = {
      id: "pc-1",
      name: "Arannis",
      type: "character",
      hasPlayerOwner: true,
    };
    const actors = createActorsCollection([actor]);
    getGameMock.mockReturnValue({
      actors,
      settings: {
        get: () => ({ actor: { type: "group", system: { members: [{ actor }] } } }),
      },
    });

    const panel = await import("./party-summary-panel");
    panel.registerPartySummaryHooks();
    panel.togglePartySummary();

    const updateActorHook = hooksOn.mock.calls.find((call) => call[0] === "updateActor")?.[1] as
      (actor: unknown) => void;
    const updateEffectHook = hooksOn.mock.calls.find((call) => call[0] === "updateActiveEffect")?.[1] as
      (effect: { parent?: unknown }) => void;

    extractCardDataMock.mockImplementation((nextActor) => ({
      ...makeCard(nextActor),
      hpValue: nextActor.id === "pc-1" ? 11 : 27,
    }));

    updateActorHook(actor);
    updateEffectHook({ parent: actor });
    await vi.advanceTimersByTimeAsync(100);

    const renderedPanel = ((globalThis.document as unknown) as FakeDocument).querySelector<FakePanelElement>("#fth-party-summary");
    const card = renderedPanel?.getCard("pc-1");

    expect(extractCardDataMock).toHaveBeenCalledTimes(2);
    expect(card?.replacedWithCalls).toBe(1);
    expect(card?.lastReplacement).not.toBeNull();
  });
});
