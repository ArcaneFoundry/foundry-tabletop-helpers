import { MOD } from "../../logger";
import type {
  StepCallbacks,
  WeaponMasterySelectionState,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { parseDocumentWeaponProficiencies } from "../data/advancement-parser";

interface DatasetElementLike {
  dataset: DOMStringMap;
  addEventListener(event: string, handler: () => void): void;
  closest(selector: string): Element | null;
}

interface ToggleInputLike extends DatasetElementLike {
  checked: boolean;
  disabled: boolean;
}

type WeaponDocumentLike = {
  system?: {
    description?: { value?: string };
    mastery?: string;
    weaponType?: string;
    type?: { value?: string };
    identifier?: string;
    rarity?: string;
    magicalBonus?: number;
    properties?: Iterable<string> | ArrayLike<string> | Record<string, boolean>;
  };
};

interface ChosenWeaponMasteryDetail {
  id: string;
  label: string;
  img?: string;
  mastery?: string;
  tooltip?: string;
}

const WEAPON_ITEM_PACK_FALLBACKS = [
  "dnd-players-handbook.equipment",
  "dnd5e.equipment24",
  "dnd5e.items",
] as const;

const MASTERY_DESCRIPTIONS: Record<string, string> = {
  cleave: "On a hit, you can make an attack roll against a second creature within 5 feet of the first and within your reach. On a hit, the second creature takes the weapon's damage, but you don't add your ability modifier unless it is negative.",
  graze: "On a miss, the target still takes damage equal to the ability modifier used for the attack, minimum 1. This damage uses the weapon's damage type.",
  nick: "When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can do this only once per turn.",
  push: "On a hit, you can push a Large or smaller creature up to 10 feet straight away from yourself.",
  sap: "On a hit, the target has Disadvantage on its next attack roll before the start of your next turn.",
  slow: "On a hit, the target's Speed is reduced by 10 feet until the start of your next turn. This can't reduce the target's Speed below 0.",
  topple: "On a hit, the target must make a Constitution save (DC 8 + your Proficiency Bonus + the ability modifier used for the attack) or fall Prone.",
  vex: "On a hit, you have Advantage on your next attack roll against that target before the end of your next turn.",
};

function getWeaponMasteryChoiceCount(state: WizardState): number {
  return state.selections.class?.weaponMasteryCount ?? 0;
}

function getWeaponMasteryPoolKeys(state: WizardState): string[] {
  return state.selections.class?.weaponMasteryPool ?? [];
}

function buildWeaponMasteryState(state: WizardState): WeaponMasterySelectionState {
  return {
    chosenWeaponMasteries: state.selections.weaponMasteries?.chosenWeaponMasteries ?? [],
    chosenWeaponMasteryDetails: state.selections.weaponMasteries?.chosenWeaponMasteryDetails ?? [],
    availableWeaponMasteries: state.selections.weaponMasteries?.availableWeaponMasteries ?? 0,
  };
}

function normalizeWeaponType(weaponType: string | undefined): string {
  switch (weaponType) {
    case "simpleM": return "Simple Melee";
    case "simpleR": return "Simple Ranged";
    case "martialM": return "Martial Melee";
    case "martialR": return "Martial Ranged";
    default: return weaponType ?? "Weapon";
  }
}

function weaponFamily(weaponType: string | undefined): "sim" | "mar" | "" {
  if (weaponType?.startsWith("simple")) return "sim";
  if (weaponType?.startsWith("martial")) return "mar";
  return "";
}

function matchesWeaponMasteryPool(
  identifier: string,
  weaponType: string | undefined,
  poolKeys: string[],
): boolean {
  for (const poolKey of poolKeys) {
    if (!poolKey.startsWith("weapon:")) continue;
    const [, family, scope] = poolKey.split(":");
    if (scope === "*") {
      if (family === "sim" && weaponType?.startsWith("simple")) return true;
      if (family === "mar" && weaponType?.startsWith("martial")) return true;
      continue;
    }
    if (poolKey.slice("weapon:".length) === identifier) return true;
  }
  return false;
}

function matchesWeaponProficiencyPool(
  identifier: string,
  weaponType: string | undefined,
  proficiencyKeys: string[],
): boolean {
  if (proficiencyKeys.length === 0) return true;
  const family = weaponFamily(weaponType);
  for (const key of proficiencyKeys) {
    if (!key.startsWith("weapon:")) continue;
    if (key === `weapon:${identifier}`) return true;
    if ((key === "weapon:sim:*" || key === "weapon:sim") && family === "sim") return true;
    if ((key === "weapon:mar:*" || key === "weapon:mar") && family === "mar") return true;
  }
  return false;
}

function normalizeSystemProperties(
  properties: NonNullable<WeaponDocumentLike["system"]>["properties"],
): Set<string> {
  if (!properties) return new Set();
  if (Array.isArray(properties)) {
    return new Set(properties.filter((value): value is string => typeof value === "string"));
  }
  if (typeof (properties as Iterable<string>)[Symbol.iterator] === "function") {
    return new Set(Array.from(properties as Iterable<string>).filter((value): value is string => typeof value === "string"));
  }
  if (typeof properties === "object") {
    return new Set(Object.entries(properties)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key));
  }
  return new Set();
}

