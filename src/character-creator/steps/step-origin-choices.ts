import { MOD } from "../../logger";
import type {
  CreatorIndexEntry,
  OriginFeatSelection,
  StepCallbacks,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseBackgroundGrants } from "../data/advancement-parser";
import { SKILLS } from "../data/dnd5e-constants";

interface DatasetElementLike {
  dataset: DOMStringMap;
  addEventListener(event: string, handler: () => void): void;
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

function buildStepData(state: WizardState): Record<string, unknown> {
  return {
    classSkills: getChosenClassSkills(state),
    chosenLanguages: [],
    originFeatUuid: state.selections.originFeat?.uuid,
  };
}

function getOriginChoiceValidationMessages(state: WizardState): string[] {
  const messages: string[] = [];
  if (state.config.allowCustomBackgrounds && !!state.selections.background?.grants.originFeatUuid) {
    messages.push("If the feat swap list looks empty, keep the background's default origin feat or enable a feat pack that contains 2024 origin feats.");
  }

  return messages;
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
      const featComplete = !state.selections.background?.grants.originFeatUuid || !!state.selections.originFeat?.uuid;
      return featComplete;
    },

    getStatusHint(state: WizardState): string {
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

      return {
        className: state.selections.class?.name ?? "",
        backgroundName: state.selections.background?.name ?? "",
        chosenClassSkillChips: getChosenClassSkills(state).map(skillLabel),
        backgroundSkillChips: backgroundSkills.map(skillLabel),
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
        originFeatEmptyMessage: state.selections.background?.grants.originFeatUuid
          ? "No alternative 2024 origin feats were found in the enabled feat packs, so the background's default feat will be used."
          : "",
        validationMessages: getOriginChoiceValidationMessages(state),
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      if (state.selections.background?.grants.originFeatUuid && !state.selections.originFeat) {
        state.selections.originFeat = getDefaultOriginFeatSelection(state) ?? undefined;
      }

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

export const __originChoicesStepInternals = {
  getBackgroundSkills,
  getChosenClassSkills,
  getDefaultOriginFeatSelection,
  getAvailableOriginFeats,
  isEligibleOriginFeatDocument,
  buildStepData,
};
