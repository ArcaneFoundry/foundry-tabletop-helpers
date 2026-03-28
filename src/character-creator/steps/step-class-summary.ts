import { MOD } from "../../logger";
import type {
  AbilityKey,
  ClassAdvancementRequirement,
  ClassAdvancementRequirementType,
  ClassSelection,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { SKILLS } from "../data/dnd5e-constants";
import { ClassSummaryStepScreen } from "../react/steps/class/class-summary-step-screen";
import { formatInjectedDescriptionHtml } from "../utils/description-formatting";
import {
  buildEmptyClassAdvancementSelections,
  getClassAdvancementRequiredCount,
  languageLabel,
  toolLabel,
} from "./class-advancement-utils";
import { getClassRecommendation } from "./step-class-model";
import { getRawDescription, getSubtitleFromDescription } from "./step-class-model";

type AdvancementLike = {
  type?: string;
  title?: string;
  level?: number;
  classRestriction?: string;
  configuration?: {
    grants?: unknown;
    items?: unknown;
  };
};

type ClassDocumentLike = {
  name?: string;
  system?: {
    advancement?: unknown;
  };
};

function saveLabel(key: AbilityKey): string {
  return key.toUpperCase();
}

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function formatAbilityBadgeText(abilities: AbilityKey[]): string {
  return abilities.map((ability) => ability.toUpperCase()).join(abilities.length > 1 ? " / " : "");
}

function formatWeaponMasteryLabel(
  entry: { label?: string; mastery?: string } | string,
): string {
  if (typeof entry !== "string") {
    return entry.mastery ? `${entry.label ?? "Weapon"} (${entry.mastery})` : (entry.label ?? "Weapon");
  }

  return entry
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (value instanceof Set) return [...value].filter((entry): entry is string => typeof entry === "string");
  return [];
}

function getAdvancementEntries(doc: ClassDocumentLike | null): AdvancementLike[] {
  const advancement = doc?.system?.advancement;
  return Array.isArray(advancement) ? advancement as AdvancementLike[] : [];
}

function titleCase(value: string): string {
  return value
    .split(/[\s:-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatArmorGrantLabel(grant: string): string {
  const value = grant.slice("armor:".length).replace(/\*$/u, "");
  const key = value.split(":").at(-1) ?? value;
  const labelMap: Record<string, string> = {
    lgt: "Light",
    med: "Medium",
    hvy: "Heavy",
    shl: "Shields",
  };
  return labelMap[key] ?? titleCase(key);
}

function formatWeaponGrantLabel(grant: string): string {
  const value = grant.slice("weapon:".length).replace(/\*$/u, "");
  const parts = value.split(":").filter(Boolean);
  const last = parts.at(-1) ?? value;
  const labelMap: Record<string, string> = {
    sim: "Simple",
    mar: "Martial",
  };
  return labelMap[last] ?? titleCase(last);
}

function formatToolGrantLabel(grant: string): string {
  const value = grant.slice("tool:".length);
  const key = value.split(":").at(-1) ?? value;
  const labelMap: Record<string, string> = {
    alchemist: "Alchemist's Supplies",
    brewer: "Brewer's Supplies",
    calligrapher: "Calligrapher's Supplies",
    carpenter: "Carpenter's Tools",
    cartographer: "Cartographer's Tools",
    cobbler: "Cobbler's Tools",
    cook: "Cook's Utensils",
    disguise: "Disguise Kit",
    forgery: "Forgery Kit",
    glassblower: "Glassblower's Tools",
    herbalism: "Herbalism Kit",
    jeweler: "Jeweler's Tools",
    leatherworker: "Leatherworker's Tools",
    mason: "Mason's Tools",
    navigator: "Navigator's Tools",
    painter: "Painter's Supplies",
    poisoner: "Poisoner's Kit",
    potter: "Potter's Tools",
    smith: "Smith's Tools",
    thief: "Thieves' Tools",
    tinker: "Tinker's Tools",
    vehicle: "Vehicles",
    weaver: "Weaver's Tools",
    woodcarver: "Woodcarver's Tools",
  };
  return labelMap[key] ?? titleCase(key);
}

function dedupeEntries(entries: string[]): string[] {
  const normalized = new Map<string, string>();
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const canonical = trimmed.toLowerCase() === "shield" ? "Shields" : trimmed;
    normalized.set(canonical.toLowerCase(), canonical);
  }
  return [...normalized.values()];
}

function getLevelAwareFeatureHeading(level: number): string {
  const labels: Record<number, string> = {
    1: "First-Level Features",
    2: "Second-Level Features",
    3: "Third-Level Features",
    4: "Fourth-Level Features",
    5: "Fifth-Level Features",
  };

  return labels[level] ?? `Level ${level} Features`;
}

function isClassSkillsComplete(state: WizardState): boolean {
  const requiredClassSkills = Math.min(state.selections.class?.skillCount ?? 0, state.selections.class?.skillPool?.length ?? 0);
  return (state.selections.skills?.chosen.length ?? 0) >= requiredClassSkills;
}

function isWeaponMasteriesComplete(state: WizardState): boolean {
  const availableWeaponMasteries = state.selections.weaponMasteries?.availableWeaponMasteries ?? (state.selections.class?.weaponMasteryCount ?? 0);
  const requiredWeaponMasteries = Math.min(state.selections.class?.weaponMasteryCount ?? 0, availableWeaponMasteries);
  return (state.selections.weaponMasteries?.chosenWeaponMasteries?.length ?? 0) >= requiredWeaponMasteries;
}

function areClassAdvancementSelectionsComplete(state: WizardState): boolean {
  const selections = state.selections.classAdvancements ?? buildEmptyClassAdvancementSelections();
  const expertiseRequired = getClassAdvancementRequiredCount(state, "expertise");
  const languagesRequired = getClassAdvancementRequiredCount(state, "languages");
  const toolsRequired = getClassAdvancementRequiredCount(state, "tools");
  const itemChoiceRequirements = state.selections.class?.classAdvancementRequirements?.filter((entry) => entry.type === "itemChoices") ?? [];

  return selections.expertiseSkills.length >= expertiseRequired
    && selections.chosenLanguages.length >= languagesRequired
    && selections.chosenTools.length >= toolsRequired
    && itemChoiceRequirements.every((requirement) => (selections.itemChoices[requirement.id]?.length ?? 0) >= requirement.requiredCount);
}

function areClassFlowSelectionsComplete(state: WizardState): boolean {
  return isClassSkillsComplete(state)
    && areClassAdvancementSelectionsComplete(state)
    && isWeaponMasteriesComplete(state);
}

function getTraitGrantLabels(
  doc: ClassDocumentLike | null,
  options: {
    titleMatches: string[];
    prefix: string;
    formatter: (grant: string) => string;
  },
): string[] {
  const allowedTitles = new Set(options.titleMatches.map((title) => title.trim().toLowerCase()));
  const labels = getAdvancementEntries(doc)
    .filter((entry) => {
      if (entry.type !== "Trait") return false;
      if ((entry.classRestriction ?? "").toLowerCase() === "secondary") return false;
      const title = (entry.title ?? "").trim().toLowerCase();
      return allowedTitles.has(title);
    })
    .flatMap((entry) => toStringList(entry.configuration?.grants))
    .filter((grant) => grant.startsWith(options.prefix))
    .map(options.formatter);

  return dedupeEntries(labels);
}

type SelectedGrantGroupViewModel = {
  id: string;
  title: string;
  iconClass: string;
  entries: string[];
};

function getSelectedGrantGroupTitle(
  requirement: ClassAdvancementRequirement,
): string {
  return requirement.title?.trim() || "Class Choice";
}

function getSelectedGrantGroupIconClass(type: ClassAdvancementRequirementType): string {
  switch (type) {
    case "expertise":
      return "fa-solid fa-bullseye";
    case "languages":
      return "fa-solid fa-comments";
    case "tools":
      return "fa-solid fa-hammer";
    case "itemChoices":
      return "fa-solid fa-stars";
    default:
      return "fa-solid fa-sparkles";
  }
}

function buildSelectedGrantGroups(
  classSelection: ClassSelection | undefined,
  state: WizardState,
): SelectedGrantGroupViewModel[] {
  const requirements = classSelection?.classAdvancementRequirements ?? [];
  const classAdvancementSelections = state.selections.classAdvancements ?? buildEmptyClassAdvancementSelections();
  let expertiseIndex = 0;
  let languageIndex = 0;
  let toolIndex = 0;

  return requirements.flatMap((requirement) => {
    let entries: string[] = [];

    switch (requirement.type) {
      case "expertise":
        entries = classAdvancementSelections.expertiseSkills
          .slice(expertiseIndex, expertiseIndex + requirement.requiredCount)
          .map(skillLabel);
        expertiseIndex += requirement.requiredCount;
        break;
      case "languages":
        entries = classAdvancementSelections.chosenLanguages
          .slice(languageIndex, languageIndex + requirement.requiredCount)
          .map(languageLabel);
        languageIndex += requirement.requiredCount;
        break;
      case "tools":
        entries = classAdvancementSelections.chosenTools
          .slice(toolIndex, toolIndex + requirement.requiredCount)
          .map(toolLabel);
        toolIndex += requirement.requiredCount;
        break;
      case "itemChoices": {
        const selectedIds = new Set(classAdvancementSelections.itemChoices[requirement.id] ?? []);
        entries = (requirement.itemChoices ?? [])
          .filter((option) => selectedIds.has(option.uuid))
          .map((option) => option.name);
        break;
      }
      default:
        return [];
    }

    if (entries.length === 0) return [];

    return [{
      id: requirement.id,
      title: getSelectedGrantGroupTitle(requirement),
      iconClass: getSelectedGrantGroupIconClass(requirement.type),
      entries,
    }];
  });
}

async function buildFeatureSummaries(
  doc: ClassDocumentLike | null,
  fallbackFeatures: Array<{ title: string; level?: number }> = [],
  currentLevel = 1,
): Promise<Array<{ title: string; description: string }>> {
  const currentLevelFallbackFeatures = fallbackFeatures
    .filter((feature) => (feature.level ?? currentLevel) === currentLevel)
    .filter((feature) => feature.title.trim().toLowerCase() !== "hit points");
  const allowedFeatureTitles = new Set(
    currentLevelFallbackFeatures.map((feature) => feature.title.trim().toLowerCase()),
  );

  const itemGrantFeatures = await Promise.all(
    getAdvancementEntries(doc)
      .filter((entry) => entry.type === "ItemGrant")
      .filter((entry) => allowedFeatureTitles.size > 0 || entry.level == null || entry.level === currentLevel)
      .flatMap((entry) => {
        const items = Array.isArray(entry.configuration?.items)
          ? entry.configuration?.items as Array<{ uuid?: string; name?: string }>
          : [];
        return items.map((item) => ({
          title: item.name ?? entry.title ?? "Feature",
          uuid: item.uuid,
        }));
      })
      .filter((feature) => typeof feature.uuid === "string" && feature.uuid.length > 0)
      .map(async (feature) => {
        const featureUuid = feature.uuid as string;
        const featureDoc = await compendiumIndexer.fetchDocument(featureUuid) as ClassDocumentLike | null;
        const title = feature.title.trim().toLowerCase() === "class features"
          ? (featureDoc?.name ?? feature.title)
          : feature.title;

        return {
          title,
          description: formatInjectedDescriptionHtml(await compendiumIndexer.getCachedDescription(featureUuid)),
        };
      }),
  );

  const filteredItemGrantFeatures = itemGrantFeatures.filter((feature) => {
    const key = feature.title.trim().toLowerCase();
    if (key === "hit points") return false;
    if (allowedFeatureTitles.size === 0) return true;
    return allowedFeatureTitles.has(key);
  });
  if (filteredItemGrantFeatures.length > 0) {
    const seen = new Set<string>();
    return filteredItemGrantFeatures.filter((feature) => {
      const key = feature.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return currentLevelFallbackFeatures
    .map((feature) => ({
      title: feature.title,
      description: "",
    }));
}

export function createClassSummaryStep(): WizardStepDefinition {
  return {
    id: "classSummary",
    label: "Class Summary",
    icon: "fa-solid fa-scroll",
    renderMode: "react",
    reactComponent: ClassSummaryStepScreen,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-summary.hbs`,
    dependencies: ["class"],
    isApplicable: (state) => !!state.selections.class?.uuid && areClassFlowSelectionsComplete(state),

    isComplete(state: WizardState): boolean {
      return !!state.selections.class?.uuid && areClassFlowSelectionsComplete(state);
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const classSelection = state.selections.class;
      const classDoc = classSelection?.uuid
        ? await compendiumIndexer.fetchDocument(classSelection.uuid) as ClassDocumentLike | null
        : null;
      const overview = getSubtitleFromDescription(getRawDescription(classDoc)).trim();
      const features = await buildFeatureSummaries(
        classDoc,
        classSelection?.classFeatures ?? [],
        state.config.startingLevel,
      );
      const chosenWeaponMasteries = (state.selections.weaponMasteries?.chosenWeaponMasteryDetails ?? []).length > 0
        ? (state.selections.weaponMasteries?.chosenWeaponMasteryDetails ?? []).map(formatWeaponMasteryLabel)
        : (state.selections.weaponMasteries?.chosenWeaponMasteries ?? []).map(formatWeaponMasteryLabel);
      const savingThrows = (classSelection?.savingThrowProficiencies ?? []).map(saveLabel);
      const armorProficiencies = dedupeEntries([
        ...(classSelection?.armorProficiencies ?? []),
        ...getTraitGrantLabels(classDoc, {
          titleMatches: ["Armor Training"],
          prefix: "armor:",
          formatter: formatArmorGrantLabel,
        }),
      ]);
      const weaponProficiencies = dedupeEntries([
        ...(classSelection?.weaponProficiencies ?? []),
        ...getTraitGrantLabels(classDoc, {
          titleMatches: ["Weapon Proficiencies"],
          prefix: "weapon:",
          formatter: formatWeaponGrantLabel,
        }),
      ]);
      const toolProficiencies = getTraitGrantLabels(classDoc, {
        titleMatches: ["Tool Proficiencies"],
        prefix: "tool:",
        formatter: formatToolGrantLabel,
      });
      const selectedGrantGroups = buildSelectedGrantGroups(classSelection, state);

      return {
        stepId: "classSummary",
        stepTitle: "Class Summary",
        stepLabel: "Class Summary",
        stepIcon: "fa-solid fa-scroll",
        nextButtonLabel: "Confirm",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--class-summary",
        className: classSelection?.name ?? "Class",
        classImage: classSelection?.img ?? "",
        classIdentifier: classSelection?.identifier ?? "",
        overview,
        primaryAbilitySummary: formatAbilityBadgeText(
          classSelection?.primaryAbilities
          ?? getClassRecommendation(classSelection?.identifier ?? "").primaryAbilities,
        ),
        startingLevel: state.config.startingLevel,
        featureHeading: getLevelAwareFeatureHeading(state.config.startingLevel),
        hitDie: classSelection?.hitDie ?? "d8",
        featureCount: features.length,
        chosenSkills: (state.selections.skills?.chosen ?? []).map(skillLabel),
        chosenWeaponMasteries,
        savingThrows,
        armorProficiencies,
        weaponProficiencies,
        toolProficiencies,
        selectedGrantGroups,
        features,
        hasChosenSkills: (state.selections.skills?.chosen?.length ?? 0) > 0,
        hasChosenWeaponMasteries: chosenWeaponMasteries.length > 0,
        hasSavingThrows: savingThrows.length > 0,
        hasArmorProficiencies: armorProficiencies.length > 0,
        hasWeaponProficiencies: weaponProficiencies.length > 0,
        hasToolProficiencies: toolProficiencies.length > 0,
        hasFeatures: features.length > 0,
      };
    },
  };
}
