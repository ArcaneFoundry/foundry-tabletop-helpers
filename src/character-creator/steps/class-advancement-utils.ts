import type {
  ClassAdvancementRequirement,
  ClassAdvancementRequirementType,
  ClassAdvancementSelectionsState,
  WizardState,
} from "../character-creator-types";
import { LANGUAGE_LABELS, SKILLS, STANDARD_LANGUAGES } from "../data/dnd5e-constants";

type Dnd5eConfigLike = {
  DND5E?: {
    languages?: Record<string, { label?: string; selectable?: boolean; children?: Record<string, unknown> }>;
    tools?: Record<string, { id?: string }>;
  };
};

type LabeledOption = {
  id: string;
  label: string;
};

function getConfig(): Dnd5eConfigLike | undefined {
  return (globalThis as typeof globalThis & { CONFIG?: Dnd5eConfigLike }).CONFIG;
}

export function buildEmptyClassAdvancementSelections(): ClassAdvancementSelectionsState {
  return {
    expertiseSkills: [],
    chosenLanguages: [],
    chosenTools: [],
    itemChoices: {},
  };
}

export function getClassAdvancementRequirements(
  state: WizardState,
  type?: ClassAdvancementRequirementType,
): ClassAdvancementRequirement[] {
  const requirements = state.selections.class?.classAdvancementRequirements ?? [];
  return type ? requirements.filter((entry) => entry.type === type) : requirements;
}

export function getClassAdvancementRequiredCount(
  state: WizardState,
  type: ClassAdvancementRequirementType,
): number {
  return getClassAdvancementRequirements(state, type)
    .reduce((sum, entry) => sum + entry.requiredCount, 0);
}

export function getKnownSkillKeys(state: WizardState): string[] {
  return [
    ...(state.selections.background?.grants.skillProficiencies ?? []),
    ...(state.selections.species?.skillGrants ?? []),
    ...(state.selections.speciesChoices?.chosenSkills ?? []),
    ...(state.selections.skills?.chosen ?? []),
  ];
}

export function getKnownLanguageKeys(state: WizardState): string[] {
  return [
    ...(state.selections.background?.languages.fixed ?? []),
    ...(state.selections.background?.languages.chosen ?? []),
    ...(state.selections.species?.languageGrants ?? []),
    ...(state.selections.speciesChoices?.chosenLanguages ?? []),
  ];
}

export function getKnownToolKeys(state: WizardState): string[] {
  return [
    ...(state.selections.background?.grants.toolProficiency ? [state.selections.background.grants.toolProficiency] : []),
  ];
}

