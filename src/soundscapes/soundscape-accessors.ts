import { MOD } from "../logger";
import { getGame, getSetting, setSetting } from "../types";
import type {
  PersistentSoundscapeLibrarySnapshot,
  ResolvedSoundscapeState,
  SoundscapeSceneAssignment,
  SoundscapeTriggerContext,
} from "./soundscape-types";
import { SOUNDSCAPE_FLAGS, SOUNDSCAPE_SETTINGS } from "./soundscape-settings-shared";
import {
  createEmptySoundscapeLibrarySnapshot,
  createPersistedSoundscapeLibrarySnapshot,
  normalizeSoundscapeSceneAssignment,
  parseStoredSoundscapeLibrarySnapshot,
} from "./soundscape-normalization";
import { resolveSoundscapeState } from "./soundscape-resolver";

interface FlagDocumentLike {
  id: string;
  active?: boolean;
  getFlag?: (scope: string, key: string) => unknown;
  setFlag?: (scope: string, key: string, value: unknown) => Promise<unknown>;
  unsetFlag?: (scope: string, key: string) => Promise<unknown>;
}

function parseLibrarySnapshot(raw: string | null | undefined): PersistentSoundscapeLibrarySnapshot | null {
  if (!raw) return null;
  try {
    return parseStoredSoundscapeLibrarySnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

function getSceneCollection(): { get(id: string): FlagDocumentLike | undefined; find(predicate: (item: FlagDocumentLike) => boolean): FlagDocumentLike | undefined } | null {
  return (getGame()?.scenes as { get(id: string): FlagDocumentLike | undefined; find(predicate: (item: FlagDocumentLike) => boolean): FlagDocumentLike | undefined } | undefined) ?? null;
}

function hasSceneOverrides(overrides: SoundscapeSceneAssignment["overrides"]): boolean {
  if (!overrides) return false;
  return Object.prototype.hasOwnProperty.call(overrides, "musicProgramId")
    || Object.prototype.hasOwnProperty.call(overrides, "ambienceLayerIds");
}

export function getStoredSoundscapeLibrarySnapshot(): PersistentSoundscapeLibrarySnapshot | null {
  return parseLibrarySnapshot(getSetting<string>(MOD, SOUNDSCAPE_SETTINGS.LIBRARY) ?? "");
}

export function getSoundscapeLibrarySnapshot(): PersistentSoundscapeLibrarySnapshot {
  return getStoredSoundscapeLibrarySnapshot() ?? createEmptySoundscapeLibrarySnapshot();
}

export async function setSoundscapeLibrarySnapshot(snapshot: unknown): Promise<void> {
  const persisted = createPersistedSoundscapeLibrarySnapshot(snapshot);
  await setSetting(MOD, SOUNDSCAPE_SETTINGS.LIBRARY, JSON.stringify(persisted));
}

export function getSoundscapeWorldDefaultProfileId(): string | null {
  const raw = getSetting<string>(MOD, SOUNDSCAPE_SETTINGS.WORLD_DEFAULT_PROFILE_ID) ?? "";
  return raw.trim().length > 0 ? raw.trim() : null;
}

export async function setSoundscapeWorldDefaultProfileId(profileId: string | null): Promise<void> {
  await setSetting(MOD, SOUNDSCAPE_SETTINGS.WORLD_DEFAULT_PROFILE_ID, profileId ?? "");
}

export function getSceneSoundscapeAssignment(scene: FlagDocumentLike | null | undefined): SoundscapeSceneAssignment | null {
  if (!scene?.getFlag) return null;
  const profileId = scene.getFlag(MOD, SOUNDSCAPE_FLAGS.PROFILE_ID);
  const overrides = scene.getFlag(MOD, SOUNDSCAPE_FLAGS.OVERRIDES);
  const assignment = normalizeSoundscapeSceneAssignment({ profileId, overrides });
  if (!assignment.profileId && !hasSceneOverrides(assignment.overrides)) return null;
  return assignment;
}

export async function setSceneSoundscapeAssignment(scene: FlagDocumentLike, assignment: SoundscapeSceneAssignment | null): Promise<void> {
  if (!scene.setFlag || !scene.unsetFlag) return;
  const normalized = normalizeSoundscapeSceneAssignment(assignment ?? {});

  if (normalized.profileId) {
    await scene.setFlag(MOD, SOUNDSCAPE_FLAGS.PROFILE_ID, normalized.profileId);
  } else {
    await scene.unsetFlag(MOD, SOUNDSCAPE_FLAGS.PROFILE_ID);
  }

  if (hasSceneOverrides(normalized.overrides)) {
    await scene.setFlag(MOD, SOUNDSCAPE_FLAGS.OVERRIDES, normalized.overrides);
  } else {
    await scene.unsetFlag(MOD, SOUNDSCAPE_FLAGS.OVERRIDES);
  }
}

export function getSoundscapeSceneById(sceneId?: string): FlagDocumentLike | null {
  const scenes = getSceneCollection();
  if (!scenes) return null;
  if (sceneId) return scenes.get(sceneId) ?? null;
  return scenes.find((scene) => !!scene.active) ?? null;
}

export function resolveStoredSoundscapeState(
  sceneId?: string,
  context?: Partial<SoundscapeTriggerContext>,
): ResolvedSoundscapeState | null {
  const scene = getSoundscapeSceneById(sceneId);
  return resolveSoundscapeState({
    library: getSoundscapeLibrarySnapshot(),
    sceneAssignment: getSceneSoundscapeAssignment(scene),
    worldDefaultProfileId: getSoundscapeWorldDefaultProfileId(),
    context,
    sceneId: scene?.id ?? sceneId ?? null,
  });
}
