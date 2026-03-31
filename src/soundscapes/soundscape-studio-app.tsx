import { useEffect, useState, type JSX, type ReactNode } from "react";

import { Log, MOD } from "../logger";
import { getHooks, getUI, isGM, loadTemplates } from "../types";
import { cn } from "../ui/lib/cn";
import { getFoundryReactMount, FoundryReactRenderer } from "../ui/foundry/react/foundry-react-application";
import { ensureNativeWindowResizeHandle, type ApplicationV2Like } from "../ui/foundry/application-v2/window-resize-handle";
import {
  ensureWindowSizeConstraints,
  type ApplicationPositionLike,
  type ApplicationV2PositionLike,
  type WindowSizeConstraints,
} from "../ui/foundry/application-v2/window-size-constraints";
import {
  getSceneSoundscapeAssignment,
  getSoundscapeLibrarySnapshot,
  getSoundscapeSceneById,
  getSoundscapeWorldDefaultProfileId,
  setSceneSoundscapeAssignment,
  setSoundscapeLibrarySnapshot,
  setSoundscapeWorldDefaultProfileId,
} from "./soundscape-accessors";
import {
  type PersistentSoundscapeLibrarySnapshot,
  type SoundscapeAmbienceLayer,
  type SoundscapeMusicProgram,
  type ResolvedSoundscapeState,
  type SoundscapeProfile,
  type SoundscapeRule,
  type SoundscapeSceneAssignment,
  type SoundscapeTriggerContext,
} from "./soundscape-types";
import {
  createSoundscapeAmbienceLayer,
  createSoundscapeMusicProgram,
  createSoundscapeProfile,
  createSoundscapeRule,
  createSoundscapeSoundMoment,
  duplicateSoundscapeProfile,
  listSoundscapeProfiles,
  listSoundscapeScenes,
  removeProfileFromLibrary,
  replaceProfileInLibrary,
  resolveSoundscapeStudioPreview,
  sanitizeSceneAssignmentsForProfileDeletion,
  updateStudioSceneAssignmentProfile,
  validateSoundscapeStudioData,
  type SoundscapeStudioValidationMessage,
} from "./soundscape-studio-helpers";
import { formatAudioPathLabel } from "./soundscape-audio-playback";

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

interface RuntimeFilePicker {
  render(force?: boolean): void;
}

interface RuntimeFilePickerClass {
  new (options: {
    type: string;
    current: string;
    callback: (path: string) => void;
  }): RuntimeFilePicker;
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

const SOUNDSCAPE_STUDIO_WINDOW_CONSTRAINTS = {
  minWidth: 840,
  maxWidth: 1560,
  minHeight: 620,
  maxHeight: 1120,
} satisfies WindowSizeConstraints;

const PROFILE_MANAGER_PANEL_ID = "fth-soundscape-profile-manager";

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

function defaultPreviewContext(): SoundscapeTriggerContext {
  return {
    manualPreview: false,
    inCombat: false,
    weather: null,
    timeOfDay: null,
  };
}

function getSelectedProfile(
  snapshot: PersistentSoundscapeLibrarySnapshot,
  profileId: string | null,
): SoundscapeProfile | null {
  if (!profileId) return null;
  return snapshot.profiles[profileId] ?? null;
}

function getNextSelectedProfileId(snapshot: PersistentSoundscapeLibrarySnapshot): string | null {
  return listSoundscapeProfiles(snapshot)[0]?.id ?? null;
}

function renderAssignmentBadge(
  assignment: SoundscapeSceneAssignment | null,
  worldDefaultProfileId: string | null,
): { label: string; tone: "accent" | "default" | "subtle" } {
  if (assignment?.profileId) {
    return { label: "Direct", tone: "accent" };
  }
  if (worldDefaultProfileId) {
    return { label: "Inherited", tone: "default" };
  }
  return { label: "Unassigned", tone: "subtle" };
}

function getFirstEntityId<T extends { id: string }>(entries: Record<string, T>): string | null {
  return Object.values(entries)[0]?.id ?? null;
}

function ensureExpandedEntityId<T extends { id: string }>(
  currentId: string | null,
  entries: Record<string, T>,
): string | null {
  if (currentId && entries[currentId]) return currentId;
  return getFirstEntityId(entries);
}

function formatProfileSummary(profile: SoundscapeProfile): Array<{ label: string; value: string }> {
  return [
    { label: "Music", value: `${Object.keys(profile.musicPrograms).length}` },
    { label: "Atmosphere", value: `${Object.keys(profile.ambienceLayers).length}` },
    { label: "Moments", value: `${Object.keys(profile.soundMoments).length}` },
    { label: "Rules", value: `${profile.rules.length}` },
  ];
}

function formatMusicProgramSummary(program: SoundscapeMusicProgram): string[] {
  return [
    program.selectionMode === "random" ? "Random" : "Sequential",
    `${program.audioPaths.length} track${program.audioPaths.length === 1 ? "" : "s"}`,
    program.delaySeconds > 0 ? `${program.delaySeconds}s gap` : "No gap",
  ];
}

function formatDelayRange(minDelaySeconds: number, maxDelaySeconds: number): string {
  if (minDelaySeconds === 0 && maxDelaySeconds === 0) return "No delay";
  if (minDelaySeconds === maxDelaySeconds) return `${minDelaySeconds}s delay`;
  return `${minDelaySeconds}-${maxDelaySeconds}s delay`;
}

function formatAmbienceLayerSummary(layer: SoundscapeAmbienceLayer): string[] {
  return [
    layer.mode === "random" ? "Random" : "Loop",
    `${layer.audioPaths.length} sound${layer.audioPaths.length === 1 ? "" : "s"}`,
    layer.mode === "random" ? formatDelayRange(layer.minDelaySeconds, layer.maxDelaySeconds) : "Continuous",
  ];
}

function summarizeSoundscapeMusicPrograms(profile: SoundscapeProfile): {
  count: number;
  trackCount: number;
  previewPrograms: SoundscapeMusicProgram[];
} {
  const previewPrograms = Object.values(profile.musicPrograms).slice(0, 2);
  const trackCount = Object.values(profile.musicPrograms).reduce((total, program) => total + program.audioPaths.length, 0);

  return {
    count: Object.keys(profile.musicPrograms).length,
    trackCount,
    previewPrograms,
  };
}

function summarizeSoundscapeAmbienceLayers(profile: SoundscapeProfile): {
  count: number;
  soundCount: number;
  previewLayers: SoundscapeAmbienceLayer[];
} {
  const previewLayers = Object.values(profile.ambienceLayers).slice(0, 2);
  const soundCount = Object.values(profile.ambienceLayers).reduce((total, layer) => total + layer.audioPaths.length, 0);

  return {
    count: Object.keys(profile.ambienceLayers).length,
    soundCount,
    previewLayers,
  };
}

function getAudioFilePickerClass(): RuntimeFilePickerClass | null {
  const g = globalThis as {
    CONFIG?: { ux?: { FilePicker?: RuntimeFilePickerClass } };
    FilePicker?: RuntimeFilePickerClass;
  };
  return g.CONFIG?.ux?.FilePicker ?? g.FilePicker ?? null;
}

function appendAudioPath(audioPaths: string[], nextPath: string): string[] {
  const trimmedPath = nextPath.trim();
  if (trimmedPath.length === 0 || audioPaths.includes(trimmedPath)) return audioPaths;
  return [...audioPaths, trimmedPath];
}

function removeAudioPath(audioPaths: string[], index: number): string[] {
  if (index < 0 || index >= audioPaths.length) return audioPaths;
  return audioPaths.filter((_, currentIndex) => currentIndex !== index);
}

function moveAudioPath(audioPaths: string[], index: number, direction: "up" | "down"): string[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= audioPaths.length || targetIndex < 0 || targetIndex >= audioPaths.length) {
    return audioPaths;
  }

