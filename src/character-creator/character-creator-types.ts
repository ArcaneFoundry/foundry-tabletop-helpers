/**
 * Character Creator & Level-Up Manager — Type Definitions
 *
 * All TypeScript interfaces for the character creation wizard,
 * GM configuration, and data layer.
 *
 * Updated for the 2024 D&D PHB character creation workflow.
 */

/* ── Content Types ───────────────────────────────────────── */

/** Compendium content categories the creator indexes. */
export type CreatorContentType =
  | "class"
  | "subclass"
  | "race"
  | "background"
  | "feat"
  | "spell"
  | "item";

/** Workflow-specific content filtering scopes. */
export type CreatorWorkflow =
  | "creator-feat"
  | "origin-feat"
  | "equipment"
  | "spell";

/** Compact source-vintage badges shown in source selectors. */
export type PackSourceBadge =
  | "SRD 2014"
  | "SRD 2024"
  | "Core 2024"
  | "Premium 2024"
  | "Mixed"
  | "Unknown";

/** Normalized compendium index entry. */
export interface CreatorIndexEntry {
  /** Full UUID for fromUuid() lookups */
  uuid: string;
  /** Item name */
  name: string;
  /** Compendium artwork path */
  img: string;
  /** Source pack collection ID */
  packId: string;
  /** Human-readable source label */
  packLabel: string;
  /** Creator content category */
  type: CreatorContentType;
  /** The actual dnd5e item type from the compendium (e.g., "race", "class", "feat") */
  itemType?: string;
  /** System identifier (e.g., "fighter", "elf") */
  identifier?: string;
  /** For subclasses: parent class identifier */
  classIdentifier?: string;
  /** For spells: spell level (0 = cantrip) */
  spellLevel?: number;
  /** For spells: school of magic */
  school?: string;
  /** For feats: normalized feat category/subtype when available. */
  featCategory?: string | null;
  /** For feats: normalized prerequisite level when available. */
  prerequisiteLevel?: number | null;
  /** For equipment: armor category */
  armorType?: string;
  /** For equipment: weapon category */
  weaponType?: string;
  /** For weapons: mastery slug from compendium index data. */
  mastery?: string;
  /** For items: rarity label from compendium index data. */
  rarity?: string;
  /** For items: magical bonus value when present. */
  magicalBonus?: number;
  /** For items: normalized price in copper pieces when available. */
  priceCp?: number;
  /** For items: whether the cached metadata marks this entry as magical. */
  isMagical?: boolean;
  /** For items: normalized enabled property keys from index data. */
  properties?: string[];
  /** For weapons: whether the cached metadata marks this entry as a firearm. */
  isFirearm?: boolean;
  /** For weapons: whether the cached metadata confirms this is a mundane baseline option. */
  baselineWeapon?: boolean;
  /** For backgrounds: granted origin feat UUID when available. */
  grantsOriginFeatUuid?: string | null;
}

/** Persisted world-level snapshot of normalized compendium index data. */
export interface PersistentCompendiumIndexSnapshot {
  /** Internal cache schema version. */
  formatVersion: number;
  /** Current module version when the cache was built. */
  moduleVersion: string;
  /** Current Foundry core version when the cache was built. */
  foundryVersion: string;
  /** Active system id. */
  systemId: string;
  /** Active system version when the cache was built. */
  systemVersion: string;
  /** Normalized selected-pack signature. */
  packSignature: string;
  /** ISO timestamp of cache generation. */
  generatedAt: string;
  /** Cached normalized entries grouped by pack id. */
  packs: Record<string, CreatorIndexEntry[]>;
}

/** Current status of the persistent compendium cache for the selected sources. */
export interface PersistentCompendiumIndexStatus {
  state: "missing" | "ready" | "stale";
  label: string;
  detail: string;
  generatedAt?: string;
  packCount: number;
}

/* ── Pack Source Configuration ────────────────────────────── */

/** Maps content types to arrays of compendium pack collection IDs. */
export interface PackSourceConfig {
  classes: string[];
  subclasses: string[];
  races: string[];
  backgrounds: string[];
  feats: string[];
  spells: string[];
  items: string[];
}

/** Source config keys for creator content packs. */
export type PackSourceKey = keyof PackSourceConfig;

/* ── GM Configuration ────────────────────────────────────── */

/** Ability score generation methods. */
export type AbilityScoreMethod = "4d6" | "pointBuy" | "standardArray";

