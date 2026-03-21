import { Log, MOD } from "../../logger";
import { renderTemplate } from "../../types";
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
import { getPackAnalysisMap, isEntryRelevantForWorkflow } from "../data/pack-analysis";
import { beginCardSelectionUpdate, isCurrentCardSelectionUpdate, patchCardDetailFromTemplate } from "./card-select-utils";

interface DatasetElementLike {
  dataset: DOMStringMap;
  addEventListener(event: string, handler: () => void): void;
}

interface FeatDocumentLike {
  system?: {
    prerequisites?: {
      level?: number | string | null;
    };
    type?:
      | {
        value?: string | null;
        subtype?: string | null;
      }
      | string
      | null;
  };
}

const originFeatEntryCache = new Map<string, Promise<CreatorIndexEntry[]>>();

function canChooseOriginFeat(state: WizardState): boolean {
  return !!state.config.allowOriginFeatChoice || !!state.config.allowCustomBackgrounds;
}

function getEnabledPackIds(state: WizardState): Set<string> {
  const packIds = new Set<string>();
  for (const ids of Object.values(state.config.packSources)) {
    for (const id of ids ?? []) packIds.add(id);
  }
  return packIds;
}

function getEnabledEntriesByItemType(state: WizardState, itemType: string): CreatorIndexEntry[] {
  const enabledPackIds = getEnabledPackIds(state);
  const allEntries = compendiumIndexer.getAllIndexedEntries();
  return allEntries
    .filter((entry) => enabledPackIds.size === 0 || enabledPackIds.has(entry.packId))
    .filter((entry) => (entry.itemType ?? "").toLowerCase() === itemType);
}

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
    classes: state.config.packSources.classes,
    subclasses: state.config.packSources.subclasses,
    races: state.config.packSources.races,
    backgrounds: state.config.packSources.backgrounds,
    feats: state.config.packSources.feats,
    spells: state.config.packSources.spells,
    items: state.config.packSources.items,
  });
}

function getFeatCategory(doc: FeatDocumentLike | null): string | null {
  const rawType = doc?.system?.type;
  if (typeof rawType === "string") return rawType.toLowerCase();
  if (rawType && typeof rawType === "object") {
    if (typeof rawType.subtype === "string" && rawType.subtype.trim()) return rawType.subtype.toLowerCase();
    if (typeof rawType.value === "string" && rawType.value.trim()) return rawType.value.toLowerCase();
  }
  return null;
}

function getPrerequisiteLevel(doc: FeatDocumentLike | null): number | null | undefined {
  const rawLevel = doc?.system?.prerequisites?.level;
  if (typeof rawLevel === "number") return rawLevel;
  if (typeof rawLevel === "string" && rawLevel.trim()) {
    const parsed = Number(rawLevel);
    if (Number.isFinite(parsed)) return parsed;
  }
  return rawLevel === null ? null : undefined;
}

function isEligibleOriginFeatDocument(doc: FeatDocumentLike | null): boolean {
  const typeValue = getFeatCategory(doc);
  const prereqLevel = getPrerequisiteLevel(doc);
  const featCategoryAllowed = !typeValue || typeValue === "feat" || typeValue === "origin";
  const levelAllowed = prereqLevel === null || prereqLevel === undefined || prereqLevel <= 1;
  return featCategoryAllowed && levelAllowed;
}

function summarizeEntriesByPack(entries: CreatorIndexEntry[]): Array<{ packId: string; count: number; sample: string[] }> {
  const byPack = new Map<string, CreatorIndexEntry[]>();

  for (const entry of entries) {
    const list = byPack.get(entry.packId) ?? [];
    list.push(entry);
    byPack.set(entry.packId, list);
  }

  return Array.from(byPack.entries())
    .map(([packId, packEntries]) => ({
      packId,
      count: packEntries.length,
      sample: packEntries.slice(0, 5).map((entry) => entry.name),
    }))
    .sort((left, right) => left.packId.localeCompare(right.packId));
}

