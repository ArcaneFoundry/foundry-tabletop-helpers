/**
 * Character Creator — Step 8: Spells
 *
 * Cantrip + spell selection filtered by the chosen class's spell list.
 * Uses the dnd5e spell list API when available, with fallback to
 * showing all compendium spells.
 */

import { Log, MOD } from "../../logger";
import { fromUuid } from "../../types";
import type {
  WizardStepDefinition,
  WizardState,
  SpellSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { resolveClassSpellUuids } from "../data/spell-list-resolver";
import {
  buildPreparationNotice,
  getSpellPreparationPolicy,
  parsePreparationScaleIdentifier,
  resolveScaleValue,
  type SpellPreparationClassDocumentLike,
  type SpellScaleAdvancementLike,
} from "../spell-preparation-policy";

/* ── Constants ───────────────────────────────────────────── */

/** Spell school labels. */
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

interface DatasetElementLike extends Element {
  dataset: DOMStringMap;
}

interface SearchInputLike extends Element {
  value: string;
}

interface SpellNameRowLike extends DatasetElementLike {
  style: {
    display: string;
  };
}

interface SpellCardLike extends DatasetElementLike {
  classList: DOMTokenList;
  appendChild<TNode extends Node>(node: TNode): TNode;
  querySelector(selector: string): Element | null;
  setAttribute(qualifiedName: string, value: string): void;
}

interface DocumentLike {
  createElement(tagName: string): HTMLElement;
}

/* ── Helpers ─────────────────────────────────────────────── */

function getAllSpells(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("spell", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

/**
 * Max spell slot level available at a given character level,
 * based on spellcasting progression.
 */
function getMaxSpellLevel(characterLevel: number, progression: string): number {
  if (progression === "pact") {
    // Pact magic: level = ceil(casterLevel / 2), max 5
    return Math.min(5, Math.ceil(characterLevel / 2));
  }

  // Caster level depends on progression
  let casterLevel = characterLevel;
  if (progression === "half" || progression === "artificer") casterLevel = Math.ceil(characterLevel / 2);
  else if (progression === "third") casterLevel = Math.ceil(characterLevel / 3);

  if (casterLevel >= 17) return 9;
  if (casterLevel >= 15) return 8;
  if (casterLevel >= 13) return 7;
  if (casterLevel >= 11) return 6;
  if (casterLevel >= 9) return 5;
  if (casterLevel >= 7) return 4;
  if (casterLevel >= 5) return 3;
  if (casterLevel >= 3) return 2;
  return 1;
}

async function getSpellSelectionLimits(
  state: WizardState,
): Promise<{
  maxCantrips: number | null;
  maxSpells: number | null;
  classDoc: SpellPreparationClassDocumentLike | null;
}> {
  const classUuid = state.selections.class?.uuid;
  const classIdentifier = state.selections.class?.identifier ?? "";
  if (!classUuid) return { maxCantrips: null, maxSpells: null, classDoc: null };

  const classDoc = await fromUuid(classUuid) as SpellPreparationClassDocumentLike | null;
  if (!classDoc) return { maxCantrips: null, maxSpells: null, classDoc: null };

  const advancements = classDoc.system?.advancement ?? [];
  const maxCantrips = resolveScaleByTitle(advancements, "Cantrips Known", state.config.startingLevel);
  const knownSpellLimit = resolveKnownSpellLimit(classIdentifier, state.config.startingLevel);
  if (knownSpellLimit !== null) {
    return { maxCantrips, maxSpells: knownSpellLimit, classDoc };
  }

  const policy = getSpellPreparationPolicy(classIdentifier, classDoc, state.config.startingLevel);
  return { maxCantrips, maxSpells: policy.usesPreparedSpellPicker ? null : policy.preparedLimit, classDoc };
}

function resolveScaleByTitle(
  advancements: SpellScaleAdvancementLike[],
  title: string,
  level: number,
): number | null {
  const match = advancements.find((entry) => entry.type === "ScaleValue" && entry.title === title);
  return resolveScaleValue(match?.configuration?.scale, level);
}

function resolveKnownSpellLimit(classIdentifier: string, level: number): number | null {
  switch (classIdentifier) {
    case "wizard":
      // Wizards add two spells to their spellbook at every level after starting with six.
      return Math.max(6, 4 + (level * 2));
    default:
      return null;
  }
}

function isSelectionComplete(
  selectedCount: number,
  requiredCount: number | undefined,
): boolean {
  if (requiredCount === undefined) return selectedCount > 0;
  return selectedCount === requiredCount;
}

function getRequiredSpellSelectionCount(
  maxSpells: number | undefined,
  usesPreparedPicker: boolean,
  preparedLimit: number | null,
): number | undefined {
  if (maxSpells !== undefined) return maxSpells;
  if (usesPreparedPicker && preparedLimit !== null && preparedLimit > 0) return preparedLimit;
  return undefined;
}

function buildSelectionSummary(
  cantripCount: number,
  spellCount: number,
  maxCantrips: number | null,
  maxSpells: number | null,
): string {
  const cantripSummary = maxCantrips !== null
    ? `${cantripCount} / ${maxCantrips} cantrips`
    : `${cantripCount} cantrips`;
  const spellSummary = maxSpells !== null
    ? `${spellCount} / ${maxSpells} spells`
    : `${spellCount} spells`;
  return `${cantripSummary}, ${spellSummary}`;
}

function getPreparedSelectionTarget(
  _spellCount: number,
  preparedLimit: number | null,
  usesPreparedPicker: boolean,
): number | undefined {
  if (!usesPreparedPicker || preparedLimit === null || preparedLimit < 1) return undefined;
  return preparedLimit;
}

function sanitizePreparedSpellSelection(
  selectedSpellUuids: string[],
  preparedSpellUuids: string[] | undefined,
  preparedLimit: number | null,
): string[] {
  const selected = new Set(selectedSpellUuids);
  const prepared = (preparedSpellUuids ?? []).filter((uuid) => selected.has(uuid));
  if (preparedLimit === null || preparedLimit < 1) return [];
  return prepared.slice(0, preparedLimit);
}

function getDefaultPreparedSpellSelection(
  selectedSpellUuids: string[],
  preparedLimit: number | null,
): string[] {
  if (preparedLimit === null || preparedLimit < 1) return [];
  return selectedSpellUuids.slice(0, preparedLimit);
}

function buildStatusHint(
  data: SpellSelection | undefined,
  usesPreparedPicker = false,
  preparedLimit: number | null = null,
): string {
  const cantripCount = data?.cantrips.length ?? 0;
  const spellCount = data?.spells.length ?? 0;
  const maxCantrips = data?.maxCantrips;
  const maxSpells = data?.maxSpells;
  const parts: string[] = [];

  if (maxCantrips !== undefined && cantripCount !== maxCantrips) {
    const remaining = maxCantrips - cantripCount;
    parts.push(remaining > 0 ? `choose ${remaining} more cantrip${remaining === 1 ? "" : "s"}` : "reduce cantrips");
  } else if (maxCantrips === undefined && cantripCount === 0) {
    parts.push("select cantrips");
  }

  const requiredSpellCount = getRequiredSpellSelectionCount(maxSpells, usesPreparedPicker, preparedLimit);
  if (requiredSpellCount !== undefined && spellCount !== requiredSpellCount) {
    const remaining = requiredSpellCount - spellCount;
    parts.push(remaining > 0 ? `choose ${remaining} more spells` : "reduce spells");
  } else if (requiredSpellCount === undefined && spellCount === 0) {
    parts.push("select spells");
  }

  const preparedTarget = getPreparedSelectionTarget(spellCount, preparedLimit, usesPreparedPicker);
  const preparedCount = sanitizePreparedSpellSelection(data?.spells ?? [], data?.preparedSpells, preparedLimit).length;
  if (usesPreparedPicker && preparedTarget !== undefined && preparedCount !== preparedTarget) {
    const remaining = preparedTarget - preparedCount;
    parts.push(remaining > 0 ? `choose ${remaining} more prepared spells` : "reduce prepared spells");
  }

  return parts.length > 0 ? parts.join(" and ") : "";
}

/* ── Step Definition ─────────────────────────────────────── */

export function createSpellsStep(): WizardStepDefinition {
  /** Cached spell list UUIDs for the current class (avoids re-resolving). */
  let cachedClassId = "";
  let cachedSpellUuids: Set<string> | null = null;

  return {
    id: "spells",
    label: "Spells",
    icon: "fa-solid fa-wand-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-spells.hbs`,
    dependencies: ["class", "subclass"],

    isApplicable(state: WizardState): boolean {
      return state.selections.class?.isSpellcaster === true;
    },

    isComplete(state: WizardState): boolean {
      const cls = state.selections.class;
      if (!cls?.isSpellcaster) return true;
      const data = state.selections.spells;
      if (!data) return false;
      const usesPreparedPicker = (data.maxPreparedSpells ?? 0) > 0;
      const preparedLimit = usesPreparedPicker ? data.maxPreparedSpells ?? null : null;
      const requiredSpellCount = getRequiredSpellSelectionCount(data.maxSpells, usesPreparedPicker, preparedLimit);
      const preparedTarget = getPreparedSelectionTarget(data.spells.length, preparedLimit, usesPreparedPicker);
      const preparedCount = sanitizePreparedSpellSelection(data.spells, data.preparedSpells, preparedLimit).length;
      return isSelectionComplete(data.cantrips.length, data.maxCantrips)
        && isSelectionComplete(data.spells.length, requiredSpellCount)
        && (!preparedTarget || preparedCount === preparedTarget);
    },

    getStatusHint(state: WizardState): string {
      const cls = state.selections.class;
      if (!cls?.isSpellcaster) return "";
      const data = state.selections.spells;
      const usesPreparedPicker = (data?.maxPreparedSpells ?? 0) > 0;
      const preparedLimit = usesPreparedPicker ? data?.maxPreparedSpells ?? null : null;
      return buildStatusHint(data, usesPreparedPicker, preparedLimit);
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);

      const cls = state.selections.class;
      const className = cls?.name ?? "your class";
      const classIdentifier = cls?.identifier ?? "";
      const progression = cls?.spellcastingProgression ?? "full";
      const maxLevel = getMaxSpellLevel(state.config.startingLevel, progression);

      // Resolve class spell list (cached per class identifier)
      if (!classIdentifier) {
        cachedClassId = "";
        cachedSpellUuids = null;
      } else if (classIdentifier !== cachedClassId) {
        cachedClassId = classIdentifier;
        cachedSpellUuids = await resolveClassSpellUuids(classIdentifier);
        if (cachedSpellUuids) {
          Log.debug(`Spells step: resolved ${cachedSpellUuids.size} spells for "${classIdentifier}"`);
        } else {
          Log.debug(`Spells step: no spell list API found for "${classIdentifier}", showing all spells`);
        }
      }

      // Get and filter spells
      let allSpells = getAllSpells(state);
      const classSpellUuids = cachedSpellUuids;
      if (classSpellUuids) {
        allSpells = allSpells.filter((s) => classSpellUuids.has(s.uuid));
      }

      Log.debug(`Spells step: ${allSpells.length} total spells available for "${className}"`, {
        withSpellLevel: allSpells.filter((s) => s.spellLevel !== undefined).length,
        withoutSpellLevel: allSpells.filter((s) => s.spellLevel === undefined).length,
      });

      const data = state.selections.spells ?? { cantrips: [], spells: [] };
      const limits = await getSpellSelectionLimits(state);
      const selectedCantrips = new Set(data.cantrips);
      const selectedSpells = new Set(data.spells);
      const preparationPolicy = getSpellPreparationPolicy(
        classIdentifier,
        limits.classDoc,
        state.config.startingLevel,
      );
      const usesPreparedPicker = preparationPolicy.usesPreparedSpellPicker;
      const preparedSpellUuids = usesPreparedPicker
        ? sanitizePreparedSpellSelection(data.spells, data.preparedSpells, preparationPolicy.preparedLimit)
        : [];
      const preparedSpells = new Set(preparedSpellUuids);

      // Separate cantrips and leveled spells
      const cantrips = allSpells
        .filter((s) => s.spellLevel === 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          ...s,
          selected: selectedCantrips.has(s.uuid),
          schoolLabel: SCHOOL_LABELS[s.school ?? ""] ?? s.school ?? "",
        }));

      const leveledSpells = allSpells
        .filter((s) => (s.spellLevel ?? 0) > 0 && (s.spellLevel ?? 0) <= maxLevel)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          ...s,
          selected: selectedSpells.has(s.uuid),
          prepared: preparedSpells.has(s.uuid),
          schoolLabel: SCHOOL_LABELS[s.school ?? ""] ?? s.school ?? "",
        }));

      // Group leveled spells by level
      const spellsByLevel: Array<{ level: number; label: string; spells: typeof leveledSpells }> = [];
      for (let lvl = 1; lvl <= maxLevel; lvl++) {
        const spells = leveledSpells.filter((s) => s.spellLevel === lvl);
        if (spells.length > 0) {
          spellsByLevel.push({
            level: lvl,
            label: `Level ${lvl}`,
            spells,
          });
        }
      }

      const usingClassFilter = cachedSpellUuids !== null;

      return {
        cantrips,
        cantripCount: data.cantrips.length,
        maxCantrips: limits.maxCantrips,
        spellsByLevel,
        spellCount: data.spells.length,
        maxSpells: limits.maxSpells,
        hasCantrips: cantrips.length > 0,
        hasSpells: leveledSpells.length > 0,
        maxSpellLevel: maxLevel,
        className,
        usingClassFilter,
        selectionSummary: buildSelectionSummary(
          data.cantrips.length,
          data.spells.length,
          limits.maxCantrips,
          limits.maxSpells,
        ),
        preparationNotice: buildPreparationNotice(className, data.spells.length, preparationPolicy),
        hasPreparationNotice: preparationPolicy.usesPreparedSpells,
        showPreparedPicker: usesPreparedPicker,
        preparedCount: preparedSpellUuids.length,
        preparedLimit: preparationPolicy.preparedLimit,
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      const maxCantrips = readNumericDataValue(el, ".cc-spells-summary__value", "cantripLimit");
      const maxSpells = readNumericDataValue(el, ".cc-spells-summary__value", "spellLimit");
      const preparedLimit = readNumericDataValue(el, ".cc-spells-summary__value", "preparedLimit");
      const usesPreparedPicker = el.querySelector("[data-prepared-picker='true']") !== null;
      const currentSelection = state.selections.spells ?? { cantrips: [], spells: [] };
      const preparedSpells = usesPreparedPicker
        ? (currentSelection.preparedSpells?.length
          ? sanitizePreparedSpellSelection(currentSelection.spells, currentSelection.preparedSpells, preparedLimit)
          : getDefaultPreparedSpellSelection(currentSelection.spells, preparedLimit))
        : [];
      if (
        currentSelection.maxCantrips !== maxCantrips
        || currentSelection.maxSpells !== maxSpells
        || currentSelection.maxPreparedSpells !== preparedLimit
        || (usesPreparedPicker && JSON.stringify(currentSelection.preparedSpells ?? []) !== JSON.stringify(preparedSpells))
      ) {
        callbacks.setDataSilent({
          ...currentSelection,
          maxCantrips: maxCantrips ?? undefined,
          maxSpells: maxSpells ?? undefined,
          maxPreparedSpells: preparedLimit ?? undefined,
          preparedSpells: usesPreparedPicker ? preparedSpells : undefined,
        } satisfies SpellSelection);
      }

      // Cantrip selection
      getElementsWithDataset(el, "[data-cantrip-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = card.dataset.cantripUuid;
          if (!uuid) return;
          const current = state.selections.spells ?? { cantrips: [], spells: [] };
          const cantrips = new Set(current.cantrips);

          if (cantrips.has(uuid)) {
            cantrips.delete(uuid);
          } else if (current.maxCantrips !== undefined && cantrips.size >= current.maxCantrips) {
            return;
          } else {
            cantrips.add(uuid);
          }

          const newData: SpellSelection = {
            cantrips: [...cantrips],
            spells: current.spells,
            preparedSpells: current.preparedSpells,
            maxCantrips: current.maxCantrips,
            maxSpells: current.maxSpells,
            maxPreparedSpells: current.maxPreparedSpells,
          };
          patchSpellCard(card, cantrips.has(uuid));
          patchSpellCounter(el, "cantrip", cantrips.size);
          callbacks.setDataSilent(newData);
        });
      });

      // Spell selection
      getElementsWithDataset(el, "[data-spell-uuid]").forEach((card) => {
        card.addEventListener("click", () => {
          const uuid = card.dataset.spellUuid;
          if (!uuid) return;
          const current = state.selections.spells ?? { cantrips: [], spells: [] };
          const spells = new Set(current.spells);
          const nextPrepared = new Set(sanitizePreparedSpellSelection(current.spells, current.preparedSpells, preparedLimit));

          if (spells.has(uuid)) {
            spells.delete(uuid);
            nextPrepared.delete(uuid);
          } else if (current.maxSpells !== undefined && spells.size >= current.maxSpells) {
            return;
          } else {
            spells.add(uuid);
          }

          const newData: SpellSelection = {
            cantrips: current.cantrips,
            spells: [...spells],
            preparedSpells: usesPreparedPicker
              ? sanitizePreparedSpellSelection([...spells], [...nextPrepared], preparedLimit)
              : current.preparedSpells,
            maxCantrips: current.maxCantrips,
            maxSpells: current.maxSpells,
            maxPreparedSpells: current.maxPreparedSpells,
          };
          callbacks.setData(newData);
        });
      });

      getElementsWithDataset(el, "[data-prepared-uuid]").forEach((toggle) => {
        toggle.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const uuid = toggle.dataset.preparedUuid;
          if (!uuid) return;

          const current = state.selections.spells ?? { cantrips: [], spells: [] };
          if (!current.spells.includes(uuid)) return;

          const prepared = new Set(sanitizePreparedSpellSelection(current.spells, current.preparedSpells, preparedLimit));
          if (prepared.has(uuid)) {
            prepared.delete(uuid);
          } else if (preparedLimit !== null && prepared.size >= preparedLimit) {
            return;
          } else {
            prepared.add(uuid);
          }

          callbacks.setData({
            ...current,
            maxPreparedSpells: current.maxPreparedSpells,
            preparedSpells: [...prepared],
          } satisfies SpellSelection);
        });
      });

      // Search filter
      const searchInput = getSearchInput(el);
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          const query = searchInput.value.toLowerCase().trim();
          getSpellNameRows(el).forEach((row) => {
            const name = (row.dataset.spellName ?? "").toLowerCase();
            row.style.display = !query || name.includes(query) ? "" : "none";
          });
        });
      }
    },
  };
}