/** Starting equipment method. */
export type EquipmentMethod = "equipment" | "gold" | "both";

/** Level 1 HP method. */
export type HpMethod = "max" | "roll";

/** Ability score keys. */
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/** Six ability scores. */
export type AbilityScores = Record<AbilityKey, number>;

/** Parsed level-gated class feature summary entry. */
export interface ClassFeatureSummary {
  title: string;
  level?: number;
}

export type ClassAdvancementRequirementType =
  | "skills"
  | "weaponMasteries"
  | "expertise"
  | "languages"
  | "tools"
  | "itemChoices";

export interface ClassAdvancementItemChoiceOption {
  uuid: string;
  name: string;
  img?: string;
}

export interface ClassAdvancementRequirement {
  id: string;
  type: ClassAdvancementRequirementType;
  title: string;
  level: number;
  advancementType: string;
  mode?: string;
  classRestriction?: string;
  requiredCount: number;
  pool: string[];
  itemChoices?: ClassAdvancementItemChoiceOption[];
  groupKey: string;
}

/** Frozen snapshot of all GM configuration at wizard open time. */
export interface GMConfig {
  packSources: PackSourceConfig;
  disabledUUIDs: Set<string>;
  allowedAbilityMethods: AbilityScoreMethod[];
  /** Max 4d6 rerolls. 0 = unlimited. */
  maxRerolls: number;
  startingLevel: number;
  allowMulticlass: boolean;
  equipmentMethod: EquipmentMethod;
  level1HpMethod: HpMethod;
  /** Whether firearm weapons should be surfaced in creator-facing weapon mastery picks. */
  allowFirearms?: boolean;
  /** Whether custom/homebrew backgrounds are permitted. Added for 2024 rules. */
  allowCustomBackgrounds: boolean;
  /** Whether players may swap away from their background's assigned origin feat. */
  allowOriginFeatChoice?: boolean;
  /** Whether background ASIs can be assigned outside the background's allowed ability list. */
  allowUnrestrictedBackgroundAsi?: boolean;
}

/* ── GM Config App ViewModels ────────────────────────────── */

/** A compendium pack entry for the Sources tab. */
export interface PackEntry {
  /** Pack collection ID */
  collection: string;
  /** Display label used by source-selection UIs */
  label: string;
  /** Raw pack label from metadata before any display enrichment */
  rawLabel: string;
  /** Optional source/module label shown alongside the row */
  packageLabel: string;
  /** Source module/package name */
  packageName: string;
  /** Number of items in the pack */
  itemCount: number;
  /** Whether this pack is enabled in the current config */
  enabled: boolean;
  /** Content types detected in this pack */
  contentTypes: CreatorContentType[];
  /** Compact source-vintage badge */
  sourceBadge: PackSourceBadge;
  /** Whether the pack mixes multiple creator-facing content buckets */
  mixedContent: boolean;
  /** Compact summary used in row metadata and previews */
  previewSummary: string;
  /** Compact content breakdown for badges and previews */
  contentBreakdown: Array<{ type: CreatorContentType; label: string; count: number }>;
  /** Sample item names from the pack index */
  sampleItems: string[];
  /** Additional sample count not shown inline */
  sampleOverflow: number;
  /** Folder-derived hints when Foundry exposes folder context */
  folderHints: string[];
  /** Compact preview header helper text */
  previewHint?: string;
}

/** Grouped packs for the Sources tab. */
export interface SourcesTabViewModel {
  /** Packs grouped by configurable source key */
  groups: Array<{
    sourceKey: PackSourceKey;
    type: CreatorContentType;
    label: string;
    packs: PackEntry[];
  }>;
}

/** A content curation entry (index entry + enabled state). */
export interface CurationEntry extends CreatorIndexEntry {
  /** Whether this item is enabled (not disabled by GM) */
  enabled: boolean;
}

/** Content Curation tab view model. */
export interface CurationTabViewModel {
  /** Whether compendium data has been loaded */
  loaded: boolean;
  /** Entries grouped by content type */
  groups: Array<{
    type: CreatorContentType;
    label: string;
    entries: CurationEntry[];
    enabledCount: number;
    totalCount: number;
  }>;
}

