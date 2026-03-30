/**
 * Level-Up — Step 6: Spells
 *
 * Shared spell progression, selection trays, and swap-aware browser for level-up.
 */

import { MOD } from "../../../logger";
import { fromUuid, type FoundryDocument } from "../../../types";
import type { CreatorIndexEntry } from "../../character-creator-types";
import { compendiumIndexer } from "../../data/compendium-indexer";
import { resolveClassSpellUuids } from "../../data/spell-list-resolver";
import type { SpellPreparationClassDocumentLike } from "../../spell-preparation-policy";
import { resolveLevelUpSpellEntitlements } from "../../spell-selection-resolver";
import type { LevelUpSpellsChoice, LevelUpState, ClassItemInfo } from "../level-up-types";
import type { LevelUpStepDef } from "./lu-step-class-choice";

const SCHOOL_LABELS: Record<string, string> = {
  abj: "Abjuration",
  con: "Conjuration",
  div: "Divination",
  enc: "Enchantment",
  evo: "Evocation",
  ill: "Illusion",
  nec: "Necromancy",
  trs: "Transmutation",
};

interface SpellItemLike {
  id: string;
  type?: string;
  name?: string;
  img?: string;
  system?: {
    level?: number;
    school?: string;
  };
}

interface ActorWithItems extends FoundryDocument {
  items?: Iterable<SpellItemLike> | ArrayLike<SpellItemLike>;
}

interface SpellCardLike {
  dataset: DOMStringMap;
  style: {
    display: string;
  };
  addEventListener(event: string, handler: (event?: Event) => void): void;
}

interface SearchInputLike {
  value: string;
  addEventListener(event: string, handler: () => void): void;
}

interface PreviewPaneElements {
  name: HTMLElement | null;
  meta: HTMLElement | null;
  description: HTMLElement | null;
  image: HTMLImageElement | null;
}

type IndexedSpellEntry = CreatorIndexEntry & {
  schoolLabel: string;
  selected?: boolean;
};

type BrowserState = {
  searchText: string;
  schoolFilter: string;
  previewUuid: string;
};

function emptyChoice(): LevelUpSpellsChoice {
  return {
    newSpellUuids: [],
    swappedOutUuids: [],
    swappedInUuids: [],
    newCantripUuids: [],
  };
}

function getActorItems(actor: FoundryDocument): SpellItemLike[] {
  const items = (actor as ActorWithItems).items;
  if (!items) return [];
  return Array.from(items);
}

