import { Log, MOD } from "../../logger";
import { renderTemplate } from "../../types";
import type {
  AbilityKey,
  ClassFeatureSummary,
  ClassSelection,
  CreatorIndexEntry,
  WizardState,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import {
  parseClassSkillAdvancement,
  parseClassSpellcasting,
  parseClassWeaponMasteryAdvancement,
  parseDocumentWeaponProficiencies,
} from "../data/advancement-parser";
import { ABILITY_LABELS } from "../data/dnd5e-constants";
import { formatInjectedDescriptionHtml } from "../utils/description-formatting";

type ClassDocumentLike = {
  system?: Record<string, unknown>;
};

type DescriptionSystemLike = {
  description?: {
    value?: unknown;
  };
};

type ClassRecommendation = {
  primaryAbilities: AbilityKey[];
  hint: string;
  hasWeaponMastery: boolean;
};

const CLASS_RECOMMENDATIONS: Record<string, ClassRecommendation> = {
  barbarian: { primaryAbilities: ["str"], hint: "Strength and Constitution recommended.", hasWeaponMastery: true },
  bard: { primaryAbilities: ["cha"], hint: "Charisma recommended, with Dexterity often close behind.", hasWeaponMastery: false },
  cleric: { primaryAbilities: ["wis"], hint: "Wisdom recommended, with Constitution supporting concentration and toughness.", hasWeaponMastery: false },
  druid: { primaryAbilities: ["wis"], hint: "Wisdom recommended, with Constitution supporting concentration and resilience.", hasWeaponMastery: false },
  fighter: { primaryAbilities: ["str", "dex"], hint: "Strength or Dexterity recommended.", hasWeaponMastery: true },
  monk: { primaryAbilities: ["dex", "wis"], hint: "Dexterity and Wisdom recommended.", hasWeaponMastery: true },
  paladin: { primaryAbilities: ["str", "cha"], hint: "Strength and Charisma recommended.", hasWeaponMastery: true },
  ranger: { primaryAbilities: ["dex", "wis"], hint: "Dexterity and Wisdom recommended.", hasWeaponMastery: true },
  rogue: { primaryAbilities: ["dex"], hint: "Dexterity recommended, with Intelligence or Charisma depending on style.", hasWeaponMastery: true },
  sorcerer: { primaryAbilities: ["cha"], hint: "Charisma recommended, with Constitution helping survivability.", hasWeaponMastery: false },
  warlock: { primaryAbilities: ["cha"], hint: "Charisma recommended, with Constitution helping concentration.", hasWeaponMastery: false },
  wizard: { primaryAbilities: ["int"], hint: "Intelligence recommended, with Constitution helping concentration.", hasWeaponMastery: false },
};

export function getAvailableClasses(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("class", state.config.packSources);
  return entries.filter((entry) => !state.config.disabledUUIDs.has(entry.uuid));
}

export function getClassRecommendation(identifier: string): ClassRecommendation {
  return CLASS_RECOMMENDATIONS[identifier] ?? {
    primaryAbilities: [],
    hint: "Choose abilities that support your class's core features.",
    hasWeaponMastery: false,
  };
}

export function getHitDie(doc: ClassDocumentLike | null): string {
  const system = doc?.system;
  const hd = system?.hd as { denomination?: unknown } | undefined;
  const hitDice = system?.hitDice;
  if (typeof hitDice === "string" && hitDice) return hitDice;
  if (typeof hd?.denomination === "string" && hd.denomination) return hd.denomination;
  return "d8";
}

function normalizeTraitValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  if (value instanceof Set) {
    return [...value].filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  return [];
}

function formatTraitLabel(value: string): string {
  return value
    .split(/[-:]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getSavingThrowProficiencies(doc: ClassDocumentLike | null): AbilityKey[] {
  const saves = doc?.system?.saves;
  if (Array.isArray(saves)) {
    return saves.filter((entry): entry is AbilityKey =>
      typeof entry === "string" && entry in ABILITY_LABELS
    );
  }

  if (typeof saves === "object" && saves !== null) {
    return Object.entries(saves)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .filter((key): key is AbilityKey => key in ABILITY_LABELS);
  }

  const advancement = Array.isArray(doc?.system?.advancement)
    ? doc.system.advancement as Array<Record<string, unknown>>
    : [];
  const grantedSaves = advancement
    .filter((entry) => {
      if (entry.type !== "Trait") return false;
      const title = typeof entry.title === "string" ? entry.title.trim().toLowerCase() : "";
      const level = typeof entry.level === "number" ? entry.level : null;
      const classRestriction = entry.classRestriction;
      return (title === "saving throws" || title === "saving throw proficiencies")
        && level === 1
        && classRestriction !== "secondary";
    })
    .flatMap((entry) => {
      const configuration = entry.configuration as { grants?: unknown } | undefined;
      return normalizeTraitValues(configuration?.grants);
    })
    .filter((grant): grant is string => typeof grant === "string" && grant.startsWith("saves:"))
    .map((grant) => grant.slice("saves:".length))
    .filter((ability): ability is AbilityKey => ability in ABILITY_LABELS);

  if (grantedSaves.length > 0) return [...new Set(grantedSaves)];

  return [];
}

export function getTraitSummary(doc: ClassDocumentLike | null, traitKey: "armorProf" | "weaponProf"): string[] {
  const traits = doc?.system?.traits as Record<string, unknown> | undefined;
  const trait = traits?.[traitKey] as { value?: unknown; custom?: unknown } | undefined;
  const values = normalizeTraitValues(trait?.value).map(formatTraitLabel);
  const custom = typeof trait?.custom === "string" && trait.custom.trim().length > 0
    ? trait.custom.split(/[;,]/g).map((part) => part.trim()).filter(Boolean)
    : [];
  return [...new Set([...values, ...custom])];
}

export function getFeatureSummary(doc: ClassDocumentLike | null, startingLevel: number): ClassFeatureSummary[] {
  const advancement = Array.isArray(doc?.system?.advancement)
    ? doc?.system?.advancement as Array<Record<string, unknown>>
    : [];

  const features: ClassFeatureSummary[] = [];
  for (const entry of advancement) {
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    if (!title) continue;

    const level = typeof entry.level === "number" ? entry.level : undefined;
    if (level && level > startingLevel) continue;

    const normalizedTitle = title.toLowerCase();
    if (normalizedTitle === "skill proficiencies") continue;
    if (normalizedTitle.includes("class features")) continue;

    features.push({ title, level });
  }

  const seen = new Set<string>();
  return features.filter((feature) => {
    const key = `${feature.level ?? 0}:${feature.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getHitPointFeatureLabel(hitDie: string, level: number | undefined): string {
  const maxHp = Number.parseInt(hitDie.replace("d", ""), 10) || 8;
  return level && level > 1 ? `Hitpoints: +${maxHp}` : `Hitpoints: ${maxHp}`;
}

export function normalizeDescriptionText(text: string): string {
  return text
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
    .replace(/\[\[\/award\s+([^[\]]+)\]\]/gi, "$1")
    .replace(/\b(\d+)(GP|SP|CP|EP|PP)\b/g, "$1 $2");
}

export function formatEquipmentChoicesInHtml(html: string): string {
  const normalized = normalizeDescriptionText(html);
  return normalized
    .replace(
      /(Choose\s+[A-Z](?:\s*,\s*[A-Z])*(?:\s*,?\s*or\s+[A-Z])?:)/gi,
      "<strong class=\"cc-card-detail__choice-heading\">$1</strong>",
    )
    .replace(/:\s*(\([A-Z]\))/g, ":<br>$1")
    .replace(/;\s*(?:or\s+)?(\([A-Z]\))/g, "<br>$1")
    .replace(
      /(\([A-Z]\))/g,
      "<strong class=\"cc-card-detail__choice-marker\">$1</strong>",
    );
}

export function postprocessDescriptionHtml(html: string): string {
  return formatInjectedDescriptionHtml(html);
}

function getEntryPrimaryAbilityText(entry: CreatorIndexEntry): string {
  const recommendation = getClassRecommendation(entry.identifier ?? "");
  if (recommendation.primaryAbilities.length === 0) return "";
  return recommendation.primaryAbilities
    .map((ability) => ABILITY_LABELS[ability])
    .join(recommendation.primaryAbilities.length > 1 ? " & " : "");
}

function formatAbilityAbbreviation(ability: AbilityKey): string {
  return ability.toUpperCase();
}

function formatAbilityBadgeText(abilities: AbilityKey[]): string {
  return abilities.map(formatAbilityAbbreviation).join(abilities.length > 1 ? " / " : "");
}

export function getRawDescription(doc: ClassDocumentLike | null): string {
  const system = doc?.system as DescriptionSystemLike | undefined;
  const value = system?.description?.value;
  return typeof value === "string" ? value : "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function getLeadingParagraphText(html: string): string {
  const match = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return match ? stripHtml(match[1]) : "";
}

export function getSubtitleFromDescription(html: string): string {
  const leadingParagraph = getLeadingParagraphText(html);
  if (leadingParagraph) return leadingParagraph;

  const plainText = html
    .replace(/<\/(p|div|section|article|blockquote|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n+/g, "\n")
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  if (!plainText) return "";

  const [firstSentence] = plainText.split(/(?<=[.!?])\s+/);
  return firstSentence?.trim() ?? plainText;
}

export function getClassSubtitle(doc: ClassDocumentLike | null, entry: CreatorIndexEntry): string {
  const fromDescription = getSubtitleFromDescription(getRawDescription(doc));
  if (fromDescription) return fromDescription;
  return getClassRecommendation(entry.identifier ?? "").hint;
}

function getSpellcastingSummary(selection: ClassSelection): string {
  if (!selection.isSpellcaster) return "Martial or non-spellcasting focus";

  const progressionLabel = selection.spellcastingProgression === "full"
    ? "Full caster"
    : selection.spellcastingProgression === "half"
      ? "Half caster"
      : selection.spellcastingProgression === "third"
        ? "Third caster"
        : selection.spellcastingProgression === "pact"
          ? "Pact magic"
          : "Spellcaster";

  const abilityLabel = selection.spellcastingAbility && selection.spellcastingAbility in ABILITY_LABELS
    ? ABILITY_LABELS[selection.spellcastingAbility as AbilityKey]
    : "";

  return abilityLabel ? `${progressionLabel} • ${abilityLabel}` : progressionLabel;
}

export function getClassHeroImage(entry: CreatorIndexEntry): string {
  const identifier = entry.identifier?.trim().toLowerCase();
  if (!identifier) return entry.img;
  return `systems/dnd5e/ui/official/classes/${identifier}.webp`;
}

function summarizeTraitList(values: string[]): string {
  return values.join(", ");
}

export async function buildSelectedClassViewModel(
  state: WizardState,
  entry: CreatorIndexEntry,
  selectionOverride?: ClassSelection,
  docOverride?: ClassDocumentLike | null,
): Promise<Record<string, unknown>> {
  const selected = selectionOverride ?? state.selections.class;
  let doc: ClassDocumentLike | null = docOverride ?? null;

  if (!doc) {
    try {
      doc = await compendiumIndexer.fetchDocument(entry.uuid) as ClassDocumentLike | null;
    } catch (err) {
      Log.warn("Failed to load class document for detail view", err);
    }
  }

  const description = await compendiumIndexer.getCachedDescription(entry.uuid);
  const recommendation = getClassRecommendation(entry.identifier ?? "");
  const selection = selected?.uuid === entry.uuid ? selected : undefined;
  const primaryAbilities = selection?.primaryAbilities ?? recommendation.primaryAbilities;
  const primaryAbilityText = primaryAbilities.length > 0
    ? primaryAbilities.map((ability) => ABILITY_LABELS[ability]).join(" / ")
    : "";

  const hitDie = selection?.hitDie ?? getHitDie(doc);
  const savingThrowProficiencies = (selection?.savingThrowProficiencies ?? getSavingThrowProficiencies(doc))
    .map((ability) => ABILITY_LABELS[ability] ?? ability.toUpperCase());
  const armorProficiencies = selection?.armorProficiencies ?? getTraitSummary(doc, "armorProf");
  const weaponProficiencies = selection?.weaponProficiencies ?? getTraitSummary(doc, "weaponProf");
  const classFeatures = selection?.classFeatures ?? getFeatureSummary(doc, state.config.startingLevel);
  const isSpellcaster = selection?.isSpellcaster ?? false;
  const spellcastingAbility = selection?.spellcastingAbility ?? "";
  const spellcastingProgression = selection?.spellcastingProgression ?? "";
  const hasWeaponMastery = selection?.hasWeaponMastery ?? recommendation.hasWeaponMastery;

  return {
    ...entry,
    description,
    heroImg: getClassHeroImage(entry),
    startingLevel: state.config.startingLevel,
    subtitle: getClassSubtitle(doc, entry),
    isSpellcaster,
    primaryAbilityText,
    primaryAbilityHint: selection?.primaryAbilityHint ?? recommendation.hint,
    hitDie,
    hitPointsAtFirstLevel: `${hitDie.replace("d", "") || "8"} + CON modifier`,
    spellcastingSummary: getSpellcastingSummary({
      uuid: entry.uuid,
      name: entry.name,
      img: entry.img,
      identifier: entry.identifier ?? "",
      skillPool: [],
      skillCount: 0,
      isSpellcaster,
      spellcastingAbility,
      spellcastingProgression,
      primaryAbilities,
      primaryAbilityHint: selection?.primaryAbilityHint ?? recommendation.hint,
      hitDie,
      savingThrowProficiencies: [],
      armorProficiencies: [],
      weaponProficiencies: [],
      classFeatures: [],
      hasWeaponMastery,
    }),
    hasWeaponMastery,
    savingThrowProficiencies,
    savingThrowsSummary: summarizeTraitList(savingThrowProficiencies),
    armorProficiencies,
    armorSummary: summarizeTraitList(armorProficiencies),
    weaponProficiencies,
    weaponSummary: summarizeTraitList(weaponProficiencies),
    classFeatures: classFeatures.map((feature) => ({
      ...feature,
      displayLabel: feature.title.toLowerCase() === "hit points"
        ? getHitPointFeatureLabel(hitDie, feature.level)
        : feature.level ? `Level ${feature.level} • ${feature.title}` : feature.title,
    })),
    summaryFeatures: classFeatures.slice(0, 3).map((feature) => feature.title),
    featureHeading: state.config.startingLevel > 1
      ? `Features Through Level ${state.config.startingLevel}`
      : "Starting Features",
    hasDescription: description.length > 0,
    hasPrimaryAbilities: primaryAbilityText.length > 0,
    hasSavingThrows: savingThrowProficiencies.length > 0,
    hasArmorProficiencies: armorProficiencies.length > 0,
    hasWeaponProficiencies: weaponProficiencies.length > 0,
    hasFeatures: classFeatures.length > 0,
  };
}

async function renderClassDetailPane(selectedEntry: Record<string, unknown> | null): Promise<string> {
  return renderTemplate(`modules/${MOD}/templates/character-creator/cc-step-class-detail.hbs`, {
    selectedEntry,
  });
}

export async function buildClassSelectionFromEntry(
  state: WizardState,
  entry: CreatorIndexEntry,
): Promise<ClassSelection> {
  const selection: ClassSelection = {
    uuid: entry.uuid,
    name: entry.name,
    img: entry.img,
    identifier: entry.identifier ?? "",
    skillPool: [],
    skillCount: 2,
    isSpellcaster: false,
    spellcastingAbility: "",
    spellcastingProgression: "",
  };

  const recommendation = getClassRecommendation(selection.identifier);
  selection.primaryAbilities = recommendation.primaryAbilities;
  selection.primaryAbilityHint = recommendation.hint;
  selection.hasWeaponMastery = recommendation.hasWeaponMastery;

  try {
    const doc = await compendiumIndexer.fetchDocument(entry.uuid) as ClassDocumentLike | null;
    if (!doc) return selection;

    const { skillPool, skillCount } = parseClassSkillAdvancement(doc as never);
    selection.skillPool = skillPool;
    selection.skillCount = skillCount;

    const weaponMastery = parseClassWeaponMasteryAdvancement(doc as never, state.config.startingLevel);
    selection.weaponMasteryCount = weaponMastery.count;
    selection.weaponMasteryPool = weaponMastery.pool;

    const sc = parseClassSpellcasting(doc as never);
    selection.isSpellcaster = sc.isSpellcaster;
    selection.spellcastingAbility = sc.ability;
    selection.spellcastingProgression = sc.progression;
    selection.hitDie = getHitDie(doc);
    selection.savingThrowProficiencies = getSavingThrowProficiencies(doc);
    selection.armorProficiencies = getTraitSummary(doc, "armorProf");
    selection.weaponProficiencies = getTraitSummary(doc, "weaponProf");
    selection.weaponProficiencyKeys = parseDocumentWeaponProficiencies(doc as never);
    selection.classFeatures = getFeatureSummary(doc, state.config.startingLevel);
  } catch (err) {
    Log.warn("Failed to parse class advancement data", err);
  }

  return selection;
}

export async function getClassStepViewModel(state: WizardState): Promise<{
  stepId: string;
  stepTitle: string;
  stepLabel: string;
  stepIcon: string;
  stepDescription: string;
  hideStepIndicator: boolean;
  hideShellHeader: boolean;
  shellContentClass: string;
  entries: Array<CreatorIndexEntry & {
    cardImg: string;
    selected: boolean;
    hitDie: string;
    primaryAbilityText: string;
    primaryAbilityBadgeText: string;
    primaryAbilityHint: string;
    savingThrowText: string;
    savingThrowBadgeText: string;
  }>;
  selectedEntry: Record<string, unknown> | null;
  detailPaneHtml: string;
  hasEntries: boolean;
  emptyMessage: string;
}> {
  await compendiumIndexer.loadPacks(state.config.packSources);
  const entries = getAvailableClasses(state);
  const selected = state.selections.class;
  const selectedEntryRef = selected
    ? entries.find((entry) => entry.uuid === selected.uuid) ?? null
    : null;
  const selectedEntry = selectedEntryRef
    ? await buildSelectedClassViewModel(state, selectedEntryRef)
    : null;
  const entryViewModels = await Promise.all(entries.map(async (entry) => {
    const recommendation = getClassRecommendation(entry.identifier ?? "");
    let doc: ClassDocumentLike | null = null;

    try {
      doc = await compendiumIndexer.fetchDocument(entry.uuid) as ClassDocumentLike | null;
    } catch (err) {
      Log.warn("Failed to load class document for class card summary", err);
    }

    const hitDie = getHitDie(doc);
    const primaryAbilities = recommendation.primaryAbilities;
    const savingThrowProficiencies = getSavingThrowProficiencies(doc);

    return {
      ...entry,
      cardImg: getClassHeroImage(entry),
      selected: entry.uuid === selected?.uuid,
      hitDie,
      primaryAbilityText: getEntryPrimaryAbilityText(entry),
      primaryAbilityBadgeText: formatAbilityBadgeText(primaryAbilities),
      primaryAbilityHint: recommendation.hint,
      savingThrowText: savingThrowProficiencies.map((ability) => ABILITY_LABELS[ability] ?? ability.toUpperCase()).join(" / "),
      savingThrowBadgeText: formatAbilityBadgeText(savingThrowProficiencies),
    };
  }));

  return {
    stepId: "class",
    stepTitle: "Class",
    stepLabel: "Choose Your Calling",
    stepIcon: "fa-solid fa-shield-halved",
    stepDescription:
      "Choose the path that will shape your legend, battle style, and defining talents.",
    hideStepIndicator: true,
    hideShellHeader: true,
    shellContentClass: "cc-step-content--class-select",
    entries: entryViewModels,
    selectedEntry,
    detailPaneHtml: await renderClassDetailPane(selectedEntry),
    hasEntries: entries.length > 0,
    emptyMessage: "No classes available. Check your GM configuration.",
  };
}
