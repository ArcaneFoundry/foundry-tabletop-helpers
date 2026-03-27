import { beforeEach, describe, expect, it, vi } from "vitest";

type HookCallback = (...args: unknown[]) => void;
type SceneLike = { id: string; active?: boolean; darkness?: number };
type CombatLike = { id: string; active?: boolean; started?: boolean; round?: number | null; turn?: number | null };

const resolveStoredSoundscapeStateMock = vi.fn();
const syncResolvedSoundscapeMusicMock = vi.fn(async () => undefined);
const syncResolvedSoundscapeAmbienceMock = vi.fn(async () => undefined);
const isGMMock = vi.fn(() => true);
const onMock = vi.fn((event: string, callback: HookCallback) => {
  registeredHooks.set(event, callback);
  return registeredHooks.size;
});
const offMock = vi.fn((event: string) => {
  registeredHooks.delete(event);
});
const getHooksMock = vi.fn(() => hookApi);

const registeredHooks = new Map<string, HookCallback>();
const hookApi = {
  on: onMock,
  off: offMock,
  once: vi.fn(),
  call: vi.fn(),
  callAll: vi.fn(),
};

let currentScene: SceneLike;
let currentCombat: CombatLike | null;
let currentCalendariaActive = false;
let currentCalendariaApi: {
  isDaytime?: () => boolean;
  isNighttime?: () => boolean;
  getCurrentWeather?: (zoneId?: string) => unknown;
} | null;

function makeCollection<T extends { id: string }>(getItems: () => T[]) {
  return {
    get(id: string): T | undefined {
      return getItems().find((item) => item.id === id);
    },
    find(predicate: (item: T) => boolean): T | undefined {
      return getItems().find(predicate);
    },
  };
}

function setWorld({
  sceneDarkness = 0.2,
  sceneActive = true,
  combatActive = false,
  combatStarted = false,
  combatRound = null,
  combatTurn = null,
  calendariaActive = false,
  calendariaApi = null,
}: {
  sceneDarkness?: number;
  sceneActive?: boolean;
  combatActive?: boolean;
  combatStarted?: boolean;
  combatRound?: number | null;
  combatTurn?: number | null;
  calendariaActive?: boolean;
  calendariaApi?: typeof currentCalendariaApi;
} = {}): void {
  currentScene = { id: "scene-1", active: sceneActive, darkness: sceneDarkness };
  currentCombat = {
    id: "combat-1",
    active: combatActive,
    started: combatStarted,
    round: combatRound,
    turn: combatTurn,
  };
  currentCalendariaActive = calendariaActive;
  currentCalendariaApi = calendariaApi;

  (globalThis as Record<string, unknown>).game = {
    user: { id: "user-1", isGM: true },
    version: "13.0.0",
    system: { id: "dnd5e", version: "5.3.0" },
    scenes: makeCollection(() => [currentScene]),
    combat: currentCombat ?? undefined,
    combats: makeCollection(() => (currentCombat ? [currentCombat] : [])),
    modules: new Map([
      ["calendaria", { active: currentCalendariaActive, version: "0.11.9" }],
    ]),
  };

  if (currentCalendariaApi) {
    (globalThis as Record<string, unknown>).CALENDARIA = {
      api: currentCalendariaApi,
    };
  } else {
    delete (globalThis as Record<string, unknown>).CALENDARIA;
  }
}

vi.mock("../types", () => ({
  getGame: () => (globalThis as Record<string, unknown>).game,
  getHooks: getHooksMock,
  isGM: isGMMock,
}));

vi.mock("./soundscape-accessors", () => ({
  resolveStoredSoundscapeState: resolveStoredSoundscapeStateMock,
}));

vi.mock("./soundscape-music-controller", () => ({
  syncResolvedSoundscapeMusic: syncResolvedSoundscapeMusicMock,
}));

vi.mock("./soundscape-ambience-controller", () => ({
  syncResolvedSoundscapeAmbience: syncResolvedSoundscapeAmbienceMock,
}));

