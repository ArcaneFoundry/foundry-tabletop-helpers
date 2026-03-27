import { getGame, getHooks, isGM } from "../types";
import { normalizeSoundscapeTriggerContext } from "./soundscape-normalization";
import { resolveStoredSoundscapeState } from "./soundscape-accessors";
import { syncResolvedSoundscapeAmbience } from "./soundscape-ambience-controller";
import { syncResolvedSoundscapeMusic } from "./soundscape-music-controller";
import type { SoundscapeTimeOfDay, SoundscapeTriggerContext } from "./soundscape-types";

const CORE_NIGHT_DARKNESS_THRESHOLD = 0.5;
const CALENDARIA_MODULE_ID = "calendaria";

interface HookRegistration {
  event: string;
  id: number;
}

interface SceneLike {
  id: string;
  active?: boolean;
  darkness?: number;
}

interface CombatLike {
  active?: boolean;
  started?: boolean;
  round?: unknown;
  turn?: unknown;
}

interface WeatherLike {
  id?: unknown;
  key?: unknown;
  presetId?: unknown;
  label?: unknown;
}

interface CalendariaApiLike {
  isDaytime?: () => boolean;
  isNighttime?: () => boolean;
  getCurrentWeather?: (zoneId?: string) => WeatherLike | string | null | undefined;
}

interface CalendariaGlobalLike {
  api?: CalendariaApiLike;
}

type ProviderPatch = Partial<Pick<SoundscapeTriggerContext, "inCombat" | "weather" | "timeOfDay">>;

interface ProviderState {
  combat: ProviderPatch;
  coreScene: ProviderPatch;
  calendaria: ProviderPatch;
}