export function getExpertisePool(state: WizardState): LabeledOption[] {
  const chosen = new Set(state.selections.classAdvancements?.expertiseSkills ?? []);
  return [...new Set(getKnownSkillKeys(state))]
    .filter((key) => key in SKILLS)
    .map((key) => ({
      id: key,
      label: SKILLS[key]?.label ?? key,
    }))
    .filter((entry) => entry.label || chosen.has(entry.id))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function isSelectableLanguageId(value: string): boolean {
  return normalizeLanguageId(value) !== "common";
}

function flattenLanguageChildren(
  entries: Record<string, unknown>,
  prefix = "",
): LabeledOption[] {
  const flattened: LabeledOption[] = [];
  for (const [key, value] of Object.entries(entries)) {
    const id = prefix ? `${prefix}:${key}` : key;
    if (typeof value === "string") {
      flattened.push({ id, label: value });
      continue;
    }
    if (!value || typeof value !== "object") continue;
    const entry = value as { label?: string; selectable?: boolean; children?: Record<string, unknown> };
    const label = entry.label ?? key;
    if (entry.selectable !== false && (!entry.children || Object.keys(entry.children).length === 0)) {
      flattened.push({ id, label });
    }
    if (entry.children) {
      flattened.push(...flattenLanguageChildren(entry.children, id));
    }
  }
  return flattened;
}

export function getLanguagePool(state: WizardState): LabeledOption[] {
  const known = new Set(getKnownLanguageKeys(state));
  const configLanguages = getConfig()?.DND5E?.languages;
  const languageOptions = configLanguages
    ? flattenLanguageChildren(configLanguages)
        .filter((entry) => !entry.id.includes("cant") && !entry.id.includes("druidic"))
        .map((entry) => ({
          id: normalizeLanguageId(entry.id),
          label: entry.label,
        }))
    : [...STANDARD_LANGUAGES];

  return dedupeLabeledOptions(languageOptions)
    .filter((entry) => isSelectableLanguageId(entry.id))
    .filter((entry) => !known.has(entry.id))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getToolPool(state: WizardState): LabeledOption[] {
  const known = new Set(getKnownToolKeys(state));
  const configTools = getConfig()?.DND5E?.tools ?? {};
  const options = Object.keys(configTools)
    .map((key) => ({
      id: key,
      label: toolLabel(key),
    }))
    .filter((entry) => !known.has(entry.id));
  return dedupeLabeledOptions(options).sort((left, right) => left.label.localeCompare(right.label));
}

export function languageLabel(key: string): string {
  return LANGUAGE_LABELS[key] ?? titleCase(key.replace(/^languages:(?:standard|exotic):/u, ""));
}

export function toolLabel(key: string): string {
  const value = key.replace(/^tool:/u, "");
  const map: Record<string, string> = {
    alchemist: "Alchemist's Supplies",
    bagpipes: "Bagpipes",
    brewer: "Brewer's Supplies",
    calligrapher: "Calligrapher's Supplies",
    card: "Playing Cards",
    carpenter: "Carpenter's Tools",
    cartographer: "Cartographer's Tools",
    chess: "Dragonchess Set",
    cobbler: "Cobbler's Tools",
    cook: "Cook's Utensils",
    dice: "Dice Set",
    disg: "Disguise Kit",
    drum: "Drum",
    dulcimer: "Dulcimer",
    flute: "Flute",
    forg: "Forgery Kit",
    glassblower: "Glassblower's Tools",
    herb: "Herbalism Kit",
    horn: "Horn",
    jeweler: "Jeweler's Tools",
    leatherworker: "Leatherworker's Tools",
    lute: "Lute",
    lyre: "Lyre",
    mason: "Mason's Tools",
    navg: "Navigator's Tools",
    painter: "Painter's Supplies",
    panflute: "Pan Flute",
    pois: "Poisoner's Kit",
    potter: "Potter's Tools",
    shawm: "Shawm",
    smith: "Smith's Tools",
    thief: "Thieves' Tools",
    tinker: "Tinker's Tools",
    viol: "Viol",
    weaver: "Weaver's Tools",
    woodcarver: "Woodcarver's Tools",
    bandore: "Bandore",
    cittern: "Cittern",
    yarting: "Yarting",
  };
  return map[value] ?? titleCase(value);
}

export function normalizeLanguageId(value: string): string {
  const normalized = value.trim().toLowerCase();
  const parts = normalized.split(":");
  const last = parts.at(-1) ?? normalized;
  const map: Record<string, string> = {
    sign: "common-sign",
    cant: "thieves-cant",
    deep: "deep-speech",
  };
  return map[last] ?? last;
}

export function isClassAdvancementStepComplete(
  state: WizardState,
  type: ClassAdvancementRequirementType,
): boolean {
  const required = getClassAdvancementRequiredCount(state, type);
  const selections = state.selections.classAdvancements ?? buildEmptyClassAdvancementSelections();

  switch (type) {
    case "expertise":
      return selections.expertiseSkills.length >= required;
    case "languages":
      return selections.chosenLanguages.length >= required;
    case "tools":
      return selections.chosenTools.length >= required;
    case "itemChoices":
      return getClassAdvancementRequirements(state, "itemChoices").every((requirement) =>
        (selections.itemChoices[requirement.id]?.length ?? 0) >= requirement.requiredCount
      );
    default:
      return true;
  }
}

function dedupeLabeledOptions(entries: LabeledOption[]): LabeledOption[] {
  const map = new Map<string, LabeledOption>();
  for (const entry of entries) {
    map.set(entry.id, entry);
  }
  return [...map.values()];
}

function titleCase(value: string): string {
  return value
    .split(/[-:\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
