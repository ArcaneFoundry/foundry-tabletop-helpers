import { useEffect, useState, type JSX, type ReactNode } from "react";

import { Log, MOD } from "../logger";
import { getHooks, getUI, isGM, loadTemplates } from "../types";
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
): { label: string; tone: string } {
  if (assignment?.profileId) {
    return { label: "Direct", tone: "border-[#d6b06e]/45 bg-[rgba(214,176,110,0.12)] text-[#f1d8a5]" };
  }
  if (worldDefaultProfileId) {
    return { label: "Inherited", tone: "border-white/12 bg-white/[0.05] text-[#d8d0c7]" };
  }
  return { label: "Unassigned", tone: "border-white/10 bg-white/[0.03] text-[#aba39a]" };
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

function SoundscapeStudioView(): JSX.Element {
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

  const selectedProfile = getSelectedProfile(library, selectedProfileId);
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
    setStatus(`Created ${profile.name}.`);
    setMessages([]);
  }

  function duplicateProfile(): void {
    if (!selectedProfile) return;
    const profile = duplicateSoundscapeProfile(selectedProfile, Object.keys(library.profiles));
    setLibrary((current) => replaceProfileInLibrary(current, profile));
    setSelectedProfileId(profile.id);
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
    setStatus(`Deleted ${selectedProfile.name}.`);
    setMessages([]);
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
    <div className="fth-react-app-shell fth-ui-root flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(114,78,33,0.18),transparent_28%),linear-gradient(180deg,#120f12_0%,#1b171c_48%,#0e0c0f_100%)] text-[#f5efe6]">
      <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(20,17,19,0.92),rgba(12,10,12,0.78))] px-5 py-4 md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.28em] text-[#d9bb84]/76">Reactive Soundscapes</div>
            <h1 className="mt-2 font-fth-cc-display text-[1.75rem] leading-none text-[#f7e7ca] md:text-[2rem]">
              Soundscape Studio
            </h1>
            <p className="mt-2 max-w-4xl font-fth-cc-body text-[0.96rem] leading-6 text-[#d6cec5]">
              Author music, atmosphere, manual moments, and trigger rules in one GM-only workspace. This studio saves authored state and scene assignments only; live playback stays in later runtime issues.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StudioButton label="New Profile" onClick={createProfile} tone="gold" />
            <StudioButton disabled={!selectedProfile} label="Duplicate" onClick={duplicateProfile} />
            <StudioButton disabled={!selectedProfile} label="Delete" onClick={deleteProfile} tone="danger" />
            <StudioButton disabled={isSaving} label={isSaving ? "Saving..." : "Save Studio"} onClick={() => void saveStudio()} tone="gold" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        <aside className="border-b border-white/8 bg-[rgba(8,8,10,0.38)] xl:w-[20rem] xl:border-b-0 xl:border-r xl:border-white/8">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.24em] text-[#d8ba84]/72">Profiles</div>
              <div className="mt-1 font-fth-cc-body text-sm text-[#cfc7be]">{Object.keys(library.profiles).length} authored</div>
            </div>
          </div>
          <div className="max-h-[16rem] overflow-y-auto px-3 pb-4 xl:max-h-none xl:pb-6">
            {listSoundscapeProfiles(library).length === 0 ? (
              <EmptyPanel message="No soundscapes yet. Create a profile to start authoring music, ambience, and trigger rules." />
            ) : (
              <div className="space-y-2">
                {listSoundscapeProfiles(library).map((profile) => {
                  const isSelected = profile.id === selectedProfileId;
                  return (
                    <button
                      className={[
                        "w-full rounded-[1rem] border px-4 py-3 text-left transition",
                        isSelected
                          ? "border-[#ddb675]/48 bg-[linear-gradient(180deg,rgba(84,60,32,0.48),rgba(23,19,18,0.94))] shadow-[0_18px_38px_rgba(0,0,0,0.28)]"
                          : "border-white/8 bg-white/[0.03] hover:border-[#d4b06d]/28 hover:bg-white/[0.05]",
                      ].join(" ")}
                      key={profile.id}
                      onClick={() => setSelectedProfileId(profile.id)}
                      type="button"
                    >
                      <div className="font-fth-cc-display text-[1.12rem] text-[#f6e7cc]">{profile.name}</div>
                      <div className="mt-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[#c9bfaf]">{profile.id}</div>
                      <div className="mt-3 flex flex-wrap gap-2 font-fth-cc-ui text-[0.55rem] uppercase tracking-[0.16em] text-[#d8cfbe]">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{Object.keys(profile.musicPrograms).length} music</span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{Object.keys(profile.ambienceLayers).length} ambience</span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{profile.rules.length} rules</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4 md:px-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(22rem,0.95fr)]">
          <div className="space-y-4">
            <StudioCard title="Profile">
              {selectedProfile ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <LabeledField label="Name">
                    <input
                      className={studioInputClassName()}
                      onChange={(event) => updateProfile({ ...selectedProfile, name: event.target.value })}
                      type="text"
                      value={selectedProfile.name}
                    />
                  </LabeledField>
                  <LabeledField label="Profile Id">
                    <input className={studioInputClassName("opacity-75")} readOnly type="text" value={selectedProfile.id} />
                  </LabeledField>
                </div>
              ) : (
                <EmptyPanel message="Create a soundscape profile to unlock the music, atmosphere, and trigger editors." />
              )}
            </StudioCard>

            <StudioCard
              action={selectedProfile ? (
                <StudioInlineButton
                  label="Add Program"
                  onClick={() => {
                    if (!selectedProfile) return;
                    const musicProgram = createSoundscapeMusicProgram(Object.keys(selectedProfile.musicPrograms));
                    updateProfile({
                      ...selectedProfile,
                      musicPrograms: {
                        ...selectedProfile.musicPrograms,
                        [musicProgram.id]: musicProgram,
                      },
                    });
                  }}
                />
              ) : null}
              title="Music"
            >
              {selectedProfile && Object.keys(selectedProfile.musicPrograms).length > 0 ? (
                <div className="space-y-4">
                  {Object.values(selectedProfile.musicPrograms).map((program) => (
                    <EntityCard
                      key={program.id}
                      onRemove={() => {
                        const nextPrograms = { ...selectedProfile.musicPrograms };
                        delete nextPrograms[program.id];
                        updateProfile({ ...selectedProfile, musicPrograms: nextPrograms });
                      }}
                      title={program.name}
                    >
                      <div className="grid gap-4 md:grid-cols-3">
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
                        <LabeledField label="Delay After Track (seconds)">
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
                        emptyMessage="No tracks selected yet. Browse Foundry audio assets to build this program one path at a time."
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
                    </EntityCard>
                  ))}
                </div>
              ) : (
                <EmptyPanel message="Music programs decide how authored tracks are selected and how long the score rests between tracks." />
              )}
            </StudioCard>

            <StudioCard
              action={selectedProfile ? (
                <StudioInlineButton
                  label="Add Layer"
                  onClick={() => {
                    if (!selectedProfile) return;
                    const ambienceLayer = createSoundscapeAmbienceLayer(Object.keys(selectedProfile.ambienceLayers));
                    updateProfile({
                      ...selectedProfile,
                      ambienceLayers: {
                        ...selectedProfile.ambienceLayers,
                        [ambienceLayer.id]: ambienceLayer,
                      },
                    });
                  }}
                />
              ) : null}
              title="Atmosphere"
            >
              {selectedProfile && Object.keys(selectedProfile.ambienceLayers).length > 0 ? (
                <div className="space-y-4">
                  {Object.values(selectedProfile.ambienceLayers).map((layer) => (
                    <EntityCard
                      key={layer.id}
                      onRemove={() => {
                        const nextLayers = { ...selectedProfile.ambienceLayers };
                        delete nextLayers[layer.id];
                        updateProfile({ ...selectedProfile, ambienceLayers: nextLayers });
                      }}
                      title={layer.name}
                    >
                      <div className="grid gap-4 md:grid-cols-4">
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
                        emptyMessage="No ambience sounds selected yet. Browse Foundry audio assets one at a time for this layer."
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
                    </EntityCard>
                  ))}
                </div>
              ) : (
                <EmptyPanel message="Atmosphere layers cover looping beds and randomized environmental sounds." />
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
              title="Moments"
            >
              {selectedProfile && Object.keys(selectedProfile.soundMoments).length > 0 ? (
                <div className="space-y-4">
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
                      <div className="grid gap-4 md:grid-cols-2">
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
                        emptyMessage="No moment sounds selected yet. Browse Foundry audio assets one path at a time."
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
                <EmptyPanel message="Moments are manual cues the GM can trigger later without changing the authored soundscape state." />
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
              title="Triggers"
            >
              {selectedProfile ? (
                <div className="space-y-4">
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
                        <div className="grid gap-4 md:grid-cols-2">
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

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                                <div className="grid gap-2 rounded-[0.85rem] border border-white/8 bg-black/15 p-3">
                                  {Object.values(selectedProfile.ambienceLayers).map((layer) => {
                                    const checked = (rule.ambienceLayerIds ?? []).includes(layer.id);
                                    return (
                                      <label className="flex items-center gap-2 text-sm text-[#eee3d3]" key={layer.id}>
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
                              ) : null}
                            </div>
                          </LabeledField>
                        </div>
                      </EntityCard>
                    );
                  })}
                </div>
              ) : (
                <EmptyPanel message="Trigger rules tell the soundscape how to react when combat, weather, or time-of-day conditions change." />
              )}
            </StudioCard>
          </div>

          <div className="space-y-4">
            <StudioCard title="Assignments">
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
                    <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-3" key={scene.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-fth-cc-body text-sm font-semibold text-[#f3ebdf]">{scene.name}</div>
                          <div className="mt-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.18em] text-[#bfb7ad]">
                            {scene.active ? "Active Scene" : "Scene"}
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.16em] ${badge.tone}`}>
                          {badge.label}
                        </span>
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

            <StudioCard title="Preview">
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
                <div className="grid gap-4 md:grid-cols-2">
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

            <StudioCard title="Validation">
              <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-3">
                <div className="font-fth-cc-body text-sm text-[#f4ebde]">{status}</div>
                {messages.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {messages.map((message, index) => (
                      <li className="rounded-[0.9rem] border border-[#ca8e73]/35 bg-[rgba(116,45,31,0.2)] px-3 py-2 font-fth-cc-body text-sm text-[#f0d2c1]" key={`${message.path}-${index}`}>
                        <div className="font-fth-cc-ui text-[0.54rem] uppercase tracking-[0.16em] text-[#efc2a7]/78">{message.path}</div>
                        <div className="mt-1">{message.message}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-[0.9rem] border border-[#90a677]/24 bg-[rgba(72,92,44,0.18)] px-3 py-2 font-fth-cc-body text-sm text-[#d8e7c8]">
                    No validation issues yet.
                  </div>
                )}
              </div>
            </StudioCard>
          </div>
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
    <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-3">
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
    <div className="rounded-[0.9rem] border border-white/8 bg-black/15 px-3 py-2">
      <div className="font-fth-cc-ui text-[0.54rem] uppercase tracking-[0.16em] text-[#d6ba88]/74">{label}</div>
      <div className="mt-1 font-fth-cc-body text-sm text-[#f2eadf]">{children}</div>
    </div>
  );
}

function StudioCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-[1.2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(31,27,31,0.92),rgba(13,11,13,0.88))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <div className="font-fth-cc-display text-[1.24rem] text-[#f7e6c8]">{title}</div>
        {action}
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
    <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-fth-cc-body text-[1rem] font-semibold text-[#f3eadf]">{title}</div>
        {onRemove ? <StudioInlineButton label="Remove" onClick={onRemove} tone="danger" /> : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function AudioPathField({
  label,
  audioPaths,
  addLabel,
  emptyMessage,
  onAdd,
  onMove,
  onRemove,
}: {
  label: string;
  audioPaths: string[];
  addLabel: string;
  emptyMessage: string;
  onAdd: () => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (index: number) => void;
}): JSX.Element {
  return (
    <LabeledField label={label}>
      <div className="space-y-3 rounded-[1rem] border border-white/8 bg-black/15 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-fth-cc-body text-sm text-[#d8d0c7]">
            Select Foundry audio assets one at a time and keep them in authored playback order.
          </div>
          <StudioInlineButton label={addLabel} onClick={onAdd} />
        </div>

        {audioPaths.length > 0 ? (
          <div className="space-y-2">
            {audioPaths.map((audioPath, index) => (
              <div
                className="flex flex-col gap-3 rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-3 md:flex-row md:items-start md:justify-between"
                key={`${audioPath}-${index}`}
              >
                <div className="min-w-0">
                  <div className="font-fth-cc-body text-sm font-semibold text-[#f2eadf]">{formatAudioPathLabel(audioPath)}</div>
                  <div className="mt-1 break-all font-fth-cc-ui text-[0.58rem] tracking-[0.08em] text-[#bfb7ad]">
                    {audioPath}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <PathActionButton
                    disabled={index === 0}
                    label="Move Up"
                    onClick={() => onMove(index, "up")}
                  />
                  <PathActionButton
                    disabled={index === audioPaths.length - 1}
                    label="Move Down"
                    onClick={() => onMove(index, "down")}
                  />
                  <PathActionButton label="Remove" onClick={() => onRemove(index)} tone="danger" />
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
    <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 font-fth-cc-body text-sm leading-6 text-[#c9c1b8]">
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
      <span className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[#cfb583]/74">{label}</span>
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
    <label className="flex items-center justify-between rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="font-fth-cc-body text-sm text-[#efe5d8]">{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function StudioButton({
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "gold" | "danger";
}): JSX.Element {
  return (
    <button
      className={studioButtonClassName(tone, !!disabled)}
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
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}): JSX.Element {
  return (
    <button
      className={studioButtonClassName(tone, disabled, "px-3 py-1.5 text-[0.54rem]")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function studioInputClassName(extra = ""): string {
  return [
    "w-full rounded-[0.9rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-2 font-fth-cc-body text-sm text-[#f4ece1] outline-none transition placeholder:text-[#8e867d]",
    "focus:border-[#d7b776]/45 focus:bg-[rgba(255,255,255,0.06)]",
    extra,
  ].filter(Boolean).join(" ");
}

function studioButtonClassName(
  tone: "default" | "gold" | "danger",
  disabled: boolean,
  sizeClass = "px-4 py-2",
): string {
  return [
    "inline-flex items-center justify-center rounded-full border font-fth-cc-ui uppercase tracking-[0.16em] transition",
    sizeClass,
    disabled
      ? "cursor-not-allowed border-white/8 bg-white/[0.04] text-[#8f877d]"
      : tone === "gold"
        ? "border-[#ddb675]/55 bg-[linear-gradient(180deg,rgba(101,74,37,0.96),rgba(53,37,21,0.96))] text-[#f7e2b5] hover:border-[#e6c487] hover:text-[#fff0d1]"
        : tone === "danger"
          ? "border-[#b26b5b]/45 bg-[rgba(93,42,34,0.42)] text-[#f2c6b8] hover:border-[#cc8a79]"
          : "border-white/10 bg-white/[0.05] text-[#e8dfd3] hover:border-[#d3b06b]/28 hover:text-[#f8ecd4]",
  ].join(" ");
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
};
