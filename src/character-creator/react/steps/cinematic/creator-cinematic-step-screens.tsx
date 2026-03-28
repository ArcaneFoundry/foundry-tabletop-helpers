import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import type {
  CreatorIndexEntry,
  PortraitSelection,
  ReactWizardStepProps,
  SpellSelection,
  SubclassSelection,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { buildPortraitPrompt } from "../../../portrait/portrait-prompt-builder";
import { generatePortraits } from "../../../portrait/portrait-client";
import type { GeneratedPortrait } from "../../../portrait/portrait-client";

type CinematicSelectionEntry = CreatorIndexEntry & {
  selected?: boolean;
  blurb?: string;
  description?: string;
};

type SubclassStepViewModel = {
  entries: CinematicSelectionEntry[];
  selectedEntry?: CinematicSelectionEntry | null;
  emptyMessage?: string;
};

type SpellViewModel = {
  cantrips: Array<CinematicSelectionEntry & { schoolLabel?: string }>;
  cantripCount: number;
  maxCantrips: number | null;
  spellsByLevel: Array<{
    level: number;
    label: string;
    spells: Array<CinematicSelectionEntry & { schoolLabel?: string; prepared?: boolean }>;
  }>;
  spellCount: number;
  maxSpells: number | null;
  className: string;
  selectionSummary: string;
  preparationNotice?: string;
  hasPreparationNotice?: boolean;
  showPreparedPicker?: boolean;
  preparedCount?: number;
  preparedLimit?: number | null;
};

type PortraitViewModel = {
  serverAvailable: boolean;
  autoPrompt: string;
  hasPortrait: boolean;
  portraitDataUrl: string;
  tokenDataUrl: string;
  source: string;
  raceName: string;
  className: string;
};

type ReviewSection = {
  id: string;
  label: string;
  icon: string;
  complete: boolean;
  summary?: string | unknown;
  detail?: string;
  img?: string;
  isSimple?: boolean;
  isAbilities?: boolean;
  isSkills?: boolean;
  isBackground?: boolean;
  traits?: string[];
  hasTraits?: boolean;
  bgSkills?: string[];
  bgTool?: string | null;
  bgOriginFeat?: string | null;
  bgLanguagesFixed?: string[];
  bgLanguagesChosen?: string[];
  bgASI?: string;
  selectedGrantGroups?: Array<{
    id: string;
    title: string;
    iconClass: string;
    entries: string[];
    source?: "background" | "species";
  }>;
  backgroundSkills?: string[];
  speciesSkills?: string[];
  speciesItems?: string[];
  hasBackgroundSkills?: boolean;
  hasSpeciesSkills?: boolean;
  hasSpeciesItems?: boolean;
};

type ReviewStepViewModel = {
  characterName: string;
  sections: ReviewSection[];
  allComplete: boolean;
  incompleteSectionLabels: string[];
  startingLevel: number;
};

export function SubclassStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as SubclassStepViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  const selectedUuid = state.selections.subclass?.uuid ?? null;
  const entries = viewModel?.entries ?? [];
  const selectedEntry = viewModel?.selectedEntry ?? entries.find((entry) => entry.uuid === selectedUuid) ?? null;

  const selectSubclass = (entry: CreatorIndexEntry) => {
    const selection: SubclassSelection = {
      uuid: entry.uuid,
      name: entry.name,
      img: entry.img,
      classIdentifier: entry.classIdentifier,
    };
    controller.updateCurrentStepData(selection, { silent: true });
  };

  return (
    <ArcaneStepFrame scene="forge">
      <ArcaneHero
        eyebrow={state.selections.class?.name ?? "Class"}
        title="Choose Your Calling"
        description="Bind your path to a specialization that sharpens the discipline you have already claimed."
      />

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(19rem,0.88fr)]">
        <ArcaneScrollPanel className="min-h-0">
          <div className="grid gap-4 md:grid-cols-2">
            {entries.map((entry, index) => (
              <motion.button
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                className={cn(
                  "group relative overflow-hidden rounded-[1.5rem] border text-left transition",
                  selectedUuid === entry.uuid
                    ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(61,53,63,0.9),rgba(27,24,31,0.96))] shadow-[0_0_0_1px_rgba(233,193,118,0.35),0_28px_50px_rgba(0,0,0,0.28)]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(34,34,38,0.92),rgba(20,20,24,0.96))] hover:border-[#e9c176]/45 hover:-translate-y-0.5",
                )}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                key={entry.uuid}
                onClick={() => selectSubclass(entry)}
                transition={{ duration: 0.28, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
                type="button"
              >
                <div className="relative h-52 overflow-hidden">
                  <img alt={entry.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" src={entry.img} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,12,0.12),rgba(8,8,12,0.84))]" />
                  <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-3">
                    <MicroLabel>{state.selections.class?.name ?? "Class"} Path</MicroLabel>
                    <SelectionSigil checked={selectedUuid === entry.uuid} />
                  </div>
                  <div className="absolute inset-x-5 bottom-5">
                    <div className="font-fth-cc-display text-[1.9rem] leading-none text-[#f8edd7]">{entry.name}</div>
                    {entry.blurb ? (
                      <p className="mt-3 max-w-md font-fth-cc-body text-[0.98rem] leading-6 text-[#d6d0cc]">
                        {entry.blurb}
                      </p>
                    ) : null}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
          {entries.length === 0 ? <ArcaneEmptyState message={viewModel?.emptyMessage ?? "No subclasses are available for the chosen class."} /> : null}
        </ArcaneScrollPanel>

        <ArcaneInspectorPanel title={selectedEntry?.name ?? "Awaiting Selection"} eyebrow="Specialization">
          {selectedEntry ? (
            <div className="space-y-4">
              <img alt={selectedEntry.name} className="h-56 w-full rounded-[1.25rem] object-cover" src={selectedEntry.img} />
              {selectedEntry.description ? (
                <div
                  className="arcane-prose"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: selectedEntry.description }}
                />
              ) : (
                <p className="font-fth-cc-body text-[0.98rem] leading-7 text-[#d7d0cb]">
                  Select a specialization to see the path it opens for your character.
                </p>
              )}
            </div>
          ) : (
            <ArcaneEmptyState message="Select a specialization to inspect its future path." compact />
          )}
        </ArcaneInspectorPanel>
      </div>
    </ArcaneStepFrame>
  );
}