  const nextAudioPaths = [...audioPaths];
  const [selectedPath] = nextAudioPaths.splice(index, 1);
  nextAudioPaths.splice(targetIndex, 0, selectedPath as string);
  return nextAudioPaths;
}

function openAudioPathPicker(options: {
  currentPath?: string;
  onSelect: (path: string) => void;
}): boolean {
  const Picker = getAudioFilePickerClass();
  if (!Picker) return false;

  const picker = new Picker({
    type: "audio",
    current: options.currentPath ?? "",
    callback: (path) => {
      const trimmedPath = path.trim();
      if (trimmedPath.length > 0) {
        options.onSelect(trimmedPath);
      }
    },
  });
  picker.render(true);
  return true;
}

function SoundscapeStudioView({
  initialProfileManagerOpen,
}: {
  initialProfileManagerOpen?: boolean;
} = {}): JSX.Element {
  const [library, setLibrary] = useState<PersistentSoundscapeLibrarySnapshot>(() => getSoundscapeLibrarySnapshot());
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => getNextSelectedProfileId(getSoundscapeLibrarySnapshot()));
  const [worldDefaultProfileId, setWorldDefaultProfileIdState] = useState<string | null>(() => getSoundscapeWorldDefaultProfileId());
  const [scenes] = useState(() => listSoundscapeScenes());
  const [sceneAssignments, setSceneAssignments] = useState<Record<string, SoundscapeSceneAssignment | null>>({});
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);
  const [previewContext, setPreviewContext] = useState<SoundscapeTriggerContext>(defaultPreviewContext);
  const [messages, setMessages] = useState<SoundscapeStudioValidationMessage[]>([]);
  const [status, setStatus] = useState<string>("Ready to author soundscapes.");
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileManagerOpen, setIsProfileManagerOpen] = useState(() => initialProfileManagerOpen ?? false);
  const [isMusicSectionExpanded, setIsMusicSectionExpanded] = useState(false);
  const [isAtmosphereSectionExpanded, setIsAtmosphereSectionExpanded] = useState(false);
  const [expandedMusicProgramId, setExpandedMusicProgramId] = useState<string | null>(null);
  const [expandedAmbienceLayerId, setExpandedAmbienceLayerId] = useState<string | null>(null);

  const selectedProfile = getSelectedProfile(library, selectedProfileId);
  const musicSummary = selectedProfile ? summarizeSoundscapeMusicPrograms(selectedProfile) : null;
  const ambienceSummary = selectedProfile ? summarizeSoundscapeAmbienceLayers(selectedProfile) : null;
  const previewState = selectedProfile
    ? resolveSoundscapeStudioPreview({
      library,
      selectedProfileId,
      previewSceneId,
      sceneAssignments,
      worldDefaultProfileId,
      context: previewContext,
    })
    : null;

  useEffect(() => {
    const assignments = Object.fromEntries(
      scenes.map((scene) => [scene.id, getSceneSoundscapeAssignment(getSoundscapeSceneById(scene.id))]),
    );
    setSceneAssignments(assignments);
    setPreviewSceneId(scenes.find((scene) => scene.active)?.id ?? scenes[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!selectedProfile) {
      setExpandedMusicProgramId(null);
      setExpandedAmbienceLayerId(null);
      return;
    }

    setExpandedMusicProgramId((current) => ensureExpandedEntityId(current, selectedProfile.musicPrograms));
    setExpandedAmbienceLayerId((current) => ensureExpandedEntityId(current, selectedProfile.ambienceLayers));
  }, [selectedProfile]);

  function updateProfile(nextProfile: SoundscapeProfile): void {
    setLibrary((current) => replaceProfileInLibrary(current, nextProfile));
  }

  function openPickerOrWarn(options: {
    currentPath?: string;
    onSelect: (path: string) => void;
  }): void {
    const opened = openAudioPathPicker(options);
    if (!opened) {
      setStatus("Audio picker unavailable. Check Foundry FilePicker support and try again.");
    }
  }

  function createProfile(): void {
    const profile = createSoundscapeProfile(Object.keys(library.profiles));
    setLibrary((current) => replaceProfileInLibrary(current, profile));
    setSelectedProfileId(profile.id);
    setExpandedMusicProgramId(null);
    setExpandedAmbienceLayerId(null);
    setStatus(`Created ${profile.name}.`);
    setMessages([]);
  }

  function duplicateProfile(): void {
    if (!selectedProfile) return;
    const profile = duplicateSoundscapeProfile(selectedProfile, Object.keys(library.profiles));
    setLibrary((current) => replaceProfileInLibrary(current, profile));
    setSelectedProfileId(profile.id);
    setExpandedMusicProgramId(getFirstEntityId(profile.musicPrograms));
    setExpandedAmbienceLayerId(getFirstEntityId(profile.ambienceLayers));
    setStatus(`Duplicated ${selectedProfile.name}.`);
    setMessages([]);
  }

  function deleteProfile(): void {
    if (!selectedProfile) return;

    const nextLibrary = removeProfileFromLibrary(library, selectedProfile.id);
    setLibrary(nextLibrary);
    setSceneAssignments((current) => sanitizeSceneAssignmentsForProfileDeletion(current, selectedProfile.id));
    setWorldDefaultProfileIdState((current) => current === selectedProfile.id ? null : current);
    setSelectedProfileId(getNextSelectedProfileId(nextLibrary));
    setExpandedMusicProgramId(null);
    setExpandedAmbienceLayerId(null);
    setStatus(`Deleted ${selectedProfile.name}.`);
    setMessages([]);
  }

  function addMusicProgram(): void {
    if (!selectedProfile) return;
    const musicProgram = createSoundscapeMusicProgram(Object.keys(selectedProfile.musicPrograms));
    setIsMusicSectionExpanded(true);
    updateProfile({
      ...selectedProfile,
      musicPrograms: {
        ...selectedProfile.musicPrograms,
        [musicProgram.id]: musicProgram,
      },
    });
    setExpandedMusicProgramId(musicProgram.id);
    setStatus(`Added ${musicProgram.name}.`);
  }

  function addAmbienceLayer(): void {
    if (!selectedProfile) return;
    const ambienceLayer = createSoundscapeAmbienceLayer(Object.keys(selectedProfile.ambienceLayers));
    setIsAtmosphereSectionExpanded(true);
    updateProfile({
      ...selectedProfile,
      ambienceLayers: {
        ...selectedProfile.ambienceLayers,
        [ambienceLayer.id]: ambienceLayer,
      },
    });
    setExpandedAmbienceLayerId(ambienceLayer.id);
    setStatus(`Added ${ambienceLayer.name}.`);
  }

  async function saveStudio(): Promise<void> {
    setIsSaving(true);
    setStatus("Saving soundscape studio changes...");

    try {
      const validation = await validateSoundscapeStudioData(library, worldDefaultProfileId, sceneAssignments);

      setMessages(validation.messages);
      if (!validation.isValid) {
        setStatus("Save blocked until the studio validation issues are resolved.");
        return;
      }

      await setSoundscapeLibrarySnapshot(library);
      await setSoundscapeWorldDefaultProfileId(worldDefaultProfileId);

      for (const scene of scenes) {
        const sceneDoc = getSoundscapeSceneById(scene.id);
        if (!sceneDoc) continue;
        await setSceneSoundscapeAssignment(sceneDoc, sceneAssignments[scene.id] ?? null);
      }

      setStatus("Soundscape studio changes saved.");
    } catch {
      setStatus("Saving failed. Check the console or Foundry permissions and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateRule(ruleId: string, updater: (rule: SoundscapeRule) => SoundscapeRule): void {
    if (!selectedProfile) return;
    updateProfile({
      ...selectedProfile,
      rules: selectedProfile.rules.map((rule) => rule.id === ruleId ? updater(rule) : rule),
    });
  }

  return (
    <div className="fth-react-app-shell fth-ui-root fth-soundscape-shell relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="fth-theme-shell-sheen pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="fth-soundscape-panel fth-soundscape-panel--header relative mx-4 mt-4 overflow-hidden rounded-[1.8rem] px-5 py-5 md:mx-5 md:px-6 md:py-6">
          <div className="fth-theme-header-glow absolute inset-0 opacity-80" />
          <div className="fth-theme-panel-accent-line pointer-events-none absolute inset-x-6 top-0 h-px opacity-80" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="fth-soundscape-kicker font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.28em]">
                Reactive Soundscapes
              </div>
              <h1 className="fth-soundscape-title mt-2 font-fth-cc-display text-[1.85rem] leading-none md:text-[2.2rem]">
                Soundscape Studio
              </h1>
              <p className="fth-soundscape-muted mt-3 max-w-3xl font-fth-cc-body text-[0.96rem] leading-6">
                Author score, atmosphere, moments, and trigger rules in one GM workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:max-w-[26rem] xl:items-end">
              {selectedProfile ? (
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <StatusChip label="Profile" tone="accent" value={selectedProfile.name} />
                  {formatProfileSummary(selectedProfile).map((entry) => (
                    <StatusChip key={entry.label} label={entry.label} value={entry.value} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <StatusChip label="Profile" value="None selected" />
                  <StatusChip label="Studio" value={`${Object.keys(library.profiles).length} authored`} />
                </div>
              )}

              <div className="flex flex-wrap gap-2 xl:justify-end">
                <StudioButton
                  label={isProfileManagerOpen ? "Hide Profiles" : "Manage Profiles"}
                  ariaControls={PROFILE_MANAGER_PANEL_ID}
                  ariaExpanded={isProfileManagerOpen}
                  onClick={() => setIsProfileManagerOpen((current) => !current)}
                />
                <StudioButton
                  disabled={isSaving}
                  label={isSaving ? "Saving..." : "Save Studio"}
                  onClick={() => void saveStudio()}
                  tone="gold"
                />
              </div>
            </div>
          </div>
        </header>

        {isProfileManagerOpen ? (
          <section
            aria-label="Profile manager"
            className="mx-4 mt-4 md:mx-5"
            id={PROFILE_MANAGER_PANEL_ID}
            role="region"
          >
            <div className="fth-soundscape-panel rounded-[1.55rem] p-4 md:p-5">
              <div className="fth-soundscape-manager-grid">
                <div className="space-y-4">
                  <div>
                    <div className="fth-soundscape-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.24em]">
                      Profiles
                    </div>
                    <p className="fth-soundscape-muted mt-2 font-fth-cc-body text-sm leading-6">
                      Select a soundscape to edit or manage profile actions without dedicating the whole window to a sidebar.
                    </p>
                  </div>

                  {selectedProfile ? (
                    <div className="fth-soundscape-card fth-soundscape-card--selected rounded-[1.35rem] p-4">
                      <div className="fth-soundscape-title font-fth-cc-display text-[1.2rem]">{selectedProfile.name}</div>
                      <div className="fth-soundscape-subtle mt-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">
                        {selectedProfile.id}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {formatProfileSummary(selectedProfile).map((entry) => (
                          <StatusChip key={entry.label} label={entry.label} value={entry.value} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel message="Create a profile to unlock the Studio authoring surfaces." />
                  )}

                  <div className="flex flex-wrap gap-2">
                    <StudioButton label="New Profile" onClick={createProfile} tone="gold" />
                    <StudioButton disabled={!selectedProfile} label="Duplicate" onClick={duplicateProfile} />
                    <StudioButton disabled={!selectedProfile} label="Delete" onClick={deleteProfile} tone="danger" />
                  </div>
                </div>

                <div className="space-y-3">
                  {listSoundscapeProfiles(library).length > 0 ? listSoundscapeProfiles(library).map((profile) => {
                    const isSelected = profile.id === selectedProfileId;
                    return (
                      <button
                        className={cn(
                          "fth-soundscape-card fth-soundscape-card--interactive w-full rounded-[1.25rem] px-4 py-3 text-left",
                          isSelected && "fth-soundscape-card--selected",
                        )}
                        key={profile.id}
                        onClick={() => {
                          setSelectedProfileId(profile.id);
                          setIsProfileManagerOpen(false);
                        }}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="fth-soundscape-title font-fth-cc-display text-[1.08rem]">{profile.name}</div>
                            <div className="fth-soundscape-subtle mt-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">
                              {profile.id}
                            </div>
                          </div>
                          {isSelected ? <StatusChip label="Current" tone="accent" value="Editing" /> : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {formatProfileSummary(profile).map((entry) => (
                            <StatusChip key={`${profile.id}-${entry.label}`} label={entry.label} value={entry.value} />
                          ))}
                        </div>
                      </button>
                    );
                  }) : (
                    <EmptyPanel message="No soundscapes yet. Create a profile to begin authoring." />
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="fth-react-scrollbar grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4 md:px-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(21rem,0.95fr)]">
          <section className="space-y-4">
            <StudioCard
              description="Rename the active soundscape and confirm its identifier before editing the authored runtime pieces."
              title="Profile"
            >
              {selectedProfile ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                  <LabeledField label="Name">
                    <input
                      className={studioInputClassName()}
                      onChange={(event) => updateProfile({ ...selectedProfile, name: event.target.value })}
                      type="text"
                      value={selectedProfile.name}
                    />
                  </LabeledField>
                  <LabeledField label="Profile Id">
                    <input className={studioInputClassName("opacity-80")} readOnly type="text" value={selectedProfile.id} />
                  </LabeledField>
                </div>
              ) : (
                <EmptyPanel message="Create or select a profile from the manager tray to start authoring." />
              )}
            </StudioCard>

            <StudioCard
              action={selectedProfile ? (
                <div className="flex flex-wrap gap-2">
                  <StudioInlineButton label="Add Program" onClick={addMusicProgram} />
                  <StudioInlineButton
                    label={isMusicSectionExpanded ? "Collapse" : "Expand"}
                    onClick={() => setIsMusicSectionExpanded((current) => !current)}
                  />
                </div>
              ) : null}
              description="Programs stay collapsed to a compact summary until you open them."
              title="Music"
            >
              {selectedProfile && musicSummary && musicSummary.count > 0 ? (
                isMusicSectionExpanded ? (
                  <div className="space-y-3">
                    {Object.values(selectedProfile.musicPrograms).map((program) => (
                      <CompactEntityCard
                        expanded={expandedMusicProgramId === program.id}
                        iconClass="fa-solid fa-waveform-lines"
                        key={program.id}
                        onRemove={() => {
                          const nextPrograms = { ...selectedProfile.musicPrograms };
                          delete nextPrograms[program.id];
                          updateProfile({ ...selectedProfile, musicPrograms: nextPrograms });
                          setExpandedMusicProgramId((current) => current === program.id ? ensureExpandedEntityId(null, nextPrograms) : current);
                        }}
                        onToggle={() => setExpandedMusicProgramId((current) => current === program.id ? null : program.id)}
                        summaryItems={formatMusicProgramSummary(program)}
                        title={program.name}
                      >
                        <div className="grid gap-3 md:grid-cols-3">
                          <LabeledField label="Name">
                            <input
                              className={studioInputClassName()}
                              onChange={(event) => updateProfile({
                                ...selectedProfile,
                                musicPrograms: {
                                  ...selectedProfile.musicPrograms,
                                  [program.id]: { ...program, name: event.target.value },
                                },
                              })}
                              type="text"
                              value={program.name}
                            />
                          </LabeledField>
                          <LabeledField label="Selection">
                            <select
                              className={studioInputClassName()}
                              onChange={(event) => updateProfile({
                                ...selectedProfile,
                                musicPrograms: {
                                  ...selectedProfile.musicPrograms,
                                  [program.id]: {
                                    ...program,
                                    selectionMode: event.target.value === "random" ? "random" : "sequential",
                                  },
                                },
                              })}
                              value={program.selectionMode}
                            >
                              <option value="sequential">Sequential</option>
                              <option value="random">Random</option>
                            </select>
                          </LabeledField>
                          <LabeledField label="Delay After Track">
                            <input
                              className={studioInputClassName()}
                              onChange={(event) => updateProfile({
                                ...selectedProfile,
                                musicPrograms: {
                                  ...selectedProfile.musicPrograms,
                                  [program.id]: { ...program, delaySeconds: Number(event.target.value) || 0 },
                                },
                              })}
                              type="number"
                              value={program.delaySeconds}
                            />
                          </LabeledField>
                        </div>
                        <AudioPathField
                          addLabel="Add Track"
                          audioPaths={program.audioPaths}
                          compact
                          emptyMessage="No tracks yet."
                          helperText="Tracks stay in order."
                          label="Tracks"
                          onAdd={() => openPickerOrWarn({
                            currentPath: program.audioPaths.at(-1),
                            onSelect: (path) => updateProfile({
                              ...selectedProfile,
                              musicPrograms: {
                                ...selectedProfile.musicPrograms,
                                [program.id]: { ...program, audioPaths: appendAudioPath(program.audioPaths, path) },
                              },
                            }),
                          })}
                          onMove={(index, direction) => updateProfile({
                            ...selectedProfile,
                            musicPrograms: {
                              ...selectedProfile.musicPrograms,
                              [program.id]: { ...program, audioPaths: moveAudioPath(program.audioPaths, index, direction) },
                            },
                          })}
                          onRemove={(index) => updateProfile({
                            ...selectedProfile,
                            musicPrograms: {
                              ...selectedProfile.musicPrograms,
                              [program.id]: { ...program, audioPaths: removeAudioPath(program.audioPaths, index) },
                            },
                          })}
                        />
                      </CompactEntityCard>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      {musicSummary.previewPrograms.map((program) => (
                        <div className="fth-soundscape-card rounded-[1rem] px-4 py-3" key={program.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="fth-soundscape-text font-fth-cc-body text-[1rem] font-semibold">{program.name}</div>
                              <div className="fth-soundscape-subtle mt-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em]">
                                {formatMusicProgramSummary(program).join(" · ")}
                              </div>
                            </div>
                            <StatusChip label="Tracks" value={`${program.audioPaths.length}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusChip label="Programs" tone="accent" value={`${musicSummary.count}`} />
                      <StatusChip label="Tracks" value={`${musicSummary.trackCount}`} />
                      {musicSummary.count > musicSummary.previewPrograms.length ? (
                        <StatusChip label="More" value={`+${musicSummary.count - musicSummary.previewPrograms.length}`} />
                      ) : null}
                    </div>
                    <p className="fth-soundscape-muted font-fth-cc-body text-sm leading-6">
                      Expand to edit track order and delay.
                    </p>
                  </div>
                )
              ) : (
                <EmptyPanel message="Add a program to define score playback order and delay." />
              )}
            </StudioCard>

            <StudioCard
              action={selectedProfile ? (
                <div className="flex flex-wrap gap-2">
                  <StudioInlineButton label="Add Layer" onClick={addAmbienceLayer} />
                  <StudioInlineButton
                    label={isAtmosphereSectionExpanded ? "Collapse" : "Expand"}
                    onClick={() => setIsAtmosphereSectionExpanded((current) => !current)}
                  />
                </div>
              ) : null}
              description="Layers stay compact until you need to edit their beds and hits."
              title="Atmosphere"
            >
              {selectedProfile && ambienceSummary && ambienceSummary.count > 0 ? (
                isAtmosphereSectionExpanded ? (
                  <div className="space-y-3">
                    {Object.values(selectedProfile.ambienceLayers).map((layer) => (
                      <CompactEntityCard
                        expanded={expandedAmbienceLayerId === layer.id}
                        iconClass="fa-solid fa-wind"
                        key={layer.id}
                        onRemove={() => {
                          const nextLayers = { ...selectedProfile.ambienceLayers };
                          delete nextLayers[layer.id];
                          updateProfile({ ...selectedProfile, ambienceLayers: nextLayers });
                          setExpandedAmbienceLayerId((current) => current === layer.id ? ensureExpandedEntityId(null, nextLayers) : current);
                        }}
                        onToggle={() => setExpandedAmbienceLayerId((current) => current === layer.id ? null : layer.id)}
                        summaryItems={formatAmbienceLayerSummary(layer)}
                        title={layer.name}
                      >
                        <div className="grid gap-3 md:grid-cols-4">
                          <LabeledField label="Name">
                            <input
                              className={studioInputClassName()}
                              onChange={(event) => updateProfile({
                                ...selectedProfile,
                                ambienceLayers: {
                                  ...selectedProfile.ambienceLayers,
                                  [layer.id]: { ...layer, name: event.target.value },
                                },
                              })}
                              type="text"
                              value={layer.name}
                            />
                          </LabeledField>
                          <LabeledField label="Mode">
                            <select
                              className={studioInputClassName()}
                              onChange={(event) => updateProfile({
                                ...selectedProfile,
                                ambienceLayers: {
                                  ...selectedProfile.ambienceLayers,
                                  [layer.id]: { ...layer, mode: event.target.value === "random" ? "random" : "loop" },
                                },
                              })}
                              value={layer.mode}
                            >
                              <option value="loop">Loop</option>
                              <option value="random">Random</option>
                            </select>
                          </LabeledField>
                          <LabeledField label="Min Delay">
                            <input
                              className={studioInputClassName()}
                              onChange={(event) => updateProfile({
                                ...selectedProfile,
                                ambienceLayers: {
                                  ...selectedProfile.ambienceLayers,
                                  [layer.id]: { ...layer, minDelaySeconds: Number(event.target.value) || 0 },
                                },
                              })}
                              type="number"
                              value={layer.minDelaySeconds}
                            />
                          </LabeledField>
                          <LabeledField label="Max Delay">
                            <input
                              className={studioInputClassName()}
                              onChange={(event) => updateProfile({
                                ...selectedProfile,
                                ambienceLayers: {
                                  ...selectedProfile.ambienceLayers,
                                  [layer.id]: { ...layer, maxDelaySeconds: Number(event.target.value) || 0 },
                                },
                              })}
                              type="number"
                              value={layer.maxDelaySeconds}
                            />
                          </LabeledField>
                        </div>
                        <AudioPathField
                          addLabel="Add Sound"
                          audioPaths={layer.audioPaths}
                          compact
                          emptyMessage="No sounds yet."
                          helperText="Beds and hits share one list."
                          label="Audio"
                          onAdd={() => openPickerOrWarn({
                            currentPath: layer.audioPaths.at(-1),
                            onSelect: (path) => updateProfile({
                              ...selectedProfile,
                              ambienceLayers: {
                                ...selectedProfile.ambienceLayers,
                                [layer.id]: { ...layer, audioPaths: appendAudioPath(layer.audioPaths, path) },
                              },
                            }),
                          })}
                          onMove={(index, direction) => updateProfile({
                            ...selectedProfile,
                            ambienceLayers: {
                              ...selectedProfile.ambienceLayers,
                              [layer.id]: { ...layer, audioPaths: moveAudioPath(layer.audioPaths, index, direction) },
                            },
                          })}
                          onRemove={(index) => updateProfile({
                            ...selectedProfile,
                            ambienceLayers: {
                              ...selectedProfile.ambienceLayers,
                              [layer.id]: { ...layer, audioPaths: removeAudioPath(layer.audioPaths, index) },
                            },
                          })}
                        />
                      </CompactEntityCard>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      {ambienceSummary.previewLayers.map((layer) => (
                        <div className="fth-soundscape-card rounded-[1rem] px-4 py-3" key={layer.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="fth-soundscape-text font-fth-cc-body text-[1rem] font-semibold">{layer.name}</div>
                              <div className="fth-soundscape-subtle mt-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em]">
                                {formatAmbienceLayerSummary(layer).join(" · ")}
                              </div>
                            </div>
                            <StatusChip label="Sounds" value={`${layer.audioPaths.length}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusChip label="Layers" tone="accent" value={`${ambienceSummary.count}`} />
                      <StatusChip label="Sounds" value={`${ambienceSummary.soundCount}`} />
                      {ambienceSummary.count > ambienceSummary.previewLayers.length ? (
                        <StatusChip label="More" value={`+${ambienceSummary.count - ambienceSummary.previewLayers.length}`} />
                      ) : null}
                    </div>
                    <p className="fth-soundscape-muted font-fth-cc-body text-sm leading-6">
                      Expand to edit loop mode and delay ranges.
                    </p>
                  </div>
                )
              ) : (
                <EmptyPanel message="Add a layer to author looping beds or randomized environmental sound." />
              )}
            </StudioCard>

            <StudioCard
              action={selectedProfile ? (
                <StudioInlineButton
                  label="Add Moment"
                  onClick={() => {
                    if (!selectedProfile) return;
                    const soundMoment = createSoundscapeSoundMoment(Object.keys(selectedProfile.soundMoments));
                    updateProfile({
                      ...selectedProfile,
                      soundMoments: {
                        ...selectedProfile.soundMoments,
                        [soundMoment.id]: soundMoment,
                      },
                    });
                  }}
                />
              ) : null}
              description="Manual cues surface in live controls without changing the authored state."
              title="Moments"
            >
              {selectedProfile && Object.keys(selectedProfile.soundMoments).length > 0 ? (
                <div className="space-y-3">
                  {Object.values(selectedProfile.soundMoments).map((moment) => (
                    <EntityCard
                      key={moment.id}
                      onRemove={() => {
                        const nextMoments = { ...selectedProfile.soundMoments };
                        delete nextMoments[moment.id];
                        updateProfile({ ...selectedProfile, soundMoments: nextMoments });
                      }}
                      title={moment.name}
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        <LabeledField label="Name">
                          <input
                            className={studioInputClassName()}
                            onChange={(event) => updateProfile({
                              ...selectedProfile,
                              soundMoments: {
                                ...selectedProfile.soundMoments,
                                [moment.id]: { ...moment, name: event.target.value },
                              },
                            })}
                            type="text"
                            value={moment.name}
                          />
                        </LabeledField>
                        <LabeledField label="Selection">
                          <select
                            className={studioInputClassName()}
                            onChange={(event) => updateProfile({
                              ...selectedProfile,
                              soundMoments: {
                                ...selectedProfile.soundMoments,
                                [moment.id]: { ...moment, selectionMode: event.target.value === "random" ? "random" : "single" },
                              },
                            })}
                            value={moment.selectionMode}
                          >
                            <option value="single">Single</option>
                            <option value="random">Random</option>
                          </select>
                        </LabeledField>
                      </div>
                      <AudioPathField
                        addLabel="Add Sound"
                        audioPaths={moment.audioPaths}
                        emptyMessage="No sounds yet."
                        helperText="Moments stay manual and do not change the current runtime mix."
                        label="Audio"
                        onAdd={() => openPickerOrWarn({
                          currentPath: moment.audioPaths.at(-1),
                          onSelect: (path) => updateProfile({
                            ...selectedProfile,
                            soundMoments: {
                              ...selectedProfile.soundMoments,
                              [moment.id]: { ...moment, audioPaths: appendAudioPath(moment.audioPaths, path) },
                            },
                          }),
                        })}
                        onMove={(index, direction) => updateProfile({
                          ...selectedProfile,
                          soundMoments: {
                            ...selectedProfile.soundMoments,
                            [moment.id]: { ...moment, audioPaths: moveAudioPath(moment.audioPaths, index, direction) },
                          },
                        })}
                        onRemove={(index) => updateProfile({
                          ...selectedProfile,
                          soundMoments: {
                            ...selectedProfile.soundMoments,
                            [moment.id]: { ...moment, audioPaths: removeAudioPath(moment.audioPaths, index) },
                          },
                        })}
                      />
                    </EntityCard>
                  ))}
                </div>
              ) : (
                <EmptyPanel message="Add a moment to expose manual cues in live controls." />
              )}
            </StudioCard>

            <StudioCard
              action={selectedProfile ? (
                <StudioInlineButton
                  label="Add Rule"
                  onClick={() => {
                    if (!selectedProfile) return;
                    updateProfile({
                      ...selectedProfile,
                      rules: [...selectedProfile.rules, createSoundscapeRule(selectedProfile.rules.map((rule) => rule.id))],
                    });
                  }}
                />
              ) : null}
              description="Rules swap music and atmosphere based on preview, combat, weather, and time."
              title="Triggers"
            >
              {selectedProfile ? (
                <div className="space-y-3">
                  {selectedProfile.rules.map((rule, index) => {
                    const triggerType = rule.trigger.type;
                    const musicMode = !Object.prototype.hasOwnProperty.call(rule, "musicProgramId")
                      ? "inherit"
                      : rule.musicProgramId === null
                        ? "clear"
                        : "set";
                    const ambienceMode = !Object.prototype.hasOwnProperty.call(rule, "ambienceLayerIds")
                      ? "inherit"
                      : rule.ambienceLayerIds === null
                        ? "clear"
                        : "set";

                    return (
                      <EntityCard
                        key={rule.id}
                        onRemove={triggerType === "base"
                          ? undefined
                          : () => updateProfile({
                            ...selectedProfile,
                            rules: selectedProfile.rules.filter((entry) => entry.id !== rule.id),
                          })}
                        title={triggerType === "base" ? "Base Rule" : `Rule ${index + 1}`}
                      >
                        <div className="grid gap-3 md:grid-cols-2">
                          <LabeledField label="Trigger">
                            <select
                              className={studioInputClassName()}
                              disabled={triggerType === "base"}
                              onChange={(event) => {
                                const nextType = event.target.value;
                                updateRule(rule.id, (current) => ({
                                  ...current,
                                  trigger: nextType === "combat"
                                    ? { type: "combat" }
                                    : nextType === "weather"
                                      ? { type: "weather", weatherKeys: [] }
                                      : nextType === "timeOfDay"
                                        ? { type: "timeOfDay", timeOfDay: "day" }
                                        : nextType === "manualPreview"
                                          ? { type: "manualPreview" }
                                          : { type: "base" },
                                }));
                              }}
                              value={triggerType}
                            >
                              <option value="base">Base</option>
                              <option value="manualPreview">Manual Preview</option>
                              <option value="combat">Combat</option>
                              <option value="weather">Weather</option>
                              <option value="timeOfDay">Time of Day</option>
                            </select>
                          </LabeledField>
                          {triggerType === "weather" ? (
                            <LabeledField label="Weather Keys">
                              <input
                                className={studioInputClassName()}
                                onChange={(event) => updateRule(rule.id, (current) => ({
                                  ...current,
                                  trigger: {
                                    type: "weather",
                                    weatherKeys: event.target.value
                                      .split(",")
                                      .map((entry) => entry.trim())
                                      .filter((entry) => entry.length > 0),
                                  },
                                }))}
                                type="text"
                                value={rule.trigger.weatherKeys.join(", ")}
                              />
                            </LabeledField>
                          ) : triggerType === "timeOfDay" ? (
                            <LabeledField label="Time of Day">
                              <select
                                className={studioInputClassName()}
                                onChange={(event) => updateRule(rule.id, (current) => ({
                                  ...current,
                                  trigger: {
                                    type: "timeOfDay",
                                    timeOfDay: event.target.value === "night" ? "night" : "day",
                                  },
                                }))}
                                value={rule.trigger.type === "timeOfDay" ? rule.trigger.timeOfDay : "day"}
                              >
                                <option value="day">Day</option>
                                <option value="night">Night</option>
                              </select>
                            </LabeledField>
                          ) : <div />}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <LabeledField label="Music Override">
                            <div className="space-y-2">
                              <select
                                className={studioInputClassName()}
                                onChange={(event) => updateRule(rule.id, (current) => {
                                  const next = event.target.value;
                                  if (next === "inherit") {
                                    const { musicProgramId, ...rest } = current;
                                    return rest;
                                  }
                                  if (next === "clear") return { ...current, musicProgramId: null };
                                  return {
                                    ...current,
                                    musicProgramId: Object.keys(selectedProfile.musicPrograms)[0] ?? null,
                                  };
                                })}
                                value={musicMode}
                              >
                                <option value="inherit">Inherit</option>
                                <option value="clear">Clear Music</option>
                                <option value="set">Use Program</option>
                              </select>
                              {musicMode === "set" ? (
                                <select
                                  className={studioInputClassName()}
                                  onChange={(event) => updateRule(rule.id, (current) => ({
                                    ...current,
                                    musicProgramId: event.target.value || null,
                                  }))}
                                  value={rule.musicProgramId ?? ""}
                                >
                                  <option value="">Select music program</option>
                                  {Object.values(selectedProfile.musicPrograms).map((program) => (
                                    <option key={program.id} value={program.id}>{program.name}</option>
                                  ))}
                                </select>
                              ) : null}
                            </div>
                          </LabeledField>

                          <LabeledField label="Ambience Override">
                            <div className="space-y-2">
                              <select
                                className={studioInputClassName()}
                                onChange={(event) => updateRule(rule.id, (current) => {
                                  const next = event.target.value;
                                  if (next === "inherit") {
                                    const { ambienceLayerIds, ...rest } = current;
                                    return rest;
                                  }
                                  if (next === "clear") return { ...current, ambienceLayerIds: null };
                                  return {
                                    ...current,
                                    ambienceLayerIds: current.ambienceLayerIds ?? [],
                                  };
                                })}
                                value={ambienceMode}
                              >
                                <option value="inherit">Inherit</option>
                                <option value="clear">Clear Ambience</option>
                                <option value="set">Use Layers</option>
                              </select>
                              {ambienceMode === "set" ? (
                                <div className="fth-soundscape-card rounded-[1rem] p-3">
                                  <div className="grid gap-2">
                                    {Object.values(selectedProfile.ambienceLayers).map((layer) => {
                                      const checked = (rule.ambienceLayerIds ?? []).includes(layer.id);
                                      return (
                                        <label className="fth-soundscape-text flex items-center gap-2 font-fth-cc-body text-sm" key={layer.id}>
                                          <input
                                            checked={checked}
                                            onChange={(event) => updateRule(rule.id, (current) => {
                                              const currentIds = current.ambienceLayerIds ?? [];
                                              const nextIds = event.target.checked
                                                ? [...new Set([...currentIds, layer.id])]
                                                : currentIds.filter((entry) => entry !== layer.id);
                                              return { ...current, ambienceLayerIds: nextIds };
                                            })}
                                            type="checkbox"
                                          />
                                          <span>{layer.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </LabeledField>
                        </div>
                      </EntityCard>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel message="Create or select a profile to author trigger rules." />
              )}
            </StudioCard>
          </section>

          <aside className="space-y-4">
            <StudioCard
              description="Assign world defaults and scene-level overrides without leaving the authoring workspace."
              title="Assignments"
            >
              <LabeledField label="World Default">
                <select
                  className={studioInputClassName()}
                  onChange={(event) => setWorldDefaultProfileIdState(event.target.value || null)}
                  value={worldDefaultProfileId ?? ""}
                >
                  <option value="">No world default</option>
                  {listSoundscapeProfiles(library).map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </LabeledField>

              <div className="mt-4 space-y-3">
                {scenes.length > 0 ? scenes.map((scene) => {
                  const assignment = sceneAssignments[scene.id] ?? null;
                  const badge = renderAssignmentBadge(assignment, worldDefaultProfileId);
                  return (
                    <div className="fth-soundscape-card rounded-[1.05rem] p-3" key={scene.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="fth-soundscape-text font-fth-cc-body text-sm font-semibold">{scene.name}</div>
                          <div className="fth-soundscape-subtle mt-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.18em]">
                            {scene.active ? "Active Scene" : "Scene"}
                          </div>
                        </div>
                        <StatusChip label={badge.label} tone={badge.tone} value={assignment?.profileId ? "Scene" : worldDefaultProfileId ? "World" : "None"} />
                      </div>
                      <div className="mt-3">
                        <select
                          className={studioInputClassName()}
                          onChange={(event) => setSceneAssignments((current) => ({
                            ...current,
                            [scene.id]: updateStudioSceneAssignmentProfile(current[scene.id], event.target.value || null),
                          }))}
                          value={assignment?.profileId ?? ""}
                        >
                          <option value="">Inherit world default</option>
                          {listSoundscapeProfiles(library).map((profile) => (
                            <option key={profile.id} value={profile.id}>{profile.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                }) : (
                  <EmptyPanel message="No scenes are available in this world yet." />
                )}
              </div>
            </StudioCard>

            <StudioCard
              description="Preview how authored rules resolve before saving the world state."
              title="Preview"
            >
              <div className="grid gap-4">
                <LabeledField label="Scene Context">
                  <select
                    className={studioInputClassName()}
                    onChange={(event) => setPreviewSceneId(event.target.value || null)}
                    value={previewSceneId ?? ""}
                  >
                    <option value="">No scene selected</option>
                    {scenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>{scene.name}</option>
                    ))}
                  </select>
                </LabeledField>
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleField
                    checked={previewContext.manualPreview}
                    label="Manual Preview"
                    onChange={(checked) => setPreviewContext((current) => ({ ...current, manualPreview: checked }))}
                  />
                  <ToggleField
                    checked={previewContext.inCombat}
                    label="Combat"
                    onChange={(checked) => setPreviewContext((current) => ({ ...current, inCombat: checked }))}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledField label="Time of Day">
                    <select
                      className={studioInputClassName()}
                      onChange={(event) => setPreviewContext((current) => ({
                        ...current,
                        timeOfDay: event.target.value === "night"
                          ? "night"
                          : event.target.value === "day"
                            ? "day"
                            : null,
                      }))}
                      value={previewContext.timeOfDay ?? ""}
                    >
                      <option value="">None</option>
                      <option value="day">Day</option>
                      <option value="night">Night</option>
                    </select>
                  </LabeledField>
                  <LabeledField label="Weather">
                    <input
                      className={studioInputClassName()}
                      onChange={(event) => setPreviewContext((current) => ({
                        ...current,
                        weather: event.target.value.trim() || null,
                      }))}
                      placeholder="storm, rain, fog..."
                      type="text"
                      value={previewContext.weather ?? ""}
                    />
                  </LabeledField>
                </div>

                <ResolvedStatePanel state={previewState} />
              </div>
            </StudioCard>

            <StudioCard
              description="Keep save feedback and validation errors in one operator-visible status lane."
              title="Validation"
            >
              <div className="fth-soundscape-card rounded-[1.05rem] p-3">
                <div className="fth-soundscape-text font-fth-cc-body text-sm">{status}</div>
                {messages.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {messages.map((message, index) => (
                      <li className="fth-soundscape-chip fth-soundscape-chip--danger flex flex-col items-start rounded-[1rem] px-3 py-2" key={`${message.path}-${index}`}>
                        <div className="font-fth-cc-ui text-[0.54rem] uppercase tracking-[0.16em]">{message.path}</div>
                        <div className="mt-1 font-fth-cc-body text-sm leading-6">{message.message}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3">
                    <StatusChip label="Validation" tone="success" value="No issues" />
                  </div>
                )}
              </div>
            </StudioCard>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ResolvedStatePanel({ state }: { state: ResolvedSoundscapeState | null }): JSX.Element {
  if (!state) {
    return <EmptyPanel message="Select or create a profile to inspect how the current trigger context resolves." />;
  }

  return (
    <div className="fth-soundscape-card rounded-[1rem] p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewValue label="Music">{state.musicProgram?.name ?? "No music"}</PreviewValue>
        <PreviewValue label="Ambience">{state.ambienceLayers.length > 0 ? state.ambienceLayers.map((layer) => layer.name).join(", ") : "No ambience"}</PreviewValue>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <PreviewValue label="Assignment Source">{state.assignmentSource}</PreviewValue>
        <PreviewValue label="Moments">{state.soundMoments.length > 0 ? state.soundMoments.map((moment) => moment.name).join(", ") : "No moments"}</PreviewValue>
      </div>
    </div>
  );
}

function PreviewValue({ label, children }: { label: string; children: string }): JSX.Element {
  return (
    <div className="fth-soundscape-card rounded-[0.95rem] px-3 py-2.5">
      <div className="fth-soundscape-kicker font-fth-cc-ui text-[0.54rem] uppercase tracking-[0.16em]">{label}</div>
      <div className="fth-soundscape-text mt-1 font-fth-cc-body text-sm">{children}</div>
    </div>
  );
}

function StudioCard({
  title,
  children,
  action,
  description,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  description?: string;
}): JSX.Element {
  return (
    <section className="fth-soundscape-panel fth-soundscape-panel--raised rounded-[1.35rem] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="fth-soundscape-title font-fth-cc-display text-[1.22rem]">{title}</div>
          {description ? (
            <p className="fth-soundscape-muted mt-1 font-fth-cc-body text-sm leading-6">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EntityCard({
  title,
  children,
  onRemove,
}: {
  title: string;
  children: ReactNode;
  onRemove?: () => void;
}): JSX.Element {
  return (
    <div className="fth-soundscape-card rounded-[1.1rem] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="fth-soundscape-text font-fth-cc-body text-[1rem] font-semibold">{title}</div>
        {onRemove ? <StudioInlineButton label="Remove" onClick={onRemove} tone="danger" /> : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function CompactEntityCard({
  title,
  summaryItems,
  expanded,
  onToggle,
  onRemove,
  iconClass,
  children,
}: {
  title: string;
  summaryItems: string[];
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  iconClass: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn(
      "fth-soundscape-card fth-soundscape-card--interactive rounded-[1.2rem] p-4",
      expanded && "fth-soundscape-card--selected",
    )}>
      <div className="flex items-start gap-3">
        <button
          aria-expanded={expanded}
          className="fth-soundscape-entity-toggle flex min-w-0 flex-1 items-start gap-3 text-left"
          onClick={onToggle}
          type="button"
        >
          <div className="fth-soundscape-card fth-soundscape-text flex h-10 w-10 shrink-0 items-center justify-center rounded-full border">
            <i aria-hidden="true" className={iconClass} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="fth-soundscape-text font-fth-cc-body text-[1rem] font-semibold">{title}</div>
              <i aria-hidden="true" className="fth-soundscape-caret fth-soundscape-text-muted fa-solid fa-chevron-right text-[0.72rem]" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {summaryItems.map((item) => (
                <StatusChip key={`${title}-${item}`} value={item} />
              ))}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 gap-2">
          <StudioInlineButton label={expanded ? "Collapse" : "Expand"} onClick={onToggle} />
          <StudioInlineButton label="Remove" onClick={onRemove} tone="danger" />
        </div>
      </div>

      {expanded ? <div className="mt-4 space-y-4">{children}</div> : null}
    </div>
  );
}

function AudioPathField({
  label,
  audioPaths,
  addLabel,
  emptyMessage,
  helperText,
  compact = false,
  onAdd,
  onMove,
  onRemove,
}: {
  label: string;
  audioPaths: string[];
  addLabel: string;
  emptyMessage: string;
  helperText: string;
  compact?: boolean;
  onAdd: () => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (index: number) => void;
}): JSX.Element {
  return (
    <LabeledField label={label}>
      <div className={cn("fth-soundscape-card rounded-[1rem]", compact ? "p-2.5" : "p-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={cn(
            "fth-soundscape-muted font-fth-cc-body",
            compact ? "text-[0.78rem] leading-5" : "text-sm",
          )}>
            {helperText}
          </div>
          <StudioInlineButton label={addLabel} onClick={onAdd} />
        </div>

        {audioPaths.length > 0 ? (
          <div className="space-y-2">
            {audioPaths.map((audioPath, index) => (
              <div
                className={cn(
                  "fth-soundscape-card rounded-[0.95rem] md:flex md:items-start md:justify-between",
                  compact ? "px-3 py-2" : "px-3 py-3",
                )}
                key={`${audioPath}-${index}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="fth-soundscape-text font-fth-cc-body text-sm font-semibold">{formatAudioPathLabel(audioPath)}</div>
                  <div className="fth-soundscape-subtle mt-1 break-all font-fth-cc-ui text-[0.58rem] tracking-[0.08em]">
                    {audioPath}
                  </div>
                </div>
                <div className={cn("mt-3 flex flex-wrap gap-2 md:mt-0 md:justify-end", compact && "gap-1.5")}>
                  <PathActionButton
                    disabled={index === 0}
                    label="Up"
                    onClick={() => onMove(index, "up")}
                    compact={compact}
                  />
                  <PathActionButton
                    disabled={index === audioPaths.length - 1}
                    label="Down"
                    onClick={() => onMove(index, "down")}
                    compact={compact}
                  />
                  <PathActionButton label="Remove" onClick={() => onRemove(index)} tone="danger" compact={compact} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel message={emptyMessage} />
        )}
      </div>
    </LabeledField>
  );
}

function EmptyPanel({ message }: { message: string }): JSX.Element {
  return (
    <div className="fth-soundscape-empty rounded-[1rem] px-4 py-5 font-fth-cc-body text-sm leading-6">
      {message}
    </div>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="fth-soundscape-kicker font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="fth-soundscape-card flex items-center justify-between rounded-[0.95rem] px-3 py-2.5">
      <span className="fth-soundscape-text font-fth-cc-body text-sm">{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function StatusChip({
  label,
  value,
  tone = "default",
}: {
  label?: string;
  value: string;
  tone?: "accent" | "default" | "success" | "danger" | "subtle";
}): JSX.Element {
  return (
    <span className={cn(
      "fth-soundscape-chip rounded-full px-2.5 py-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em]",
      tone === "accent" && "fth-soundscape-chip--accent",
      tone === "success" && "fth-soundscape-chip--success",
      tone === "danger" && "fth-soundscape-chip--danger",
    )}>
      {label ? `${label}: ${value}` : value}
    </span>
  );
}

function StudioButton({
  label,
  onClick,
  disabled,
  tone = "default",
  ariaControls,
  ariaExpanded,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "gold" | "danger";
  ariaControls?: string;
  ariaExpanded?: boolean;
}): JSX.Element {
  return (
    <button
      className={studioButtonClassName(tone, !!disabled)}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StudioInlineButton({
  label,
  onClick,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}): JSX.Element {
  return (
    <button
      className={studioButtonClassName(tone, false, "px-3 py-1.5 text-[0.58rem]")}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function PathActionButton({
  label,
  onClick,
  disabled = false,
  tone = "default",
  compact = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  compact?: boolean;
}): JSX.Element {
  return (
    <button
      className={studioButtonClassName(tone, disabled, compact ? "px-2.5 py-1.5 text-[0.5rem]" : "px-3 py-1.5 text-[0.54rem]")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function studioInputClassName(extra = ""): string {
  return cn(
    "fth-soundscape-input px-3 py-2 font-fth-cc-body text-sm",
    extra,
  );
}

function studioButtonClassName(
  tone: "default" | "gold" | "danger",
  disabled: boolean,
  sizeClass = "px-4 py-2",
): string {
  return cn(
    "fth-soundscape-button",
    tone === "gold" ? "fth-soundscape-button--primary" : tone === "danger" ? "fth-soundscape-button--danger" : "fth-soundscape-button--secondary",
    sizeClass,
    disabled && "opacity-75",
  );
}

let _SoundscapeStudioAppClass: RuntimeApplicationClass | null = null;

export function buildSoundscapeStudioAppClass(): void {
  const { HandlebarsApplicationMixin, ApplicationV2 } = getFoundryAppClasses();
  if (typeof HandlebarsApplicationMixin !== "function" || typeof ApplicationV2 !== "function") {
    Log.warn("Reactive Soundscapes: ApplicationV2 not available — Soundscape Studio disabled");
    return;
  }

  const Base = HandlebarsApplicationMixin(ApplicationV2);

  class SoundscapeStudioApp extends Base {
    static DEFAULT_OPTIONS = {
      id: "fth-soundscape-studio",
      classes: ["fth-soundscape-studio", "fth-ui-root"],
      tag: "div",
      window: {
        resizable: true,
        icon: "fa-solid fa-waveform-lines",
        title: "Soundscape Studio",
      },
      position: { width: 1180, height: 820 },
    };

    static PARTS = {
      root: {
        template: `modules/${MOD}/templates/soundscapes/soundscape-studio-root.hbs`,
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
      ensureWindowSizeConstraints(this, SOUNDSCAPE_STUDIO_WINDOW_CONSTRAINTS);
      if (!mount) return;

      this._reactRenderer.render(mount, <SoundscapeStudioView />);
    }

    async close(options?: unknown): Promise<void> {
      this._reactRenderer.unmount();
      return super.close(options);
    }
  }

  _SoundscapeStudioAppClass = SoundscapeStudioApp;
  Log.debug("Reactive Soundscapes: Soundscape Studio class built");
}

export function getSoundscapeStudioAppClass(): RuntimeApplicationClass | null {
  return _SoundscapeStudioAppClass;
}

export function openSoundscapeStudio(): void {
  if (!isGM()) {
    getUI()?.notifications?.warn?.("Soundscape Studio is only available to GMs.");
    return;
  }

  const AppClass = getSoundscapeStudioAppClass();
  if (!AppClass) {
    buildSoundscapeStudioAppClass();
  }

  const RuntimeClass = getSoundscapeStudioAppClass();
  if (!RuntimeClass) return;

  const app = new RuntimeClass();
  app.render({ force: true });
}

export function registerSoundscapeStudioHooks(): void {
  buildSoundscapeStudioAppClass();
  loadTemplates([`modules/${MOD}/templates/soundscapes/soundscape-studio-root.hbs`]);
  getHooks()?.on?.("getSceneControlButtons", onGetSceneControlButtonsSoundscapeStudio);
}

function onGetSceneControlButtonsSoundscapeStudio(controls: SceneControls): void {
  if (!isGM()) return;
  if (!controls.tokens?.tools) return;

  controls.tokens.tools["fth-soundscape-studio"] = {
    name: "fth-soundscape-studio",
    title: "Soundscape Studio",
    icon: "fa-solid fa-waveform-lines",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => openSoundscapeStudio(),
  };
}

export const __soundscapeStudioAppInternals = {
  onGetSceneControlButtonsSoundscapeStudio,
  getAudioFilePickerClass,
  appendAudioPath,
  removeAudioPath,
  moveAudioPath,
  openAudioPathPicker,
  summarizeSoundscapeMusicPrograms,
  summarizeSoundscapeAmbienceLayers,
  PROFILE_MANAGER_PANEL_ID,
  SoundscapeStudioView,
};
