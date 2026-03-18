import { MOD } from "../../logger";
import type {
  AbilityKey,
  CreatorIndexEntry,
  OriginChoicesState,
  OriginFeatSelection,
  SkillSelection,
  StepCallbacks,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseBackgroundGrants } from "../data/advancement-parser";
import { ABILITY_ABBREVS, SKILLS } from "../data/dnd5e-constants";

interface DatasetElementLike {
  dataset: DOMStringMap;
  addEventListener(event: string, handler: () => void): void;
}

interface SkillCheckboxLike extends DatasetElementLike {
  checked: boolean;
  disabled: boolean;
  addEventListener(event: string, handler: () => void): void;
  closest(selector: string): Element | null;
}

interface FeatDocumentLike {
  system?: {
    prerequisites?: {
      level?: number | null;
    };
    type?: {
      value?: string | null;
    };
  };
}

const originFeatEntryCache = new Map<string, Promise<CreatorIndexEntry[]>>();

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function toolLabel(key: string): string {
  return key.split(":").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(": ");
}

function getBackgroundSkills(state: WizardState): string[] {
  return state.selections.background?.grants.skillProficiencies ?? [];
}

function getChosenClassSkills(state: WizardState): string[] {
  return state.selections.skills?.chosen ?? [];
}

function getClassSkillPool(state: WizardState): string[] {
  return state.selections.class?.skillPool ?? [];
}

function getClassSkillCount(state: WizardState): number {
  return state.selections.class?.skillCount ?? 0;
}

function getDefaultOriginFeatSelection(state: WizardState): OriginFeatSelection | null {
  const backgroundFeatUuid = state.selections.background?.grants.originFeatUuid;
  if (!backgroundFeatUuid) return null;
  return {
    uuid: backgroundFeatUuid,
    name: state.selections.background?.grants.originFeatName ?? "Origin Feat",
    img: state.selections.background?.grants.originFeatImg ?? "",
    isCustom: false,
  };
}

function buildOriginFeatCacheKey(state: WizardState): string {
  return JSON.stringify({
    backgrounds: state.config.packSources.backgrounds,
    feats: state.config.packSources.feats,
  });
}

function isEligibleOriginFeatDocument(doc: FeatDocumentLike | null): boolean {
  const typeValue = doc?.system?.type?.value ?? "feat";
  const prereqLevel = doc?.system?.prerequisites?.level;
  return typeValue === "feat" && (prereqLevel === null || prereqLevel === undefined);
}

async function getAvailableOriginFeats(state: WizardState): Promise<CreatorIndexEntry[]> {
  const cacheKey = buildOriginFeatCacheKey(state);
  const cached = originFeatEntryCache.get(cacheKey);
  if (cached) {
    const entries = await cached;
    return entries.filter((entry) => !state.config.disabledUUIDs.has(entry.uuid));
  }

  const pending = (async () => {
    const featEntries = compendiumIndexer.getIndexedEntries("feat", state.config.packSources);
    const backgroundEntries = compendiumIndexer.getIndexedEntries("background", state.config.packSources);
    const featEntriesByUuid = new Map(featEntries.map((entry) => [entry.uuid, entry]));
    const originFeatUuids = new Set<string>();

    for (const backgroundEntry of backgroundEntries) {
      const backgroundDoc = await compendiumIndexer.fetchDocument(backgroundEntry.uuid);
      if (!backgroundDoc) continue;
      const grants = await parseBackgroundGrants(backgroundDoc);
      if (grants.originFeatUuid) originFeatUuids.add(grants.originFeatUuid);
    }

    const entries: CreatorIndexEntry[] = [];
    for (const uuid of originFeatUuids) {
      const entry = featEntriesByUuid.get(uuid);
      if (!entry) continue;
      const featDoc = await compendiumIndexer.fetchDocument(uuid) as FeatDocumentLike | null;
      if (!isEligibleOriginFeatDocument(featDoc)) continue;
      entries.push(entry);
    }

    return entries.sort((left, right) => left.name.localeCompare(right.name));
  })();

  originFeatEntryCache.set(cacheKey, pending);
  const entries = await pending;
  return entries.filter((entry) => !state.config.disabledUUIDs.has(entry.uuid));
}