/** Rules Configuration tab view model. */
export interface RulesConfigViewModel {
  allowedAbilityMethods: {
    "4d6": boolean;
    pointBuy: boolean;
    standardArray: boolean;
  };
  startingLevel: number;
  allowMulticlass: boolean;
  equipmentMethod: EquipmentMethod;
  level1HpMethod: HpMethod;
  allowFirearms?: boolean;
  allowCustomBackgrounds: boolean;
  allowOriginFeatChoice?: boolean;
  allowUnrestrictedBackgroundAsi?: boolean;
}

/** Full GM Config App context. */
export interface GMConfigAppContext {
  tabs: Record<string, { id: string; label: string; icon: string; active: boolean }>;
  activeTab: string;
  sources?: SourcesTabViewModel;
  curation?: CurationTabViewModel;
  rules?: RulesConfigViewModel;
}

/* ── Wizard State Machine ───────────────────────────────── */

/** Status of a wizard step. */
export type StepStatus = "pending" | "complete" | "invalid";

/** The wizard's in-memory state. Discarded on close. */
export interface WizardState {
  /** Index into applicableSteps */
  currentStep: number;
  /** Step IDs in navigation order (recalculated when selections change) */
  applicableSteps: string[];
  /** Per-step selections (keyed by step ID) */
  selections: WizardSelections;
  /** Per-step completion status */
  stepStatus: Map<string, StepStatus>;
  /** Frozen GM config snapshot taken at wizard open */
  config: GMConfig;
}

/* ── Step Selection Types ───────────────────────────────── */

/** Ability score step state. */
export interface AbilityScoreState {
  method: AbilityScoreMethod;
  /** Final assigned scores. Values are 0 until assigned. */
  scores: Record<AbilityKey, number>;
  /** 4d6/standard array: which rolled/array value is assigned to each ability. -1 = unassigned. */
  assignments: Record<AbilityKey, number>;
  /** 4d6: The six rolled totals. */
  rolledValues?: number[];
  /** 4d6: Number of rerolls used on the current score array. */
  rerollCount?: number;
}

/** Species selection state (2024 PHB — replaces "Race" in the wizard). */
export interface SpeciesSelection {
  uuid: string;
  name: string;
  img: string;
  /** Display-only summaries parsed from advancement (e.g., "Darkvision", "Fey Ancestry"). */
  traits?: string[];
  /** Languages auto-granted by species (e.g., ["common"]). */
  languageGrants?: string[];
  /** Weapon proficiencies auto-granted by species. */
  weaponProficiencies?: string[];
  /** Number of additional language choices from species. */
  languageChoiceCount?: number;
  /** Pool of choosable species languages. */
  languageChoicePool?: string[];
  /** Skill proficiencies auto-granted by species. */
  skillGrants?: string[];
  /** Number of additional skill choices from species. */
  skillChoiceCount?: number;
  /** Pool of choosable species skills. */
  skillChoicePool?: string[];
  /** Species level-0 item/spell choice groups parsed from ItemGrant advancements. */
  itemChoiceGroups?: SpeciesItemChoiceGroup[];
  /** UI-facing normalized level-0/1 choice requirements surfaced by the species. */
  advancementRequirements?: OriginAdvancementRequirement[];
}

export interface SpeciesItemChoiceOption {
  uuid: string;
  name: string;
}

export interface SpeciesItemChoiceGroup {
  id: string;
  title: string;
  count: number;
  options: SpeciesItemChoiceOption[];
}

export type OriginAdvancementRequirementType =
  | "skills"
  | "languages"
  | "itemChoices";

export interface OriginAdvancementItemChoiceOption {
  uuid: string;
  name: string;
  img?: string;
}

export interface OriginAdvancementRequirement {
  id: string;
  source: "background" | "species";
  type: OriginAdvancementRequirementType;
  title: string;
  level: number;
  advancementType: string;
  requiredCount: number;
  pool: string[];
  itemChoices?: OriginAdvancementItemChoiceOption[];
  groupKey: string;
}

