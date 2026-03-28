import { getGame } from "../types";
import { isAudioPathResolvable } from "./soundscape-audio-playback";
import {
  type PersistentSoundscapeLibrarySnapshot,
  type ResolvedSoundscapeState,
  type SoundscapeAmbienceLayer,
  type SoundscapeMusicProgram,
  type SoundscapeProfile,
  type SoundscapeRule,
  type SoundscapeSceneAssignment,
  type SoundscapeSoundMoment,
  type SoundscapeTriggerContext,
} from "./soundscape-types";
import { normalizeSoundscapeProfile } from "./soundscape-normalization";
import { resolveSoundscapeState } from "./soundscape-resolver";

export interface SoundscapeStudioValidationMessage {
  profileId?: string;
  path: string;
  message: string;
}

export interface SoundscapeStudioValidationResult {
  isValid: boolean;
  messages: SoundscapeStudioValidationMessage[];
}

interface SoundscapeStudioValidationOptions {
  resolveAudioPath?: (path: string) => Promise<boolean>;
}

function slugifySegment(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function uniqueId(baseId: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  if (!taken.has(baseId)) return baseId;

  let index = 2;
  while (taken.has(`${baseId}-${index}`)) index += 1;
  return `${baseId}-${index}`;
}

function cloneProfile(profile: SoundscapeProfile): SoundscapeProfile {
  return JSON.parse(JSON.stringify(profile)) as SoundscapeProfile;
}

function joinUuidList(values: string[]): string {
  return values.join("\n");
}

function splitUuidList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function getKnownPlaylistUuidSet(): Set<string> {
  const playlists = getGame()?.playlists;
  if (!playlists) return new Set<string>();

  const uuids = new Set<string>();
  for (const playlist of playlists) {
    if (typeof playlist?.uuid === "string" && playlist.uuid.trim().length > 0) {
      uuids.add(playlist.uuid.trim());
    }
  }
  return uuids;
}

export function listKnownPlaylists(): Array<{ id: string; name: string; uuid: string }> {
  const playlists = getGame()?.playlists;
  if (!playlists) return [];

  return [...playlists]
    .map((playlist) => ({
      id: playlist.id,
      name: playlist.name?.trim() || "Untitled Playlist",
      uuid: typeof playlist.uuid === "string" ? playlist.uuid.trim() : "",
    }))
    .filter((playlist) => playlist.uuid.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function listSoundscapeProfiles(snapshot: PersistentSoundscapeLibrarySnapshot): SoundscapeProfile[] {
  return Object.values(snapshot.profiles).sort((left, right) => left.name.localeCompare(right.name));
}

export function listSoundscapeScenes(): Array<{ id: string; name: string; active: boolean }> {
  const scenes = getGame()?.scenes;
  if (!scenes) return [];

  return [...scenes]
    .map((scene) => ({
      id: scene.id,
      name: scene.name?.trim() || "Untitled Scene",
      active: !!scene.active,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createSoundscapeProfile(existingIds: Iterable<string>, name = "New Soundscape"): SoundscapeProfile {
  const id = uniqueId(slugifySegment(name, "soundscape-profile"), existingIds);
  return normalizeSoundscapeProfile({
    id,
    name,
    musicPrograms: {},
    ambienceLayers: {},
    soundMoments: {},
    rules: [{ id: "base", trigger: { type: "base" } }],
  }, id);
}

export function duplicateSoundscapeProfile(profile: SoundscapeProfile, existingIds: Iterable<string>): SoundscapeProfile {
  const nextId = uniqueId(slugifySegment(`${profile.id}-copy`, "soundscape-profile-copy"), existingIds);
  return normalizeSoundscapeProfile({
    ...cloneProfile(profile),
    id: nextId,
    name: `${profile.name} Copy`,
  }, nextId);
}

export function createSoundscapeMusicProgram(existingIds: Iterable<string>, name = "New Music Program"): SoundscapeMusicProgram {
  const id = uniqueId(slugifySegment(name, "music-program"), existingIds);
  return {
    id,
    name,
    audioPaths: [],
    selectionMode: "sequential",
    delaySeconds: 0,
  };
}

export function createSoundscapeAmbienceLayer(existingIds: Iterable<string>, name = "New Ambience Layer"): SoundscapeAmbienceLayer {
  const id = uniqueId(slugifySegment(name, "ambience-layer"), existingIds);
  return {
    id,
    name,
    mode: "loop",
    audioPaths: [],
    minDelaySeconds: 0,
    maxDelaySeconds: 0,
  };
}

export function createSoundscapeSoundMoment(existingIds: Iterable<string>, name = "New Sound Moment"): SoundscapeSoundMoment {
  const id = uniqueId(slugifySegment(name, "sound-moment"), existingIds);
  return {
    id,
    name,
    audioPaths: [],
    selectionMode: "single",
  };
}

export function createSoundscapeRule(existingIds: Iterable<string>): SoundscapeRule {
  return {
    id: uniqueId("soundscape-rule", existingIds),
    trigger: { type: "manualPreview" },
  };
}

export function replaceProfileInLibrary(
  snapshot: PersistentSoundscapeLibrarySnapshot,
  profile: SoundscapeProfile,
): PersistentSoundscapeLibrarySnapshot {
  return {
    ...snapshot,
    profiles: {
      ...snapshot.profiles,
      [profile.id]: cloneProfile(profile),
    },
  };
}

export function removeProfileFromLibrary(
  snapshot: PersistentSoundscapeLibrarySnapshot,
  profileId: string,
): PersistentSoundscapeLibrarySnapshot {
  const profiles = { ...snapshot.profiles };
  delete profiles[profileId];
  return {
    ...snapshot,
    profiles,
  };
}

export function sanitizeSceneAssignmentsForProfileDeletion(
  assignments: Record<string, SoundscapeSceneAssignment | null>,
  deletedProfileId: string,
): Record<string, SoundscapeSceneAssignment | null> {
  return Object.fromEntries(
    Object.entries(assignments).map(([sceneId, assignment]) => {
      if (!assignment || assignment.profileId !== deletedProfileId) return [sceneId, assignment];
      return [sceneId, null];
    }),
  );
}

export function updateStudioSceneAssignmentProfile(
  assignment: SoundscapeSceneAssignment | null | undefined,
  profileId: string | null,
): SoundscapeSceneAssignment | null {
  const nextProfileId = profileId?.trim() || null;
  if (nextProfileId) {
    return assignment?.overrides
      ? { profileId: nextProfileId, overrides: assignment.overrides }
      : { profileId: nextProfileId };
  }

  return assignment?.overrides
    ? { profileId: null, overrides: assignment.overrides }
    : null;
}

export function parseUuidText(value: string): string[] {
  return splitUuidList(value);
}

export function stringifyUuidText(values: string[]): string {
  return joinUuidList(values);
}

export function resolveSoundscapeStudioPreview(input: {
  library: PersistentSoundscapeLibrarySnapshot;
  selectedProfileId: string | null;
  previewSceneId: string | null;
  sceneAssignments: Record<string, SoundscapeSceneAssignment | null>;
  worldDefaultProfileId: string | null;
  context: Partial<SoundscapeTriggerContext>;
}): ResolvedSoundscapeState | null {
  const previewAssignment = input.previewSceneId
    ? (input.sceneAssignments[input.previewSceneId] ?? null)
    : (input.selectedProfileId ? { profileId: input.selectedProfileId } : null);

  return resolveSoundscapeState({
    library: input.library,
    sceneAssignment: previewAssignment,
    worldDefaultProfileId: input.worldDefaultProfileId,
    context: input.context,
    sceneId: input.previewSceneId,
  });
}

export async function validateSoundscapeStudioData(
  snapshot: PersistentSoundscapeLibrarySnapshot,
  worldDefaultProfileId: string | null,
  sceneAssignments: Record<string, SoundscapeSceneAssignment | null>,
  options: SoundscapeStudioValidationOptions = {},
): Promise<SoundscapeStudioValidationResult> {
  const messages: SoundscapeStudioValidationMessage[] = [];
  const resolveAudioPath = options.resolveAudioPath ?? isAudioPathResolvable;
  const profiles = Object.values(snapshot.profiles);
  const profileIds = new Set(profiles.map((profile) => profile.id));

  if (worldDefaultProfileId && !profileIds.has(worldDefaultProfileId)) {
    messages.push({
      path: "worldDefaultProfileId",
      message: "World default profile must reference an existing soundscape.",
    });
  }

  for (const [sceneId, assignment] of Object.entries(sceneAssignments)) {
    if (!assignment?.profileId) continue;
    if (!profileIds.has(assignment.profileId)) {
      messages.push({
        path: `sceneAssignments.${sceneId}.profileId`,
        message: `Scene assignment references missing profile "${assignment.profileId}".`,
      });
    }
  }

  const uniqueAudioPaths = new Map<string, string[]>();
  const queueAssetCheck = (audioPath: string, path: string): void => {
    const paths = uniqueAudioPaths.get(audioPath) ?? [];
    paths.push(path);
    uniqueAudioPaths.set(audioPath, paths);
  };

  for (const profile of profiles) {
    const rules = profile.rules;
    const baseRules = rules.filter((rule) => rule.trigger.type === "base");

    if (baseRules.length === 0) {
      messages.push({
        profileId: profile.id,
        path: "rules",
        message: "Each soundscape needs a base rule.",
      });
    }

    if (baseRules.length > 1) {
      messages.push({
        profileId: profile.id,
        path: "rules",
        message: "Only one base rule is allowed per soundscape.",
      });
    }

    const triggerSignatures = new Set<string>();
    for (const [index, rule] of rules.entries()) {
      const prefix = `profiles.${profile.id}.rules.${index}`;
      const signature = (() => {
        if (rule.trigger.type === "weather") {
          return `weather:${[...(rule.trigger.weatherKeys ?? [])].sort().join("|")}`;
        }
        if (rule.trigger.type === "timeOfDay") return `timeOfDay:${rule.trigger.timeOfDay}`;
        return rule.trigger.type;
      })();

      if (triggerSignatures.has(signature)) {
        messages.push({
          profileId: profile.id,
          path: prefix,
          message: `Duplicate trigger rule detected for "${signature}".`,
        });
      } else {
        triggerSignatures.add(signature);
      }

      if (rule.trigger.type === "weather" && rule.trigger.weatherKeys.length === 0) {
        messages.push({
          profileId: profile.id,
          path: prefix,
          message: "Weather rules need at least one weather key.",
        });
      }

      const musicProgramIdDefined = Object.prototype.hasOwnProperty.call(rule, "musicProgramId");
      const ambienceLayerIdsDefined = Object.prototype.hasOwnProperty.call(rule, "ambienceLayerIds");
      if (!musicProgramIdDefined && !ambienceLayerIdsDefined) {
        messages.push({
          profileId: profile.id,
          path: prefix,
          message: "Trigger rules must override music, ambience, or both.",
        });
      }

      if (typeof rule.musicProgramId === "string" && !(rule.musicProgramId in profile.musicPrograms)) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.musicProgramId`,
          message: `Rule references missing music program "${rule.musicProgramId}".`,
        });
      }

      if (Array.isArray(rule.ambienceLayerIds)) {
        for (const ambienceLayerId of rule.ambienceLayerIds) {
          if (!(ambienceLayerId in profile.ambienceLayers)) {
            messages.push({
              profileId: profile.id,
              path: `${prefix}.ambienceLayerIds`,
              message: `Rule references missing ambience layer "${ambienceLayerId}".`,
            });
          }
        }
      }
    }

    for (const program of Object.values(profile.musicPrograms)) {
      const prefix = `profiles.${profile.id}.musicPrograms.${program.id}`;
      if (program.name.trim().length === 0) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.name`,
          message: "Music programs need a name.",
        });
      }
      if (program.delaySeconds < 0) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.delaySeconds`,
          message: "Music delay cannot be negative.",
        });
      }
      if (program.audioPaths.length === 0) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.audioPaths`,
          message: "Music programs need at least one audio path.",
        });
      }
      for (const audioPath of program.audioPaths) {
        queueAssetCheck(audioPath, `${prefix}.audioPaths`);
      }
    }

    for (const layer of Object.values(profile.ambienceLayers)) {
      const prefix = `profiles.${profile.id}.ambienceLayers.${layer.id}`;
      if (layer.name.trim().length === 0) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.name`,
          message: "Ambience layers need a name.",
        });
      }
      if (layer.minDelaySeconds < 0 || layer.maxDelaySeconds < 0) {
        messages.push({
          profileId: profile.id,
          path: prefix,
          message: "Ambience timing values cannot be negative.",
        });
      }
      if (layer.maxDelaySeconds < layer.minDelaySeconds) {
        messages.push({
          profileId: profile.id,
          path: prefix,
          message: "Ambience max delay must be greater than or equal to min delay.",
        });
      }
      if (layer.audioPaths.length === 0) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.audioPaths`,
          message: "Ambience layers need at least one audio path.",
        });
      }
      for (const audioPath of layer.audioPaths) {
        queueAssetCheck(audioPath, `${prefix}.audioPaths`);
      }
    }

    for (const moment of Object.values(profile.soundMoments)) {
      const prefix = `profiles.${profile.id}.soundMoments.${moment.id}`;
      if (moment.name.trim().length === 0) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.name`,
          message: "Sound moments need a name.",
        });
      }
      if (moment.audioPaths.length === 0) {
        messages.push({
          profileId: profile.id,
          path: `${prefix}.audioPaths`,
          message: "Sound moments need at least one audio path.",
        });
      }
      for (const audioPath of moment.audioPaths) {
        queueAssetCheck(audioPath, `${prefix}.audioPaths`);
      }
    }
  }

  for (const [audioPath, paths] of uniqueAudioPaths.entries()) {
    const exists = await resolveAudioPath(audioPath);
    if (exists) continue;

    for (const path of paths) {
      messages.push({
        path,
        message: `Referenced audio path "${audioPath}" could not be resolved.`,
      });
    }
  }

  return {
    isValid: messages.length === 0,
    messages,
  };
}
