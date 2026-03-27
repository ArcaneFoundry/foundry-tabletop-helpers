import {
  type ResolveSoundscapeStateInput,
  type ResolvedSoundscapeState,
  type SoundscapeAmbienceLayer,
  type SoundscapeMusicProgram,
  type SoundscapeProfile,
  type SoundscapeRule,
  type SoundscapeRuleTrigger,
} from "./soundscape-types";
import { normalizeSoundscapeTriggerContext } from "./soundscape-normalization";

interface ChannelResolution<TValue> {
  value: TValue;
  ruleId: string | null;
}

function triggerMatches(trigger: SoundscapeRuleTrigger, context: ReturnType<typeof normalizeSoundscapeTriggerContext>): boolean {
  switch (trigger.type) {
    case "base":
      return true;
    case "manualPreview":
      return context.manualPreview;
    case "combat":
      return context.inCombat;
    case "weather":
      return !!context.weather && trigger.weatherKeys.includes(context.weather);
    case "timeOfDay":
      return context.timeOfDay === trigger.timeOfDay;
  }
}

function resolveBaseMusicCandidate(rules: SoundscapeRule[]): ChannelResolution<string | null> {
  for (const rule of rules) {
    if (rule.trigger.type !== "base") continue;
    if (Object.prototype.hasOwnProperty.call(rule, "musicProgramId")) {
      return { value: rule.musicProgramId ?? null, ruleId: rule.id };
    }
  }
  return { value: null, ruleId: null };
}

function resolveBaseAmbienceCandidate(rules: SoundscapeRule[]): ChannelResolution<string[]> {
  for (const rule of rules) {
    if (rule.trigger.type !== "base") continue;
    if (Object.prototype.hasOwnProperty.call(rule, "ambienceLayerIds")) {
      return { value: rule.ambienceLayerIds ?? [], ruleId: rule.id };
    }
  }
  return { value: [], ruleId: null };
}

function resolveMusicProgram(
  rules: SoundscapeRule[],
  context: ReturnType<typeof normalizeSoundscapeTriggerContext>,
  sceneOverrideMusicProgramId: string | null | undefined,
): ChannelResolution<string | null> {
  let base = resolveBaseMusicCandidate(rules);
  if (sceneOverrideMusicProgramId !== undefined) {
    base = { value: sceneOverrideMusicProgramId, ruleId: "scene-override" };
  }

  for (const triggerType of ["manualPreview", "combat", "weather", "timeOfDay"] as const) {
    for (const rule of rules) {
      if (rule.trigger.type !== triggerType || !triggerMatches(rule.trigger, context)) continue;
      if (Object.prototype.hasOwnProperty.call(rule, "musicProgramId")) {
        return { value: rule.musicProgramId ?? null, ruleId: rule.id };
      }
    }
  }

  return base;
}

function resolveAmbienceLayers(
  rules: SoundscapeRule[],
  context: ReturnType<typeof normalizeSoundscapeTriggerContext>,
  sceneOverrideAmbienceLayerIds: string[] | null | undefined,
): ChannelResolution<string[]> {
  let base = resolveBaseAmbienceCandidate(rules);
  if (sceneOverrideAmbienceLayerIds !== undefined) {
    base = { value: sceneOverrideAmbienceLayerIds ?? [], ruleId: "scene-override" };
  }

  for (const triggerType of ["manualPreview", "combat", "weather", "timeOfDay"] as const) {
    for (const rule of rules) {
      if (rule.trigger.type !== triggerType || !triggerMatches(rule.trigger, context)) continue;
      if (Object.prototype.hasOwnProperty.call(rule, "ambienceLayerIds")) {
        return { value: rule.ambienceLayerIds ?? [], ruleId: rule.id };
      }
    }
  }

  return base;
}

function chooseProfile(
  input: ResolveSoundscapeStateInput,
): { profile: SoundscapeProfile; assignmentSource: ResolvedSoundscapeState["assignmentSource"] } | null {
  const sceneProfileId = input.sceneAssignment?.profileId ?? null;
  if (sceneProfileId) {
    const sceneProfile = input.library.profiles[sceneProfileId];
    if (sceneProfile) {
      return { profile: sceneProfile, assignmentSource: "scene" };
    }
  }

  const worldDefaultProfileId = input.worldDefaultProfileId ?? null;
  if (worldDefaultProfileId) {
    const worldDefaultProfile = input.library.profiles[worldDefaultProfileId];
    if (worldDefaultProfile) {
      return { profile: worldDefaultProfile, assignmentSource: "worldDefault" };
    }
  }

  return null;
}

function lookupMusicProgram(profile: SoundscapeProfile, musicProgramId: string | null): SoundscapeMusicProgram | null {
  return musicProgramId ? (profile.musicPrograms[musicProgramId] ?? null) : null;
}

function lookupAmbienceLayers(profile: SoundscapeProfile, layerIds: string[]): SoundscapeAmbienceLayer[] {
  return layerIds
    .map((id) => profile.ambienceLayers[id])
    .filter((layer): layer is SoundscapeAmbienceLayer => !!layer);
}

export function resolveSoundscapeState(input: ResolveSoundscapeStateInput): ResolvedSoundscapeState | null {
  const selected = chooseProfile(input);
  if (!selected) return null;

  const context = normalizeSoundscapeTriggerContext(input.context);
  const rules = selected.profile.rules;
  const sceneOverrides = input.sceneAssignment?.overrides ?? null;

  const musicResolution = resolveMusicProgram(
    rules,
    context,
    sceneOverrides?.musicProgramId,
  );
  const ambienceResolution = resolveAmbienceLayers(
    rules,
    context,
    sceneOverrides?.ambienceLayerIds,
  );

  return {
    profileId: selected.profile.id,
    assignmentSource: selected.assignmentSource,
    sceneId: input.sceneId ?? null,
    context,
    musicProgramId: musicResolution.value,
    musicProgram: lookupMusicProgram(selected.profile, musicResolution.value),
    musicRuleId: musicResolution.ruleId,
    ambienceLayerIds: ambienceResolution.value,
    ambienceLayers: lookupAmbienceLayers(selected.profile, ambienceResolution.value),
    ambienceRuleId: ambienceResolution.ruleId,
    soundMoments: Object.values(selected.profile.soundMoments),
  };
}
