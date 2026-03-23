import { Log, MOD } from "../../logger";
import { renderTemplate } from "../../types";
import type {
  CreatorIndexEntry,
  OriginFeatSelection,
  StepCallbacks,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { ensureOriginFeatMetadataReady } from "../character-creator-index-cache";
import { compendiumIndexer } from "../data/compendium-indexer";
import { SKILLS } from "../data/dnd5e-constants";
import { getPackAnalysisMap, isEntryRelevantForWorkflow } from "../data/pack-analysis";
import { beginCardSelectionUpdate, isCurrentCardSelectionUpdate, patchCardDetailFromTemplate } from "./card-select-utils";

interface DatasetElementLike {
  dataset: DOMStringMap;
  addEventListener(event: string, handler: () => void): void;
}

interface OriginFeatLoadStats {
  cacheSource: "hydrated" | "enriched-fallback";
  indexedBackgroundCount: number;
  indexedFeatCount: number;
  missingBackgroundMetadataCount: number;
  missingFeatMetadataCount: number;
  grantedOriginFeatCount: number;
  workflowEligibleCount: number;
  duplicateFeatCount: number;
  packAnalysisMs: number;
  metadataReadyMs: number;
  resolverMs: number;
  buildMs: number;
}

interface OriginFeatAvailabilityResult {
  entries: CreatorIndexEntry[];
  stats: OriginFeatLoadStats;
}

const originFeatEntryCache = new Map<string, Promise<OriginFeatAvailabilityResult>>();

function getNowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function elapsedMs(start: number): number {
  return Math.round(getNowMs() - start);
}

function canChooseOriginFeat(state: WizardState): boolean {
  return !!state.config.allowOriginFeatChoice || !!state.config.allowCustomBackgrounds;
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

function isEligibleOriginFeatMetadata(entry: CreatorIndexEntry): boolean {
  const typeValue = entry.featCategory;
  const prereqLevel = entry.prerequisiteLevel;
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
    const cacheReadStart = getNowMs();
    const result = await cached;
    const filtered = result.entries.filter((entry) => !state.config.disabledUUIDs.has(entry.uuid));
    Log.info("CC Perf: origin feat options ready", {
      cache: "in-memory-hit",
      metadataSource: result.stats.cacheSource,
      indexedBackgroundCount: result.stats.indexedBackgroundCount,
      indexedFeatCount: result.stats.indexedFeatCount,
      missingBackgroundMetadataCount: result.stats.missingBackgroundMetadataCount,
      missingFeatMetadataCount: result.stats.missingFeatMetadataCount,
      grantedOriginFeatCount: result.stats.grantedOriginFeatCount,
      cachedEntryCount: result.entries.length,
      returnedCount: filtered.length,
      disabledFilteredCount: result.entries.length - filtered.length,
      cacheReadMs: elapsedMs(cacheReadStart),
      metadataReadyMs: result.stats.metadataReadyMs,
      resolverMs: result.stats.resolverMs,
      buildMs: result.stats.buildMs,
    });
    return filtered;
  }

  const pending = (async () => {
    const totalStart = getNowMs();
    await compendiumIndexer.ensureIndexedSources(state.config.packSources, {
      contentKeys: ["backgrounds", "feats"],
    });
    const indexedBackgroundEntries = compendiumIndexer.getIndexedEntries("background", state.config.packSources);
    const indexedFeatEntries = compendiumIndexer.getIndexedEntries("feat", state.config.packSources);
    const missingBackgroundMetadataCount = indexedBackgroundEntries
      .filter((entry) => entry.grantsOriginFeatUuid === undefined)
      .length;
    const missingFeatMetadataCount = indexedFeatEntries
      .filter((entry) => entry.featCategory === undefined || entry.prerequisiteLevel === undefined)
      .length;
    const metadataSource = missingBackgroundMetadataCount > 0 || missingFeatMetadataCount > 0
      ? "enriched-fallback"
      : "hydrated";
    const metadataReadyStart = getNowMs();
    await ensureOriginFeatMetadataReady(state.config.packSources, { persistIfMissing: false });
    const metadataReadyMs = elapsedMs(metadataReadyStart);

    const featEntries = compendiumIndexer.getIndexedEntries("feat", state.config.packSources);
    const backgroundEntries = compendiumIndexer.getIndexedEntries("background", state.config.packSources);
    const originFeatUuids = new Set<string>();
    const packAnalysisStart = getNowMs();
    const packAnalysisMap = await getPackAnalysisMap();
    const packAnalysisMs = elapsedMs(packAnalysisStart);

    Log.debug("Character Creator: origin feat sources", {
      featSources: state.config.packSources.feats,
      backgroundSources: state.config.packSources.backgrounds,
      indexedFeatPacks: summarizeEntriesByPack(featEntries),
      indexedBackgroundPacks: summarizeEntriesByPack(backgroundEntries),
    });

    for (const backgroundEntry of backgroundEntries) {
      if (backgroundEntry.grantsOriginFeatUuid) {
        originFeatUuids.add(backgroundEntry.grantsOriginFeatUuid);
      }
    }

    Log.debug("Character Creator: background-granted origin feats", Array.from(originFeatUuids));

    const entries: CreatorIndexEntry[] = [];
    const seen = new Set<string>();
    let workflowEligibleCount = 0;
    let duplicateFeatCount = 0;
    const resolverStart = getNowMs();

    for (const entry of featEntries) {
      if (seen.has(entry.uuid)) {
        duplicateFeatCount += 1;
        continue;
      }
      seen.add(entry.uuid);

      const workflowEligible = isEligibleOriginFeatMetadata(entry) && isEntryRelevantForWorkflow(entry, "origin-feat", {
        packAnalysis: packAnalysisMap.get(entry.packId) ?? null,
        prerequisiteLevel: entry.prerequisiteLevel,
        featCategory: entry.featCategory,
        grantedOriginFeatUuids: originFeatUuids,
      });

      Log.debug("Character Creator: origin feat candidate", {
        uuid: entry.uuid,
        name: entry.name,
        packId: entry.packId,
        packLabel: entry.packLabel,
        itemType: entry.itemType ?? null,
        featCategory: entry.featCategory,
        prerequisiteLevel: entry.prerequisiteLevel,
        docEligible: isEligibleOriginFeatMetadata(entry),
        workflowEligible,
      });

      if (!workflowEligible) continue;
      workflowEligibleCount += 1;
      entries.push(entry);
    }
    const resolverMs = elapsedMs(resolverStart);

    const sorted = entries.sort((left, right) => left.name.localeCompare(right.name));
    return {
      entries: sorted,
      stats: {
        cacheSource: metadataSource,
        indexedBackgroundCount: backgroundEntries.length,
        indexedFeatCount: featEntries.length,
        missingBackgroundMetadataCount,
        missingFeatMetadataCount,
        grantedOriginFeatCount: originFeatUuids.size,
        workflowEligibleCount,
        duplicateFeatCount,
        packAnalysisMs,
        metadataReadyMs,
        resolverMs,
        buildMs: elapsedMs(totalStart),
      },
    } satisfies OriginFeatAvailabilityResult;
  })();

  originFeatEntryCache.set(cacheKey, pending);
  const result = await pending;
  const filtered = result.entries.filter((entry) => !state.config.disabledUUIDs.has(entry.uuid));
  Log.info("CC Perf: origin feat options ready", {
    cache: "miss",
    ...result.stats,
    returnedCount: filtered.length,
    disabledFilteredCount: result.entries.length - filtered.length,
  });
  return filtered;
}

export async function warmOriginFeatChoices(state: WizardState): Promise<CreatorIndexEntry[]> {
  return getAvailableOriginFeats(state);
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
    label: "Origin Feat",
    icon: "fa-solid fa-hand-sparkles",
    renderMode: "react",
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
        await ensureOriginFeatMetadataReady(state.config.packSources, { persistIfMissing: true });
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
        stepId: "originChoices",
        stepTitle: "Origin Feat",
        stepLabel: "Origin Feat",
        stepIcon: "fa-solid fa-hand-sparkles",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--origin-flow",
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
  isEligibleOriginFeatMetadata,
  buildStepData,
};
