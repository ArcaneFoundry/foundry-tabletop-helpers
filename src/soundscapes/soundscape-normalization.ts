import { getGame } from "../types";
import { MOD } from "../logger";
import {
  type PersistentSoundscapeLibrarySnapshot,
  type SoundscapeAmbienceLayer,
  type SoundscapeMomentMode,
  type SoundscapeMusicProgram,
  type SoundscapeProfile,
  type SoundscapeRule,
  type SoundscapeRuleTrigger,
  type SoundscapeSceneAssignment,
  type SoundscapeSceneOverrides,
  type SoundscapeSelectionMode,
  type SoundscapeSoundMoment,
  type SoundscapeTimeOfDay,
  type SoundscapeTriggerContext,
  SOUNDSCAPE_LIBRARY_FORMAT_VERSION,
} from "./soundscape-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const strings = value
    .map((entry) => sanitizeString(entry))
    .filter((entry): entry is string => !!entry);
  return [...new Set(strings)];
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export function createEmptySoundscapeLibrarySnapshot(): PersistentSoundscapeLibrarySnapshot {
  return {
    formatVersion: SOUNDSCAPE_LIBRARY_FORMAT_VERSION,
    savedAt: "",
    moduleVersion: getGame()?.modules?.get(MOD)?.version ?? undefined,
    foundryVersion: getGame()?.version ?? undefined,
    systemId: getGame()?.system?.id ?? undefined,
    systemVersion: getGame()?.system?.version ?? undefined,
    profiles: {},
  };
}

export function normalizeSoundscapeSelectionMode(raw: unknown): SoundscapeSelectionMode {
  return raw === "random" ? "random" : "sequential";
}

export function normalizeSoundscapeMomentMode(raw: unknown): SoundscapeMomentMode {
  return raw === "random" ? "random" : "single";
}

export function normalizeSoundscapeTimeOfDay(raw: unknown): SoundscapeTimeOfDay | null {
  return raw === "day" || raw === "night" ? raw : null;
}

export function normalizeSoundscapeMusicProgram(raw: unknown, fallbackId = "music-program"): SoundscapeMusicProgram {
  const parsed = isRecord(raw) ? raw : {};
  return {
    id: sanitizeString(parsed.id) ?? fallbackId,
    name: sanitizeString(parsed.name) ?? "Untitled Music Program",
    playlistUuids: uniqueStrings(parsed.playlistUuids),
    selectionMode: normalizeSoundscapeSelectionMode(parsed.selectionMode),
    delaySeconds: normalizeNonNegativeNumber(parsed.delaySeconds, 0),
  };
}

export function normalizeSoundscapeAmbienceLayer(raw: unknown, fallbackId = "ambience-layer"): SoundscapeAmbienceLayer {
  const parsed = isRecord(raw) ? raw : {};
  const minDelaySeconds = normalizeNonNegativeNumber(parsed.minDelaySeconds, 0);
  const maxDelayCandidate = normalizeNonNegativeNumber(parsed.maxDelaySeconds, minDelaySeconds);
  return {
    id: sanitizeString(parsed.id) ?? fallbackId,
    name: sanitizeString(parsed.name) ?? "Untitled Ambience Layer",
    mode: parsed.mode === "random" ? "random" : "loop",
    soundUuids: uniqueStrings(parsed.soundUuids),
    minDelaySeconds,
    maxDelaySeconds: Math.max(minDelaySeconds, maxDelayCandidate),
  };
}

export function normalizeSoundscapeSoundMoment(raw: unknown, fallbackId = "sound-moment"): SoundscapeSoundMoment {
  const parsed = isRecord(raw) ? raw : {};
  return {
    id: sanitizeString(parsed.id) ?? fallbackId,
    name: sanitizeString(parsed.name) ?? "Untitled Sound Moment",
    soundUuids: uniqueStrings(parsed.soundUuids),
    selectionMode: normalizeSoundscapeMomentMode(parsed.selectionMode),
  };
}