function createProviderState(): ProviderState {
  return {
    combat: { inCombat: false },
    coreScene: { timeOfDay: null },
    calendaria: {},
  };
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildContextKey(sceneId: string | null, context: SoundscapeTriggerContext): string {
  return JSON.stringify({ sceneId, context });
}

function normalizeWeatherKey(value: unknown): string | null {
  const direct = asNonEmptyString(value);
  if (direct) return direct;
  if (!isRecord(value)) return null;
  return asNonEmptyString(value.id)
    ?? asNonEmptyString(value.key)
    ?? asNonEmptyString(value.presetId)
    ?? asNonEmptyString(value.label);
}

function normalizeWeatherPayload(value: unknown): string | null {
  if (!isRecord(value)) return normalizeWeatherKey(value);
  if (value.visualOnly === true) return null;
  return normalizeWeatherKey(value.current) ?? normalizeWeatherKey(value);
}

function isCombatStarted(combat: CombatLike | null | undefined): boolean {
  if (!combat) return false;
  if (combat.started === true) return true;

  const round = typeof combat.round === "number" ? combat.round : null;
  const turn = typeof combat.turn === "number" ? combat.turn : null;
  return (round ?? 0) > 0 || turn !== null;
}

function resolveTimeOfDayFromCalendaria(api: CalendariaApiLike | null): SoundscapeTimeOfDay | null {
  if (!api) return null;
  if (api.isDaytime?.() === true) return "day";
  if (api.isNighttime?.() === true) return "night";
  return null;
}

function getCalendariaApi(): CalendariaApiLike | null {
  const root = globalThis as Record<string, unknown>;
  const calendaria = root.CALENDARIA as CalendariaGlobalLike | undefined;
  return calendaria?.api ?? null;
}

export class SoundscapeTriggerService {
  private readonly hookRegistrations: HookRegistration[] = [];
  private providerState: ProviderState = createProviderState();
  private currentContext = normalizeSoundscapeTriggerContext({});
  private lastSyncKey: string | null = null;
  private pendingSyncKey: string | null = null;
  private syncQueue: Promise<void> = Promise.resolve();
  private started = false;

  async start(): Promise<void> {
    if (!isGM()) return;
    if (!this.started) {
      this.started = true;
      this.registerHooks();
    }
    await this.refresh();
  }

  stop(): void {
    const hooks = getHooks();
    for (const registration of this.hookRegistrations) {
      hooks?.off?.(registration.event, registration.id);
    }
    this.hookRegistrations.length = 0;
    this.providerState = createProviderState();
    this.currentContext = normalizeSoundscapeTriggerContext({});
    this.started = false;
    this.lastSyncKey = null;
    this.pendingSyncKey = null;
    this.syncQueue = Promise.resolve();
  }

  getContext(): SoundscapeTriggerContext {
    return normalizeSoundscapeTriggerContext(this.currentContext);
  }

  async refresh(): Promise<void> {
    this.providerState.combat = this.readCombatPatch();
    this.providerState.coreScene = this.readCoreScenePatch();
    this.providerState.calendaria = this.readCalendariaPatch();
    await this.queueSync();
  }

  private registerHooks(): void {
    this.registerHook("combatStart", () => {
      this.providerState.combat = { inCombat: true };
      void this.queueSync();
    });
    this.registerHook("combatEnd", () => {
      void this.refresh();
    });
    this.registerHook("createCombat", () => {
      void this.refresh();
    });
    this.registerHook("updateCombat", () => {
      void this.refresh();
    });
    this.registerHook("deleteCombat", () => {
      void this.refresh();
    });
    this.registerHook("canvasReady", () => {
      void this.refresh();
    });
    this.registerHook("updateScene", () => {
      void this.refresh();
    });

    this.registerHook("calendaria.ready", () => {
      void this.refresh();
    });
    this.registerHook("calendaria.dateTimeChange", () => {
      void this.refresh();
    });
    this.registerHook("calendaria.dayChange", () => {
      void this.refresh();
    });
    this.registerHook("calendaria.seasonChange", () => {
      void this.refresh();
    });
    this.registerHook("calendaria.sunrise", () => {
      this.providerState.calendaria = {
        ...this.providerState.calendaria,
        timeOfDay: "day",
      };
      void this.queueSync();
    });
    this.registerHook("calendaria.sunset", () => {
      this.providerState.calendaria = {
        ...this.providerState.calendaria,
        timeOfDay: "night",
      };
      void this.queueSync();
    });
    this.registerHook("calendaria.weatherChange", (weather?: unknown) => {
      const nextWeather = normalizeWeatherPayload(weather);
      if (nextWeather === null && isRecord(weather) && weather.visualOnly === true) return;
      this.providerState.calendaria = {
        ...this.providerState.calendaria,
        weather: nextWeather ?? this.readCalendariaPatch().weather ?? null,
      };
      void this.queueSync();
    });
  }

  private registerHook(event: string, callback: (...args: unknown[]) => void): void {
    const id = getHooks()?.on?.(event, callback);
    if (typeof id === "number") {
      this.hookRegistrations.push({ event, id });
    }
  }

  private readCombatPatch(): ProviderPatch {
    const game = getGame();
    const activeCombat = game?.combat;
    if (isCombatStarted(activeCombat)) {
      return { inCombat: true };
    }
    const combats = game?.combats;
    const inCombat = combats?.find((combat: CombatLike) => isCombatStarted(combat)) !== undefined;
    return { inCombat };
  }

  private readCoreScenePatch(): ProviderPatch {
    const scene = this.getActiveScene();
    if (typeof scene?.darkness !== "number" || !Number.isFinite(scene.darkness)) {
      return { timeOfDay: null };
    }
    return {
      timeOfDay: scene.darkness >= CORE_NIGHT_DARKNESS_THRESHOLD ? "night" : "day",
    };
  }

  private readCalendariaPatch(): ProviderPatch {
    if (!this.isCalendariaActive()) return {};
    const api = getCalendariaApi();
    if (!api) return {};
    return {
      timeOfDay: resolveTimeOfDayFromCalendaria(api),
      weather: normalizeWeatherKey(api.getCurrentWeather?.()) ?? null,
    };
  }

  private getActiveScene(): SceneLike | null {
    const scenes = getGame()?.scenes;
    return scenes?.find((scene: SceneLike) => scene.active === true) ?? null;
  }

  private composeContext(): SoundscapeTriggerContext {
    return normalizeSoundscapeTriggerContext({
      manualPreview: false,
      inCombat: this.providerState.combat.inCombat,
      timeOfDay: this.providerState.calendaria.timeOfDay ?? this.providerState.coreScene.timeOfDay ?? null,
      weather: this.providerState.calendaria.weather ?? null,
    });
  }

  private isCalendariaActive(): boolean {
    return getGame()?.modules?.get(CALENDARIA_MODULE_ID)?.active === true;
  }

  private queueSync(): Promise<void> {
    const sceneId = this.getActiveScene()?.id ?? null;
    const nextContext = this.composeContext();
    this.currentContext = nextContext;

    const nextKey = buildContextKey(sceneId, nextContext);
    if (nextKey === this.lastSyncKey || nextKey === this.pendingSyncKey) return this.syncQueue;
    this.pendingSyncKey = nextKey;

    this.syncQueue = this.syncQueue
      .catch(() => undefined)
      .then(async () => {
        const resolvedState = resolveStoredSoundscapeState(sceneId ?? undefined, nextContext);
        await Promise.all([
          syncResolvedSoundscapeMusic(resolvedState),
          syncResolvedSoundscapeAmbience(resolvedState),
        ]);
        this.lastSyncKey = nextKey;
        this.pendingSyncKey = null;
      })
      .catch((error: unknown) => {
        this.pendingSyncKey = null;
        throw error;
      });
    return this.syncQueue;
  }
}

const singletonService = new SoundscapeTriggerService();

export async function startSoundscapeTriggerService(): Promise<void> {
  await singletonService.start();
}

export function stopSoundscapeTriggerService(): void {
  singletonService.stop();
}

export function getSoundscapeTriggerContext(): SoundscapeTriggerContext {
  return singletonService.getContext();
}

export const __soundscapeTriggerServiceInternals = {
  singletonService,
  buildContextKey,
  getCalendariaApi,
  isCombatStarted,
  normalizeWeatherKey,
  normalizeWeatherPayload,
};