function isBaselineWeaponOption(doc: WeaponDocumentLike | null): boolean {
  const system = doc?.system;
  if (!system) return false;

  const rarity = typeof system.rarity === "string" ? system.rarity.trim().toLowerCase() : "";
  if (rarity && rarity !== "mundane") return false;
  if (typeof system.magicalBonus === "number" && system.magicalBonus > 0) return false;

  const properties = normalizeSystemProperties(system.properties);
  if (properties.has("mgc")) return false;

  return true;
}

async function getCurrentWeaponProficiencyKeys(state: WizardState): Promise<string[]> {
  const proficiencies = new Set<string>([
    ...(state.selections.class?.weaponProficiencyKeys ?? []),
    ...(state.selections.background?.grants.weaponProficiencies ?? []),
    ...(state.selections.species?.weaponProficiencies ?? []),
  ]);

  const originFeatUuid = state.selections.originFeat?.uuid ?? state.selections.background?.grants.originFeatUuid;
  if (originFeatUuid) {
    const featDoc = await compendiumIndexer.fetchDocument(originFeatUuid);
    if (featDoc) {
      for (const proficiency of parseDocumentWeaponProficiencies(featDoc as never)) {
        proficiencies.add(proficiency);
      }
    }
  }

  return [...proficiencies];
}