/* ── DOM Patching ────────────────────────────────────────── */

/** Toggle a spell card's selected state without re-rendering. */
function patchSpellCard(card: SpellCardLike, selected: boolean): void {
  card.classList.toggle("cc-spell-card--selected", selected);
  card.setAttribute("aria-selected", String(selected));
  // Toggle check icon
  let check = card.querySelector(".cc-spell-card__check");
  if (selected && !check) {
    const documentRef = getDocumentRef();
    if (!documentRef) return;
    check = documentRef.createElement("div");
    check.className = "cc-spell-card__check";
    const icon = documentRef.createElement("i");
    icon.className = "fa-solid fa-check";
    check.appendChild(icon);
    card.appendChild(check);
  } else if (!selected && check) {
    check.remove();
  }
}

/** Update a spell counter element. */
function patchSpellCounter(el: HTMLElement, type: "cantrip" | "spell", count: number): void {
  // Update section header count
  if (type === "cantrip") {
    const countEl = el.querySelector<HTMLElement>(".cc-spell-section__count");
    if (countEl) {
      const limit = parseDataNumber(countEl.dataset.cantripLimit);
      countEl.textContent = limit !== null ? `${count} / ${limit} selected` : `${count} selected`;
    }
  }
  // Update summary bar
  const summary = el.querySelector<HTMLElement>(".cc-spells-summary__value");
  if (summary) {
    const cantripCount = type === "cantrip" ? count : parseSummaryCount(summary.textContent, "cantrips");
    const spellCount = type === "spell" ? count : parseSummaryCount(summary.textContent, "spells");
    const cantripLimit = parseDataNumber(summary.dataset.cantripLimit);
    const spellLimit = parseDataNumber(summary.dataset.spellLimit);
    summary.textContent = buildSelectionSummary(cantripCount, spellCount, cantripLimit, spellLimit);
  }
}

