import { MOD } from "../../logger";
import type {
  ClassChoicesState,
  StepCallbacks,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { ABILITY_ABBREVS, SKILLS } from "../data/dnd5e-constants";

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

const SKILL_META: Record<string, { icon: string; description: string }> = {
  acr: { icon: "fa-person-running", description: "Balance, tumble, dive, and keep your footing when the battlefield turns treacherous." },
  ani: { icon: "fa-paw", description: "Read and calm beasts, mount up, or guide animals through danger." },
  arc: { icon: "fa-stars", description: "Recall magical lore, arcane traditions, and the hidden logic of spells." },
  ath: { icon: "fa-dumbbell", description: "Climb, jump, grapple, swim, and force your way through physical challenges." },
  dec: { icon: "fa-masks-theater", description: "Bluff, mislead, and sell the lie when words are your sharpest weapon." },
  his: { icon: "fa-landmark", description: "Recall legends, lineages, wars, and the long memory of the world." },
  ins: { icon: "fa-eye", description: "Read motives, catch falsehoods, and sense what others are trying to hide." },
  itm: { icon: "fa-bolt", description: "Project menace, force the issue, and make your presence impossible to ignore." },
  inv: { icon: "fa-magnifying-glass", description: "Piece together clues, examine details, and uncover what others missed." },
  med: { icon: "fa-staff-snake", description: "Diagnose wounds, stabilize the fallen, and understand the body under strain." },
  nat: { icon: "fa-leaf", description: "Recall the laws of the wild: terrain, plants, beasts, and natural phenomena." },
  prc: { icon: "fa-binoculars", description: "Spot danger, hear the hidden approach, and notice what the room is trying to conceal." },
  prf: { icon: "fa-music", description: "Command attention through song, dance, drama, and force of stage presence." },
  per: { icon: "fa-comments", description: "Charm, negotiate, inspire, and move others with conviction." },
  rel: { icon: "fa-book-bible", description: "Recall rites, deities, sacred histories, and the doctrines of faith." },
  slt: { icon: "fa-hand-sparkles", description: "Palm objects, slip tools into place, and work delicate tricks without notice." },
  ste: { icon: "fa-user-ninja", description: "Move in silence, melt into shadow, and strike without warning." },
  sur: { icon: "fa-compass", description: "Track, forage, navigate, and keep the party alive beyond the last road." },
};

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function getChosenSkills(state: WizardState): string[] {
  return state.selections.skills?.chosen ?? [];
}

function getAvailableSkillKeys(state: WizardState): string[] {
  return state.selections.class?.skillPool ?? [];
}

function getRequiredSkillCount(state: WizardState): number {
  return Math.min(state.selections.class?.skillCount ?? 0, getAvailableSkillKeys(state).length);
}

function getWeaponMasteryChoiceCount(state: WizardState): number {
  return state.selections.class?.weaponMasteryCount ?? 0;
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

function getWeaponMasteryPoolKeys(state: WizardState): string[] {
  return state.selections.class?.weaponMasteryPool ?? [];
}

function buildClassChoicesState(state: WizardState): ClassChoicesState {
  return {
    chosenSkills: getChosenSkills(state),
    chosenWeaponMasteries: state.selections.classChoices?.chosenWeaponMasteries ?? [],
    chosenWeaponMasteryDetails: state.selections.classChoices?.chosenWeaponMasteryDetails ?? [],
    availableWeaponMasteries: state.selections.classChoices?.availableWeaponMasteries ?? 0,
  };
}

async function getWeaponMasteryOptions(state: WizardState): Promise<Array<{
  id: string;
  uuid: string;
  identifier: string;
  name: string;
  img: string;
  weaponType: string;
  mastery: string;
  tooltip: string;
}>> {
  const requiredCount = getWeaponMasteryChoiceCount(state);
  if (requiredCount <= 0 || !state.selections.class?.hasWeaponMastery) return [];
  const poolKeys = getWeaponMasteryPoolKeys(state);
  if (poolKeys.length === 0) return [];

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
    const resolvedWeaponType = typeof system?.weaponType === "string" && system.weaponType
      ? system.weaponType
      : typeof system?.type?.value === "string" && system.type.value
        ? system.type.value
        : entry.weaponType;
    const rawMastery = typeof system?.mastery === "string" ? system.mastery.trim() : "";
    const identifier = typeof system?.identifier === "string" && system.identifier.trim().length > 0
      ? system.identifier.trim()
      : entry.identifier ?? "";
    if (!identifier) return null;
    if (!rawMastery) return null;
    if (!matchesWeaponMasteryPool(identifier, resolvedWeaponType, poolKeys)) return null;
    const rawDescription = typeof system?.description?.value === "string" ? system.description.value : "";
    const plainDescription = rawDescription
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      id: identifier,
      uuid: entry.uuid,
      identifier,
      name: entry.name,
      img: entry.img,
      weaponType: normalizeWeaponType(resolvedWeaponType),
      mastery: rawMastery.charAt(0).toUpperCase() + rawMastery.slice(1),
      tooltip: plainDescription
        ? `${entry.name} • ${normalizeWeaponType(resolvedWeaponType)} • ${rawMastery.charAt(0).toUpperCase() + rawMastery.slice(1)} mastery. ${plainDescription}`
        : `${entry.name} • ${normalizeWeaponType(resolvedWeaponType)} • ${rawMastery.charAt(0).toUpperCase() + rawMastery.slice(1)} mastery.`,
    };
  }));

  return options
    .filter((option): option is NonNullable<typeof option> => !!option)
    .filter((option, index, arr) => arr.findIndex((candidate) => candidate.id === option.id) === index)
    .sort((left, right) => left.name.localeCompare(right.name));
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
    const normalized = poolKey.slice("weapon:".length);
    if (normalized === identifier) return true;
  }
  return false;
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