async function loadService() {
  vi.resetModules();
  return await import("./soundscape-trigger-service");
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("soundscape trigger service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHooks.clear();
    isGMMock.mockReturnValue(true);
    setWorld();
    resolveStoredSoundscapeStateMock.mockImplementation((sceneId?: string, context?: Record<string, unknown>) => ({
      profileId: "forest",
      assignmentSource: "scene",
      sceneId: sceneId ?? null,
      context: context ?? {},
      musicProgramId: "calm",
      musicProgram: null,
      musicRuleId: null,
      ambienceLayerIds: ["wind"],
      ambienceLayers: [],
      ambienceRuleId: null,
      soundMoments: [],
    }));
  });

  it("starts as a GM-authoritative service, resolves the current scene context, and syncs both channels once", async () => {
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();

    expect(onMock).toHaveBeenCalledWith("combatStart", expect.any(Function));
    expect(onMock).toHaveBeenCalledWith("updateScene", expect.any(Function));
    expect(onMock).toHaveBeenCalledWith("calendaria.ready", expect.any(Function));
    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", {
      manualPreview: false,
      inCombat: false,
      timeOfDay: "day",
      weather: null,
    });
    expect(syncResolvedSoundscapeMusicMock).toHaveBeenCalledTimes(1);
    expect(syncResolvedSoundscapeAmbienceMock).toHaveBeenCalledTimes(1);
    expect(syncResolvedSoundscapeMusicMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "forest",
      sceneId: "scene-1",
    }));
    expect(syncResolvedSoundscapeAmbienceMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "forest",
      sceneId: "scene-1",
    }));
    expect(mod.getSoundscapeTriggerContext()).toEqual({
      manualPreview: false,
      inCombat: false,
      timeOfDay: "day",
      weather: null,
    });
  });

  it("dedupes repeated combat bursts and flips back out of combat on combat end", async () => {
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();
    registeredHooks.get("combatStart")?.();
    registeredHooks.get("combatStart")?.();
    await flushMicrotasks();

    expect(syncResolvedSoundscapeMusicMock).toHaveBeenCalledTimes(2);
    expect(syncResolvedSoundscapeAmbienceMock).toHaveBeenCalledTimes(2);
    expect(mod.getSoundscapeTriggerContext()).toEqual(expect.objectContaining({ inCombat: true }));

    if (currentCombat) {
      currentCombat.active = false;
      currentCombat.started = false;
    }

    registeredHooks.get("combatEnd")?.();
    await flushMicrotasks();

    expect(resolveStoredSoundscapeStateMock).toHaveBeenLastCalledWith("scene-1", expect.objectContaining({ inCombat: false }));
    expect(syncResolvedSoundscapeMusicMock).toHaveBeenCalledTimes(3);
    expect(syncResolvedSoundscapeAmbienceMock).toHaveBeenCalledTimes(3);
  });

  it("does not treat an active but unstarted combat as in-combat", async () => {
    setWorld({
      combatActive: true,
      combatStarted: false,
      combatRound: null,
      combatTurn: null,
    });
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();

    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", expect.objectContaining({
      inCombat: false,
    }));
    expect(mod.getSoundscapeTriggerContext()).toEqual(expect.objectContaining({
      inCombat: false,
    }));
  });

  it("prefers Calendaria hooks and API data over core scene darkness", async () => {
    setWorld({
      sceneDarkness: 0.9,
      calendariaActive: true,
      calendariaApi: {
        isDaytime: () => false,
        isNighttime: () => true,
        getCurrentWeather: () => ({ key: "storm" }),
      },
    });
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();

    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", {
      manualPreview: false,
      inCombat: false,
      timeOfDay: "night",
      weather: "storm",
    });

    currentCalendariaApi = {
      isDaytime: () => true,
      isNighttime: () => false,
      getCurrentWeather: () => ({ label: "rain" }),
    };
    (globalThis as Record<string, unknown>).CALENDARIA = { api: currentCalendariaApi };

    registeredHooks.get("calendaria.weatherChange")?.({ label: "hail" });
    await flushMicrotasks();

    expect(mod.getSoundscapeTriggerContext()).toEqual({
      manualPreview: false,
      inCombat: false,
      timeOfDay: "night",
      weather: "hail",
    });
    expect(syncResolvedSoundscapeMusicMock).toHaveBeenCalledTimes(2);
    expect(syncResolvedSoundscapeAmbienceMock).toHaveBeenCalledTimes(2);
  });

  it("applies sunrise and sunset hooks directly while keeping Calendaria authoritative", async () => {
    setWorld({
      sceneDarkness: 0.1,
      calendariaActive: true,
      calendariaApi: {
        isDaytime: () => true,
        isNighttime: () => false,
        getCurrentWeather: () => ({ key: "clear" }),
      },
    });
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();
    registeredHooks.get("calendaria.sunset")?.();
    await flushMicrotasks();

    expect(mod.getSoundscapeTriggerContext()).toEqual({
      manualPreview: false,
      inCombat: false,
      timeOfDay: "night",
      weather: "clear",
    });

    registeredHooks.get("calendaria.sunrise")?.();
    await flushMicrotasks();

    expect(mod.getSoundscapeTriggerContext()).toEqual({
      manualPreview: false,
      inCombat: false,
      timeOfDay: "day",
      weather: "clear",
    });
  });

  it("ignores Calendaria visual-only weather previews", async () => {
    setWorld({
      calendariaActive: true,
      calendariaApi: {
        isDaytime: () => true,
        isNighttime: () => false,
        getCurrentWeather: () => ({ key: "clear" }),
      },
    });
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();
    registeredHooks.get("calendaria.weatherChange")?.({
      visualOnly: true,
      current: { key: "storm" },
    });
    await flushMicrotasks();

    expect(mod.getSoundscapeTriggerContext()).toEqual({
      manualPreview: false,
      inCombat: false,
      timeOfDay: "day",
      weather: "clear",
    });
    expect(syncResolvedSoundscapeMusicMock).toHaveBeenCalledTimes(1);
    expect(syncResolvedSoundscapeAmbienceMock).toHaveBeenCalledTimes(1);
  });

  it("cleans up hooks and resets context on stop", async () => {
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();
    expect(registeredHooks.size).toBeGreaterThan(0);

    mod.stopSoundscapeTriggerService();

    expect(offMock).toHaveBeenCalled();
    expect(registeredHooks.size).toBe(0);
    expect(mod.getSoundscapeTriggerContext()).toEqual({
      manualPreview: false,
      inCombat: false,
      timeOfDay: null,
      weather: null,
    });
  });

  it("is a no-op for non-gm clients", async () => {
    isGMMock.mockReturnValue(false);
    const mod = await loadService();

    await mod.startSoundscapeTriggerService();

    expect(onMock).not.toHaveBeenCalled();
    expect(resolveStoredSoundscapeStateMock).not.toHaveBeenCalled();
    expect(syncResolvedSoundscapeMusicMock).not.toHaveBeenCalled();
    expect(syncResolvedSoundscapeAmbienceMock).not.toHaveBeenCalled();
    expect(mod.getSoundscapeTriggerContext()).toEqual({
      manualPreview: false,
      inCombat: false,
      timeOfDay: null,
      weather: null,
    });
  });
});