export function SpellsStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as SpellViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const selection = state.selections.spells ?? { cantrips: [], spells: [] };
  const preparedLimit = viewModel.preparedLimit ?? null;
  const usesPreparedPicker = Boolean(viewModel.showPreparedPicker);

  useEffect(() => {
    const preparedSpells = usesPreparedPicker
      ? (selection.preparedSpells?.length
        ? selection.preparedSpells.filter((uuid) => selection.spells.includes(uuid)).slice(0, preparedLimit ?? undefined)
        : selection.spells.slice(0, preparedLimit ?? undefined))
      : undefined;
    if (
      selection.maxCantrips !== (viewModel.maxCantrips ?? undefined)
      || selection.maxSpells !== (viewModel.maxSpells ?? undefined)
      || selection.maxPreparedSpells !== (preparedLimit ?? undefined)
      || (usesPreparedPicker && JSON.stringify(selection.preparedSpells ?? []) !== JSON.stringify(preparedSpells ?? []))
    ) {
      controller.updateCurrentStepData({
        ...selection,
        maxCantrips: viewModel.maxCantrips ?? undefined,
        maxSpells: viewModel.maxSpells ?? undefined,
        maxPreparedSpells: preparedLimit ?? undefined,
        preparedSpells,
      } satisfies SpellSelection, { silent: true });
    }
  }, [
    controller,
    preparedLimit,
    selection,
    usesPreparedPicker,
    viewModel.maxCantrips,
    viewModel.maxSpells,
  ]);

  const toggleCantrip = (uuid: string) => {
    const current = new Set(selection.cantrips);
    if (current.has(uuid)) current.delete(uuid);
    else if (viewModel.maxCantrips === null || current.size < viewModel.maxCantrips) current.add(uuid);
    controller.updateCurrentStepData({
      ...selection,
      cantrips: [...current],
    } satisfies SpellSelection);
  };

  const toggleSpell = (uuid: string) => {
    const current = new Set(selection.spells);
    const prepared = new Set((selection.preparedSpells ?? []).filter((entry) => current.has(entry)));
    if (current.has(uuid)) {
      current.delete(uuid);
      prepared.delete(uuid);
    } else if (viewModel.maxSpells === null || current.size < viewModel.maxSpells) {
      current.add(uuid);
    }
    controller.updateCurrentStepData({
      ...selection,
      spells: [...current],
      preparedSpells: usesPreparedPicker ? [...prepared].filter((entry) => current.has(entry)).slice(0, preparedLimit ?? undefined) : selection.preparedSpells,
    } satisfies SpellSelection);
  };

  const togglePrepared = (uuid: string) => {
    if (!usesPreparedPicker || !selection.spells.includes(uuid)) return;
    const current = new Set(selection.preparedSpells ?? []);
    if (current.has(uuid)) current.delete(uuid);
    else if (preparedLimit === null || current.size < preparedLimit) current.add(uuid);
    controller.updateCurrentStepData({
      ...selection,
      preparedSpells: [...current],
    } satisfies SpellSelection);
  };

  return (
    <ArcaneStepFrame scene="grimoire">
      <ArcaneHero
        eyebrow={viewModel.className}
        title="Open the Grimoire"
        description="Choose the invocations, rites, and prepared workings your character carries into their first venture."
      />

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.14fr)_minmax(21rem,0.86fr)]">
        <ArcaneScrollPanel className="min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MicroLabel>Selection State</MicroLabel>
            <ValueBadge>{viewModel.selectionSummary}</ValueBadge>
          </div>
          {viewModel.hasPreparationNotice ? (
            <div className="mt-4 rounded-[1.2rem] border border-[#e9c176]/20 bg-[rgba(125,86,153,0.12)] px-4 py-3 font-fth-cc-body text-[0.98rem] leading-7 text-[#ded5eb]">
              {viewModel.preparationNotice}
            </div>
          ) : null}

          <SpellGroupSection
            emptyMessage={`No cantrips are available for ${viewModel.className} from the enabled spell data right now.`}
            entries={viewModel.cantrips}
            onToggle={toggleCantrip}
            prefersReducedMotion={prefersReducedMotion}
            selectedIds={new Set(selection.cantrips)}
            subtitle={viewModel.maxCantrips !== null ? `${selection.cantrips.length} / ${viewModel.maxCantrips} chosen` : `${selection.cantrips.length} chosen`}
            title="Cantrips"
          />

          <div className="mt-6 space-y-5">
            {viewModel.spellsByLevel.length > 0 ? viewModel.spellsByLevel.map((group) => (
              <SpellGroupSection
                entries={group.spells}
                key={group.level}
                onToggle={toggleSpell}
                onTogglePrepared={usesPreparedPicker ? togglePrepared : undefined}
                preparedIds={new Set(selection.preparedSpells ?? [])}
                prefersReducedMotion={prefersReducedMotion}
                selectedIds={new Set(selection.spells)}
                subtitle={usesPreparedPicker
                  ? `${group.spells.filter((spell) => selection.preparedSpells?.includes(spell.uuid)).length} prepared`
                  : `${group.spells.filter((spell) => selection.spells.includes(spell.uuid)).length} selected`}
                title={group.label}
              />
            )) : (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <MicroLabel>Leveled Spells</MicroLabel>
                  <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em] text-[#a89fbe]">
                    No valid entries
                  </div>
                </div>
                <div className="mt-4">
                  <ArcaneEmptyState
                    compact
                    message={`No leveled spells are available for ${viewModel.className} from the enabled spell data right now.`}
                  />
                </div>
              </section>
            )}
          </div>
        </ArcaneScrollPanel>

        <ArcaneInspectorPanel title="Prepared Workings" eyebrow={viewModel.className}>
          <div className="space-y-4">
            <ValueBadge>{selection.cantrips.length} cantrips • {selection.spells.length} spells</ValueBadge>
            {usesPreparedPicker ? (
              <div className="space-y-3">
                <MicroLabel>Prepared Now</MicroLabel>
                <div className="flex flex-wrap gap-2">
                  {(selection.preparedSpells ?? []).length > 0 ? (selection.preparedSpells ?? []).map((uuid) => {
                    const spell = viewModel.spellsByLevel.flatMap((group) => group.spells).find((entry) => entry.uuid === uuid);
                    return <TokenPill key={uuid}>{spell?.name ?? uuid}</TokenPill>;
                  }) : <TokenPill muted>Choose prepared spells</TokenPill>}
                </div>
              </div>
            ) : null}
            <div className="space-y-3">
              <MicroLabel>Chosen Invocations</MicroLabel>
              <div className="flex flex-wrap gap-2">
                {selection.cantrips.concat(selection.spells).length > 0 ? selection.cantrips.concat(selection.spells).map((uuid) => {
                  const spell = [...viewModel.cantrips, ...viewModel.spellsByLevel.flatMap((group) => group.spells)].find((entry) => entry.uuid === uuid);
                  return <TokenPill key={uuid}>{spell?.name ?? uuid}</TokenPill>;
                }) : <TokenPill muted>No spells chosen yet</TokenPill>}
              </div>
            </div>
          </div>
        </ArcaneInspectorPanel>
      </div>
    </ArcaneStepFrame>
  );
}