async function getWeaponMasteryOptions(state: WizardState): Promise<Array<{
  id: string;
  uuid: string;
  identifier: string;
  name: string;
  img: string;
  weaponType: string;
  mastery: string;
  masteryDescription: string;
  weaponDescription: string;
  tooltip: string;
}>> {
  const requiredCount = getWeaponMasteryChoiceCount(state);
  if (requiredCount <= 0 || !state.selections.class?.hasWeaponMastery) return [];
  const poolKeys = getWeaponMasteryPoolKeys(state);
  if (poolKeys.length === 0) return [];
  const proficiencyKeys = await getCurrentWeaponProficiencyKeys(state);

  const sourceIds = [...new Set([
    ...(state.config.packSources.items ?? []),
    ...WEAPON_ITEM_PACK_FALLBACKS,
  ])];
  const entries = [];
  for (const packId of sourceIds) {
    const loaded = await compendiumIndexer.loadPack(packId, "item");
    entries.push(...loaded);
  }

  const weaponEntries = entries.filter((entry) => entry.itemType === "weapon");
  const options = await Promise.all(weaponEntries.map(async (entry) => {
    const doc = await compendiumIndexer.fetchDocument(entry.uuid) as WeaponDocumentLike | null;
    const system = doc?.system;
    if (!isBaselineWeaponOption(doc)) return null;
    const resolvedWeaponType = typeof system?.weaponType === "string" && system.weaponType
      ? system.weaponType
      : typeof system?.type?.value === "string" && system.type.value
        ? system.type.value
        : entry.weaponType;
    const rawMastery = typeof system?.mastery === "string" ? system.mastery.trim() : "";
    const identifier = typeof system?.identifier === "string" && system.identifier.trim().length > 0
      ? system.identifier.trim()
      : entry.identifier ?? "";
    if (!identifier || !rawMastery) return null;
    if (!matchesWeaponMasteryPool(identifier, resolvedWeaponType, poolKeys)) return null;
    if (!matchesWeaponProficiencyPool(identifier, resolvedWeaponType, proficiencyKeys)) return null;

    const weaponDescription = typeof system?.description?.value === "string"
      ? system.description.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "";
    const masteryKey = rawMastery.toLowerCase();
    const mastery = rawMastery.charAt(0).toUpperCase() + rawMastery.slice(1);
    const masteryDescription = MASTERY_DESCRIPTIONS[masteryKey] ?? "No mastery description available.";
    const tooltip = weaponDescription
      ? `${entry.name} • ${normalizeWeaponType(resolvedWeaponType)} • ${mastery} mastery. ${weaponDescription}`
      : `${entry.name} • ${normalizeWeaponType(resolvedWeaponType)} • ${mastery} mastery.`;

    return {
      id: identifier,
      uuid: entry.uuid,
      identifier,
      name: entry.name,
      img: entry.img,
      weaponType: normalizeWeaponType(resolvedWeaponType),
      mastery,
      masteryDescription,
      weaponDescription,
      tooltip,
    };
  }));

  return options
    .filter((option): option is NonNullable<typeof option> => !!option)
    .filter((option, index, arr) => arr.findIndex((candidate) => candidate.id === option.id) === index)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function patchToggleRows(
  el: HTMLElement,
  selector: string,
  chosen: Set<string>,
  maxPicks: number,
): void {
  const atMax = maxPicks > 0 && chosen.size >= maxPicks;
  getToggleInputs(el, selector).forEach((input) => {
    const key = input.dataset.choiceValue;
    if (!key) return;
    const isChosen = chosen.has(key);
    input.checked = isChosen;
    input.disabled = !isChosen && atMax;
    const row = input.closest(".cc-choice-option");
    if (row) row.classList.toggle("cc-choice-option--selected", isChosen);
  });
}

function patchSectionCount(el: HTMLElement, section: string, value: number): void {
  const countEl = el.querySelector<HTMLElement>(`[data-choice-count="${section}"]`);
  if (countEl) countEl.textContent = String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function patchSelectedChips(
  el: HTMLElement,
  section: string,
  entries: Array<{ label: string; img?: string; tooltip: string }>,
): void {
  const host = el.querySelector<HTMLElement>(`[data-selected-chips="${section}"]`);
  if (!host) return;
  host.innerHTML = entries.map((entry) => {
    const imgHtml = entry.img
      ? `<img class="cc-choice-chip__img" src="${entry.img}" alt="${escapeHtml(entry.label)}">`
      : "";
    return `<span class="cc-choice-chip cc-tooltip-anchor" tabindex="0" data-tooltip="${escapeHtml(entry.tooltip)}">${imgHtml}<span>${escapeHtml(entry.label)}</span></span>`;
  }).join("");
}

function collectChosenWeaponMasteryDetails(el: HTMLElement, chosen: Set<string>): ChosenWeaponMasteryDetail[] {
  return getToggleInputs(el, "[data-choice-section='weaponMasteries']")
    .filter((entry) => chosen.has(entry.dataset.choiceValue ?? ""))
    .map((entry) => ({
      id: entry.dataset.choiceValue ?? "",
      label: entry.dataset.choiceLabel ?? "",
      img: entry.dataset.choiceImg ?? "",
      mastery: entry.dataset.choiceMastery ?? "",
      tooltip: entry.dataset.choiceTooltip ?? entry.dataset.choiceLabel ?? "",
    }))
    .filter((entry) => entry.id.length > 0);
}

export function createWeaponMasteriesStep(): WizardStepDefinition {
  return {
    id: "weaponMasteries",
    label: "Weapon Masteries",
    icon: "fa-solid fa-swords",
    renderMode: "react",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-weapon-masteries.hbs`,
    dependencies: ["class", "originSummary"],
    isApplicable: (state) => !!state.selections.class?.uuid && (state.selections.class?.weaponMasteryCount ?? 0) > 0,

    isComplete(state: WizardState): boolean {
      const availableMasteries = state.selections.weaponMasteries?.availableWeaponMasteries ?? getWeaponMasteryChoiceCount(state);
      const requiredMasteries = Math.min(getWeaponMasteryChoiceCount(state), availableMasteries);
      const chosenMasteries = state.selections.weaponMasteries?.chosenWeaponMasteries?.length ?? 0;
      return chosenMasteries >= requiredMasteries;
    },

    getStatusHint(state: WizardState): string {
      const chosenMasteries = state.selections.weaponMasteries?.chosenWeaponMasteries?.length ?? 0;
      const availableMasteries = state.selections.weaponMasteries?.availableWeaponMasteries ?? getWeaponMasteryChoiceCount(state);
      const requiredMasteries = Math.min(getWeaponMasteryChoiceCount(state), availableMasteries);
      if (chosenMasteries < requiredMasteries) {
        const remaining = requiredMasteries - chosenMasteries;
        return `Choose ${remaining} more weapon master${remaining === 1 ? "y" : "ies"}`;
      }
      return "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const options = await getWeaponMasteryOptions(state);
      const chosenWeaponMasteries = new Set(state.selections.weaponMasteries?.chosenWeaponMasteries ?? []);
      const requiredWeaponMasteries = Math.min(getWeaponMasteryChoiceCount(state), options.length);
      const chosenWeaponMasteryDetails = state.selections.weaponMasteries?.chosenWeaponMasteryDetails ?? [];

      return {
        stepId: "weaponMasteries",
        stepTitle: "Weapon Masteries",
        stepLabel: "Choose Your Weapon Masteries",
        stepIcon: "fa-solid fa-swords",
        stepDescription: "Choose the weapon types your character has mastered.",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--weapon-masteries",
        classIdentifier: state.selections.class?.identifier ?? "",
        className: state.selections.class?.name ?? "Class",
        weaponMasterySection: {
          hasChoices: requiredWeaponMasteries > 0,
          chosenCount: chosenWeaponMasteries.size,
          maxCount: requiredWeaponMasteries,
          selectedEntries: chosenWeaponMasteryDetails.length > 0
            ? chosenWeaponMasteryDetails.map((entry) => ({
                label: entry.label,
                img: entry.img,
                mastery: entry.mastery ?? "",
                tooltip: entry.tooltip ?? entry.label,
              }))
            : options
              .filter((entry) => chosenWeaponMasteries.has(entry.id))
              .map((entry) => ({
                label: entry.name,
                img: entry.img,
                mastery: entry.mastery,
                tooltip: entry.tooltip,
              })),
          options: options.map((entry) => ({
            ...entry,
            checked: chosenWeaponMasteries.has(entry.id),
            disabled: !chosenWeaponMasteries.has(entry.id) && chosenWeaponMasteries.size >= requiredWeaponMasteries,
          })),
          emptyMessage: "This class grants weapon mastery, but no mastery-eligible proficient weapons were exposed by the current class, origin, species, and item data.",
        },
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      getToggleInputs(el, "[data-choice-section='weaponMasteries']").forEach((input) => {
        input.addEventListener("change", () => {
          const masteryId = input.dataset.choiceValue;
          if (!masteryId) return;

          const chosen = new Set(state.selections.weaponMasteries?.chosenWeaponMasteries ?? []);
          const limit = Math.min(getWeaponMasteryChoiceCount(state), getToggleInputs(el, "[data-choice-section='weaponMasteries']").length);
          if (input.checked) {
            if (chosen.size >= limit) {
              input.checked = false;
              return;
            }
            chosen.add(masteryId);
          } else {
            chosen.delete(masteryId);
          }

          const chosenWeaponMasteries = [...chosen];
          const chosenWeaponMasteryDetails = collectChosenWeaponMasteryDetails(el, chosen);
          state.selections.weaponMasteries = {
            chosenWeaponMasteries,
            chosenWeaponMasteryDetails,
            availableWeaponMasteries: getToggleInputs(el, "[data-choice-section='weaponMasteries']").length,
          };

          patchToggleRows(el, "[data-choice-section='weaponMasteries']", chosen, limit);
          patchSectionCount(el, "weaponMasteries", chosen.size);
          patchSelectedChips(
            el,
            "weaponMasteries",
            chosenWeaponMasteryDetails.map((entry) => ({
              label: entry.mastery ? `${entry.label} (${entry.mastery})` : entry.label,
              img: entry.img ?? "",
              tooltip: entry.tooltip ?? entry.label,
            })),
          );
          callbacks.setDataSilent(buildWeaponMasteryState(state));
        });
      });

      state.selections.weaponMasteries = {
        ...buildWeaponMasteryState(state),
        chosenWeaponMasteryDetails: collectChosenWeaponMasteryDetails(
          el,
          new Set(state.selections.weaponMasteries?.chosenWeaponMasteries ?? []),
        ),
        availableWeaponMasteries: getToggleInputs(el, "[data-choice-section='weaponMasteries']").length,
      };
      callbacks.setDataSilent(buildWeaponMasteryState(state));
    },
  };
}

function getToggleInputs(root: ParentNode, selector: string): ToggleInputLike[] {
  return Array.from(root.querySelectorAll(selector))
    .filter((value) =>
      typeof value === "object" && value !== null && "dataset" in value && "checked" in value && "disabled" in value
    )
    .map((value) => value as unknown as ToggleInputLike);
}