/** What a background grants — parsed from advancement data. */
export interface BackgroundGrants {
  /** Skill proficiency keys granted by this background. */
  skillProficiencies: string[];
  /** Fixed weapon proficiency keys granted by this background. */
  weaponProficiencies: string[];
  /** Tool proficiency key (e.g., "art:calligrapher") or null. */
  toolProficiency: string | null;
  /** UUID of the origin feat, or null if none (homebrew/legacy). */
  originFeatUuid: string | null;
  /** Display name of the origin feat. */
  originFeatName: string | null;
  /** Image path of the origin feat. */
  originFeatImg: string | null;
  /** Total ASI points to distribute (typically 3; 0 if no ASI advancement). */
  asiPoints: number;
  /** Max points in a single ability (typically 2; 0 if no ASI advancement). */
  asiCap: number;
  /** Abilities this background actually allows when unrestricted background ASI is off. */
  asiAllowed: AbilityKey[];
  /** Abilities the PHB suggests — UI hint only, NOT enforced. */
  asiSuggested: string[];
  /** Languages auto-granted by this background (e.g., ["common"]). */
  languageGrants: string[];
  /** Number of additional language choices (typically 2; 0 if none). */
  languageChoiceCount: number;
  /** Pool of choosable languages (e.g., ["languages:standard:*"]). */
  languageChoicePool: string[];
}

/** Player's ability score increase assignments from their background. */
export interface BackgroundASI {
  /**
   * Maps ability keys to point values.
   * Must sum to grants.asiPoints, each value <= grants.asiCap.
   * e.g., { wis: 2, cha: 1 }
   */
  assignments: Partial<Record<AbilityKey, number>>;
}

/** Player's language selections (fixed + chosen). */
export interface LanguageSelection {
  /** Auto-granted from advancement (e.g., ["common"]). */
  fixed: string[];
  /** Player-chosen languages. */
  chosen: string[];
}

/** Player's origin feat selection from their background. */
export interface OriginFeatSelection {
  uuid: string;
  name: string;
  img: string;
  /** True if the GM allowed the player to swap to a different origin feat. */
  isCustom: boolean;
}

/** Summary state for the combined origin-choices step. */
export interface OriginChoicesState {
  classSkills: string[];
  chosenLanguages: string[];
  originFeatUuid?: string;
}

/** Summary state for species-specific option handling. */
export interface SpeciesChoicesState {
  hasChoices: boolean;
  note?: string;
  chosenLanguages?: string[];
  chosenSkills?: string[];
  chosenItems?: Record<string, string[]>;
}

/** Background selection state (2024 PHB — enriched with grants and sub-selections). */
export interface BackgroundSelection {
  uuid: string;
  name: string;
  img: string;
  /** Parsed grants from the background's advancement data. */
  grants: BackgroundGrants;
  /** UI-facing normalized level-0/1 choice requirements surfaced by the background. */
  advancementRequirements?: OriginAdvancementRequirement[];
  /** Player's ASI distribution. */
  asi: BackgroundASI;
  /** Player's language selections. */
  languages: LanguageSelection;
}

/** Class selection state (2024 PHB — includes skill pool from advancement). */
export interface ClassSelection {
  uuid: string;
  name: string;
  img: string;
  /** System identifier (e.g., "fighter", "wizard"). */
  identifier: string;
  /** Available skill keys from class advancement. */
  skillPool: string[];
  /** How many skills to pick (fallback 2). */
  skillCount: number;
  /** Whether this class is a spellcaster. */
  isSpellcaster: boolean;
  /** Spellcasting ability key (e.g., "int", "wis", "cha"). Empty if not a caster. */
  spellcastingAbility: string;
  /** Spell slot progression: "full", "half", "third", "pact", or "". */
  spellcastingProgression: string;
  /** Recommended primary abilities for this class. */
  primaryAbilities?: AbilityKey[];
  /** UI hint for class/background/ability synergy. */
  primaryAbilityHint?: string;
  /** Hit die denomination (e.g., "d10"). */
  hitDie?: string;
  /** Saving throw proficiencies granted by the class. */
  savingThrowProficiencies?: AbilityKey[];
  /** Armor proficiency summary strings. */
  armorProficiencies?: string[];
  /** Weapon proficiency summary strings. */
  weaponProficiencies?: string[];
  /** Weapon proficiency keys usable for matching weapon pools. */
  weaponProficiencyKeys?: string[];
  /** Feature summary entries through the configured starting level. */
  classFeatures?: ClassFeatureSummary[];
  /** Whether the class appears to support weapon mastery choices. */
  hasWeaponMastery?: boolean;
  /** Number of weapon mastery picks granted through current starting level. */
  weaponMasteryCount?: number;
  /** Raw weapon mastery pool keys from class advancements (e.g. weapon:sim:*). */
  weaponMasteryPool?: string[];
  /** Normalized class-driven selections required through the configured starting level. */
  classAdvancementRequirements?: ClassAdvancementRequirement[];
}

