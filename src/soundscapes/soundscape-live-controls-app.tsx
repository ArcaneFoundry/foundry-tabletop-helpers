import { useEffect, useState, type JSX } from "react";

import { Log, MOD } from "../logger";
import { getHooks, getUI, isGM, loadTemplates } from "../types";
import { ensureNativeWindowResizeHandle, type ApplicationV2Like } from "../ui/foundry/application-v2/window-resize-handle";
import {
  ensureWindowSizeConstraints,
  type ApplicationPositionLike,
  type ApplicationV2PositionLike,
  type WindowSizeConstraints,
} from "../ui/foundry/application-v2/window-size-constraints";
import { getFoundryReactMount, FoundryReactRenderer } from "../ui/foundry/react/foundry-react-application";
import { getSoundscapeSceneById, resolveStoredSoundscapeState } from "./soundscape-accessors";
import {
  getSoundscapeAmbienceRuntimeSnapshot,
  playStoredSoundscapeMoment,
} from "./soundscape-ambience-controller";
import type { SoundscapeMomentPlaybackResult } from "./soundscape-ambience-runtime";
import { getSoundscapeMusicRuntimeSnapshot } from "./soundscape-music-controller";
import { openSoundscapeStudio } from "./soundscape-studio-app";
import { listSoundscapeScenes } from "./soundscape-studio-helpers";
import { getSoundscapeTriggerContext } from "./soundscape-trigger-service";
import type {
  ResolvedSoundscapeState,
  SoundscapeTimeOfDay,
  SoundscapeTriggerContext,
} from "./soundscape-types";

interface RuntimeApplicationBase extends ApplicationV2PositionLike {
  element?: Element | null;
  hasFrame?: boolean;
  window?: ApplicationV2Like["window"];
  position?: Partial<ApplicationPositionLike> | null;
  render(options?: Record<string, unknown>): void;
  close(options?: unknown): Promise<void>;
  _preparePartContext?(partId: string, context: unknown, options: unknown): Promise<unknown>;
}

interface RuntimeApplicationClass {
  new (): RuntimeApplicationBase;
}

type RuntimeHandlebarsApplicationMixin = (base: RuntimeApplicationClass) => RuntimeApplicationClass;

interface RuntimeFoundryAppClasses {
  HandlebarsApplicationMixin?: RuntimeHandlebarsApplicationMixin;
  ApplicationV2?: RuntimeApplicationClass;
}

interface SceneControlTool {
  name: string;
  title: string;
  icon: string;
  order: number;
  button: boolean;
  visible: boolean;
  onChange: () => void;
}

interface SceneControls {
  tokens?: {
    tools?: Record<string, SceneControlTool>;
  };
}

const SOUNDSCAPE_LIVE_CONTROLS_WINDOW_CONSTRAINTS = {
  minWidth: 520,
  maxWidth: 860,
  minHeight: 540,
  maxHeight: 1040,
} satisfies WindowSizeConstraints;

const LIVE_CONTROL_REFRESH_EVENTS = [
  "canvasReady",
  "combatStart",
  "combatEnd",
  "createCombat",
  "updateCombat",
  "deleteCombat",
  "updateScene",
  "calendaria.ready",
  "calendaria.dateTimeChange",
  "calendaria.dayChange",
  "calendaria.sunrise",
  "calendaria.sunset",
  "calendaria.weatherChange",
] as const;

const getFoundryAppClasses = () => {
  const g = globalThis as Record<string, unknown>;
  const api = (g.foundry as Record<string, unknown> | undefined)
    ?.applications as Record<string, unknown> | undefined;
  const appApi = api?.api as Record<string, unknown> | undefined;
  return {
    HandlebarsApplicationMixin: appApi?.HandlebarsApplicationMixin as RuntimeHandlebarsApplicationMixin | undefined,
    ApplicationV2: appApi?.ApplicationV2 as RuntimeApplicationClass | undefined,
  } satisfies RuntimeFoundryAppClasses;
};

function normalizeTimeOfDay(value: SoundscapeTimeOfDay | null): string {
  return value === "night" ? "Night" : value === "day" ? "Day" : "Unknown";
}

function normalizeSceneLabel(sceneId: string | null): string {
  if (!sceneId) return "No active scene";
  return listSoundscapeScenes().find((scene) => scene.id === sceneId)?.name ?? "Unknown Scene";
}