function readNumericDataValue(
  root: ParentNode,
  selector: string,
  key: "cantripLimit" | "spellLimit" | "preparedLimit",
): number | null {
  const el = root.querySelector<HTMLElement>(selector);
  return el ? parseDataNumber(el.dataset[key]) : null;
}

function parseDataNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseSummaryCount(
  textContent: string | null | undefined,
  label: "cantrips" | "spells",
): number {
  const match = textContent?.match(new RegExp(`(\\d+)(?:\\s*\\/\\s*\\d+)?\\s+${label}`));
  const parsed = Number.parseInt(match?.[1] ?? "0", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getDocumentRef(): DocumentLike | null {
  const doc = Reflect.get(globalThis as object, "document");
  return isDocumentLike(doc) ? doc : null;
}

function getElementsWithDataset(root: ParentNode, selector: string): DatasetElementLike[] {
  return Array.from(root.querySelectorAll(selector)).filter(isDatasetElementLike);
}

function getSearchInput(root: ParentNode): SearchInputLike | null {
  const input = root.querySelector("[data-spell-search]");
  return isSearchInputLike(input) ? input : null;
}

function getSpellNameRows(root: ParentNode): SpellNameRowLike[] {
  return Array.from(root.querySelectorAll("[data-spell-name]")).filter(isSpellNameRowLike);
}

function isDatasetElementLike(value: unknown): value is DatasetElementLike {
  return value instanceof Element && "dataset" in value;
}

function isSearchInputLike(value: unknown): value is SearchInputLike {
  return value instanceof Element && "value" in value;
}

function isSpellNameRowLike(value: unknown): value is SpellNameRowLike {
  return value instanceof Element && "dataset" in value && "style" in value;
}

function isDocumentLike(value: unknown): value is DocumentLike {
  return typeof value === "object"
    && value !== null
    && "createElement" in value
    && typeof (value as { createElement?: unknown }).createElement === "function";
}

export const __spellsStepInternals = {
  getSpellSelectionLimits,
  getMaxSpellLevel,
  buildSelectionSummary,
  buildStatusHint,
  sanitizePreparedSpellSelection,
  getDefaultPreparedSpellSelection,
  patchSpellCard,
  patchSpellCounter,
  parsePreparationScaleIdentifier,
  resolveScaleValue,
};