export function normalizeSoundscapeRuleTrigger(raw: unknown): SoundscapeRuleTrigger {
  const parsed = isRecord(raw) ? raw : {};
  const type = sanitizeString(parsed.type);
  if (type === "manualPreview") return { type };
  if (type === "combat") return { type };
  if (type === "weather") {
    return {
      type,
      weatherKeys: uniqueStrings(parsed.weatherKeys),
    };
  }
  if (type === "timeOfDay") {
    const timeOfDay = normalizeSoundscapeTimeOfDay(parsed.timeOfDay);
    return {
      type,
      timeOfDay: timeOfDay ?? "day",
    };
  }
  return { type: "base" };
}

function normalizeOptionalMusicProgramId(raw: Record<string, unknown>): string | null | undefined {
  if (!hasOwn(raw, "musicProgramId")) return undefined;
  if (raw.musicProgramId === null) return null;
  return sanitizeString(raw.musicProgramId);
}

function normalizeOptionalAmbienceLayerIds(raw: Record<string, unknown>): string[] | null | undefined {
  if (!hasOwn(raw, "ambienceLayerIds")) return undefined;
  if (raw.ambienceLayerIds === null) return null;
  return uniqueStrings(raw.ambienceLayerIds);
}

export function normalizeSoundscapeRule(raw: unknown, fallbackId = "soundscape-rule"): SoundscapeRule {
  const parsed = isRecord(raw) ? raw : {};
  const musicProgramId = normalizeOptionalMusicProgramId(parsed);
  const ambienceLayerIds = normalizeOptionalAmbienceLayerIds(parsed);

  return {
    id: sanitizeString(parsed.id) ?? fallbackId,
    trigger: normalizeSoundscapeRuleTrigger(parsed.trigger),
    ...(musicProgramId !== undefined ? { musicProgramId } : {}),
    ...(ambienceLayerIds !== undefined ? { ambienceLayerIds } : {}),
  };
}

export function normalizeSoundscapeProfile(raw: unknown, fallbackId = "soundscape-profile"): SoundscapeProfile {
  const parsed = isRecord(raw) ? raw : {};
  const musicProgramsRaw = isRecord(parsed.musicPrograms) ? parsed.musicPrograms : {};
  const ambienceLayersRaw = isRecord(parsed.ambienceLayers) ? parsed.ambienceLayers : {};
  const soundMomentsRaw = isRecord(parsed.soundMoments) ? parsed.soundMoments : {};
  const rulesRaw = Array.isArray(parsed.rules) ? parsed.rules : [];

  const musicPrograms = Object.fromEntries(
    Object.entries(musicProgramsRaw).map(([id, value]) => {
      const normalized = normalizeSoundscapeMusicProgram(value, id);
      return [normalized.id, normalized];
    }),
  );

  const ambienceLayers = Object.fromEntries(
    Object.entries(ambienceLayersRaw).map(([id, value]) => {
      const normalized = normalizeSoundscapeAmbienceLayer(value, id);
      return [normalized.id, normalized];
    }),
  );

  const soundMoments = Object.fromEntries(
    Object.entries(soundMomentsRaw).map(([id, value]) => {
      const normalized = normalizeSoundscapeSoundMoment(value, id);
      return [normalized.id, normalized];
    }),
  );

  const validMusicProgramIds = new Set(Object.keys(musicPrograms));
  const validAmbienceLayerIds = new Set(Object.keys(ambienceLayers));
  const rules = rulesRaw.map((value, index) => {
    const normalized = normalizeSoundscapeRule(value, `soundscape-rule-${index + 1}`);
    const musicProgramId = normalized.musicProgramId !== undefined
      ? (normalized.musicProgramId === null || validMusicProgramIds.has(normalized.musicProgramId)
        ? normalized.musicProgramId
        : undefined)
      : undefined;
    const ambienceLayerIds = normalized.ambienceLayerIds !== undefined
      ? (normalized.ambienceLayerIds === null
        ? null
        : normalized.ambienceLayerIds.filter((id) => validAmbienceLayerIds.has(id)))
      : undefined;
    return {
      id: normalized.id,
      trigger: normalized.trigger,
      ...(musicProgramId !== undefined ? { musicProgramId } : {}),
      ...(ambienceLayerIds !== undefined ? { ambienceLayerIds } : {}),
    };
  });

  return {
    id: sanitizeString(parsed.id) ?? fallbackId,
    name: sanitizeString(parsed.name) ?? "Untitled Soundscape",
    musicPrograms,
    ambienceLayers,
    soundMoments,
    rules,
  };
}

