import { getGame } from "../types";

interface RuntimeSoundLike {
  duration?: number;
  play?: (options?: Record<string, unknown>) => Promise<unknown>;
  stop?: () => Promise<unknown> | void;
  load?: () => Promise<void>;
}

interface RuntimeSoundFactory {
  create?: (data: Record<string, unknown>) => Promise<RuntimeSoundLike | null | undefined>;
  fromPath?: (path: string) => Promise<RuntimeSoundLike | null | undefined>;
  fromSource?: (path: string) => Promise<RuntimeSoundLike | null | undefined>;
  new (src: string, options?: Record<string, unknown>): RuntimeSoundLike;
}

export interface SoundscapeAudioHandle {
  path: string;
  durationSeconds: number;
  load(): Promise<void>;
  play(options?: { loop?: boolean }): Promise<boolean>;
  stop(): Promise<void>;
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").at(-1) ?? path;
}

function getSoundFactory(): RuntimeSoundFactory | null {
  const g = globalThis as Record<string, unknown>;
  const foundryNs = g.foundry as Record<string, unknown> | undefined;
  const audioNs = foundryNs?.audio as Record<string, unknown> | undefined;
  const candidate = audioNs?.Sound as RuntimeSoundFactory | undefined;
  return candidate ?? null;
}

async function createRuntimeSound(path: string): Promise<RuntimeSoundLike | null> {
  const Factory = getSoundFactory();
  if (!Factory) return null;

  try {
    if (typeof Factory.create === "function") {
      const created = await Factory.create({
        src: path,
        preload: true,
        singleton: false,
      });
      if (created) return created;
    }
  } catch {
    // Fall through to alternate factories.
  }

  try {
    if (typeof Factory.fromPath === "function") {
      const created = await Factory.fromPath(path);
      if (created) return created;
    }
  } catch {
    // Fall through to alternate factories.
  }

  try {
    if (typeof Factory.fromSource === "function") {
      const created = await Factory.fromSource(path);
      if (created) return created;
    }
  } catch {
    // Fall through to constructor fallback.
  }

  try {
    return new Factory(path);
  } catch {
    return null;
  }
}

function normalizeDurationSeconds(sound: RuntimeSoundLike): number {
  const duration = typeof sound.duration === "number" ? sound.duration : 0;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export async function resolveAudioPathPlayback(path: string): Promise<SoundscapeAudioHandle | null> {
  const trimmedPath = path.trim();
  if (trimmedPath.length === 0) return null;

  const sound = await createRuntimeSound(trimmedPath);
  if (!sound) return null;

  return {
    path: trimmedPath,
    get durationSeconds(): number {
      return normalizeDurationSeconds(sound);
    },
    async load(): Promise<void> {
      await sound.load?.();
    },
    async play(options?: { loop?: boolean }): Promise<boolean> {
      if (!sound.play) return false;
      await sound.play({ loop: options?.loop === true });
      return true;
    },
    async stop(): Promise<void> {
      await sound.stop?.();
    },
  };
}

export function isAudioPathResolvable(path: string): Promise<boolean> {
  return resolveAudioPathPlayback(path).then((handle) => handle !== null);
}

export function formatAudioPathLabel(path: string): string {
  const trimmedPath = path.trim();
  return trimmedPath.length > 0 ? basename(trimmedPath) : "Untitled Audio";
}

export const __soundscapeAudioPlaybackInternals = {
  createRuntimeSound,
  getSoundFactory,
  basename,
  normalizeDurationSeconds,
  getFoundryVersion: () => getGame()?.version ?? null,
};