function patchSkillsDOM(el: HTMLElement, chosen: Set<string>, maxPicks: number): void {
  const atMax = chosen.size >= maxPicks;
  getSkillCheckboxes(el).forEach((cb) => {
    const key = cb.dataset.skill;
    if (!key) return;
    const isChosen = chosen.has(key);
    cb.checked = isChosen;
    cb.disabled = !isChosen && atMax;
    const row = cb.closest(".cc-skill-row");
    if (row) row.classList.toggle("cc-skill-row--checked", isChosen);
  });
  const countEl = el.querySelector<HTMLElement>("[data-skill-count]");
  if (countEl) countEl.textContent = String(chosen.size);
}

function buildStepData(state: WizardState): OriginChoicesState {
  return {
    classSkills: getChosenClassSkills(state),
    chosenLanguages: [],
    originFeatUuid: state.selections.originFeat?.uuid,
  };
}

export function createOriginChoicesStep(): WizardStepDefinition {
  return {
    id: "originChoices",
    label: "Origin Choices",
    icon: "fa-solid fa-hand-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-origin-choices.hbs`,
    dependencies: ["background", "class"],
    isApplicable: (state) => !!state.selections.background?.uuid && !!state.selections.class?.uuid,

    isComplete(state: WizardState): boolean {
      const classSkillsComplete = getChosenClassSkills(state).length === getClassSkillCount(state);
      const featComplete = !state.selections.background?.grants.originFeatUuid || !!state.selections.originFeat?.uuid;
      return classSkillsComplete && featComplete;
    },

    getStatusHint(state: WizardState): string {
      const chosenSkills = getChosenClassSkills(state).length;
      const maxSkills = getClassSkillCount(state);
      if (chosenSkills < maxSkills) {
        const remaining = maxSkills - chosenSkills;
        return `Choose ${remaining} more class skill${remaining === 1 ? "" : "s"}`;
      }

      if (state.selections.background?.grants.originFeatUuid && !state.selections.originFeat?.uuid) {
        return "Confirm your origin feat";
      }

      return "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      if (state.config.allowCustomBackgrounds) {
        await compendiumIndexer.loadPacks(state.config.packSources);
      }

      const backgroundSkills = getBackgroundSkills(state);
      const backgroundSet = new Set(backgroundSkills);
      const chosenSkills = new Set(getChosenClassSkills(state));
      const maxPicks = getClassSkillCount(state);
      const availableKeys = getClassSkillPool(state).filter((key) => !backgroundSet.has(key));
      const featSelection = state.selections.originFeat ?? getDefaultOriginFeatSelection(state);
      const feats = state.config.allowCustomBackgrounds && state.selections.background?.grants.originFeatUuid
        ? await getAvailableOriginFeats(state)
        : [];
      const selectedFeatEntry = featSelection?.uuid
        ? feats.find((entry) => entry.uuid === featSelection.uuid)
        : null;
      const selectedFeatDescription = selectedFeatEntry?.uuid
        ? await compendiumIndexer.getCachedDescription(selectedFeatEntry.uuid)
        : "";

      const availableSkills = availableKeys
        .filter((key) => key in SKILLS)
        .map((key) => ({
          key,
          label: SKILLS[key].label,
          abilityAbbrev: ABILITY_ABBREVS[SKILLS[key].ability as AbilityKey],
          checked: chosenSkills.has(key),
          disabled: !chosenSkills.has(key) && chosenSkills.size >= maxPicks,
        }));

      return {
        className: state.selections.class?.name ?? "",
        backgroundName: state.selections.background?.name ?? "",
        availableSkills,
        backgroundSkillChips: backgroundSkills.map(skillLabel),
        chosenCount: chosenSkills.size,
        maxPicks,
        atMax: chosenSkills.size >= maxPicks,
        toolProficiency: state.selections.background?.grants.toolProficiency
          ? toolLabel(state.selections.background.grants.toolProficiency)
          : null,
        allowOriginFeatSwap: state.config.allowCustomBackgrounds && !!state.selections.background?.grants.originFeatUuid,
        defaultOriginFeatName: state.selections.background?.grants.originFeatName ?? null,
        originFeatName: featSelection?.name ?? state.selections.background?.grants.originFeatName ?? null,
        originFeatImg: featSelection?.img ?? state.selections.background?.grants.originFeatImg ?? "",
        isCustomOriginFeat: !!featSelection?.isCustom,
        selectedOriginFeat: selectedFeatEntry
          ? {
              ...selectedFeatEntry,
              description: selectedFeatDescription,
            }
          : null,
        availableOriginFeats: feats.map((entry) => ({
          ...entry,
          selected: entry.uuid === featSelection?.uuid,
        })),
        hasOriginFeats: feats.length > 0,
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      if (state.selections.background?.grants.originFeatUuid && !state.selections.originFeat) {
        state.selections.originFeat = getDefaultOriginFeatSelection(state) ?? undefined;
      }

      const backgroundSet = new Set(getBackgroundSkills(state));
      const maxPicks = getClassSkillCount(state);

      getSkillCheckboxes(el).forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const key = checkbox.dataset.skill;
          if (!key) return;

          const chosen = new Set(getChosenClassSkills(state));
          if (checkbox.checked) {
            if (chosen.size >= maxPicks || backgroundSet.has(key)) {
              checkbox.checked = false;
              return;
            }
            chosen.add(key);
          } else {
            chosen.delete(key);
          }

          const skillSelection: SkillSelection = { chosen: [...chosen] };
          state.selections.skills = skillSelection;
          patchSkillsDOM(el, chosen, maxPicks);
          callbacks.setDataSilent(buildStepData(state));
        });
      });

      getCardElements(el).forEach((card) => {
        card.addEventListener("click", () => {
          if (!state.config.allowCustomBackgrounds) return;
          const uuid = card.dataset.cardUuid;
          if (!uuid) return;

          const backgroundFeatUuid = state.selections.background?.grants.originFeatUuid;
          const entry = getCardElements(el)
            .map((candidate) => ({
              uuid: candidate.dataset.cardUuid ?? "",
              name: candidate.dataset.cardName ?? "",
              img: candidate.dataset.cardImg ?? "",
            }))
            .find((candidate) => candidate.uuid === uuid);
          if (!entry) return;

          const originFeat: OriginFeatSelection = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
            isCustom: entry.uuid !== backgroundFeatUuid,
          };
          state.selections.originFeat = originFeat;
          callbacks.setDataSilent(buildStepData(state));
          callbacks.rerender();
        });
      });

      callbacks.setDataSilent(buildStepData(state));
    },
  };
}

function getCardElements(root: ParentNode): DatasetElementLike[] {
  return Array.from(root.querySelectorAll("[data-card-uuid]"))
    .filter((value) => typeof value === "object" && value !== null && "dataset" in value)
    .map((value) => value as DatasetElementLike);
}

function getSkillCheckboxes(root: ParentNode): SkillCheckboxLike[] {
  return Array.from(root.querySelectorAll("[data-skill]"))
    .filter((value) =>
      typeof value === "object" && value !== null && "dataset" in value && "checked" in value && "disabled" in value
    )
    .map((value) => value as unknown as SkillCheckboxLike);
}

export const __originChoicesStepInternals = {
  getBackgroundSkills,
  getChosenClassSkills,
  getClassSkillPool,
  getClassSkillCount,
  getDefaultOriginFeatSelection,
  getAvailableOriginFeats,
  isEligibleOriginFeatDocument,
  buildStepData,
};