function SoundscapeLiveControlsView(): JSX.Element {
  const [context, setContext] = useState<SoundscapeTriggerContext>(() => getSoundscapeTriggerContext());
  const [resolvedState, setResolvedState] = useState<ResolvedSoundscapeState | null>(() => resolveStoredSoundscapeState(undefined, getSoundscapeTriggerContext()));
  const [musicSnapshot, setMusicSnapshot] = useState(() => getSoundscapeMusicRuntimeSnapshot());
  const [ambienceSnapshot, setAmbienceSnapshot] = useState(() => getSoundscapeAmbienceRuntimeSnapshot());
  const [status, setStatus] = useState("Reading live soundscape state...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playingMomentId, setPlayingMomentId] = useState<string | null>(null);

  async function refreshState(reason = "Live soundscape state refreshed."): Promise<void> {
    setIsRefreshing(true);
    const nextContext = getSoundscapeTriggerContext();
    const nextResolvedState = resolveStoredSoundscapeState(undefined, nextContext);
    setContext(nextContext);
    setResolvedState(nextResolvedState);
    setMusicSnapshot(getSoundscapeMusicRuntimeSnapshot());
    setAmbienceSnapshot(getSoundscapeAmbienceRuntimeSnapshot());
    setStatus(reason);
    setIsRefreshing(false);
  }

  useEffect(() => {
    void refreshState();

    const hooks = getHooks();
    const registrations: Array<{ event: string; id: number }> = [];
    for (const event of LIVE_CONTROL_REFRESH_EVENTS) {
      const id = hooks?.on?.(event, () => {
        void refreshState("Live soundscape state updated from Foundry.");
      });
      if (typeof id === "number") registrations.push({ event, id });
    }

    return () => {
      for (const registration of registrations) {
        hooks?.off?.(registration.event, registration.id);
      }
    };
  }, []);

  async function playMoment(momentId: string, momentName: string): Promise<void> {
    setPlayingMomentId(momentId);
    const liveContext = getSoundscapeTriggerContext();
    setContext(liveContext);

    let result: SoundscapeMomentPlaybackResult;
    try {
      result = await playStoredSoundscapeMoment(momentId, undefined, liveContext);
    } finally {
      setPlayingMomentId(null);
    }

    setMusicSnapshot(getSoundscapeMusicRuntimeSnapshot());
    setAmbienceSnapshot(getSoundscapeAmbienceRuntimeSnapshot());

    if (result.played) {
      setStatus(`Played ${momentName}${result.audioPath ? ` (${result.audioPath})` : ""}.`);
    } else {
      setStatus(result.error ?? `Unable to play ${momentName}.`);
    }
  }

  const activeScene = getSoundscapeSceneById();

  return (
    <div className="fth-react-app-shell fth-ui-root flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(114,78,33,0.16),transparent_28%),linear-gradient(180deg,#120f12_0%,#19161b_50%,#0e0c10_100%)] text-[#f5efe6]">
      <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(20,17,19,0.94),rgba(12,10,12,0.82))] px-5 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.28em] text-[#d9bb84]/76">Reactive Soundscapes</div>
            <h1 className="mt-2 font-fth-cc-display text-[1.6rem] leading-none text-[#f7e7ca]">Soundscape Live Controls</h1>
            <p className="mt-2 max-w-2xl font-fth-cc-body text-[0.95rem] leading-6 text-[#d6cec5]">
              Trigger authored manual moments against the current live soundscape state without reopening the full studio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LiveControlsButton disabled={isRefreshing} label={isRefreshing ? "Refreshing..." : "Refresh"} onClick={() => void refreshState()} tone="gold" />
            <LiveControlsButton label="Open Studio" onClick={() => openSoundscapeStudio()} />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:px-5">
        <section className="space-y-4">
          <LiveControlsCard title="Current State">
            {resolvedState ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <LiveControlsValue label="Scene">{normalizeSceneLabel(activeScene?.id ?? null)}</LiveControlsValue>
                  <LiveControlsValue label="Profile">{resolvedState.profileId}</LiveControlsValue>
                  <LiveControlsValue label="Assignment">{resolvedState.assignmentSource === "scene" ? "Scene Override" : "World Default"}</LiveControlsValue>
                  <LiveControlsValue label="Time Of Day">{normalizeTimeOfDay(context.timeOfDay)}</LiveControlsValue>
                  <LiveControlsValue label="Combat">{context.inCombat ? "Active" : "Inactive"}</LiveControlsValue>
                  <LiveControlsValue label="Weather">{context.weather ?? "None"}</LiveControlsValue>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <LiveControlsValue label="Music">{resolvedState.musicProgram?.name ?? "No music"}</LiveControlsValue>
                  <LiveControlsValue label="Ambience">
                    {resolvedState.ambienceLayers.length > 0
                      ? resolvedState.ambienceLayers.map((layer) => layer.name).join(", ")
                      : "No ambience"}
                  </LiveControlsValue>
                </div>
              </div>
            ) : (
              <EmptyPanel message="No active scene assignment or world default soundscape is resolving right now." />
            )}
          </LiveControlsCard>

          <LiveControlsCard title="Manual Moments">
            {resolvedState && resolvedState.soundMoments.length > 0 ? (
              <div className="space-y-3">
                {resolvedState.soundMoments.map((moment) => (
                  <div
                    className="flex flex-col gap-3 rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    key={moment.id}
                  >
                    <div className="min-w-0">
                      <div className="font-fth-cc-display text-[1.08rem] text-[#f5e5c6]">{moment.name}</div>
                      <div className="mt-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[#c7bcad]">
                        {moment.id} · {moment.audioPaths.length} sound{moment.audioPaths.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <LiveControlsButton
                      disabled={playingMomentId !== null}
                      label={playingMomentId === moment.id ? "Playing..." : "Play Moment"}
                      onClick={() => void playMoment(moment.id, moment.name)}
                      tone="gold"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel message="The current live soundscape does not expose any manual moments." />
            )}
          </LiveControlsCard>
        </section>

        <section className="space-y-4">
          <LiveControlsCard title="Runtime Snapshot">
            <div className="grid gap-3">
              <RuntimePill label="Music Program" value={musicSnapshot.activeProgramId ?? "Idle"} />
              <RuntimePill label="Audio Path" value={musicSnapshot.activeAudioPath ?? "None"} />
              <RuntimePill label="Queued Delay" value={musicSnapshot.pendingDelayMs !== null ? `${musicSnapshot.pendingDelayMs} ms` : "None"} />
              <RuntimePill label="Ambience Layers" value={ambienceSnapshot.activeLayerIds.length > 0 ? ambienceSnapshot.activeLayerIds.join(", ") : "Idle"} />
              <RuntimePill label="Random Layers Pending" value={ambienceSnapshot.pendingRandomLayerIds.length > 0 ? ambienceSnapshot.pendingRandomLayerIds.join(", ") : "None"} />
              <RuntimePill label="Last Error" value={musicSnapshot.lastError ?? ambienceSnapshot.lastError ?? "None"} tone={musicSnapshot.lastError || ambienceSnapshot.lastError ? "danger" : "default"} />
            </div>
          </LiveControlsCard>

          <LiveControlsCard title="Status">
            <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 font-fth-cc-body text-sm text-[#eee3d4]">
              {status}
            </div>
          </LiveControlsCard>
        </section>
      </div>
    </div>
  );
}

function LiveControlsCard({
  title,
  children,
}: {
  title: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <section className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.22)]">
      <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em] text-[#d8ba84]/78">{title}</div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LiveControlsValue({
  label,
  children,
}: {
  label: string;
  children: string;
}): JSX.Element {
  return (
    <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.04] px-3 py-2.5">
      <div className="font-fth-cc-ui text-[0.54rem] uppercase tracking-[0.18em] text-[#c8bdaf]">{label}</div>
      <div className="mt-1 font-fth-cc-body text-sm text-[#f5ebdf]">{children}</div>
    </div>
  );
}