/** Player-facing selections made in the class choices step. */
export interface ClassChoicesState {
  /** Class skill keys chosen during the class step flow. */
  chosenSkills: string[];
}

export interface ClassAdvancementSelectionsState {
  expertiseSkills: string[];
  chosenLanguages: string[];
  chosenTools: string[];
  itemChoices: Record<string, string[]>;
}

/** Player-facing selections made in the weapon mastery step. */
export interface WeaponMasterySelectionState {
  /** Weapon identifiers chosen for weapon mastery, if any. */
  chosenWeaponMasteries?: string[];
  /** Display metadata for chosen weapon masteries. */
  chosenWeaponMasteryDetails?: Array<{
    id: string;
    label: string;
    img?: string;
    mastery?: string;
    tooltip?: string;
  }>;
  /** Number of mastery options currently surfaced by enabled item packs. */
  availableWeaponMasteries?: number;
}

/** Subclass selection state. */
export interface SubclassSelection {
  uuid: string;
  name: string;
  img: string;
  classIdentifier?: string;
}

/** Feat/ASI selection state. */
export interface FeatSelection {
  /** Whether the player chose ASI or a feat. */
  choice: "asi" | "feat";
  /** ASI: which abilities get +1 (up to 2 abilities). */
  asiAbilities?: AbilityKey[];
  /** Feat: selected feat UUID. */
  featUuid?: string;
  featName?: string;
  featImg?: string;
}

/** Spell selection state. */
export interface SpellSelection {
  /** Selected cantrip UUIDs. */
  cantrips: string[];
  /** Selected spell UUIDs. */
  spells: string[];
  /** Explicitly prepared leveled spell UUIDs for classes that prepare on create. */
  preparedSpells?: string[];
  /** Class-driven cantrip target, when the system exposes one. */
  maxCantrips?: number;
  /** Class-driven leveled-spell target, when the system exposes one. */
  maxSpells?: number;
  /** Class-driven prepared-spell target, when the system exposes one. */
  maxPreparedSpells?: number;
}

export interface EquipmentOptionItem {
  uuid: string;
  name: string;
  img?: string;
  quantity: number;
  priceCp?: number;
  itemType?: string;
  isFirearm?: boolean;
  isMagical?: boolean;
}

export interface EquipmentSourceOption {
  id: string;
  source: "class" | "background";
  mode: "equipment" | "gold";
  title: string;
  description: string;
  img?: string;
  items: EquipmentOptionItem[];
  goldCp: number;
  totalValueCp: number;
}

/** Equipment selection state. */
export interface EquipmentSelection {
  classOptionId?: string;
  backgroundOptionId?: string;
  purchases?: Record<string, number>;
  sales?: Record<string, number>;
  shopMode?: "buy" | "sell";
  /** Internal snapshot used for conditional step routing and review without reparsing. */
  baseGoldCp?: number;
  /** Internal snapshot of current remaining currency after shop transactions. */
  remainingGoldCp?: number;
}

/** Skills selection state (class-chosen only). */
export interface SkillSelection {
  /** Player-chosen skill proficiency keys. */
  chosen: string[];
}

/** Portrait selection state. */
export interface PortraitSelection {
  /** Data URL or uploaded path for the portrait image. */
  portraitDataUrl?: string;
  /** Data URL or uploaded path for the token image (square crop). */
  tokenDataUrl?: string;
  /** Whether the portrait was AI-generated or manually uploaded. */
  source: "generated" | "uploaded" | "none";
}

/** Callbacks passed to step onActivate for state updates. */
export interface StepCallbacks {
  /**
   * Store step data and trigger a full re-render.
   * Use when the step layout fundamentally changes (e.g., switching ability method,
   * selecting a new card that replaces the content area).
   */
  setData: (value: unknown) => void;
  /**
   * Store step data WITHOUT re-rendering. Patches only the nav bar
   * (Next button state, status hint, step indicators).
   * Use for in-place edits (dropdowns, toggles, text input) where the step
   * handles its own DOM updates.
   */
  setDataSilent: (value: unknown) => void;
  /** Re-render the wizard shell. */
  rerender: () => void;
}

export interface WizardStepRenderController {
  getState(): WizardState;
  updateCurrentStepData(value: unknown, options?: { silent?: boolean }): void;
  refresh(): Promise<void>;
  jumpToStep(stepId: string): void;
}