export function PortraitStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as PortraitViewModel | undefined;
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<"fantasy" | "realistic" | "painterly">("fantasy");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedPortrait[]>([]);

  if (!viewModel) return null;

  const currentPortrait = state.selections.portrait?.portraitDataUrl ?? viewModel.portraitDataUrl;
  const portraitSource = state.selections.portrait?.source ?? viewModel.source;
  const portraitSourceLabel = portraitSource === "generated"
    ? "Generated likeness"
    : portraitSource === "uploaded"
      ? "Uploaded likeness"
      : "Portrait optional";

  const selectPortrait = (dataUrl: string) => {
    const selection: PortraitSelection = {
      portraitDataUrl: dataUrl,
      tokenDataUrl: dataUrl,
      source: dataUrl.startsWith("data:") ? "generated" : "uploaded",
    };
    controller.updateCurrentStepData(selection, { silent: true });
  };

  const clearPortrait = () => {
    controller.updateCurrentStepData({
      portraitDataUrl: undefined,
      tokenDataUrl: undefined,
      source: "none",
    } satisfies PortraitSelection, { silent: true });
  };

  const openUploadPicker = () => {
    const pickerCtor = (globalThis as { FilePicker?: new (options: { type: string; current: string; callback: (path: string) => void }) => { render: (force: boolean) => void } }).FilePicker;
    if (!pickerCtor) return;
    const picker = new pickerCtor({
      type: "image",
      current: "",
      callback: (path) => selectPortrait(path),
    });
    picker.render(true);
  };

  const runGeneration = async () => {
    setGenerating(true);
    try {
      const prompt = buildPortraitPrompt(state, description.trim());
      const images = await generatePortraits({
        prompt,
        style,
        count: 4,
      });
      setGenerated(images);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ArcaneStepFrame scene="visage">
      <ArcaneHero
        eyebrow="Finalize"
        title="Choose the Visage"
        description="This chamber is optional. Bind a likeness to the artifact now, or leave the portrait for a later hour."
      />

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
        <ArcaneScrollPanel className="min-h-0">
          <div className="space-y-5">
            <section className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,34,38,0.95),rgba(19,19,23,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.18)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <MicroLabel>Portrait Atelier</MicroLabel>
                  <div className="font-fth-cc-display text-[1.6rem] leading-tight text-[#f4e7ce]">Shape the Likeness</div>
                  <p className="max-w-2xl font-fth-cc-body text-[0.98rem] leading-7 text-[#d1c9c2]">
                    Describe the face you want, choose a tonal style, and summon candidate portraits before you bind one.
                  </p>
                </div>
                <ValueBadge>{portraitSourceLabel}</ValueBadge>
              </div>

              <textarea
                className="mt-5 min-h-32 w-full rounded-[1rem] border border-white/10 bg-black/25 px-4 py-3 font-fth-cc-body text-[1rem] leading-7 text-[#f1ece8] outline-none transition placeholder:text-[#928881] focus:border-[#e9c176]/55"
                onChange={(event) => setDescription(event.target.value)}
                placeholder={viewModel.autoPrompt}
                value={description}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {(["fantasy", "realistic", "painterly"] as const).map((option) => (
                  <ModeToggleButton
                    active={style === option}
                    key={option}
                    label={option}
                    onClick={() => setStyle(option)}
                  />
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {viewModel.serverAvailable ? (
                  <button
                    className="rounded-[1rem] border border-[#e9c176]/70 bg-[linear-gradient(180deg,#f2cb84,#d6a447)] px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] text-[#3b280f] shadow-[0_12px_26px_rgba(0,0,0,0.16)] transition hover:translate-y-[-1px] hover:shadow-[0_16px_34px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={generating}
                    onClick={() => void runGeneration()}
                    type="button"
                  >
                    {generating ? "Summoning Portraits..." : "Generate Portraits"}
                  </button>
                ) : null}
                <button
                  className="rounded-[1rem] border border-white/12 bg-[rgba(255,255,255,0.04)] px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] text-[#efe7df] transition hover:border-[#e9c176]/45 hover:bg-[rgba(255,255,255,0.06)]"
                  onClick={openUploadPicker}
                  type="button"
                >
                  Upload Portrait
                </button>
                {currentPortrait ? (
                  <button
                    className="rounded-[1rem] border border-[#d07364]/40 bg-[rgba(117,42,42,0.18)] px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] text-[#f4d3cd] transition hover:border-[#d07364]/70 hover:bg-[rgba(117,42,42,0.26)]"
                    onClick={clearPortrait}
                    type="button"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(28,28,33,0.92),rgba(15,15,19,0.97))] p-4">
              <div className="flex items-center justify-between gap-3">
                <MicroLabel>Generated Portraits</MicroLabel>
                <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em] text-[#a89fbe]">
                  {generated.length > 0 ? `${generated.length} summoned` : "Awaiting invocation"}
                </div>
              </div>
              {generated.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {generated.map((image, index) => (
                    <motion.button
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "overflow-hidden rounded-[1.3rem] border transition",
                        currentPortrait === image.dataUrl
                          ? "border-[#e9c176] shadow-[0_0_0_1px_rgba(233,193,118,0.28),0_16px_30px_rgba(0,0,0,0.22)]"
                          : "border-white/10 hover:border-[#e9c176]/45",
                      )}
                      initial={{ opacity: 0, y: 8 }}
                      key={`${image.dataUrl}-${index}`}
                      onClick={() => selectPortrait(image.dataUrl)}
                      transition={{ duration: 0.24, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
                      type="button"
                    >
                      <img alt="Generated portrait option" className="h-full w-full object-cover" src={image.dataUrl} />
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <ArcaneEmptyState
                    compact
                    message="No portraits have been summoned yet. Generate a few options or upload a finished portrait to begin."
                  />
                </div>
              )}
            </section>
          </div>
        </ArcaneScrollPanel>

        <ArcaneInspectorPanel title={currentPortrait ? "Bound Likeness" : "Awaiting Likeness"} eyebrow="Portrait">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ValueBadge>{portraitSourceLabel}</ValueBadge>
              {currentPortrait ? <TokenPill muted>Ready for final review</TokenPill> : null}
            </div>
            {currentPortrait ? (
              <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-3">
                <img alt="Selected portrait" className="aspect-[4/5] w-full rounded-[1rem] object-cover" src={currentPortrait} />
              </div>
            ) : (
              <ArcaneEmptyState message="No portrait is required. You can proceed without binding a likeness, or generate one here before the ritual closes." compact />
            )}
          </div>
        </ArcaneInspectorPanel>
      </div>
    </ArcaneStepFrame>
  );
}

export function ReviewStepScreen({ shellContext, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as ReviewStepViewModel | undefined;
  const [characterName, setCharacterName] = useState(viewModel?.characterName ?? "");
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    setCharacterName(viewModel?.characterName ?? "");
  }, [viewModel?.characterName]);

  if (!viewModel) return null;

  const heroSection = viewModel.sections.find((section) => section.id === "class");
  const originSection = viewModel.sections.find((section) => section.id === "background");
  const speciesSection = viewModel.sections.find((section) => section.id === "species");
  const abilitiesSection = viewModel.sections.find((section) => section.id === "abilities");
  const originSummarySection = viewModel.sections.find((section) => section.id === "originSummary");
  const recapSections = viewModel.sections.filter((section) => !["class", "background", "species", "abilities", "originSummary", "portrait"].includes(section.id));
  const buildSections = viewModel.sections.filter((section) => ["feats", "equipment", "spells", "portrait"].includes(section.id));
  const completeSections = viewModel.sections.filter((section) => section.complete).length;
  const unresolvedCount = viewModel.incompleteSectionLabels.length;

  return (
    <ArcaneStepFrame scene="binding">
      <ArcaneHero
        eyebrow={`Level ${viewModel.startingLevel}`}
        title="The Ritual Is Complete"
        description="Review the bound artifact of your creation before calling it fully into the world."
      >
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <ValueBadge>{viewModel.allComplete ? "All rites complete" : `${unresolvedCount} unresolved`}</ValueBadge>
          <TokenPill muted>
            {completeSections}/{viewModel.sections.length} reviewed
          </TokenPill>
          <TokenPill muted>Jump back to revise any card</TokenPill>
        </div>
      </ArcaneHero>

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.16fr)_minmax(20rem,0.84fr)]">
        <ArcaneScrollPanel className="min-h-0">
          <div className="overflow-hidden rounded-[1.6rem] border border-[#e9c176]/20 bg-[linear-gradient(180deg,rgba(35,35,39,0.95),rgba(19,19,24,0.98))] shadow-[0_28px_60px_rgba(0,0,0,0.28)]">
            <div className="grid gap-0 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1fr)]">
              <div className="relative min-h-[20rem] overflow-hidden">
                <img
                  alt={characterName || "Character portrait"}
                  className="h-full w-full object-cover"
                  src={viewModel.sections.find((section) => section.id === "portrait")?.img ?? speciesSection?.img ?? heroSection?.img ?? ""}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,12,0.22),rgba(8,8,12,0.88))]" />
                <div className="absolute inset-x-6 bottom-6">
                  <MicroLabel>Bound Identity</MicroLabel>
                  <div className="mt-3 font-fth-cc-display text-[2.4rem] leading-none text-[#f5e8cf]">
                    {characterName || "Name Your Artifact"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[speciesSection?.summary, heroSection?.summary, originSection?.summary].filter(Boolean).map((entry) => (
                      <TokenPill key={String(entry)}>{String(entry)}</TokenPill>
                    ))}
                  </div>
                  <p className="mt-4 max-w-2xl font-fth-cc-body text-[0.96rem] leading-6 text-[#d6cdc8]">
                    This is the name that will appear on the character sheet and in the world. Keep it clear, bold, and easy to
                    recognize when the ritual closes.
                  </p>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <section className="rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 shadow-[0_16px_30px_rgba(0,0,0,0.16)]">
                  <MicroLabel>Character Name</MicroLabel>
                  <p id="review-character-name-guidance" className="mt-3 max-w-xl font-fth-cc-body text-[0.94rem] leading-6 text-[#cec5be]">
                    The final binding uses this name exactly as shown here. Review it now so the finished character arrives
                    with the right identity.
                  </p>
                  <input
                    aria-describedby="review-character-name-guidance"
                    className="mt-4 w-full rounded-[1rem] border border-white/12 bg-black/20 px-4 py-3 font-fth-cc-display text-[1.35rem] text-[#f5e8cf] outline-none transition focus:border-[#e9c176]/55"
                    onChange={(event) => {
                      const value = event.target.value;
                      setCharacterName(value);
                      controller.updateCurrentStepData({ characterName: value }, { silent: true });
                    }}
                    placeholder="Name the artifact"
                    value={characterName}
                  />
                </section>

                {Array.isArray(abilitiesSection?.summary) ? (
                  <section className="rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 shadow-[0_16px_30px_rgba(0,0,0,0.16)]">
                    <MicroLabel>Core Attributes</MicroLabel>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {(abilitiesSection.summary as Array<{ key: string; score: number; modifier: string }>).map((ability) => (
                        <div
                          className="rounded-[1rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3"
                          key={ability.key}
                        >
                          <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.2em] text-[#aa9fc5]">{ability.key}</div>
                          <div className="mt-2 font-fth-cc-display text-[1.55rem] text-[#f4e7cf]">{ability.score}</div>
                          <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.14em] text-[#d1c8bf]">{ability.modifier}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {originSummarySection?.selectedGrantGroups?.length ? (
                  <section className="rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 shadow-[0_16px_30px_rgba(0,0,0,0.16)]">
                    <MicroLabel>Origins</MicroLabel>
                    <div className="mt-3 grid gap-3">
                      {originSummarySection.selectedGrantGroups.map((group) => (
                        <div className="rounded-[1rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4" key={group.id}>
                          <div className="font-fth-cc-body text-[1rem] font-semibold text-[#f4e7cf]">{group.title}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.entries.map((entry) => <TokenPill key={`${group.id}-${entry}`}>{entry}</TokenPill>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recapSections.map((section, index) => (
              <ReviewRecapCard
                controller={controller}
                prefersReducedMotion={prefersReducedMotion}
                section={section}
                key={section.id}
                staggerIndex={index}
              />
            ))}
          </div>
        </ArcaneScrollPanel>

        <ArcaneInspectorPanel title="Readiness" eyebrow="Final Check">
          <div className="space-y-4">
            <ValueBadge>{viewModel.allComplete ? "All rites complete" : `${viewModel.incompleteSectionLabels.length} unresolved`}</ValueBadge>
            {!viewModel.allComplete ? (
              <div className="space-y-3">
                <MicroLabel>Still unresolved</MicroLabel>
                <div className="flex flex-wrap gap-2">
                  {viewModel.incompleteSectionLabels.map((label) => <TokenPill key={label} muted>{label}</TokenPill>)}
                </div>
              </div>
            ) : (
              <p className="font-fth-cc-body text-[0.98rem] leading-7 text-[#d7d0cb]">
                The creator has all of the selections it needs. When you are satisfied with the artifact above, the footer action will complete the binding and create the character in Foundry.
              </p>
            )}
            {buildSections.length > 0 ? (
              <div className="space-y-3">
                <MicroLabel>Build Outcomes</MicroLabel>
                <div className="grid gap-3">
                  {buildSections.map((section) => (
                    <div className="rounded-[1rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4" key={section.id}>
                      <div className="font-fth-cc-body text-[1rem] font-semibold text-[#f4e7cf]">{section.label}</div>
                      {typeof section.summary === "string" && section.summary ? (
                        <p className="mt-2 font-fth-cc-body text-[0.95rem] leading-6 text-[#d7d0cb]">{section.summary}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </ArcaneInspectorPanel>
      </div>
    </ArcaneStepFrame>
  );
}

function SpellGroupSection({
  title,
  subtitle,
  emptyMessage,
  entries,
  selectedIds,
  preparedIds,
  onToggle,
  onTogglePrepared,
  prefersReducedMotion,
}: {
  title: string;
  subtitle: string;
  emptyMessage?: string;
  entries: Array<CinematicSelectionEntry & { schoolLabel?: string; prepared?: boolean }>;
  selectedIds: Set<string>;
  preparedIds?: Set<string>;
  onToggle: (uuid: string) => void;
  onTogglePrepared?: (uuid: string) => void;
  prefersReducedMotion: boolean;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <MicroLabel>{title}</MicroLabel>
        <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em] text-[#a89fbe]">{subtitle}</div>
      </div>
      {entries.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {entries.map((entry, index) => {
            const checked = selectedIds.has(entry.uuid);
            const prepared = preparedIds?.has(entry.uuid) ?? false;
            return (
              <motion.button
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                className={cn(
                  "rounded-[1.25rem] border p-4 text-left transition",
                  checked
                    ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(62,36,67,0.82),rgba(24,20,31,0.96))] shadow-[0_0_0_1px_rgba(233,193,118,0.18),0_18px_36px_rgba(0,0,0,0.2)]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(33,33,38,0.95),rgba(20,20,24,0.98))] hover:border-[#e9c176]/35",
                )}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                key={entry.uuid}
                onClick={() => onToggle(entry.uuid)}
                transition={{ duration: 0.22, delay: index * 0.02, ease: [0.22, 1, 0.36, 1] }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-fth-cc-display text-[1.25rem] text-[#f4e7cf]">{entry.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.schoolLabel ? <TokenPill muted>{entry.schoolLabel}</TokenPill> : null}
                      {prepared ? <TokenPill>Prepared</TokenPill> : null}
                    </div>
                  </div>
                  <SelectionSigil checked={checked} />
                </div>
                {onTogglePrepared && checked ? (
                  <button
                    className={cn(
                      "mt-4 rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em]",
                      prepared
                        ? "border-[#e9c176] bg-[linear-gradient(180deg,#f3d28e,#d5a84d)] text-[#38260f]"
                        : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#efe7df]",
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePrepared(entry.uuid);
                    }}
                    type="button"
                  >
                    {prepared ? "Prepared" : "Mark Prepared"}
                  </button>
                ) : null}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <ArcaneEmptyState compact message={emptyMessage ?? "No selections are available here yet."} />
        </div>
      )}
    </section>
  );
}

function ArcaneStepFrame({
  children,
  scene,
}: {
  children: ReactNode;
  scene: string;
}) {
  return (
    <section
      className="arcane-step-frame flex flex-col px-4 pb-4 pt-3 md:px-6 md:pb-6"
      data-scene={scene}
    >
      {children}
    </section>
  );
}

function ArcaneHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mx-auto mb-5 flex w-full max-w-5xl flex-col items-center text-center">
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <h2 className="mt-3 max-w-4xl font-fth-cc-display text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.95] text-[#f3e6cc]">
        {title}
      </h2>
      <div className="mt-4 h-px w-full max-w-3xl bg-[linear-gradient(90deg,rgba(233,193,118,0),rgba(233,193,118,0.7),rgba(233,193,118,0))]" />
      {description ? (
        <p className="mt-5 max-w-3xl font-fth-cc-body text-[1.06rem] leading-8 text-[#d1c9c2]">
          {description}
        </p>
      ) : null}
      {children ? <div className="w-full">{children}</div> : null}
    </header>
  );
}

function ArcaneScrollPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(
      "fth-react-scrollbar rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(25,25,30,0.9),rgba(15,15,19,0.96))] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl",
      className,
    )}
    >
      {children}
    </section>
  );
}

function ArcaneInspectorPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(23,23,29,0.92),rgba(13,13,18,0.98))] p-5 shadow-[0_24px_55px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <div className="mt-3 font-fth-cc-display text-[1.7rem] leading-tight text-[#f3e6cc]">{title}</div>
      <div className="mt-5">{children}</div>
    </aside>
  );
}

function ArcaneEmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={cn(
      "rounded-[1.25rem] border border-dashed border-white/12 bg-[rgba(255,255,255,0.03)] px-5 py-8 text-center",
      compact && "px-4 py-6",
    )}
    >
      <p className="mx-auto max-w-xl font-fth-cc-body text-[0.98rem] leading-7 text-[#c9c1ba]">{message}</p>
    </div>
  );
}

function ModeToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-full border px-4 py-2 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.18em] transition",
        active
          ? "border-[#e9c176] bg-[linear-gradient(180deg,#f3d28e,#d5a84d)] text-[#38260f] shadow-[0_10px_24px_rgba(0,0,0,0.14)]"
          : "border-white/10 bg-[rgba(255,255,255,0.04)] text-[#e6dfd8] hover:border-[#e9c176]/45",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.26em] text-[#e9c176]">
      {children}
    </div>
  );
}

function ValueBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-[#e9c176]/25 bg-[rgba(211,190,235,0.1)] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#f2e6d0]">
      {children}
    </div>
  );
}

function TokenPill({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-body text-[0.92rem]",
        muted
          ? "border-white/10 bg-[rgba(255,255,255,0.03)] text-[#c9c1ba]"
          : "border-[#e9c176]/25 bg-[rgba(211,190,235,0.1)] text-[#f1e5cf]",
      )}
    >
      {children}
    </span>
  );
}

