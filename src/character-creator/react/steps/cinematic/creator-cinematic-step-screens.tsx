import type { CSSProperties, ReactNode } from "react";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import type {
  CreatorIndexEntry,
  PortraitSelection,
  ReactWizardStepProps,
  SpellSelection,
  SubclassSelection,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { fromUuid } from "../../../../types";
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
  cantrips: Array<CinematicSelectionEntry & { schoolLabel?: string; description?: string }>;
  cantripCount: number;
  maxCantrips: number | null;
  spellsByLevel: Array<{
    level: number;
    label: string;
    spells: Array<CinematicSelectionEntry & { schoolLabel?: string; prepared?: boolean; description?: string }>;
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
  sourceContextLabel?: string;
  spellListLabel?: string;
  schoolFilters?: Array<{ value: string; label: string }>;
};

type PortraitViewModel = {
  serverAvailable: boolean;
  autoPrompt: string;
  hasPortrait: boolean;
  portraitDataUrl: string;
  tokenDataUrl: string;
  tokenArtMode: "portrait" | "custom";
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
  alignment: string;
  backgroundStory: string;
  portraitDataUrl: string;
  tokenDataUrl: string;
  tokenArtMode: "portrait" | "custom";
  hasPortrait: boolean;
  hasTokenArt: boolean;
  tokenUsesPortrait: boolean;
  sections: ReviewSection[];
  allComplete: boolean;
  incompleteSectionLabels: string[];
  startingLevel: number;
};

const FINALIZE_SHELL_IMAGE_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-cinematic-finalize-shell-image)",
};

const FINALIZE_CARD_IMAGE_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-cinematic-finalize-card-image)",
};

const FINALIZE_CARD_SOFT_IMAGE_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-cinematic-finalize-card-soft-image)",
};

const FINALIZE_BUTTON_PRIMARY_IMAGE_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-cinematic-finalize-button-primary-image)",
};

const FINALIZE_BUTTON_SECONDARY_IMAGE_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-cinematic-finalize-button-secondary-image)",
};

const FINALIZE_BUTTON_DANGER_IMAGE_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-cinematic-finalize-button-danger-image)",
};