export function normalizeSoundscapeLibrarySnapshot(raw: unknown): PersistentSoundscapeLibrarySnapshot {
  const fallback = createEmptySoundscapeLibrarySnapshot();
  const parsed = isRecord(raw) ? raw : {};
  const profilesRaw = isRecord(parsed.profiles) ? parsed.profiles : {};
  const profiles = Object.fromEntries(
    Object.entries(profilesRaw).map(([id, value]) => {
      const normalized = normalizeSoundscapeProfile(value, id);
      return [normalized.id, normalized];
    }),
  );

  return {
    formatVersion: SOUNDSCAPE_LIBRARY_FORMAT_VERSION,
    savedAt: sanitizeString(parsed.savedAt) ?? fallback.savedAt,
    moduleVersion: sanitizeString(parsed.moduleVersion) ?? fallback.moduleVersion,
    foundryVersion: sanitizeString(parsed.foundryVersion) ?? fallback.foundryVersion,
    systemId: sanitizeString(parsed.systemId) ?? fallback.systemId,
    systemVersion: sanitizeString(parsed.systemVersion) ?? fallback.systemVersion,
    profiles,
  };
}

export function parseStoredSoundscapeLibrarySnapshot(raw: unknown): PersistentSoundscapeLibrarySnapshot | null {
  if (!isRecord(raw)) return null;
  if (raw.formatVersion !== SOUNDSCAPE_LIBRARY_FORMAT_VERSION) return null;
  return normalizeSoundscapeLibrarySnapshot(raw);
}

export function normalizeSoundscapeSceneOverrides(raw: unknown): SoundscapeSceneOverrides | null {
  const parsed = isRecord(raw) ? raw : {};
  const musicProgramId = normalizeOptionalMusicProgramId(parsed);
  const ambienceLayerIds = normalizeOptionalAmbienceLayerIds(parsed);
  if (musicProgramId === undefined && ambienceLayerIds === undefined) return null;
  return {
    ...(musicProgramId !== undefined ? { musicProgramId } : {}),
    ...(ambienceLayerIds !== undefined ? { ambienceLayerIds } : {}),
  };
}

export function normalizeSoundscapeSceneAssignment(raw: unknown): SoundscapeSceneAssignment {
  const parsed = isRecord(raw) ? raw : {};
  return {
    profileId: sanitizeString(parsed.profileId) ?? null,
    overrides: normalizeSoundscapeSceneOverrides(parsed.overrides),
  };
}

export function normalizeSoundscapeTriggerContext(raw: Partial<SoundscapeTriggerContext> | undefined): SoundscapeTriggerContext {
  return {
    manualPreview: !!raw?.manualPreview,
    inCombat: !!raw?.inCombat,
    weather: sanitizeString(raw?.weather) ?? null,
    timeOfDay: normalizeSoundscapeTimeOfDay(raw?.timeOfDay),
  };
}

export function createPersistedSoundscapeLibrarySnapshot(
  raw: unknown,
  savedAt = new Date().toISOString(),
): PersistentSoundscapeLibrarySnapshot {
  const normalized = normalizeSoundscapeLibrarySnapshot(raw);
  return {
    ...normalized,
    savedAt,
    moduleVersion: getGame()?.modules?.get(MOD)?.version ?? normalized.moduleVersion,
    foundryVersion: getGame()?.version ?? normalized.foundryVersion,
    systemId: getGame()?.system?.id ?? normalized.systemId,
    systemVersion: getGame()?.system?.version ?? normalized.systemVersion,
  };
}