async function getAvailableOriginFeats(state: WizardState): Promise<CreatorIndexEntry[]> {
  const cacheKey = buildOriginFeatCacheKey(state);
  const cached = originFeatEntryCache.get(cacheKey);
  if (cached) {
    const entries = await cached;
    return entries.filter((entry) => !state.config.disabledUUIDs.has(entry.uuid));
  }

  const pending = (async () => {
    const featEntries = getEnabledEntriesByItemType(state, "feat");
    const backgroundEntries = getEnabledEntriesByItemType(state, "background");
    const originFeatUuids = new Set<string>();
    const packAnalysisMap = await getPackAnalysisMap();

    Log.info("Character Creator: origin feat sources", {
      featSources: state.config.packSources.feats,
      backgroundSources: state.config.packSources.backgrounds,
      indexedFeatPacks: summarizeEntriesByPack(featEntries),
      indexedBackgroundPacks: summarizeEntriesByPack(backgroundEntries),
    });

    for (const backgroundEntry of backgroundEntries) {
      const backgroundDoc = await compendiumIndexer.fetchDocument(backgroundEntry.uuid);
      if (!backgroundDoc) continue;
      const grants = await parseBackgroundGrants(backgroundDoc);
      if (grants.originFeatUuid) originFeatUuids.add(grants.originFeatUuid);
    }

    Log.info("Character Creator: background-granted origin feats", Array.from(originFeatUuids));

    const entries: CreatorIndexEntry[] = [];
    const seen = new Set<string>();

    for (const entry of featEntries) {
      if (seen.has(entry.uuid)) continue;
      seen.add(entry.uuid);

      const featDoc = await compendiumIndexer.fetchDocument(entry.uuid) as FeatDocumentLike | null;
      const featCategory = getFeatCategory(featDoc);
      const prerequisiteLevel = getPrerequisiteLevel(featDoc);
      const docEligible = isEligibleOriginFeatDocument(featDoc);
      const workflowEligible = docEligible && isEntryRelevantForWorkflow(entry, "origin-feat", {
        packAnalysis: packAnalysisMap.get(entry.packId) ?? null,
        prerequisiteLevel,
        featCategory,
        grantedOriginFeatUuids: originFeatUuids,
      });

      Log.info("Character Creator: origin feat candidate", {
        uuid: entry.uuid,
        name: entry.name,
        packId: entry.packId,
        packLabel: entry.packLabel,
        itemType: entry.itemType ?? null,
        featCategory,
        prerequisiteLevel,
        docEligible,
        workflowEligible,
      });

      if (!workflowEligible) continue;
      entries.push(entry);
    }

    const sorted = entries.sort((left, right) => left.name.localeCompare(right.name));
    Log.info("Character Creator: origin feat results", summarizeEntriesByPack(sorted));
    return sorted;
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

async function renderOriginFeatDetailPane(
  selectedEntry: (CreatorIndexEntry & { description?: string }) | null,
): Promise<string> {
  return renderTemplate(`modules/${MOD}/templates/character-creator/cc-step-card-detail-pane.hbs`, {
    selectedEntry,
  });
}

export function createOriginChoicesStep(): WizardStepDefinition {
  return {
    id: "originChoices",
    label: "Origin Choices",
    icon: "fa-solid fa-hand-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-origin-choices.hbs`,
    dependencies: ["background", "class"],
    isApplicable: (state) =>
      canChooseOriginFeat(state)
      && !!state.selections.background?.uuid
      && !!state.selections.class?.uuid
      && !!state.selections.background?.grants.originFeatUuid,

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
      if (canChooseOriginFeat(state)) {
        await compendiumIndexer.loadPacks(state.config.packSources);
      }

      const backgroundSkills = getBackgroundSkills(state);
      const featSelection = state.selections.originFeat ?? getDefaultOriginFeatSelection(state);
      const feats = canChooseOriginFeat(state) && state.selections.background?.grants.originFeatUuid
        ? await getAvailableOriginFeats(state)
        : [];
      const selectedFeatEntry = featSelection?.uuid
        ? feats.find((entry) => entry.uuid === featSelection.uuid)
        : null;
      const selectedFeatDescription = selectedFeatEntry?.uuid
        ? await compendiumIndexer.getCachedDescription(selectedFeatEntry.uuid)
        : "";
      const selectedOriginFeat = selectedFeatEntry
        ? {
            ...selectedFeatEntry,
            description: selectedFeatDescription,
          }
        : featSelection
          ? {
              uuid: featSelection.uuid,
              name: featSelection.name,
              img: featSelection.img,
              packId: "",
              packLabel: "",
              type: "feat" as const,
              description: "",
            }
        : null;

      return {
        className: state.selections.class?.name ?? "",
        backgroundName: state.selections.background?.name ?? "",
        chosenClassSkillChips: getChosenClassSkills(state).map(skillLabel),
        backgroundSkillChips: backgroundSkills.map(skillLabel),
        toolProficiency: state.selections.background?.grants.toolProficiency
          ? toolLabel(state.selections.background.grants.toolProficiency)
          : null,
        allowOriginFeatSwap: canChooseOriginFeat(state) && !!state.selections.background?.grants.originFeatUuid,
        defaultOriginFeatName: state.selections.background?.grants.originFeatName ?? null,
        originFeatName: featSelection?.name ?? state.selections.background?.grants.originFeatName ?? null,
        originFeatImg: featSelection?.img ?? state.selections.background?.grants.originFeatImg ?? "",
        isCustomOriginFeat: !!featSelection?.isCustom,
        selectedOriginFeat,
        originFeatDetailPaneHtml: await renderOriginFeatDetailPane(selectedOriginFeat),
        availableOriginFeats: feats.map((entry) => ({
          ...entry,
          selected: entry.uuid === featSelection?.uuid,
        })),
        hasOriginFeats: feats.length > 0,
        originFeatEmptyMessage: state.selections.background?.grants.originFeatUuid
          ? "No alternative 2024 origin feats were found in the enabled feat packs, so the background's default feat will be used."
          : "",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      if (state.selections.background?.grants.originFeatUuid && !state.selections.originFeat) {
        state.selections.originFeat = getDefaultOriginFeatSelection(state) ?? undefined;
      }

      getCardElements(el).forEach((card) => {
        card.addEventListener("click", () => {
          if (!canChooseOriginFeat(state)) return;
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
          const patchEntry: CreatorIndexEntry = {
            uuid: entry.uuid,
            name: entry.name,
            img: entry.img,
            packLabel: card.dataset.cardPackLabel ?? "",
            packId: "",
            type: "feat" as const,
          };
          const requestId = beginCardSelectionUpdate(el, uuid, patchEntry);

          void (async () => {
            const description = patchEntry.uuid
              ? await compendiumIndexer.getCachedDescription(patchEntry.uuid)
              : "";
            if (!isCurrentCardSelectionUpdate(el, requestId)) return;
            await patchCardDetailFromTemplate(el, {
              templatePath: `modules/${MOD}/templates/character-creator/cc-step-card-detail-pane.hbs`,
              data: {
                selectedEntry: {
                  ...patchEntry,
                  description,
                },
              },
              requestId,
            });
          })();
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