export interface ReactWizardStepProps {
  shellContext: WizardShellContext;
  state: WizardState;
  controller: WizardStepRenderController;
  step: WizardStepDefinition;
}

/** All wizard selections, keyed by step ID. */
export interface WizardSelections {
  abilities?: AbilityScoreState;
  species?: SpeciesSelection;
  background?: BackgroundSelection;
  class?: ClassSelection;
  classChoices?: ClassChoicesState;
  classAdvancements?: ClassAdvancementSelectionsState;
  weaponMasteries?: WeaponMasterySelectionState;
  subclass?: SubclassSelection;
  backgroundAsi?: BackgroundASI;
  originChoices?: OriginChoicesState;
  skills?: SkillSelection;
  originFeat?: OriginFeatSelection;
  speciesChoices?: SpeciesChoicesState;
  feats?: FeatSelection;
  spells?: SpellSelection;
  equipment?: EquipmentSelection;
  portrait?: PortraitSelection;
  [key: string]: unknown;
}

/** Metadata for a wizard step (used by StepRegistry, rendered by shell). */
export interface WizardStepDefinition {
  /** Unique step identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** FontAwesome icon class */
  icon: string;
  /** Rendering strategy for this step during migration. */
  renderMode?: "legacy" | "react";
  /** Template path for step content */
  templatePath: string;
  /** Step IDs this step depends on */
  dependencies: string[];

  /** Should this step appear given current state? */
  isApplicable(state: WizardState): boolean;
  /** Is this step's data complete? */
  isComplete(state: WizardState): boolean;
  /** Short status hint for the navigation bar (e.g., "Choose a species"). */
  getStatusHint?(state: WizardState): string;
  /** Build the template ViewModel */
  buildViewModel(state: WizardState): Promise<Record<string, unknown>>;
  /** Optional React step entry point used when renderMode is "react". */
  reactComponent?: ComponentType<ReactWizardStepProps>;
  /** Action handlers merged into the app's actions */
  actions?: Record<string, (app: unknown, event: Event, target: HTMLElement) => void>;
  /** Called when step gains focus (bind event listeners here) */
  onActivate?(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void;
  /** Called when step loses focus */
  onDeactivate?(state: WizardState, el: HTMLElement): void;
}

/** ViewModel for the wizard shell template. */
export interface WizardShellContext {
  /** Step indicator entries */
  steps: Array<{
    id: string;
    label: string;
    icon: string;
    status: StepStatus;
    active: boolean;
    index: number;
  }>;
  /** Pre-rendered step content HTML */
  stepContentHtml: string;
  /** Current step metadata */
  currentStepId: string;
  currentStepLabel: string;
  currentStepIcon: string;
  /** Navigation state */
  canGoBack: boolean;
  canGoNext: boolean;
  isReviewStep: boolean;
  nextButtonLabel?: string;
  /** Short status hint for the navigation bar */
  statusHint: string;
  statusHintStyle?: "progress" | "selection" | "warning" | "summary";
  /** Atmospheric gradient class for current step */
  atmosphereClass: string;
  chapterKey?: "class" | "origins" | "build" | "finalize";
  chapterSceneKey?: string;
  chapterAccentToken?: string;
  panelStyleVariant?: "artifact" | "recessed" | "glass" | "summary";
  motionProfile?: "ceremonial" | "selection" | "loading" | "confirmation";
  /** Enhanced header fields — set by card-select steps to override the default header */
  headerTitle?: string;
  headerSubtitle?: string;
  headerDescription?: string;
  headerIcon?: string;
  hideStepIndicator?: boolean;
  hideShellHeader?: boolean;
  shellContentClass?: string;
  /** Step view-model payload, used by React-rendered steps. */
  stepViewModel?: Record<string, unknown>;
  /** Selected entry preview for card-select steps */
  selectedEntry?: { name: string; img: string; packLabel: string } | null;
}

/* ── Content Type Labels ─────────────────────────────────── */

/** Human-readable labels for content types. */
export const CONTENT_TYPE_LABELS: Record<CreatorContentType, string> = {
  class: "Classes",
  subclass: "Subclasses",
  race: "Races & Species",
  background: "Backgrounds",
  feat: "Feats",
  spell: "Spells",
  item: "Equipment",
};
import type { ComponentType } from "react";