function patchSelectedChips(
  el: HTMLElement,
  section: string,
  entries: Array<{ label: string; iconClass?: string; img?: string; tooltip: string }>,
): void {
  const host = el.querySelector<HTMLElement>(`[data-selected-chips="${section}"]`);
  if (!host) return;
  host.innerHTML = entries.map((entry) => {
    const iconHtml = entry.img
      ? `<img class="cc-choice-chip__img" src="${entry.img}" alt="${entry.label}">`
      : entry.iconClass
        ? `<i class="fa-solid ${entry.iconClass}"></i>`
        : "";
    return `<span class="cc-choice-chip cc-tooltip-anchor" tabindex="0" data-tooltip="${escapeHtml(entry.tooltip)}">${iconHtml}<span>${escapeHtml(entry.label)}</span></span>`;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createClassChoicesStep(): WizardStepDefinition {
  return {
    id: "classChoices",
    label: "Class Choices",
    icon: "fa-solid fa-list-check",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-choices.hbs`,
    dependencies: ["class"],
    isApplicable: (state) => !!state.selections.class?.uuid,

    isComplete(state: WizardState): boolean {
      if (!state.selections.class?.uuid) return false;
      const skillsComplete = getChosenSkills(state).length >= getRequiredSkillCount(state);
      const availableMasteries = state.selections.classChoices?.availableWeaponMasteries ?? getWeaponMasteryChoiceCount(state);
      const requiredMasteries = Math.min(getWeaponMasteryChoiceCount(state), availableMasteries);
      const chosenMasteries = state.selections.classChoices?.chosenWeaponMasteries?.length ?? 0;
      return skillsComplete && chosenMasteries >= requiredMasteries;
    },

    getStatusHint(state: WizardState): string {
      const chosenSkills = getChosenSkills(state).length;
      const requiredSkills = getRequiredSkillCount(state);
      if (chosenSkills < requiredSkills) {
        const remaining = requiredSkills - chosenSkills;
        return `Choose ${remaining} more class skill${remaining === 1 ? "" : "s"}`;
      }

      const chosenMasteries = state.selections.classChoices?.chosenWeaponMasteries?.length ?? 0;
      const availableMasteries = state.selections.classChoices?.availableWeaponMasteries ?? getWeaponMasteryChoiceCount(state);
      const requiredMasteries = Math.min(getWeaponMasteryChoiceCount(state), availableMasteries);
      if (chosenMasteries < requiredMasteries) {
        const remaining = requiredMasteries - chosenMasteries;
        return `Choose ${remaining} more weapon master${remaining === 1 ? "y" : "ies"}`;
      }

      return "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const classSelection = state.selections.class;
      const chosenSkills = new Set(getChosenSkills(state));
      const requiredSkillCount = getRequiredSkillCount(state);
      const skillPool = getAvailableSkillKeys(state).map((key) => ({
        key,
        label: skillLabel(key),
        abilityAbbrev: ABILITY_ABBREVS[SKILLS[key]?.ability ?? "int"],
        checked: chosenSkills.has(key),
        disabled: !chosenSkills.has(key) && chosenSkills.size >= requiredSkillCount,
        iconClass: SKILL_META[key]?.icon ?? "fa-book",
        tooltip: `${skillLabel(key)} (${ABILITY_ABBREVS[SKILLS[key]?.ability ?? "int"]}) — ${SKILL_META[key]?.description ?? "Class skill option."}`,
      }));

      const weaponMasteryOptions = await getWeaponMasteryOptions(state);
      const chosenWeaponMasteries = new Set(state.selections.classChoices?.chosenWeaponMasteries ?? []);
      const requiredWeaponMasteries = Math.min(getWeaponMasteryChoiceCount(state), weaponMasteryOptions.length);
      const chosenWeaponMasteryDetails = state.selections.classChoices?.chosenWeaponMasteryDetails ?? [];

      return {
        className: classSelection?.name ?? "Class",
        primaryAbilityHint: classSelection?.primaryAbilityHint ?? "",
        skillSection: {
          hasChoices: requiredSkillCount > 0,
          chosenCount: chosenSkills.size,
          maxCount: requiredSkillCount,
          selectedEntries: skillPool
            .filter((entry) => entry.checked)
            .map((entry) => ({ label: entry.label, iconClass: entry.iconClass, tooltip: entry.tooltip })),
          options: skillPool,
          emptyMessage: "This class does not expose additional class skill choices.",
        },
        weaponMasterySection: {
          hasChoices: requiredWeaponMasteries > 0,
          chosenCount: chosenWeaponMasteries.size,
          maxCount: requiredWeaponMasteries,
          selectedEntries: chosenWeaponMasteryDetails.length > 0
            ? chosenWeaponMasteryDetails.map((entry) => ({
                label: entry.mastery ? `${entry.label} (${entry.mastery})` : entry.label,
                img: entry.img,
                tooltip: entry.tooltip ?? entry.label,
              }))
            : weaponMasteryOptions
              .filter((entry) => chosenWeaponMasteries.has(entry.id))
              .map((entry) => ({
                label: `${entry.name} (${entry.mastery})`,
                img: entry.img,
                tooltip: entry.tooltip,
              })),
          options: weaponMasteryOptions.map((entry) => ({
            ...entry,
            checked: chosenWeaponMasteries.has(entry.id),
            disabled: !chosenWeaponMasteries.has(entry.id) && chosenWeaponMasteries.size >= requiredWeaponMasteries,
          })),
          emptyMessage: classSelection?.hasWeaponMastery
            ? "This class grants weapon mastery, but no matching mastery-bearing weapons were exposed by the current item packs."
            : "This class does not grant weapon mastery selections.",
        },
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      getToggleInputs(el, "[data-choice-section='skills']").forEach((input) => {
        input.addEventListener("change", () => {
          const key = input.dataset.choiceValue;
          if (!key) return;

          const chosen = new Set(getChosenSkills(state));
          const limit = getRequiredSkillCount(state);
          if (input.checked) {
            if (chosen.size >= limit) {
              input.checked = false;
              return;
            }
            chosen.add(key);
          } else {
            chosen.delete(key);
          }

          const chosenSkills = [...chosen];
          state.selections.skills = { chosen: chosenSkills };
          state.selections.classChoices = {
            ...buildClassChoicesState(state),
            chosenSkills,
            availableWeaponMasteries: getToggleInputs(el, "[data-choice-section='weaponMasteries']").length,
          };

          patchToggleRows(el, "[data-choice-section='skills']", chosen, limit);
          patchSectionCount(el, "skills", chosen.size);
          patchSelectedChips(
            el,
            "skills",
            chosenSkills.map((skill) => ({
              label: skillLabel(skill),
              iconClass: SKILL_META[skill]?.icon ?? "fa-book",
              tooltip: `${skillLabel(skill)} (${ABILITY_ABBREVS[SKILLS[skill]?.ability ?? "int"]}) — ${SKILL_META[skill]?.description ?? "Class skill option."}`,
            })),
          );
          callbacks.setDataSilent(buildClassChoicesState(state));
        });
      });

      getToggleInputs(el, "[data-choice-section='weaponMasteries']").forEach((input) => {
        input.addEventListener("change", () => {
          const masteryId = input.dataset.choiceValue;
          if (!masteryId) return;

          const chosen = new Set(state.selections.classChoices?.chosenWeaponMasteries ?? []);
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
          state.selections.classChoices = {
            ...buildClassChoicesState(state),
            chosenSkills: getChosenSkills(state),
            chosenWeaponMasteries,
            chosenWeaponMasteryDetails,
            availableWeaponMasteries: getToggleInputs(el, "[data-choice-section='weaponMasteries']").length,
          };

          patchToggleRows(el, "[data-choice-section='weaponMasteries']", chosen, limit);
          patchSectionCount(el, "weaponMasteries", chosen.size);
          const selectedEntries = chosenWeaponMasteryDetails.map((entry) => ({
            label: entry.mastery ? `${entry.label} (${entry.mastery})` : entry.label,
            img: entry.img ?? "",
            tooltip: entry.tooltip ?? entry.label,
          }));
          patchSelectedChips(el, "weaponMasteries", selectedEntries);
          callbacks.setDataSilent(buildClassChoicesState(state));
        });
      });

      state.selections.classChoices = {
        ...buildClassChoicesState(state),
        chosenSkills: getChosenSkills(state),
        chosenWeaponMasteryDetails: collectChosenWeaponMasteryDetails(
          el,
          new Set(state.selections.classChoices?.chosenWeaponMasteries ?? []),
        ),
        availableWeaponMasteries: getToggleInputs(el, "[data-choice-section='weaponMasteries']").length,
      };
      callbacks.setDataSilent(buildClassChoicesState(state));
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