function RuntimePill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}): JSX.Element {
  return (
    <div className={[
      "rounded-[0.95rem] border px-3 py-2.5",
      tone === "danger"
        ? "border-[#bf7c69]/35 bg-[rgba(105,41,29,0.24)]"
        : "border-white/8 bg-white/[0.04]",
    ].join(" ")}>
      <div className="font-fth-cc-ui text-[0.54rem] uppercase tracking-[0.18em] text-[#c8bdaf]">{label}</div>
      <div className="mt-1 break-all font-fth-cc-body text-sm text-[#f5ebdf]">{value}</div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 font-fth-cc-body text-sm leading-6 text-[#b9b0a6]">
      {message}
    </div>
  );
}

function LiveControlsButton({
  label,
  onClick,
  tone = "default",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "gold";
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-full border px-4 py-2 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.16em] transition",
        disabled
          ? "cursor-not-allowed border-white/8 bg-white/[0.04] text-[#8f877d]"
          : tone === "gold"
            ? "border-[#ddb675]/55 bg-[linear-gradient(180deg,rgba(101,74,37,0.96),rgba(53,37,21,0.96))] text-[#f7e2b5] hover:border-[#e6c487] hover:text-[#fff0d1]"
            : "border-white/10 bg-white/[0.05] text-[#e8dfd3] hover:border-[#d3b06b]/28 hover:text-[#f8ecd4]",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

let _SoundscapeLiveControlsAppClass: RuntimeApplicationClass | null = null;

export function buildSoundscapeLiveControlsAppClass(): void {
  const { HandlebarsApplicationMixin, ApplicationV2 } = getFoundryAppClasses();
  if (typeof HandlebarsApplicationMixin !== "function" || typeof ApplicationV2 !== "function") {
    Log.warn("Reactive Soundscapes: ApplicationV2 not available - Soundscape Live Controls disabled");
    return;
  }

  const Base = HandlebarsApplicationMixin(ApplicationV2);

  class SoundscapeLiveControlsApp extends Base {
    static DEFAULT_OPTIONS = {
      id: "fth-soundscape-live-controls",
      classes: ["fth-soundscape-live-controls", "fth-ui-root"],
      tag: "div",
      window: {
        resizable: true,
        icon: "fa-solid fa-sliders",
        title: "Soundscape Live Controls",
      },
      position: { width: 660, height: 760 },
    };

    static PARTS = {
      root: {
        template: `modules/${MOD}/templates/soundscapes/soundscape-live-controls-root.hbs`,
      },
    };

    private _reactRenderer = new FoundryReactRenderer();

    async _prepareContext(_options: unknown): Promise<Record<string, never>> {
      return {};
    }

    async _preparePartContext(partId: string, context: Record<string, never>, options: unknown): Promise<unknown> {
      const base = await super._preparePartContext?.(partId, context, options) ?? {};
      return { ...base, ...context };
    }

    async _onRender(_context: Record<string, never>, _options: unknown): Promise<void> {
      const mount = getFoundryReactMount(this.element);
      ensureNativeWindowResizeHandle(this);
      ensureWindowSizeConstraints(this, SOUNDSCAPE_LIVE_CONTROLS_WINDOW_CONSTRAINTS);
      if (!mount) return;

      this._reactRenderer.render(mount, <SoundscapeLiveControlsView />);
    }

    async close(options?: unknown): Promise<void> {
      this._reactRenderer.unmount();
      return super.close(options);
    }
  }

  _SoundscapeLiveControlsAppClass = SoundscapeLiveControlsApp;
  Log.debug("Reactive Soundscapes: Soundscape Live Controls class built");
}

export function getSoundscapeLiveControlsAppClass(): RuntimeApplicationClass | null {
  return _SoundscapeLiveControlsAppClass;
}

export function openSoundscapeLiveControls(): void {
  if (!isGM()) {
    getUI()?.notifications?.warn?.("Soundscape Live Controls are only available to GMs.");
    return;
  }

  const AppClass = getSoundscapeLiveControlsAppClass();
  if (!AppClass) {
    buildSoundscapeLiveControlsAppClass();
  }

  const RuntimeClass = getSoundscapeLiveControlsAppClass();
  if (!RuntimeClass) return;

  const app = new RuntimeClass();
  app.render({ force: true });
}

export function registerSoundscapeLiveControlsHooks(): void {
  buildSoundscapeLiveControlsAppClass();
  loadTemplates([`modules/${MOD}/templates/soundscapes/soundscape-live-controls-root.hbs`]);
  getHooks()?.on?.("getSceneControlButtons", onGetSceneControlButtonsSoundscapeLiveControls);
}

function onGetSceneControlButtonsSoundscapeLiveControls(controls: SceneControls): void {
  if (!isGM()) return;
  if (!controls.tokens?.tools) return;

  controls.tokens.tools["fth-soundscape-live-controls"] = {
    name: "fth-soundscape-live-controls",
    title: "Soundscape Live Controls",
    icon: "fa-solid fa-sliders",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => openSoundscapeLiveControls(),
  };
}

export const __soundscapeLiveControlsAppInternals = {
  onGetSceneControlButtonsSoundscapeLiveControls,
};