function ReviewRecapCard({
  controller,
  prefersReducedMotion,
  section,
  staggerIndex,
}: {
  controller: ReactWizardStepProps["controller"];
  prefersReducedMotion: boolean;
  section: ReviewSection;
  staggerIndex: number;
}) {
  return (
    <motion.button
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      className={cn(
        "rounded-[1.35rem] border p-4 text-left transition",
        section.complete
          ? "border-white/12 bg-[linear-gradient(180deg,rgba(31,31,35,0.92),rgba(18,18,23,0.96))] hover:border-[#e9c176]/35"
          : "border-[#d07364]/35 bg-[linear-gradient(180deg,rgba(58,30,30,0.82),rgba(29,17,20,0.94))] hover:border-[#e9c176]/35",
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      onClick={() => controller.jumpToStep(section.id)}
      transition={{ duration: 0.22, delay: staggerIndex * 0.02, ease: [0.22, 1, 0.36, 1] }}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-fth-cc-display text-[1.2rem] text-[#f4e7cf]">{section.label}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <TokenPill muted>{section.complete ? "Complete" : "Needs attention"}</TokenPill>
            <TokenPill muted>Jump back</TokenPill>
          </div>
          {typeof section.summary === "string" && section.summary ? (
            <p className="mt-3 font-fth-cc-body text-[0.96rem] leading-6 text-[#d3cbc4]">{section.summary}</p>
          ) : null}
          {section.detail ? (
            <p className="mt-2 font-fth-cc-body text-[0.9rem] leading-6 text-[#9d94ad]">{section.detail}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <SelectionSigil checked={section.complete} />
          <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[#d8d0c7]">
            Edit
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function SelectionSigil({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border transition",
        checked
          ? "border-[#e9c176] bg-[radial-gradient(circle_at_35%_35%,#f3d28e,#d5a84d)] text-[#38260f] shadow-[0_0_16px_rgba(233,193,118,0.25)]"
          : "border-white/10 bg-[rgba(255,255,255,0.04)] text-[#bdb4ab]",
      )}
    >
      <i className={cn("fa-solid", checked ? "fa-check" : "fa-sparkles")} />
    </span>
  );
}