const FINALIZE_MEDIA_FADE_IMAGE_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-cinematic-finalize-media-fade)",
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
  const [searchText, setSearchText] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const deferredSearchText = useDeferredValue(searchText);
  const allSpellEntries = [
    ...viewModel.cantrips,
    ...viewModel.spellsByLevel.flatMap((group) => group.spells),
  ];
  const initialPreviewId = selection.preparedSpells?.[0]
    ?? selection.spells[0]
    ?? selection.cantrips[0]
    ?? allSpellEntries[0]?.uuid
    ?? null;
  const [previewUuid, setPreviewUuid] = useState<string | null>(initialPreviewId);
  const [previewDescriptions, setPreviewDescriptions] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!previewUuid) {
      setPreviewUuid(initialPreviewId);
      return;
    }
    const stillPresent = allSpellEntries.some((entry) => entry.uuid === previewUuid);
    if (!stillPresent) setPreviewUuid(initialPreviewId);
  }, [allSpellEntries, initialPreviewId, previewUuid]);

  useEffect(() => {
    if (!previewUuid || previewDescriptions[previewUuid]) return;
    const previewEntry = allSpellEntries.find((entry) => entry.uuid === previewUuid);
    if (previewEntry?.description) {
      setPreviewDescriptions((current) => ({ ...current, [previewUuid]: previewEntry.description ?? "" }));
      return;
    }

    let active = true;
    void (async () => {
      const doc = await fromUuid(previewUuid);
      const description = typeof doc?.system === "object" && doc?.system !== null
        ? ((doc.system as { description?: { value?: string } }).description?.value ?? "")
        : "";
      if (!active) return;
      setPreviewDescriptions((current) => ({ ...current, [previewUuid]: description }));
    })();

    return () => {
      active = false;
    };
  }, [allSpellEntries, previewDescriptions, previewUuid]);

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

  const normalizedQuery = deferredSearchText.trim().toLowerCase();
  const filteredCantrips = viewModel.cantrips.filter((entry) => {
    const matchesQuery = !normalizedQuery || entry.name.toLowerCase().includes(normalizedQuery);
    const matchesSchool = !schoolFilter || entry.school === schoolFilter;
    return matchesQuery && matchesSchool;
  });
  const filteredSpellGroups = viewModel.spellsByLevel
    .map((group) => ({
      ...group,
      spells: group.spells.filter((entry) => {
        const matchesQuery = !normalizedQuery || entry.name.toLowerCase().includes(normalizedQuery);
        const matchesSchool = !schoolFilter || entry.school === schoolFilter;
        return matchesQuery && matchesSchool;
      }),
    }))
    .filter((group) => group.spells.length > 0);
  const previewEntry = allSpellEntries.find((entry) => entry.uuid === previewUuid) ?? null;
  const previewDescription = previewEntry
    ? previewDescriptions[previewEntry.uuid] ?? previewEntry.description ?? ""
    : "";
  const selectedCantripIds = new Set(selection.cantrips);
  const selectedSpellIds = new Set(selection.spells);
  const preparedSpellIds = new Set(selection.preparedSpells ?? []);
  const selectedCantripEntries = viewModel.cantrips.filter((entry) => selection.cantrips.includes(entry.uuid));
  const selectedSpellEntries = viewModel.spellsByLevel.flatMap((group) => group.spells).filter((entry) => selection.spells.includes(entry.uuid));
  const preparedSpellEntries = selectedSpellEntries.filter((entry) => selection.preparedSpells?.includes(entry.uuid));
  const spellListName = (() => {
    const label = viewModel.spellListLabel?.trim();
    if (!label) return `${viewModel.className} list`;
    return /\blist\b/i.test(label) ? label : `${label} list`;
  })();
  const sourceContext = viewModel.sourceContextLabel ?? `Filtered to the ${viewModel.className} spell list.`;
  const selectionModelLabel = usesPreparedPicker
    ? `Choose spells from the ${spellListName}, then mark what starts prepared.`
    : `Choose the spells your ${viewModel.className} begins with from the ${spellListName}.`;
  const searchPlaceholder = `Search the ${spellListName}`;
  const selectedSchoolFilter = (viewModel.schoolFilters ?? []).find((filter) => filter.value === schoolFilter)?.label ?? null;
  const filterSummary = normalizedQuery || schoolFilter
    ? [
      normalizedQuery ? `Matching "${deferredSearchText.trim()}"` : null,
      selectedSchoolFilter ? `in ${selectedSchoolFilter}` : null,
    ].filter(Boolean).join(" ")
    : `Search by name or narrow the ${spellListName} by school.`;
  const cantripSummaryLabel = viewModel.maxCantrips !== null
    ? `${selection.cantrips.length} / ${viewModel.maxCantrips} cantrips`
    : `${selection.cantrips.length} cantrips`;
  const spellSummaryLabel = viewModel.maxSpells !== null
    ? `${selection.spells.length} / ${viewModel.maxSpells} spells`
    : `${selection.spells.length} spells chosen`;
  const preparedSummaryLabel = usesPreparedPicker
    ? `${preparedSpellEntries.length} / ${preparedLimit ?? 0} prepared`
    : null;

  return (
    <ArcaneStepFrame scene="grimoire">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <MicroLabel>{viewModel.className} Spellbook</MicroLabel>
          <h2 className="cc-theme-title mt-2 font-fth-cc-display text-[clamp(1.75rem,3vw,2.55rem)] leading-[0.94]">
            Choose Your Spells
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <ValueBadge>{cantripSummaryLabel}</ValueBadge>
          <ValueBadge>{spellSummaryLabel}</ValueBadge>
          {preparedSummaryLabel ? <ValueBadge>{preparedSummaryLabel}</ValueBadge> : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.14fr)_minmax(20rem,0.86fr)]">
        <ArcaneScrollPanel className="flex min-h-0 flex-col overflow-hidden">
          <div className="cc-theme-panel cc-theme-panel--accent shrink-0 rounded-[1.35rem] border p-4" data-spell-command-bar="true">
            <div className="grid gap-3 lg:grid-cols-2">
              <section className="cc-theme-card cc-theme-card--soft rounded-[1.2rem] p-4">
                <MicroLabel>Spell Source</MicroLabel>
                <p className="cc-theme-body-muted mt-3 font-fth-cc-body text-[0.95rem] leading-6">
                  {sourceContext}
                </p>
              </section>
              <section className="cc-theme-card cc-theme-card--soft rounded-[1.2rem] p-4">
                <MicroLabel>{usesPreparedPicker ? "Preparation Rules" : "Selection Rules"}</MicroLabel>
                <p className="cc-theme-body-muted mt-3 font-fth-cc-body text-[0.95rem] leading-6">
                  {selectionModelLabel}
                </p>
                {viewModel.hasPreparationNotice ? (
                  <p className="cc-theme-body mt-3 font-fth-cc-body text-[0.92rem] leading-6">
                    {viewModel.preparationNotice}
                  </p>
                ) : null}
              </section>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="cc-theme-card cc-theme-card--soft flex items-center gap-3 rounded-full border px-4 py-3 text-[var(--cc-text-primary)]">
                <i className="fa-solid fa-magnifying-glass text-[0.8rem] text-[var(--cc-badge-text)]" />
                <input
                  className="w-full bg-transparent font-fth-cc-body text-[0.96rem] outline-none placeholder:text-[var(--cc-text-secondary)]"
                  onChange={(event) => {
                    const value = event.target.value;
                    startTransition(() => setSearchText(value));
                  }}
                  placeholder={searchPlaceholder}
                  type="text"
                  value={searchText}
                />
              </label>
              <div className="space-y-2">
                <p className="cc-theme-body-muted font-fth-cc-body text-[0.83rem] leading-5">
                  {filterSummary}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1" data-spell-school-filters="true">
                  <ModeToggleButton
                    active={schoolFilter === ""}
                    label="All Schools"
                    onClick={() => startTransition(() => setSchoolFilter(""))}
                  />
                  {(viewModel.schoolFilters ?? []).map((filter) => (
                    <ModeToggleButton
                      active={schoolFilter === filter.value}
                      key={filter.value}
                      label={filter.label}
                      onClick={() => startTransition(() => setSchoolFilter(filter.value))}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1" data-spell-chooser-scroll="true">
            <SpellGroupSection
              emptyMessage={normalizedQuery || schoolFilter
                ? `No cantrips match the current filters for ${viewModel.className}.`
                : `No cantrips are available for ${viewModel.className} from the enabled spell data right now.`}
              entries={filteredCantrips}
              onToggle={toggleCantrip}
              onPreview={setPreviewUuid}
              prefersReducedMotion={prefersReducedMotion}
              selectedIds={selectedCantripIds}
              subtitle={viewModel.maxCantrips !== null ? `${selection.cantrips.length} / ${viewModel.maxCantrips} chosen` : `${selection.cantrips.length} chosen`}
              title="Cantrips"
            />

            <div className="mt-6 space-y-5">
              {filteredSpellGroups.length > 0 ? filteredSpellGroups.map((group) => (
                <SpellGroupSection
                  entries={group.spells}
                  key={group.level}
                  onToggle={toggleSpell}
                  onTogglePrepared={usesPreparedPicker ? togglePrepared : undefined}
                  onPreview={setPreviewUuid}
                  preparedIds={preparedSpellIds}
                  prefersReducedMotion={prefersReducedMotion}
                  selectedIds={selectedSpellIds}
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
                      {normalizedQuery || schoolFilter ? "No filtered entries" : "No valid entries"}
                    </div>
                  </div>
                  <div className="mt-4">
                    <ArcaneEmptyState
                      compact
                      message={normalizedQuery || schoolFilter
                        ? `No leveled spells match the current filters for ${viewModel.className}.`
                        : `No leveled spells are available for ${viewModel.className} from the enabled spell data right now.`}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        </ArcaneScrollPanel>

        <ArcaneInspectorPanel className="flex min-h-0 flex-col overflow-hidden" title="Preview & Loadout" eyebrow={viewModel.className}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2" data-spell-selection-rail="true">
              <ValueBadge>{cantripSummaryLabel}</ValueBadge>
              <ValueBadge>{spellSummaryLabel}</ValueBadge>
              {preparedSummaryLabel ? <ValueBadge>{preparedSummaryLabel}</ValueBadge> : null}
            </div>
            <div className="cc-theme-card cc-theme-card--soft rounded-[1.2rem] border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <MicroLabel>Spell Preview</MicroLabel>
                  <p className="cc-theme-body-muted mt-2 font-fth-cc-body text-[0.92rem] leading-6">
                    Focus or hover a spell on the left to inspect what it actually does before you commit it.
                  </p>
                </div>
                {previewEntry?.schoolLabel ? <TokenPill muted>{previewEntry.schoolLabel}</TokenPill> : null}
              </div>
              {previewEntry ? (
                <div className="mt-3">
                  <div className="flex items-start gap-3">
                    <img alt={previewEntry.name} className="h-16 w-16 rounded-[0.95rem] object-cover" src={previewEntry.img} />
                    <div className="min-w-0">
                      <div className="font-fth-cc-display text-[1.25rem] text-[#f4e7cf]">{previewEntry.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {previewEntry.schoolLabel ? <TokenPill muted>{previewEntry.schoolLabel}</TokenPill> : null}
                        {typeof previewEntry.spellLevel === "number" ? <TokenPill muted>Level {previewEntry.spellLevel}</TokenPill> : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 max-h-56 overflow-y-auto pr-2">
                    {previewDescription ? (
                      <div
                        className="arcane-prose"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: previewDescription }}
                      />
                    ) : (
                      <p className="font-fth-cc-body text-[0.95rem] leading-7 text-[#cfc6bf]">
                        No description is available for this spell yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <ArcaneEmptyState compact message="Hover or focus a spell to inspect its details here." />
                </div>
              )}
            </div>
            <div className="cc-theme-card cc-theme-card--soft rounded-[1.2rem] border p-4">
              <MicroLabel>{usesPreparedPicker ? "Current Loadout" : "Current Selections"}</MicroLabel>
              <div className="mt-4 space-y-4">
                {usesPreparedPicker ? (
                  <div className="space-y-3">
                    <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--cc-text-secondary)]">
                      Prepared Now
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {preparedSpellEntries.length > 0
                        ? preparedSpellEntries.map((entry) => <TokenPill key={entry.uuid}>{entry.name}</TokenPill>)
                        : <TokenPill muted>Choose prepared spells</TokenPill>}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-3">
                  <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--cc-text-secondary)]">
                    Chosen Cantrips
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCantripEntries.length > 0
                      ? selectedCantripEntries.map((entry) => <TokenPill key={entry.uuid}>{entry.name}</TokenPill>)
                      : <TokenPill muted>No cantrips chosen yet</TokenPill>}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--cc-text-secondary)]">
                    Chosen Spells
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSpellEntries.length > 0
                      ? selectedSpellEntries.map((entry) => <TokenPill key={entry.uuid}>{entry.name}</TokenPill>)
                      : <TokenPill muted>No leveled spells chosen yet</TokenPill>}
                  </div>
                </div>
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

  const portraitSelection = state.selections.portrait ?? undefined;
  const basePortraitSelection: PortraitSelection = portraitSelection ?? { source: "none" };
  const currentPortrait = portraitSelection?.portraitDataUrl ?? viewModel.portraitDataUrl;
  const currentTokenArt = portraitSelection?.tokenArtMode === "custom"
    ? (portraitSelection.tokenDataUrl ?? viewModel.tokenDataUrl)
    : (currentPortrait || viewModel.tokenDataUrl);
  const portraitSource = portraitSelection?.source ?? viewModel.source;
  const tokenArtMode = portraitSelection?.tokenArtMode ?? viewModel.tokenArtMode;
  const portraitSourceLabel = portraitSource === "generated"
    ? "Generated likeness"
    : portraitSource === "uploaded"
      ? "Uploaded likeness"
      : "Portrait optional";

  const selectPortrait = (dataUrl: string) => {
    const selection: PortraitSelection = {
      ...basePortraitSelection,
      portraitDataUrl: dataUrl,
      tokenDataUrl: tokenArtMode === "custom" ? (portraitSelection?.tokenDataUrl ?? dataUrl) : dataUrl,
      tokenArtMode: tokenArtMode === "custom" ? "custom" : "portrait",
      source: dataUrl.startsWith("data:") ? "generated" : "uploaded",
    };
    controller.updateCurrentStepData(selection, { silent: true });
  };

  const selectTokenArt = (dataUrl: string) => {
    const selection: PortraitSelection = {
      ...basePortraitSelection,
      tokenDataUrl: dataUrl,
      tokenArtMode: "custom",
      source: basePortraitSelection.source,
    };
    controller.updateCurrentStepData(selection, { silent: true });
  };

  const clearPortrait = () => {
    controller.updateCurrentStepData({
      ...basePortraitSelection,
      portraitDataUrl: undefined,
      tokenDataUrl: tokenArtMode === "custom" ? portraitSelection?.tokenDataUrl : undefined,
      tokenArtMode: tokenArtMode === "custom" ? "custom" : undefined,
      source: "none",
    } satisfies PortraitSelection, { silent: true });
  };

  const clearTokenArt = () => {
    controller.updateCurrentStepData({
      ...basePortraitSelection,
      tokenDataUrl: undefined,
      tokenArtMode: undefined,
      source: basePortraitSelection.source,
    } satisfies PortraitSelection, { silent: true });
  };

  const usePortraitForToken = () => {
    controller.updateCurrentStepData({
      ...basePortraitSelection,
      tokenDataUrl: currentPortrait || undefined,
      tokenArtMode: "portrait",
      source: basePortraitSelection.source,
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

  const openTokenUploadPicker = () => {
    const pickerCtor = (globalThis as { FilePicker?: new (options: { type: string; current: string; callback: (path: string) => void }) => { render: (force: boolean) => void } }).FilePicker;
    if (!pickerCtor) return;
    const picker = new pickerCtor({
      type: "image",
      current: "",
      callback: (path) => selectTokenArt(path),
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
            <section className="cc-theme-panel cc-theme-panel--soft rounded-[1.45rem] p-5" style={FINALIZE_CARD_SOFT_IMAGE_STYLE}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <MicroLabel>Portrait Atelier</MicroLabel>
                  <div className="cc-theme-title font-fth-cc-display text-[1.6rem] leading-tight">Shape the Likeness</div>
                  <p className="cc-theme-body-muted max-w-2xl font-fth-cc-body text-[0.98rem] leading-7">
                    Describe the face you want, choose a tonal style, and summon candidate portraits before you bind one.
                  </p>
                </div>
                <ValueBadge>{portraitSourceLabel}</ValueBadge>
              </div>

              <label className="cc-theme-kicker mt-5 block font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em]" htmlFor="portrait-prompt">
                Portrait Prompt
              </label>
              <textarea
                autoComplete="off"
                className="cc-theme-card cc-theme-card--raised mt-3 min-h-32 w-full rounded-[1rem] px-4 py-3 font-fth-cc-body text-[1rem] leading-7 text-[color:var(--cc-text-primary)] outline-none transition placeholder:text-[color:var(--cc-text-secondary)] focus-visible:border-[#e9c176]/55 focus-visible:ring-2 focus-visible:ring-[#e9c176]/35 focus-visible:ring-offset-0"
                onChange={(event) => setDescription(event.target.value)}
                id="portrait-prompt"
                name="portraitPrompt"
                placeholder={viewModel.autoPrompt}
                aria-describedby="portrait-prompt-guidance"
                value={description}
              />
              <p id="portrait-prompt-guidance" className="sr-only">
                Enter the portrait description used to generate candidate likenesses.
              </p>
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
                    className="cc-theme-card cc-theme-card--raised rounded-[1rem] border px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] text-[color:var(--cc-text-primary)] transition hover:translate-y-[-1px] hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                    style={FINALIZE_BUTTON_PRIMARY_IMAGE_STYLE}
                    disabled={generating}
                    onClick={() => void runGeneration()}
                    type="button"
                  >
                    {generating ? "Summoning Portraits..." : "Generate Portraits"}
                  </button>
                ) : null}
                <button
                  className="cc-theme-card cc-theme-card--soft rounded-[1rem] border px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] transition hover:border-[color:color-mix(in_srgb,var(--cc-border-accent)_48%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--cc-bg-surface)_84%,var(--cc-surface-accent-soft)_16%)]"
                  style={FINALIZE_BUTTON_SECONDARY_IMAGE_STYLE}
                  onClick={openUploadPicker}
                  type="button"
                >
                  Upload Portrait
                </button>
                {viewModel.hasPortrait ? (
                  <button
                    className="rounded-[1rem] border border-[color:color-mix(in_srgb,var(--cc-danger)_48%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-danger)_20%,transparent)] px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--cc-danger)_72%,var(--cc-text-primary)_28%)] transition hover:border-[color:color-mix(in_srgb,var(--cc-danger)_68%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--cc-danger)_28%,transparent)]"
                    style={FINALIZE_BUTTON_DANGER_IMAGE_STYLE}
                    onClick={clearPortrait}
                    type="button"
                  >
                    Clear Portrait
                  </button>
                ) : null}
                <button
                  className="cc-theme-card cc-theme-card--soft rounded-[1rem] border px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] transition hover:border-[color:color-mix(in_srgb,var(--cc-border-accent)_48%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--cc-bg-surface)_84%,var(--cc-surface-accent-soft)_16%)]"
                  style={FINALIZE_BUTTON_SECONDARY_IMAGE_STYLE}
                  onClick={openTokenUploadPicker}
                  type="button"
                >
                  Upload Token Art
                </button>
                <button
                  className="cc-theme-card cc-theme-card--soft rounded-[1rem] border px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] transition hover:border-[color:color-mix(in_srgb,var(--cc-border-accent)_48%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--cc-bg-surface)_84%,var(--cc-surface-accent-soft)_16%)]"
                  style={FINALIZE_BUTTON_SECONDARY_IMAGE_STYLE}
                  onClick={usePortraitForToken}
                  type="button"
                >
                  Use Portrait for Token
                </button>
                {tokenArtMode === "custom" ? (
                  <button
                    className="rounded-[1rem] border border-[color:color-mix(in_srgb,var(--cc-danger)_48%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-danger)_18%,transparent)] px-5 py-3 font-fth-cc-ui text-[0.74rem] uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--cc-danger)_72%,var(--cc-text-primary)_28%)] transition hover:border-[color:color-mix(in_srgb,var(--cc-danger)_68%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--cc-danger)_24%,transparent)]"
                    style={FINALIZE_BUTTON_DANGER_IMAGE_STYLE}
                    onClick={clearTokenArt}
                    type="button"
                  >
                    Clear Token Art
                  </button>
                ) : null}
              </div>
            </section>

            <section className="cc-theme-panel cc-theme-panel--soft rounded-[1.35rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE}>
              <div className="flex items-center justify-between gap-3">
                <MicroLabel>Generated Portraits</MicroLabel>
                <div className="cc-theme-body-muted font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em]">
                  {generated.length > 0 ? `${generated.length} summoned` : "Awaiting invocation"}
                </div>
              </div>
              {generated.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {generated.map((image, index) => (
                    <motion.button
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "cc-theme-card cc-theme-card--interactive overflow-hidden rounded-[1.3rem] border transition",
                        currentPortrait === image.dataUrl
                          ? "cc-theme-card--selected"
                          : "cc-theme-card--soft",
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
              <div className="cc-theme-media-frame overflow-hidden rounded-[1.4rem] border p-3" style={FINALIZE_CARD_IMAGE_STYLE}>
                <img alt="Selected portrait" className="aspect-[4/5] w-full rounded-[1rem] object-cover" src={currentPortrait} />
              </div>
            ) : (
              <ArcaneEmptyState message="No portrait is required. You can proceed without binding a likeness, or generate one here before the ritual closes." compact />
            )}
            <div className="cc-theme-card cc-theme-card--soft rounded-[1.25rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE}>
              <div className="flex items-center justify-between gap-3">
                <MicroLabel>Token Art</MicroLabel>
                <TokenPill muted>{tokenArtMode === "custom" ? "Custom token art" : "Mirrors portrait"}</TokenPill>
              </div>
              <p className="cc-theme-body-muted mt-3 font-fth-cc-body text-[0.95rem] leading-6">
                The token image defaults to the portrait. Upload a separate square asset only when the tabletop token should differ.
              </p>
              {currentTokenArt ? (
                <div className="cc-theme-media-frame mt-4 overflow-hidden rounded-[1.2rem] border p-3" style={FINALIZE_CARD_IMAGE_STYLE}>
                  <img alt="Selected token art" className="aspect-square w-full rounded-[0.9rem] object-cover" src={currentTokenArt} />
                </div>
              ) : (
                <ArcaneEmptyState compact message="No token art selected yet. The portrait will be used unless a custom token is uploaded." />
              )}
            </div>
          </div>
        </ArcaneInspectorPanel>
      </div>
    </ArcaneStepFrame>
  );
}

export function ReviewStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as ReviewStepViewModel | undefined;
  const [characterName, setCharacterName] = useState(viewModel?.characterName ?? "");
  const [alignment, setAlignment] = useState(viewModel?.alignment ?? "");
  const [backgroundStory, setBackgroundStory] = useState(viewModel?.backgroundStory ?? "");
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    setCharacterName(viewModel?.characterName ?? "");
    setAlignment(viewModel?.alignment ?? "");
    setBackgroundStory(viewModel?.backgroundStory ?? "");
  }, [viewModel?.characterName]);
  useEffect(() => {
    setAlignment(viewModel?.alignment ?? "");
  }, [viewModel?.alignment]);
  useEffect(() => {
    setBackgroundStory(viewModel?.backgroundStory ?? "");
  }, [viewModel?.backgroundStory]);

  if (!viewModel) return null;

  const reviewSelection = state.selections.review ?? {};
  const currentPortrait = viewModel.portraitDataUrl;
  const currentTokenArt = viewModel.tokenUsesPortrait
    ? (currentPortrait || viewModel.tokenDataUrl)
    : (viewModel.tokenDataUrl || currentPortrait);
  const commitLorePatch = (patch: Partial<{ characterName: string; alignment: string; backgroundStory: string }>) => {
    controller.updateCurrentStepData({ ...reviewSelection, ...patch }, { silent: true });
  };

  const heroSection = viewModel.sections.find((section) => section.id === "class");
  const originSection = viewModel.sections.find((section) => section.id === "background");
  const speciesSection = viewModel.sections.find((section) => section.id === "species");
  const abilitiesSection = viewModel.sections.find((section) => section.id === "abilities");
  const originSummarySection = viewModel.sections.find((section) => section.id === "originSummary");
  const portraitSection = viewModel.sections.find((section) => section.id === "portrait");
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
          <div className="cc-theme-panel cc-theme-panel--soft overflow-hidden rounded-[1.6rem]" style={FINALIZE_SHELL_IMAGE_STYLE}>
            <div className="grid gap-0 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1fr)]">
              <div className="p-5">
                <div className="cc-theme-card cc-theme-card--raised relative min-h-[20rem] overflow-hidden rounded-[1.4rem]">
                  <img
                    alt={characterName || "Character portrait"}
                    className="h-full w-full object-cover"
                    src={portraitSection?.img ?? currentPortrait ?? speciesSection?.img ?? heroSection?.img ?? ""}
                  />
                  <div className="cc-theme-media-frame__fade absolute inset-0 opacity-75" style={FINALIZE_MEDIA_FADE_IMAGE_STYLE} />
                  <div className="absolute inset-x-6 bottom-6">
                    <MicroLabel>Bound Identity</MicroLabel>
                    <div className="cc-theme-title mt-3 font-fth-cc-display text-[2.4rem] leading-none">
                      {characterName || "Name Your Artifact"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[speciesSection?.summary, heroSection?.summary, originSection?.summary].filter(Boolean).map((entry) => (
                        <TokenPill key={String(entry)}>{String(entry)}</TokenPill>
                      ))}
                      {alignment ? <TokenPill>{alignment}</TokenPill> : null}
                    </div>
                    <p className="cc-theme-copy mt-4 max-w-2xl font-fth-cc-body text-[0.96rem] leading-6">
                      This is the name that will appear on the character sheet and in the world. Keep it clear, bold, and easy to
                      recognize when the ritual closes. Add alignment and backstory here before finalizing the binding.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <section className="cc-theme-card cc-theme-card--soft rounded-[1.25rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE}>
                  <label className="cc-theme-kicker block font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em]" htmlFor="review-character-name">
                    Character Name
                  </label>
                  <p id="review-character-name-guidance" className="cc-theme-body-muted mt-3 max-w-xl font-fth-cc-body text-[0.94rem] leading-6">
                    The final binding uses this name exactly as shown here. Review it now so the finished character arrives
                    with the right identity.
                  </p>
                  <input
                    autoComplete="off"
                    aria-describedby="review-character-name-guidance"
                    data-character-name
                    className="cc-theme-card cc-theme-card--raised mt-4 w-full rounded-[1rem] px-4 py-3 font-fth-cc-display text-[1.35rem] text-[color:var(--cc-text-primary)] outline-none transition focus-visible:border-[#e9c176]/55 focus-visible:ring-2 focus-visible:ring-[#e9c176]/35 focus-visible:ring-offset-0"
                    style={FINALIZE_CARD_IMAGE_STYLE}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCharacterName(value);
                      commitLorePatch({ characterName: value });
                    }}
                    id="review-character-name"
                    name="characterName"
                    placeholder="Enter character name..."
                    value={characterName}
                  />
                </section>

                <section className="cc-theme-card cc-theme-card--soft rounded-[1.25rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE}>
                  <MicroLabel>Character Details</MicroLabel>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <label className="cc-theme-kicker block font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em]" htmlFor="review-alignment">
                        Alignment
                      </label>
                      <input
                        autoComplete="off"
                        className="cc-theme-card cc-theme-card--raised mt-3 w-full rounded-[1rem] px-4 py-3 font-fth-cc-body text-[1rem] text-[color:var(--cc-text-primary)] outline-none transition focus-visible:border-[#e9c176]/55 focus-visible:ring-2 focus-visible:ring-[#e9c176]/35 focus-visible:ring-offset-0"
                        id="review-alignment"
                        name="alignment"
                        data-lore-alignment
                        style={FINALIZE_CARD_IMAGE_STYLE}
                        placeholder="Neutral Good, chaotic, lawful, or custom..."
                        value={alignment}
                        onChange={(event) => {
                          const value = event.target.value;
                          setAlignment(value);
                          commitLorePatch({ alignment: value });
                        }}
                      />
                    </div>

                    <div>
                      <label className="cc-theme-kicker block font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em]" htmlFor="review-background-story">
                        Background Story
                      </label>
                      <textarea
                        autoComplete="off"
                        className="cc-theme-card cc-theme-card--raised mt-3 min-h-36 w-full rounded-[1rem] px-4 py-3 font-fth-cc-body text-[1rem] leading-7 text-[color:var(--cc-text-primary)] outline-none transition placeholder:text-[color:var(--cc-text-secondary)] focus-visible:border-[#e9c176]/55 focus-visible:ring-2 focus-visible:ring-[#e9c176]/35 focus-visible:ring-offset-0"
                        id="review-background-story"
                        name="backgroundStory"
                        data-background-story
                        style={FINALIZE_CARD_IMAGE_STYLE}
                        placeholder="Write a short origin, goals, or personality note..."
                        value={backgroundStory}
                        onChange={(event) => {
                          const value = event.target.value;
                          setBackgroundStory(value);
                          commitLorePatch({ backgroundStory: value });
                        }}
                      />
                    </div>
                  </div>
                </section>

                <section className="cc-theme-card cc-theme-card--soft rounded-[1.25rem] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <MicroLabel>Portrait and Token</MicroLabel>
                    <TokenPill muted>{viewModel.tokenUsesPortrait ? "Token follows portrait" : "Custom token art"}</TokenPill>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.56fr)]">
                    <div className="space-y-3">
                      <div className="cc-theme-body-muted font-fth-cc-body text-[0.95rem] leading-6">
                        {viewModel.hasPortrait
                          ? "The portrait is already bound and will be used on the final actor."
                          : "No portrait is required. The character can still be created with just the name, alignment, and story."}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <TokenPill muted>{viewModel.hasPortrait ? "Portrait set" : "Portrait optional"}</TokenPill>
                        <TokenPill muted>{viewModel.hasTokenArt ? "Token art set" : "Token art uses portrait"}</TokenPill>
                      </div>
                    </div>
                    <div className="cc-theme-media-frame overflow-hidden rounded-[1.2rem] border p-3" style={FINALIZE_CARD_IMAGE_STYLE}>
                      {currentTokenArt ? (
                        <img
                          alt="Selected token art"
                          className="aspect-square w-full rounded-[0.9rem] object-cover"
                          src={currentTokenArt}
                        />
                      ) : (
                        <ArcaneEmptyState compact message="No token art is bound yet. The portrait will stand in unless a custom token is uploaded later." />
                      )}
                    </div>
                  </div>
                </section>

                {Array.isArray(abilitiesSection?.summary) ? (
                  <section className="cc-theme-card cc-theme-card--soft rounded-[1.25rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE}>
                    <MicroLabel>Core Attributes</MicroLabel>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {(abilitiesSection.summary as Array<{ key: string; score: number; modifier: string }>).map((ability) => (
                        <div
                          className="cc-theme-card cc-theme-card--soft rounded-[1rem] px-4 py-3"
                          style={FINALIZE_CARD_SOFT_IMAGE_STYLE}
                          key={ability.key}
                        >
                          <div className="cc-theme-kicker font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.2em]">{ability.key}</div>
                          <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.55rem]">{ability.score}</div>
                          <div className="cc-theme-body-muted font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.14em]">{ability.modifier}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {originSummarySection?.selectedGrantGroups?.length ? (
                  <section className="cc-theme-card cc-theme-card--soft rounded-[1.25rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE}>
                    <MicroLabel>Origins</MicroLabel>
                    <div className="mt-3 grid gap-3">
                      {originSummarySection.selectedGrantGroups.map((group) => (
                        <div className="cc-theme-card cc-theme-card--soft rounded-[1rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE} key={group.id}>
                          <div className="cc-theme-body font-fth-cc-body text-[1rem] font-semibold">{group.title}</div>
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
              <p className="cc-theme-body-muted font-fth-cc-body text-[0.98rem] leading-7">
                The creator has all of the selections it needs. When you are satisfied with the artifact above, the footer action will complete the binding and create the character in Foundry.
              </p>
            )}
            {buildSections.length > 0 ? (
              <div className="space-y-3">
                <MicroLabel>Build Outcomes</MicroLabel>
                <div className="grid gap-3">
                  {buildSections.map((section) => (
                    <div className="cc-theme-card cc-theme-card--soft rounded-[1rem] p-4" style={FINALIZE_CARD_SOFT_IMAGE_STYLE} key={section.id}>
                      <div className="cc-theme-body font-fth-cc-body text-[1rem] font-semibold">{section.label}</div>
                      {typeof section.summary === "string" && section.summary ? (
                        <p className="cc-theme-body-muted mt-2 font-fth-cc-body text-[0.95rem] leading-6">{section.summary}</p>
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
  onPreview,
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
  onPreview?: (uuid: string) => void;
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
                onFocus={() => onPreview?.(entry.uuid)}
                onMouseEnter={() => onPreview?.(entry.uuid)}
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
      className="arcane-step-frame flex min-h-full flex-col px-4 pb-4 pt-3 md:px-6 md:pb-6"
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
    <header className="cc-theme-hero-shell mx-auto mb-5 flex w-full max-w-5xl flex-col items-center rounded-[2rem] px-6 py-5 text-center">
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <h2 className="cc-theme-title mt-3 max-w-4xl font-fth-cc-display text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.95]">
        {title}
      </h2>
      <div className="mt-4 h-px w-full max-w-3xl bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--cc-border-accent)_72%,transparent),transparent)]" />
      {description ? (
        <p className="cc-theme-copy mt-5 max-w-3xl font-fth-cc-body text-[1.06rem] leading-8">
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
      "fth-react-scrollbar cc-theme-panel cc-theme-panel--soft rounded-[1.7rem] border p-5 backdrop-blur-xl",
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
  className,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn(
      "cc-theme-panel cc-theme-panel--soft rounded-[1.7rem] border p-5 backdrop-blur-xl",
      className,
    )}
    >
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <div className="cc-theme-title mt-3 font-fth-cc-display text-[1.7rem] leading-tight">{title}</div>
      <div className="mt-5">{children}</div>
    </aside>
  );
}

function ArcaneEmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={cn(
      "cc-theme-empty rounded-[1.25rem] border border-dashed px-5 py-8 text-center",
      compact && "px-4 py-6",
    )}
    >
      <p className="cc-theme-body-muted mx-auto max-w-xl font-fth-cc-body text-[0.98rem] leading-7">{message}</p>
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
        "cc-theme-toggle rounded-full border px-4 py-2 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.18em] transition",
        active
          ? "cc-theme-toggle--active"
          : "",
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
    <div className="cc-theme-kicker font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.26em]">
      {children}
    </div>
  );
}

function ValueBadge({ children }: { children: ReactNode }) {
  return (
    <div className="cc-theme-badge inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em]">
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
          ? "cc-theme-pill--muted"
          : "cc-theme-pill",
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
        "cc-theme-card rounded-[1.35rem] border p-4 text-left transition",
        section.complete
          ? "cc-theme-card--raised cc-theme-card--interactive"
          : "cc-theme-card--selected",
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      onClick={() => controller.jumpToStep(section.id)}
      transition={{ duration: 0.22, delay: staggerIndex * 0.02, ease: [0.22, 1, 0.36, 1] }}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="cc-theme-title font-fth-cc-display text-[1.2rem]">{section.label}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <TokenPill muted>{section.complete ? "Complete" : "Needs attention"}</TokenPill>
            <TokenPill muted>Jump back</TokenPill>
          </div>
          {typeof section.summary === "string" && section.summary ? (
            <p className="cc-theme-body-muted mt-3 font-fth-cc-body text-[0.96rem] leading-6">{section.summary}</p>
          ) : null}
          {section.detail ? (
            <p className="cc-theme-kicker mt-2 font-fth-cc-body text-[0.9rem] leading-6">{section.detail}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <SelectionSigil checked={section.complete} />
          <span className="cc-theme-badge--muted rounded-full border px-2.5 py-1 font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em]">
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
          ? "cc-theme-sigil cc-theme-sigil--selected shadow-[0_0_16px_color-mix(in_srgb,var(--cc-border-accent)_28%,transparent)]"
          : "cc-theme-sigil",
      )}
    >
      <i className={cn("fa-solid", checked ? "fa-check" : "fa-sparkles")} />
    </span>
  );
}
