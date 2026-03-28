export const SOUNDSCAPE_LIBRARY_FORMAT_VERSION = 2;

export type SoundscapeAudioPath = string;
export type SoundscapeSelectionMode = "sequential" | "random";
export type SoundscapeLayerMode = "loop" | "random";
export type SoundscapeMomentMode = "single" | "random";
export type SoundscapeTimeOfDay = "day" | "night";
export type SoundscapeTriggerKind = "base" | "manualPreview" | "combat" | "weather" | "timeOfDay";
export type SoundscapeAssignmentSource = "scene" | "worldDefault";

export interface SoundscapeMusicProgram {
  id: string;
  name: string;
  audioPaths: SoundscapeAudioPath[];
  selectionMode: SoundscapeSelectionMode;
  delaySeconds: number;
}

export interface SoundscapeAmbienceLayer {
  id: string;
  name: string;
  mode: SoundscapeLayerMode;
  audioPaths: SoundscapeAudioPath[];
  minDelaySeconds: number;
  maxDelaySeconds: number;
}

export interface SoundscapeSoundMoment {
  id: string;
  name: string;
  audioPaths: SoundscapeAudioPath[];
  selectionMode: SoundscapeMomentMode;
}

export interface SoundscapeBaseTrigger {
  type: "base";
}

export interface SoundscapeManualPreviewTrigger {
  type: "manualPreview";
}

export interface SoundscapeCombatTrigger {
  type: "combat";
}

export interface SoundscapeWeatherTrigger {
  type: "weather";
  weatherKeys: string[];
}

export interface SoundscapeTimeOfDayTrigger {
  type: "timeOfDay";
  timeOfDay: SoundscapeTimeOfDay;
}

export type SoundscapeRuleTrigger =
  | SoundscapeBaseTrigger
  | SoundscapeManualPreviewTrigger
  | SoundscapeCombatTrigger
  | SoundscapeWeatherTrigger
  | SoundscapeTimeOfDayTrigger;

export interface SoundscapeRule {
  id: string;
  trigger: SoundscapeRuleTrigger;
  musicProgramId?: string | null;
  ambienceLayerIds?: string[] | null;
}

export interface SoundscapeProfile {
  id: string;
  name: string;
  musicPrograms: Record<string, SoundscapeMusicProgram>;
  ambienceLayers: Record<string, SoundscapeAmbienceLayer>;
  soundMoments: Record<string, SoundscapeSoundMoment>;
  rules: SoundscapeRule[];
}

export interface PersistentSoundscapeLibrarySnapshot {
  formatVersion: typeof SOUNDSCAPE_LIBRARY_FORMAT_VERSION;
  savedAt: string;
  moduleVersion?: string;
  foundryVersion?: string;
  systemId?: string;
  systemVersion?: string;
  profiles: Record<string, SoundscapeProfile>;
}

export interface SoundscapeSceneOverrides {
  musicProgramId?: string | null;
  ambienceLayerIds?: string[] | null;
}

export interface SoundscapeSceneAssignment {
  profileId: string | null;
  overrides?: SoundscapeSceneOverrides | null;
}

export interface SoundscapeTriggerContext {
  manualPreview: boolean;
  inCombat: boolean;
  weather: string | null;
  timeOfDay: SoundscapeTimeOfDay | null;
}

export interface ResolvedSoundscapeState {
  profileId: string;
  assignmentSource: SoundscapeAssignmentSource;
  sceneId: string | null;
  context: SoundscapeTriggerContext;
  musicProgramId: string | null;
  musicProgram: SoundscapeMusicProgram | null;
  musicRuleId: string | null;
  ambienceLayerIds: string[];
  ambienceLayers: SoundscapeAmbienceLayer[];
  ambienceRuleId: string | null;
  soundMoments: SoundscapeSoundMoment[];
}

export interface ResolveSoundscapeStateInput {
  library: PersistentSoundscapeLibrarySnapshot;
  sceneAssignment?: SoundscapeSceneAssignment | null;
  worldDefaultProfileId?: string | null;
  context?: Partial<SoundscapeTriggerContext>;
  sceneId?: string | null;
}