function getClassContext(state: LevelUpState): {
  classChoice: LevelUpState["selections"]["classChoice"];
  classInfo: ClassItemInfo | null;
  classIdentifier: string;
  className: string;
  currentClassLevel: number;
  targetClassLevel: number;
  subclassName: string | null;
} {
  const classChoice = state.selections.classChoice;
  const defaultClass = state.classItems[0] ?? null;
  const classInfo = classChoice?.mode === "existing"
    ? state.classItems.find((item) => item.itemId === classChoice.classItemId) ?? null
    : null;
  const activeClass = classInfo ?? defaultClass;
  const classIdentifier = classChoice?.classIdentifier ?? activeClass?.identifier ?? "";
  const className = classChoice?.className ?? activeClass?.name ?? "your class";
  const currentClassLevel = classChoice?.mode === "multiclass"
    ? 0
    : (classInfo?.levels ?? activeClass?.levels ?? 0);
  const targetClassLevel = currentClassLevel + 1;
  const subclassName = state.selections.subclass?.name ?? classInfo?.subclassName ?? activeClass?.subclassName ?? null;

  return {
    classChoice,
    classInfo,
    classIdentifier,
    className,
    currentClassLevel,
    targetClassLevel,
    subclassName,
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function normalizeChoice(
  choice: LevelUpSpellsChoice | undefined,
  limits: {
    newCantrips: number;
    newSpells: number;
    swapLimit: number;
  },
): LevelUpSpellsChoice {
  const current = choice ?? emptyChoice();
  const newCantripUuids = dedupe(current.newCantripUuids).slice(0, limits.newCantrips);
  const newSpellUuids = dedupe(current.newSpellUuids);
  const swappedOutUuids = dedupe(current.swappedOutUuids).slice(0, limits.swapLimit);
  const allowedSwapCount = Math.min(limits.swapLimit, swappedOutUuids.length);
  const swappedInUuids = dedupe(current.swappedInUuids)
    .filter((uuid) => !newSpellUuids.includes(uuid))
    .slice(0, allowedSwapCount);

  return {
    newCantripUuids,
    newSpellUuids: newSpellUuids
      .filter((uuid) => !swappedInUuids.includes(uuid))
      .slice(0, limits.newSpells),
    swappedOutUuids,
    swappedInUuids,
  };
}

function buildSelectionSummary(
  choice: LevelUpSpellsChoice,
  limits: {
    newCantrips: number;
    newSpells: number;
    swapLimit: number;
  },
): string {
  const parts: string[] = [];
  if (limits.newCantrips > 0) parts.push(`${choice.newCantripUuids.length} / ${limits.newCantrips} cantrips`);
  if (limits.newSpells > 0) parts.push(`${choice.newSpellUuids.length} / ${limits.newSpells} spells`);
  if (limits.swapLimit > 0) {
    const completedSwaps = Math.min(choice.swappedOutUuids.length, choice.swappedInUuids.length);
    parts.push(`${completedSwaps} / ${limits.swapLimit} swaps`);
  }
  return parts.length > 0 ? parts.join(", ") : "No spell changes at this level";
}

function buildStatusHint(
  choice: LevelUpSpellsChoice,
  limits: {
    newCantrips: number;
    newSpells: number;
    swapLimit: number;
  },
): string {
  const parts: string[] = [];
  const remainingCantrips = limits.newCantrips - choice.newCantripUuids.length;
  const remainingSpells = limits.newSpells - choice.newSpellUuids.length;

  if (remainingCantrips > 0) parts.push(`choose ${remainingCantrips} more cantrip${remainingCantrips === 1 ? "" : "s"}`);
  if (remainingSpells > 0) parts.push(`choose ${remainingSpells} more spell${remainingSpells === 1 ? "" : "s"}`);

  if (limits.swapLimit > 0) {
    if (choice.swappedInUuids.length > choice.swappedOutUuids.length) {
      parts.push("choose spells to replace");
    } else if (choice.swappedOutUuids.length > choice.swappedInUuids.length) {
      const remaining = choice.swappedOutUuids.length - choice.swappedInUuids.length;
      parts.push(`choose ${remaining} replacement spell${remaining === 1 ? "" : "s"}`);
    }
  }

  return parts.join(" and ");
}

function isChoiceComplete(
  choice: LevelUpSpellsChoice,
  limits: {
    newCantrips: number;
    newSpells: number;
    swapLimit: number;
  },
): boolean {
  const swapCount = Math.min(choice.swappedOutUuids.length, choice.swappedInUuids.length);
  const swapsBalanced = choice.swappedOutUuids.length === choice.swappedInUuids.length
    && choice.swappedOutUuids.length <= limits.swapLimit;

  return choice.newCantripUuids.length === limits.newCantrips
    && choice.newSpellUuids.length === limits.newSpells
    && swapsBalanced
    && swapCount <= limits.swapLimit;
}

function getSpellSchoolLabel(entry: { school?: string; system?: { school?: string } }): string {
  const school = entry.school ?? entry.system?.school ?? "";
  return SCHOOL_LABELS[school] ?? school ?? "";
}

function toSpellEntry(entry: CreatorIndexEntry, selected = false): IndexedSpellEntry {
  return {
    ...entry,
    selected,
    schoolLabel: getSpellSchoolLabel(entry),
  };
}

function nameKey(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

function getPreviewElements(root: ParentNode): PreviewPaneElements {
  return {
    name: root.querySelector("[data-preview-name]"),
    meta: root.querySelector("[data-preview-meta]"),
    description: root.querySelector("[data-preview-description]"),
    image: root.querySelector("[data-preview-image]"),
  };
}

function updatePreviewDom(
  root: ParentNode,
  payload: {
    name: string;
    meta: string;
    description: string;
    img: string;
  },
): void {
  const preview = getPreviewElements(root);
  if (preview.name) preview.name.textContent = payload.name;
  if (preview.meta) preview.meta.textContent = payload.meta;
  if (preview.description) preview.description.innerHTML = payload.description || "<p>No description is available for this spell yet.</p>";
  if (preview.image) {
    preview.image.src = payload.img;
    preview.image.alt = payload.name;
  }
}

function getCards(root: ParentNode, selector: string): SpellCardLike[] {
  const values = Array.from(root.querySelectorAll(selector) as ArrayLike<unknown>);
  return values.filter((value): value is SpellCardLike =>
    typeof value === "object"
    && value !== null
    && "dataset" in value
    && "style" in value
    && typeof (value as { addEventListener?: unknown }).addEventListener === "function"
  );
}

function getSearchInput(root: ParentNode): SearchInputLike | null {
  const value = root.querySelector("[data-spell-search]");
  if (!value || typeof value !== "object") return null;
  if (typeof (value as { addEventListener?: unknown }).addEventListener !== "function") return null;
  if (!("value" in value)) return null;
  return value as SearchInputLike;
}

export function createLuSpellsStep(): LevelUpStepDef {
  let cachedSpellListId = "";
  let cachedSpellUuids: Set<string> | null = null;
  const previewDescriptionCache: Record<string, string> = {};
  const browserState: BrowserState = {
    searchText: "",
    schoolFilter: "",
    previewUuid: "",
  };

  const resolveCurrentLimits = (state: LevelUpState) => {
    const context = getClassContext(state);
    const entitlements = resolveLevelUpSpellEntitlements({
      classIdentifier: context.classIdentifier,
      className: context.className,
      currentLevel: context.currentClassLevel,
      targetLevel: context.targetClassLevel,
      subclassName: context.subclassName,
    });

    return {
      entitlements,
      limits: {
        newCantrips: entitlements.newCantrips,
        newSpells: entitlements.newSpells,
        swapLimit: entitlements.swapLimit,
      },
    };
  };

  const applyBrowserFilters = (root: ParentNode) => {
    const query = browserState.searchText.trim().toLowerCase();
    const school = browserState.schoolFilter;

    getCards(root, "[data-filter-card]").forEach((card) => {
      const name = (card.dataset.spellName ?? "").toLowerCase();
      const cardSchool = card.dataset.spellSchool ?? "";
      const matchesQuery = !query || name.includes(query);
      const matchesSchool = !school || school === cardSchool;
      card.style.display = matchesQuery && matchesSchool ? "" : "none";
    });

    const buttons = Array.from(root.querySelectorAll("[data-school-filter-button]")) as HTMLElement[];
    for (const button of buttons) {
      button.classList.toggle("cc-lu-spells__filter--active", (button.dataset.schoolFilter ?? "") === browserState.schoolFilter);
    }
  };

  const loadPreviewDescription = async (uuid: string): Promise<string> => {
    if (previewDescriptionCache[uuid] !== undefined) return previewDescriptionCache[uuid];
    const doc = await fromUuid(uuid);
    const description = typeof doc?.system === "object" && doc?.system !== null
      ? ((doc.system as { description?: { value?: string } }).description?.value ?? "")
      : "";
    previewDescriptionCache[uuid] = description;
    return description;
  };

  return {
    id: "spells",
    label: "Spells",
    icon: "fa-solid fa-wand-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/lu-step-spells.hbs`,

    isComplete(state: LevelUpState): boolean {
      const { limits } = resolveCurrentLimits(state);
      const choice = normalizeChoice(state.selections.spells, limits);
      return isChoiceComplete(choice, limits);
    },

    getStatusHint(state: LevelUpState): string {
      const { limits } = resolveCurrentLimits(state);
      const choice = normalizeChoice(state.selections.spells, limits);
      return buildStatusHint(choice, limits);
    },

    async buildViewModel(state: LevelUpState, actor: FoundryDocument): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks({
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: ["dnd5e.spells"],
        items: [],
      });

      const context = getClassContext(state);
      const classDoc = context.classChoice?.mode === "multiclass" && context.classChoice.newClassUuid
        ? await fromUuid(context.classChoice.newClassUuid) as SpellPreparationClassDocumentLike | null
        : null;
      const entitlements = resolveLevelUpSpellEntitlements({
        classIdentifier: context.classIdentifier,
        className: context.className,
        currentLevel: context.currentClassLevel,
        targetLevel: context.targetClassLevel,
        subclassName: context.subclassName,
        classDoc,
      });
      const limits = {
        newCantrips: entitlements.newCantrips,
        newSpells: entitlements.newSpells,
        swapLimit: entitlements.swapLimit,
      };
      const selection = normalizeChoice(state.selections.spells, limits);

      if (!entitlements.listIdentifier) {
        cachedSpellListId = "";
        cachedSpellUuids = null;
      } else if (entitlements.listIdentifier !== cachedSpellListId) {
        cachedSpellListId = entitlements.listIdentifier;
        cachedSpellUuids = await resolveClassSpellUuids(entitlements.listIdentifier);
      }

      const indexedSpells = compendiumIndexer.getIndexedEntries("spell", {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: ["dnd5e.spells"],
        items: [],
      });
      const allowedSpells = cachedSpellUuids
        ? indexedSpells.filter((entry) => cachedSpellUuids?.has(entry.uuid))
        : indexedSpells;
      const actorSpellNames = new Set(
        getActorItems(actor)
          .filter((item) => item.type === "spell")
          .map((item) => nameKey(item.name)),
      );
      const indexedByName = new Map(allowedSpells.map((entry) => [nameKey(entry.name), entry]));

      const currentSpells = getActorItems(actor)
        .filter((item) => item.type === "spell")
        .map((item) => {
          const indexed = indexedByName.get(nameKey(item.name));
          return {
            id: item.id,
            uuid: indexed?.uuid ?? "",
            name: item.name ?? "Unknown Spell",
            level: item.system?.level ?? indexed?.spellLevel ?? 0,
            spellLevel: item.system?.level ?? indexed?.spellLevel ?? 0,
            schoolLabel: getSpellSchoolLabel(indexed ?? item),
            img: indexed?.img ?? item.img ?? "icons/svg/book.svg",
            selected: !!indexed?.uuid && selection.swappedOutUuids.includes(indexed.uuid),
          };
        })
        .filter((entry) => entry.level > 0 && entry.level <= entitlements.maxSpellLevel)
        .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));

      const isKnownSpell = (entry: CreatorIndexEntry): boolean => actorSpellNames.has(nameKey(entry.name));
      const cantrips = allowedSpells
        .filter((entry) => entry.spellLevel === 0)
        .filter((entry) => !isKnownSpell(entry) || selection.newCantripUuids.includes(entry.uuid))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => toSpellEntry(entry, selection.newCantripUuids.includes(entry.uuid)));

      const leveledSpells = allowedSpells
        .filter((entry) => (entry.spellLevel ?? 0) > 0 && (entry.spellLevel ?? 0) <= entitlements.maxSpellLevel)
        .filter((entry) => !isKnownSpell(entry) || selection.newSpellUuids.includes(entry.uuid) || selection.swappedInUuids.includes(entry.uuid))
        .sort((left, right) => left.spellLevel === right.spellLevel
          ? left.name.localeCompare(right.name)
          : (left.spellLevel ?? 0) - (right.spellLevel ?? 0));

      const spellsByLevel = Array.from({ length: entitlements.maxSpellLevel }, (_, index) => index + 1)
        .map((level) => ({
          level,
          label: `Level ${level}`,
          spells: leveledSpells
            .filter((entry) => entry.spellLevel === level)
            .map((entry) => toSpellEntry(entry, selection.newSpellUuids.includes(entry.uuid))),
        }))
        .filter((group) => group.spells.length > 0);

      const swapInByLevel = Array.from({ length: entitlements.maxSpellLevel }, (_, index) => index + 1)
        .map((level) => ({
          level,
          label: `Level ${level}`,
          spells: leveledSpells
            .filter((entry) => entry.spellLevel === level)
            .map((entry) => toSpellEntry(entry, selection.swappedInUuids.includes(entry.uuid))),
        }))
        .filter((group) => group.spells.length > 0);

      const selectedCantrips = cantrips.filter((entry) => selection.newCantripUuids.includes(entry.uuid));
      const selectedSpells = spellsByLevel.flatMap((group) => group.spells).filter((entry) => selection.newSpellUuids.includes(entry.uuid));
      const selectedSwapIn = swapInByLevel.flatMap((group) => group.spells).filter((entry) => selection.swappedInUuids.includes(entry.uuid));
      const selectedSwapOut = currentSpells.filter((entry) => selection.swappedOutUuids.includes(entry.uuid));

      const availablePreviewEntries: Array<IndexedSpellEntry | { uuid: string; name: string; img: string; schoolLabel: string; spellLevel: number }> = [
        ...selectedCantrips,
        ...selectedSpells,
        ...selectedSwapIn,
        ...cantrips,
        ...spellsByLevel.flatMap((group) => group.spells),
      ];
      const previewSpell = availablePreviewEntries.find((entry) => entry.uuid === browserState.previewUuid)
        ?? selectedSwapOut[0]
        ?? availablePreviewEntries[0]
        ?? null;
      if (previewSpell?.uuid) browserState.previewUuid = previewSpell.uuid;

      const previewDescription = previewSpell?.uuid
        ? await loadPreviewDescription(previewSpell.uuid)
        : "";
      const previewSpellLevel = previewSpell
        ? previewSpell.spellLevel
        : 0;

      return {
        className: context.className,
        targetLevel: state.targetLevel,
        classLevel: context.targetClassLevel,
        hasSpellChanges: limits.newCantrips > 0 || limits.newSpells > 0 || limits.swapLimit > 0,
        cantrips,
        spellsByLevel,
        swapInByLevel,
        currentSpells,
        cantripTarget: limits.newCantrips,
        spellTarget: limits.newSpells,
        swapTarget: limits.swapLimit,
        newCantripCount: selection.newCantripUuids.length,
        newSpellCount: selection.newSpellUuids.length,
        swapOutCount: selection.swappedOutUuids.length,
        swapInCount: selection.swappedInUuids.length,
        completedSwapCount: Math.min(selection.swappedOutUuids.length, selection.swappedInUuids.length),
        hasCantripChoices: limits.newCantrips > 0 || selectedCantrips.length > 0,
        hasSpellChoices: limits.newSpells > 0 || selectedSpells.length > 0,
        hasSwapChoices: limits.swapLimit > 0 && (currentSpells.length > 0 || selectedSwapIn.length > 0),
        hasCurrentSpells: currentSpells.length > 0,
        hasSearchControls: cantrips.length > 0 || leveledSpells.length > 0,
        maxSpellLevel: entitlements.maxSpellLevel,
        sourceContextLabel: entitlements.sourceContextLabel,
        spellListLabel: entitlements.listLabel,
        schoolFilters: Object.entries(SCHOOL_LABELS).map(([value, label]) => ({
          value,
          label,
          active: browserState.schoolFilter === value,
        })),
        searchText: browserState.searchText,
        schoolFilter: browserState.schoolFilter,
        selectionSummary: buildSelectionSummary(selection, limits),
        localProgressDetail: buildSelectionSummary(selection, limits),
        selectedCantrips,
        selectedSpells,
        selectedSwapOut,
        selectedSwapIn,
        hasSelectedCantrips: selectedCantrips.length > 0,
        hasSelectedSpells: selectedSpells.length > 0,
        hasSelectedSwapOut: selectedSwapOut.length > 0,
        hasSelectedSwapIn: selectedSwapIn.length > 0,
        previewSpell: previewSpell
          ? {
              name: previewSpell.name,
              img: previewSpell.img,
              schoolLabel: previewSpell.schoolLabel,
              spellLevel: previewSpellLevel,
              description: previewDescription,
            }
          : null,
      };
    },

    onActivate(state: LevelUpState, el: HTMLElement, callbacks): void {
      const { limits } = resolveCurrentLimits(state);
      const getCurrentData = () => normalizeChoice(state.selections.spells, limits);

      const persistChoice = (next: LevelUpSpellsChoice) => {
        callbacks.setData(normalizeChoice(next, limits));
      };

      getCards(el, "[data-cantrip-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = card.dataset.cantripUuid;
          if (!uuid) return;
          const current = getCurrentData();
          const next = new Set(current.newCantripUuids);
          if (next.has(uuid)) next.delete(uuid);
          else if (next.size < limits.newCantrips) next.add(uuid);
          persistChoice({ ...current, newCantripUuids: [...next] });
        });
      });

      getCards(el, "[data-spell-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = card.dataset.spellUuid;
          if (!uuid) return;
          const current = getCurrentData();
          const next = new Set(current.newSpellUuids);
          if (next.has(uuid)) next.delete(uuid);
          else if (next.size < limits.newSpells && !current.swappedInUuids.includes(uuid)) next.add(uuid);
          persistChoice({ ...current, newSpellUuids: [...next] });
        });
      });

      getCards(el, "[data-swap-out-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = card.dataset.swapOutUuid;
          if (!uuid) return;
          const current = getCurrentData();
          const next = new Set(current.swappedOutUuids);
          if (next.has(uuid)) next.delete(uuid);
          else if (next.size < limits.swapLimit) next.add(uuid);
          persistChoice({ ...current, swappedOutUuids: [...next] });
        });
      });

      getCards(el, "[data-swap-in-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = card.dataset.swapInUuid;
          if (!uuid) return;
          const current = getCurrentData();
          const next = new Set(current.swappedInUuids);
          const allowedSwapCount = Math.min(limits.swapLimit, current.swappedOutUuids.length);
          if (next.has(uuid)) next.delete(uuid);
          else if (next.size < allowedSwapCount && !current.newSpellUuids.includes(uuid)) next.add(uuid);
          persistChoice({ ...current, swappedInUuids: [...next] });
        });
      });

      const searchInput = getSearchInput(el);
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          browserState.searchText = searchInput.value;
          applyBrowserFilters(el);
        });
      }

      Array.from(el.querySelectorAll("[data-school-filter-button]")).forEach((button) => {
        button.addEventListener("click", () => {
          const target = button as HTMLElement;
          browserState.schoolFilter = target.dataset.schoolFilter ?? "";
          applyBrowserFilters(el);
        });
      });

      getCards(el, "[data-preview-uuid]").forEach((card) => {
        const activatePreview = () => {
          const uuid = card.dataset.previewUuid;
          const name = card.dataset.previewName ?? "Spell";
          const meta = card.dataset.previewMeta ?? "";
          const img = card.dataset.previewImg ?? "icons/svg/book.svg";
          if (!uuid) return;
          browserState.previewUuid = uuid;
          void loadPreviewDescription(uuid).then((description) => {
            updatePreviewDom(el, { name, meta, description, img });
          });
        };

        card.addEventListener("mouseenter", activatePreview);
        card.addEventListener("focus", activatePreview);
      });

      applyBrowserFilters(el);
    },
  };
}

export const __luStepSpellsInternals = {
  buildSelectionSummary,
  buildStatusHint,
  getActorItems,
  getClassContext,
  isChoiceComplete,
  normalizeChoice,
};
