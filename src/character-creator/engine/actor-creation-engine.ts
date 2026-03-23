/**
 * Character Creator — Actor Creation Engine
 *
 * Assembles all wizard selections into a real dnd5e Actor via
 * Actor.create() + createEmbeddedDocuments(). Assigns player ownership.
 *
 * Rewritten for 2024 PHB rules: species, background (with ASI, origin feat,
 * languages), class skill proficiencies, and separated assembly steps.
 */

import { Log, MOD } from "../../logger";
import { getGame, getUI, fromUuid } from "../../types";
import type { FoundryDocument } from "../../types";
import type { WizardState, PortraitSelection } from "../character-creator-types";
import { ABILITY_KEYS } from "../data/dnd5e-constants";
import type { AbilityKey } from "../character-creator-types";
import { buildEmptyClassAdvancementSelections } from "../steps/class-advancement-utils";
import {
  currencyCpToActorCurrency,
  deriveEquipmentState,
  resolveEquipmentFlow,
} from "../steps/equipment-flow-utils";
import { applyLevelUp } from "../level-up/actor-update-engine";
import { averageHpForHitDie, getClassItems } from "../level-up/level-up-detection";
import { buildFeatureSelectionForLevel, resolveGrantedFeaturesForDocument } from "../level-up/level-up-feature-helpers";
import type { ClassItemInfo, LevelUpState } from "../level-up/level-up-types";

interface ActorCollectionWithClass {
  documentClass?: {
    create(data: Record<string, unknown>): Promise<FoundryDocument | null>;
  };
}

interface FilePickerUploadResult {
  path?: string;
}

interface FilePickerLike {
  upload?(
    source: string,
    target: string,
    file: File,
    options: Record<string, unknown>,
  ): Promise<FilePickerUploadResult | null | undefined>;
}

interface GameSocketLike {
  emit?(event: string, data: Record<string, unknown>): void;
}

interface ClassDocumentLike {
  system?: {
    hitDice?: string;
    hd?: {
      denomination?: string;
    };
    levels?: number;
    advancement?: Array<{
      type?: string;
      configuration?: {
        identifier?: string;
        scale?: Record<string, { value?: number }>;
      };
    }>;
    spellcasting?: {
      preparation?: {
        formula?: string;
      };
    };
  };
}

interface AdvancementValueLike {
  chosen?: Set<string> | string[];
}

interface TraitAdvancementLike {
  title?: string;
  type?: string;
  level?: number;
  configuration?: {
    mode?: string;
    choices?: Array<{
      count?: number;
    }>;
    grants?: Set<string> | string[];
  };
  value?: AdvancementValueLike;
  updateSource?(updateData: Record<string, unknown>): void;
  _source?: {
    value?: {
      chosen?: string[];
    };
  };
  apply?(level: number, data: { chosen: Set<string> }): Promise<void> | void;
  toObject?(): Record<string, unknown>;
}

interface ItemWithAdvancementLike extends FoundryDocument {
  system?: {
    advancement?: TraitAdvancementLike[];
    identifier?: string;
  };
}

interface SpellItemLike extends FoundryDocument {
  type?: string;
  name?: string;
  system?: {
    level?: number;
    identifier?: string;
    method?: string;
    prepared?: number | boolean;
    preparation?: {
      mode?: string;
      prepared?: boolean | number;
    };
  };
}

const SPELL_PREPARATION_STATES = {
  unprepared: 0,
  prepared: 1,
  always: 2,
} as const;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Create a dnd5e Actor from completed wizard state.
 * Returns the created Actor document, or null on failure.
 */
export async function createCharacterFromWizard(
  state: WizardState,
): Promise<FoundryDocument | null> {
  const sel = state.selections;
  const characterName =
    (sel.review as { characterName?: string } | undefined)?.characterName?.trim() ??
    "New Character";

  try {
    // 1. Create base Actor
    const actorData = {
      name: characterName,
      type: "character" as const,
      system: {},
    };

    const ActorClass = getActorDocumentClass(getGame()?.actors);
    if (!ActorClass) {
      Log.error("ActorCreationEngine: Actor document class not available");
      return null;
    }

    const actor = await ActorClass.create(actorData);
    if (!actor) {
      Log.error("ActorCreationEngine: Actor.create() returned null");
      return null;
    }

    Log.info(`ActorCreationEngine: Created actor "${characterName}" (${actor.id})`);

    // 2. Apply ability scores + background ASI
    await applyAbilityScores(actor, sel);

    // 3. Collect and embed items (species, background, origin feat, class, subclass, feats, spells)
    await embedItems(actor, state);

    // 4. Grant baseline level-1 features that dnd5e class items do not
    // materialize automatically when embedded during creation.
    await applyInitialFeatureGrants(actor, state);

    // 5. Apply proficiencies (background skills + class-chosen skills)
    await applyProficiencies(actor, sel);

    // 6. Apply languages
    await applyLanguages(actor, sel);

    // 7. Apply level-1 HP and starting resources
    await applyStartingDetails(actor, state);

    // 8. Apply higher-level progression when starting above level 1
    await applyStartingLevelProgression(actor, state);

    // 9. Re-apply final derived selections after item embedding and
    // higher-level progression, which can overwrite actor data in live dnd5e.
    await applyFinalCharacterSelections(actor, state);

    // 10. Normalize embedded spell preparation after dnd5e creation/progression
    // flows have finished mutating actor spell items.
    await normalizeActorSpellPreparation(actor, state);

    // 11. Upload and apply portrait if generated
    await applyPortrait(actor, sel.portrait, characterName);

    // 12. Set ownership
    await setOwnership(actor);

    // 13. Notify GM via socket
    notifyGMCharacterCreated(characterName, actor.id);

    // 14. Return the created actor
    return actor;
  } catch (err) {
    Log.error("ActorCreationEngine: Failed to create character", err);
    return null;
  }
}

/* ── Step 2: Ability Scores + Background ASI ─────────────── */

async function applyAbilityScores(
  actor: FoundryDocument,
  sel: WizardState["selections"],
): Promise<void> {
  const abilityUpdates: Record<string, unknown> = {};
  const scores = buildSelectedAbilityScores(sel);
  for (const key of ABILITY_KEYS) {
    abilityUpdates[`system.abilities.${key}.value`] = scores[key];
  }

  await actor.update(abilityUpdates);
  Log.debug("ActorCreationEngine: Applied ability scores");
}

/* ── Step 3: Collect & Embed Items ───────────────────────── */

async function embedItems(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const sel = state.selections;
  const uuids: string[] = [];
  const selectedCantrips = new Set(sel.spells?.cantrips ?? []);
  const selectedSpells = new Set(sel.spells?.spells ?? []);
  const usesPreparedSpellSelection = (sel.spells?.maxPreparedSpells ?? 0) > 0;
  const grantedSpellRefs = await resolveGrantedSpellRefsForCreation(
    sel.class?.uuid,
    sel.subclass?.uuid,
    state.config.startingLevel,
  );
  const grantedSpellUuids = new Set(grantedSpellRefs.map((ref) => ref.uuid));

  // Species
  if (sel.species?.uuid) uuids.push(sel.species.uuid);
  for (const groupSelection of Object.values(sel.speciesChoices?.chosenItems ?? {})) {
    for (const uuid of groupSelection) {
      if (typeof uuid === "string" && uuid.length > 0) uuids.push(uuid);
    }
  }
  // Background
  if (sel.background?.uuid) uuids.push(sel.background.uuid);
  // Origin feat (from background grants or player swap)
  if (sel.originFeat?.uuid) uuids.push(sel.originFeat.uuid);
  // Class
  if (sel.class?.uuid) uuids.push(sel.class.uuid);
  // Subclass (if applicable at starting level)
  if (sel.subclass?.uuid) uuids.push(sel.subclass.uuid);
  // Feat item (if player chose a feat instead of ASI)
  if (sel.feats?.featUuid) uuids.push(sel.feats.featUuid);
  // Spell UUIDs (cantrips + leveled spells)
  for (const uuid of sel.spells?.cantrips ?? []) {
    uuids.push(uuid);
  }
  for (const uuid of sel.spells?.spells ?? []) {
    if (grantedSpellUuids.has(uuid)) continue;
    uuids.push(uuid);
  }

  // Fetch full documents and convert to plain data
  const items: Record<string, unknown>[] = [];
  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (doc) {
      const obj = doc.toObject();
      // Remove _id so Foundry generates a new one
      delete obj._id;
      normalizeEmbeddedSpellData(obj, uuid, selectedCantrips, selectedSpells, usesPreparedSpellSelection);
      items.push(obj);
    } else {
      Log.warn(`ActorCreationEngine: Could not resolve UUID ${uuid}`);
    }
  }

  if (items.length > 0) {
    await actor.createEmbeddedDocuments("Item", items);
    Log.debug(`ActorCreationEngine: Embedded ${items.length} items`);
  }
}

function normalizeEmbeddedSpellData(
  itemData: Record<string, unknown>,
  uuid: string,
  selectedCantrips: ReadonlySet<string>,
  selectedSpells: ReadonlySet<string>,
  usesPreparedSpellSelection: boolean,
): void {
  if (itemData.type !== "spell") return;

  const system = typeof itemData.system === "object" && itemData.system !== null
    ? { ...(itemData.system as Record<string, unknown>) }
    : {};

  if (selectedCantrips.has(uuid)) {
    system.level = 0;
    system.method = "spell";
    system.prepared = SPELL_PREPARATION_STATES.always;
    delete system.preparation;
    itemData.system = system;
    return;
  }

  if (selectedSpells.has(uuid) && usesPreparedSpellSelection) {
    system.method = "spell";
    system.prepared = SPELL_PREPARATION_STATES.unprepared;
    delete system.preparation;
    itemData.system = system;
  }
}

async function normalizeActorSpellPreparation(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const sel = state.selections;
  const cantripRefs = await resolveSelectedSpellRefs(sel.spells?.cantrips ?? []);
  const leveledSpellRefs = await resolveSelectedSpellRefs(sel.spells?.spells ?? []);
  const selectedCantripIds = new Set(cantripRefs.flatMap(({ identifier, name }) => [identifier, name]).filter(Boolean));
  const selectedSpellIds = new Set(leveledSpellRefs.flatMap(({ identifier, name }) => [identifier, name]).filter(Boolean));
  const initialPreparedIds = await resolveInitiallyPreparedSpellIds(actor, state, leveledSpellRefs);
  const usesPreparedSpellSelection = (sel.spells?.maxPreparedSpells ?? 0) > 0 || initialPreparedIds.size > 0;
  const updates: Array<{ _id: string; system: Record<string, unknown> }> = [];

  for (const item of iterateActorItems(actor)) {
    if (item.type !== "spell" || !item.id) continue;

    const identifier = item.system?.identifier;
    const name = item.name;
    const keyMatchesCantrip = selectedCantripIds.has(identifier) || selectedCantripIds.has(name);
    const keyMatchesLeveled = selectedSpellIds.has(identifier) || selectedSpellIds.has(name);

    if (keyMatchesCantrip) {
      updates.push({
        _id: item.id,
        system: {
          level: 0,
          method: "spell",
          prepared: SPELL_PREPARATION_STATES.always,
        },
      });
      continue;
    }

    if (keyMatchesLeveled && usesPreparedSpellSelection) {
      const shouldPrepare = (identifier ? initialPreparedIds.has(identifier) : false)
        || (name ? initialPreparedIds.has(name) : false);
      updates.push({
        _id: item.id,
        system: {
          method: "spell",
          prepared: shouldPrepare
            ? SPELL_PREPARATION_STATES.prepared
            : SPELL_PREPARATION_STATES.unprepared,
        },
      });
    }
  }

  if (updates.length === 0) return;

  const updateEmbeddedDocuments = getUpdateEmbeddedDocuments(actor);
  if (!updateEmbeddedDocuments) return;

  await updateEmbeddedDocuments("Item", updates);
}

async function resolveSelectedSpellRefs(
  uuids: string[],
): Promise<Array<{ uuid: string; name?: string; identifier?: string }>> {
  const refs: Array<{ uuid: string; name?: string; identifier?: string }> = [];

  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (!doc) continue;
    const obj = doc.toObject?.();
    const system = typeof obj?.system === "object" && obj.system !== null
      ? obj.system as Record<string, unknown>
      : {};
    refs.push({
      uuid,
      name: typeof obj?.name === "string" ? obj.name : undefined,
      identifier: typeof system.identifier === "string" ? system.identifier : undefined,
    });
  }

  return refs;
}

async function resolveGrantedSpellRefsForCreation(
  classUuid: string | undefined,
  subclassUuid: string | undefined,
  level: number,
): Promise<Array<{ uuid: string; name?: string; identifier?: string }>> {
  const granted = [
    ...(await resolveGrantedFeaturesForDocument(classUuid, { maxLevel: level })),
    ...(await resolveGrantedFeaturesForDocument(subclassUuid, { maxLevel: level })),
  ];
  const spellUuids = new Set<string>();

  for (const grant of granted) {
    if (await isSpellGrantUuid(grant.uuid)) spellUuids.add(grant.uuid);
  }

  return resolveSelectedSpellRefs([...spellUuids]);
}

async function isSpellGrantUuid(uuid: string): Promise<boolean> {
  if (/\.spells?\./i.test(uuid)) return true;

  const doc = await fromUuid(uuid);
  const obj = doc?.toObject?.();
  return obj?.type === "spell";
}

async function resolveInitiallyPreparedSpellIds(
  actor: FoundryDocument,
  state: WizardState,
  leveledSpellRefs: Array<{ name?: string; identifier?: string }>,
): Promise<Set<string>> {
  const explicitPreparedRefs = await resolveSelectedSpellRefs(state.selections.spells?.preparedSpells ?? []);
  if (explicitPreparedRefs.length > 0) {
    const explicitPrepared = new Set<string>();
    for (const ref of explicitPreparedRefs) {
      if (ref.identifier) explicitPrepared.add(ref.identifier);
      if (ref.name) explicitPrepared.add(ref.name);
    }
    return explicitPrepared;
  }

  const preparedLimit = await resolvePreparedSpellLimit(actor, state);
  if (!preparedLimit || preparedLimit < 1) return new Set<string>();

  const prepared = new Set<string>();
  for (const ref of leveledSpellRefs.slice(0, preparedLimit)) {
    if (ref.identifier) prepared.add(ref.identifier);
    if (ref.name) prepared.add(ref.name);
  }
  return prepared;
}

async function resolvePreparedSpellLimit(
  actor: FoundryDocument,
  state: WizardState,
): Promise<number> {
  const classIdentifier = state.selections.class?.identifier;
  const actorClassItem = findActorClassItem(actor, classIdentifier);
  const actorClassLevel = getActorClassLevel(actor, actorClassItem, state.config.startingLevel);
  const actorFormula = actorClassItem?.system?.spellcasting?.preparation?.formula ?? "";
  const actorScaleIdentifier = parsePreparationScaleIdentifier(actorFormula);
  if (actorScaleIdentifier) {
    const actorPreparedLimit = resolveScaleByIdentifier(
      actorClassItem?.system?.advancement ?? [],
      actorScaleIdentifier,
      actorClassLevel,
    );
    if (actorPreparedLimit > 0) return actorPreparedLimit;
  }

  const classUuid = state.selections.class?.uuid;
  if (!classUuid) return 0;

  const classDoc = await fromUuid(classUuid) as ClassDocumentLike | null;
  const formula = classDoc?.system?.spellcasting?.preparation?.formula ?? "";
  const scaleIdentifier = parsePreparationScaleIdentifier(formula);
  if (!scaleIdentifier) return 0;

  const advancements = classDoc?.system?.advancement ?? [];
  return resolveScaleByIdentifier(advancements, scaleIdentifier, actorClassLevel);
}

function parsePreparationScaleIdentifier(formula: string): string | null {
  const match = formula.match(/^@scale\.[^.]+\.([a-z0-9-]+)$/i);
  return match?.[1] ?? null;
}

function resolveScaleByIdentifier(
  advancements: Array<{
    type?: string;
    configuration?: {
      identifier?: string;
      scale?: Record<string, { value?: number }>;
    };
  }>,
  identifier: string,
  level: number,
): number {
  const match = advancements.find((entry) =>
    entry.type === "ScaleValue" && entry.configuration?.identifier === identifier
  );
  return resolveScaleValue(match?.configuration?.scale, level);
}

function resolveScaleValue(
  scale: Record<string, { value?: number }> | undefined,
  level: number,
): number {
  if (!scale) return 0;

  const matchingLevels = Object.keys(scale)
    .map((key) => Number.parseInt(key, 10))
    .filter((key) => !Number.isNaN(key) && key <= level)
    .sort((a, b) => b - a);

  const matchedLevel = matchingLevels[0];
  if (matchedLevel === undefined) return 0;

  const value = scale[String(matchedLevel)]?.value;
  return typeof value === "number" ? value : 0;
}

function iterateActorItems(actor: FoundryDocument): SpellItemLike[] {
  const items = Reflect.get(actor as object, "items");
  if (!items || typeof items !== "object") return [];
  if (Symbol.iterator in items) {
    return Array.from(items as Iterable<SpellItemLike>);
  }
  return [];
}

function findActorClassItem(
  actor: FoundryDocument,
  classIdentifier: string | undefined,
): ClassDocumentLike | null {
  for (const item of iterateActorItems(actor)) {
    if (item.type !== "class") continue;
    if (!classIdentifier || item.system?.identifier === classIdentifier) {
      return item as ClassDocumentLike;
    }
  }
  return null;
}

function getActorClassLevel(
  actor: FoundryDocument,
  classItem: ClassDocumentLike | null,
  fallbackLevel: number,
): number {
  const classLevel = Reflect.get(classItem?.system ?? {}, "levels");
  if (typeof classLevel === "number" && classLevel > 0) return classLevel;

  const actorLevel = Reflect.get(actor as object, "system.details.level");
  if (typeof actorLevel === "number" && actorLevel > 0) return actorLevel;

  return fallbackLevel;
}

function getUpdateEmbeddedDocuments(
  actor: FoundryDocument,
): ((embeddedName: string, updates: Array<Record<string, unknown>>) => Promise<unknown>) | null {
  const fn = Reflect.get(actor as object, "updateEmbeddedDocuments");
  return typeof fn === "function"
    ? fn.bind(actor) as (embeddedName: string, updates: Array<Record<string, unknown>>) => Promise<unknown>
    : null;
}

/* ── Step 4: Apply Proficiencies ─────────────────────────── */

async function applyInitialFeatureGrants(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const featureUuids = new Set<string>();
  const classFeatures = await resolveGrantedFeaturesForDocument(state.selections.class?.uuid, { level: 1 });
  const subclassFeatures = await resolveGrantedFeaturesForDocument(state.selections.subclass?.uuid, { maxLevel: 1 });

  for (const feature of [...classFeatures, ...subclassFeatures]) {
    featureUuids.add(feature.uuid);
  }

  if (featureUuids.size === 0) return;

  await grantItemsByUuid(actor, [...featureUuids]);
  Log.debug(`ActorCreationEngine: Granted ${featureUuids.size} baseline class features`);
}

async function applyProficiencies(
  actor: FoundryDocument,
  sel: WizardState["selections"],
): Promise<void> {
  const backgroundSkills = sel.background?.grants.skillProficiencies ?? [];
  const classSkills = sel.skills?.chosen ?? [];
  const speciesSkills = [
    ...(sel.species?.skillGrants ?? []),
    ...(sel.speciesChoices?.chosenSkills ?? []),
  ];
  let appliedViaAdvancement = false;

  appliedViaAdvancement = await applyTraitAdvancementSelection(actor, {
    itemTypes: ["background"],
    advancementTitleIncludes: "proficiencies",
    chosen: prefixTraitKeys(backgroundSkills, "skills"),
    level: 0,
    includeConfigurationGrants: true,
  }) || appliedViaAdvancement;

  appliedViaAdvancement = await applyTraitAdvancementSelection(actor, {
    itemTypes: ["class"],
    advancementTitleIncludes: "skill proficiencies",
    chosen: prefixTraitKeys(classSkills, "skills"),
    level: 1,
    itemIdentifier: sel.class?.identifier,
  }) || appliedViaAdvancement;

  appliedViaAdvancement = await applyTraitAdvancementSelection(actor, {
    itemTypes: ["race", "species"],
    advancementTitleIncludes: "proficien",
    chosen: prefixTraitKeys(speciesSkills, "skills"),
    level: 0,
    includeConfigurationGrants: true,
  }) || appliedViaAdvancement;

  if (appliedViaAdvancement) {
    Log.debug("ActorCreationEngine: Applied skill proficiencies via dnd5e advancements");
    return;
  }

  const skillUpdates: Record<string, unknown> = {};

  // Background-granted skills
  for (const key of backgroundSkills) {
    skillUpdates[`system.skills.${key}.proficient`] = 1;
  }
  // Class-chosen skills
  for (const key of classSkills) {
    skillUpdates[`system.skills.${key}.proficient`] = 1;
  }
  // Species-granted/chosen skills
  for (const key of speciesSkills) {
    skillUpdates[`system.skills.${key}.proficient`] = 1;
  }

  if (Object.keys(skillUpdates).length > 0) {
    await actor.update(skillUpdates);
    Log.debug("ActorCreationEngine: Applied skill proficiencies");
  }
}

/* ── Step 5: Apply Languages ─────────────────────────────── */

async function applyLanguages(
  actor: FoundryDocument,
  sel: WizardState["selections"],
): Promise<void> {
  const fixed = sel.background?.languages.fixed ?? [];
  const chosen = sel.background?.languages.chosen ?? [];
  const speciesLanguages = sel.species?.languageGrants ?? [];
  const speciesChosen = sel.speciesChoices?.chosenLanguages ?? [];
  const allLanguages = [...new Set([...speciesLanguages, ...speciesChosen, ...fixed, ...chosen])];

  let appliedViaAdvancement = false;
  appliedViaAdvancement = await applyTraitAdvancementSelection(actor, {
    itemTypes: ["background"],
    advancementTitleIncludes: "language",
    chosen: prefixTraitKeys([...fixed, ...chosen], "languages:standard"),
    level: 0,
    includeConfigurationGrants: true,
  }) || appliedViaAdvancement;

  appliedViaAdvancement = await applyTraitAdvancementSelection(actor, {
    itemTypes: ["race", "species"],
    advancementTitleIncludes: "language",
    chosen: prefixTraitKeys([...speciesLanguages, ...speciesChosen], "languages:standard"),
    level: 0,
    includeConfigurationGrants: true,
  }) || appliedViaAdvancement;

  if (appliedViaAdvancement) {
    Log.debug(`ActorCreationEngine: Applied ${allLanguages.length} languages via dnd5e advancements`);
    return;
  }

  if (allLanguages.length > 0) {
    await actor.update({ "system.traits.languages.value": allLanguages });
    Log.debug(`ActorCreationEngine: Applied ${allLanguages.length} languages`);
  }
}

/* ── Step 6: Starting Details ────────────────────────────── */

async function applyStartingDetails(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  await applyLevel1HitPoints(actor, state);
  await applyStartingCurrency(actor, state);
  await applyStartingEquipment(actor, state);
  await actor.update({ "system.details.level": 1 });
}

async function applyLevel1HitPoints(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const hitDie = await getClassHitDie(state.selections.class?.uuid);
  const maxHitPoints = calculateLevel1HitPoints(hitDie, state);

  await actor.update({
    "system.attributes.hp.max": maxHitPoints,
    "system.attributes.hp.value": maxHitPoints,
  });
  Log.debug(`ActorCreationEngine: Applied level 1 HP (${state.config.level1HpMethod})`, {
    hitDie,
    maxHitPoints,
  });
}

async function applyStartingCurrency(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const equipment = state.selections.equipment;
  if (!equipment || !state.selections.class?.uuid || !state.selections.background?.uuid) return;

  const resolution = await resolveEquipmentFlow(state);
  const derived = deriveEquipmentState(state, resolution);
  const actorCurrency = currencyCpToActorCurrency(derived.remainingGoldCp);

  await actor.update({ "system.currency": actorCurrency });
  Log.debug("ActorCreationEngine: Applied starting currency", {
    baseGoldCp: derived.baseGoldCp,
    remainingGoldCp: derived.remainingGoldCp,
    actorCurrency,
  });
}

async function applyStartingEquipment(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const equipment = state.selections.equipment;
  if (!equipment || !state.selections.class?.uuid || !state.selections.background?.uuid) return;

  const resolution = await resolveEquipmentFlow(state);
  const derived = deriveEquipmentState(state, resolution);
  if (derived.inventory.length === 0) return;

  const items: Record<string, unknown>[] = [];
  for (const inventoryItem of derived.inventory) {
    const doc = await fromUuid(inventoryItem.uuid);
    if (!doc) {
      Log.warn(`ActorCreationEngine: Could not resolve equipment UUID ${inventoryItem.uuid}`);
      continue;
    }
    const obj = doc.toObject();
    delete obj._id;
    const system = typeof obj.system === "object" && obj.system !== null
      ? { ...(obj.system as Record<string, unknown>) }
      : {};
    system.quantity = inventoryItem.quantity;
    obj.system = system;
    items.push(obj);
  }

  if (items.length > 0) {
    await actor.createEmbeddedDocuments("Item", items);
    Log.debug(`ActorCreationEngine: Embedded ${items.length} starting equipment items`);
  }
}

async function getClassHitDie(classUuid: string | undefined): Promise<string> {
  if (!classUuid) return "d8";
  const classDoc = await fromUuid(classUuid) as ClassDocumentLike | null;
  return classDoc?.system?.hitDice
    ?? classDoc?.system?.hd?.denomination
    ?? "d8";
}

function calculateLevel1HitPoints(hitDie: string, state: WizardState): number {
  const dieSize = Number.parseInt(hitDie.replace("d", ""), 10);
  const safeDieSize = Number.isNaN(dieSize) ? 8 : dieSize;
  const conScore = buildSelectedConScore(state, 1);
  const conModifier = Math.floor((conScore - 10) / 2);
  const baseHp = state.config.level1HpMethod === "roll"
    ? Math.floor(Math.random() * safeDieSize) + 1
    : safeDieSize;
  return Math.max(1, baseHp + conModifier);
}

async function applyStartingLevelProgression(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const startingLevel = state.config.startingLevel;
  if (startingLevel <= 1) return;

  for (let targetLevel = 2; targetLevel <= startingLevel; targetLevel++) {
    const classInfo = getSelectedClassInfo(actor, state);
    if (!classInfo) {
      throw new Error("ActorCreationEngine: Could not resolve created class item for higher-level progression");
    }

    const levelUpState = buildCreationLevelUpState(actor, state, classInfo, targetLevel);
    const success = await applyLevelUp(levelUpState);
    if (!success) {
      throw new Error(`ActorCreationEngine: Failed to apply creation progression for level ${targetLevel}`);
    }
  }

  await actor.update({ "system.details.level": startingLevel });
  Log.info(`ActorCreationEngine: Applied higher-level progression through level ${startingLevel}`);
}

function buildCreationLevelUpState(
  actor: FoundryDocument,
  wizardState: WizardState,
  classInfo: ClassItemInfo,
  targetLevel: number,
): LevelUpState {
  const currentLevel = targetLevel - 1;
  const hpGained = calculateAverageLevelUpHp(classInfo.hitDie, wizardState, targetLevel);

  return {
    actorId: actor.id,
    currentLevel,
    targetLevel,
    applicableSteps: [],
    currentStep: 0,
    stepStatus: new Map(),
    classItems: getClassItems(actor),
    selections: {
      classChoice: {
        mode: "existing",
        classItemId: classInfo.itemId,
        className: classInfo.name,
        classIdentifier: classInfo.identifier,
      },
      hp: {
        method: "average",
        hpGained,
        hitDie: classInfo.hitDie,
      },
      features: buildFeatureSelectionForLevel(classInfo, targetLevel),
      subclass: wizardState.selections.subclass,
      feats: buildCreationFeatSelection(wizardState, targetLevel),
    },
  };
}

function getSelectedClassInfo(
  actor: FoundryDocument,
  state: WizardState,
): ClassItemInfo | undefined {
  const classIdentifier = state.selections.class?.identifier ?? "";
  const classItems = getClassItems(actor);
  return classItems.find((item) => item.identifier === classIdentifier) ?? classItems[0];
}

function calculateAverageLevelUpHp(
  hitDie: string,
  state: WizardState,
  targetLevel: number,
): number {
  const conScore = buildSelectedConScore(state, targetLevel);
  const conModifier = Math.floor((conScore - 10) / 2);
  return Math.max(1, averageHpForHitDie(hitDie) + conModifier);
}

function buildSelectedAbilityScores(
  selections: WizardState["selections"],
): Record<AbilityKey, number> {
  const baseScores = selections.abilities?.scores ?? ({} as Partial<Record<AbilityKey, number>>);
  const backgroundAsi = selections.background?.asi?.assignments ?? {};
  const featAsi = buildFeatAsiAssignments(selections.feats);
  const scores = {} as Record<AbilityKey, number>;

  for (const key of ABILITY_KEYS) {
    scores[key] = (baseScores[key] ?? 10) + (backgroundAsi[key] ?? 0) + (featAsi[key] ?? 0);
  }

  return scores;
}

function buildFeatAsiAssignments(
  feats: WizardState["selections"]["feats"] | undefined,
): Partial<Record<AbilityKey, number>> {
  if (feats?.choice !== "asi" || !feats.asiAbilities?.length) return {};

  const bonus = feats.asiAbilities.length === 1 ? 2 : 1;
  return feats.asiAbilities.reduce<Partial<Record<AbilityKey, number>>>((acc, key) => {
    acc[key] = (acc[key] ?? 0) + bonus;
    return acc;
  }, {});
}

function buildSelectedConScore(state: WizardState, targetLevel: number): number {
  const baseScores = state.selections.abilities?.scores ?? ({} as Partial<Record<AbilityKey, number>>);
  const backgroundAsi = state.selections.background?.asi?.assignments ?? {};
  const featAsi = targetLevel >= 4 ? buildFeatAsiAssignments(state.selections.feats) : {};
  return (baseScores.con ?? 10) + (backgroundAsi.con ?? 0) + (featAsi.con ?? 0);
}

function buildCreationFeatSelection(
  state: WizardState,
  targetLevel: number,
): LevelUpState["selections"]["feats"] | undefined {
  if (targetLevel !== 4) return undefined;
  const feats = state.selections.feats;
  if (!feats || feats.choice !== "asi") return undefined;

  return {
    choice: "asi",
    asiAbilities: feats.asiAbilities,
  };
}

async function applyFinalCharacterSelections(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  await applyAbilityScores(actor, state.selections);
  await applyProficiencies(actor, state.selections);
  await applyClassAdvancementSelections(actor, state);
  await applyWeaponMasteries(actor, state);
  await applyLanguages(actor, state.selections);
  await applyFinalHitPoints(actor, state);
}

function toClassLanguageAdvancementKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "common-sign": "languages:standard:sign",
    "deep-speech": "languages:standard:deep",
  };
  return aliases[normalized] ?? `languages:standard:${normalized}`;
}

async function applyClassAdvancementSelections(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const selections = state.selections.classAdvancements ?? buildEmptyClassAdvancementSelections();
  const classIdentifier = state.selections.class?.identifier;
  if (!classIdentifier) return;

  let appliedExpertiseViaAdvancement = false;
  if (selections.expertiseSkills.length > 0) {
    appliedExpertiseViaAdvancement = await applyTraitAdvancementSelection(actor, {
      itemTypes: ["class"],
      advancementTitleIncludes: "expertise",
      chosen: prefixTraitKeys(selections.expertiseSkills, "skills"),
      level: state.config.startingLevel,
      itemIdentifier: classIdentifier,
    });

    if (!appliedExpertiseViaAdvancement) {
      const expertiseUpdates: Record<string, unknown> = {};
      for (const key of selections.expertiseSkills) {
        expertiseUpdates[`system.skills.${key}.value`] = 2;
      }
      if (Object.keys(expertiseUpdates).length > 0) {
        await actor.update(expertiseUpdates);
      }
    }
  }

  if (selections.chosenLanguages.length > 0) {
    const appliedLanguageAdvancement = await applyTraitAdvancementSelection(actor, {
      itemTypes: ["class"],
      advancementTitleIncludes: "language",
      chosen: selections.chosenLanguages.map(toClassLanguageAdvancementKey),
      level: state.config.startingLevel,
      itemIdentifier: classIdentifier,
      includeConfigurationGrants: true,
    });
    if (!appliedLanguageAdvancement) {
      await applyTraitAdvancementSelection(actor, {
        itemTypes: ["class"],
        advancementTitleIncludes: "cant",
        chosen: selections.chosenLanguages.map(toClassLanguageAdvancementKey),
        level: state.config.startingLevel,
        itemIdentifier: classIdentifier,
        includeConfigurationGrants: true,
      });
    }
  }

  if (selections.chosenTools.length > 0) {
    await applyTraitAdvancementSelection(actor, {
      itemTypes: ["class"],
      advancementTitleIncludes: "tool",
      chosen: prefixTraitKeys(selections.chosenTools, "tool"),
      level: state.config.startingLevel,
      itemIdentifier: classIdentifier,
      includeConfigurationGrants: true,
    });
  }

  const selectedItemUuids = Object.values(selections.itemChoices).flat().filter((value): value is string => typeof value === "string" && value.length > 0);
  if (selectedItemUuids.length > 0) {
    await grantItemsByUuid(actor, [...new Set(selectedItemUuids)]);
  }
}

async function applyWeaponMasteries(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const chosenMasteries = state.selections.weaponMasteries?.chosenWeaponMasteries ?? [];
  if (chosenMasteries.length === 0) return;

  const classItem = findActorItemWithAdvancement(actor, ["class"], state.selections.class?.identifier);
  let appliedViaAdvancement = false;

  if (classItem && Array.isArray(classItem.system?.advancement)) {
    const masteryAdvancements = classItem.system.advancement
      .filter((entry) =>
        entry.type === "Trait"
        && (entry.title ?? "").toLowerCase() === "weapon mastery"
        && entry.configuration?.mode === "mastery"
        && typeof entry.apply === "function"
        && (typeof entry.level !== "number" || entry.level <= state.config.startingLevel)
      )
      .sort((left, right) => (left.level ?? 0) - (right.level ?? 0));

    const remaining = [...chosenMasteries];
    for (const advancement of masteryAdvancements) {
      const count = getTraitAdvancementChoiceCount(advancement);
      if (count <= 0 || remaining.length === 0) continue;
      const chunk = remaining.splice(0, count);
      if (chunk.length === 0) continue;
      const chosenKeys = new Set(chunk.map((id) => id.startsWith("weapon:") ? id : `weapon:${id}`));
      await advancement.apply?.(advancement.level ?? 1, {
        chosen: chosenKeys,
      });
      syncAdvancementChosenKeys(advancement, chosenKeys);
      appliedViaAdvancement = true;
    }

    if (appliedViaAdvancement) {
      await persistAdvancementSelections(classItem);
    }
  }

  await actor.update({
    "system.traits.weaponProf.mastery.value": chosenMasteries,
  });
  Log.debug(`ActorCreationEngine: Applied ${chosenMasteries.length} weapon masteries${appliedViaAdvancement ? " via advancements and actor traits" : ""}`);
}

async function applyFinalHitPoints(
  actor: FoundryDocument,
  state: WizardState,
): Promise<void> {
  const hitDie = await getClassHitDie(state.selections.class?.uuid);
  const finalLevel = Math.max(1, state.config.startingLevel);
  const finalConModifier = Math.floor((buildSelectedAbilityScores(state.selections).con - 10) / 2);
  const dieSize = Number.parseInt(hitDie.replace("d", ""), 10);
  const safeDieSize = Number.isNaN(dieSize) ? 8 : dieSize;
  const level1Base = state.config.level1HpMethod === "roll" ? 1 : safeDieSize;
  const laterLevelsBase = Math.max(0, finalLevel - 1) * averageHpForHitDie(hitDie);
  const maxHitPoints = Math.max(1, level1Base + laterLevelsBase + (finalConModifier * finalLevel));

  await actor.update({
    "system.attributes.hp.max": maxHitPoints,
    "system.attributes.hp.value": maxHitPoints,
  });
  Log.debug("ActorCreationEngine: Reapplied final hit points", {
    finalLevel,
    hitDie,
    maxHitPoints,
  });
}

interface TraitAdvancementSelectionOptions {
  itemTypes: string[];
  advancementTitleIncludes: string;
  chosen: string[];
  level: number;
  itemIdentifier?: string;
  includeConfigurationGrants?: boolean;
}

async function applyTraitAdvancementSelection(
  actor: FoundryDocument,
  options: TraitAdvancementSelectionOptions,
): Promise<boolean> {
  const item = findActorItemWithAdvancement(actor, options.itemTypes, options.itemIdentifier);
  if (!item) return false;

  const advancement = item.system?.advancement?.find((entry) =>
    entry.type === "Trait"
    && (entry.title ?? "").toLowerCase().includes(options.advancementTitleIncludes.toLowerCase())
    && typeof entry.apply === "function"
  );

  if (!advancement) return false;

  const chosen = new Set(options.chosen);
  if (options.includeConfigurationGrants) {
    for (const grant of getAdvancementGrantKeys(advancement)) {
      chosen.add(grant);
    }
  }

  if (chosen.size === 0) return false;

  await advancement.apply?.(options.level, { chosen });
  syncAdvancementChosenKeys(advancement, chosen);
  await persistAdvancementSelections(item);
  return true;
}

function findActorItemWithAdvancement(
  actor: FoundryDocument,
  itemTypes: string[],
  itemIdentifier?: string,
): ItemWithAdvancementLike | undefined {
  const items = Array.from(actor.items as Iterable<unknown>) as ItemWithAdvancementLike[];
  return items.find((item) => {
    if (!itemTypes.includes(item.type ?? "")) return false;
    if (itemIdentifier && item.system?.identifier && item.system.identifier !== itemIdentifier) {
      return false;
    }
    return Array.isArray(item.system?.advancement);
  });
}

async function persistAdvancementSelections(item: ItemWithAdvancementLike): Promise<void> {
  const advancements = item.system?.advancement;
  if (!Array.isArray(advancements)) return;

  const serialized = advancements.map((entry) => entry.toObject ? entry.toObject() : entry);
  await item.update({ "system.advancement": serialized });
}

function prefixTraitKeys(values: string[], prefix: string): string[] {
  const chosen = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    chosen.add(value.startsWith(`${prefix}:`) ? value : `${prefix}:${value}`);
  }
  return Array.from(chosen);
}

function getAdvancementGrantKeys(advancement: TraitAdvancementLike): string[] {
  const grants = advancement.configuration?.grants;
  if (Array.isArray(grants)) return [...grants];
  if (grants instanceof Set) return Array.from(grants);
  return [];
}

function getTraitAdvancementChoiceCount(advancement: TraitAdvancementLike): number {
  const choices = Array.isArray(advancement.configuration?.choices)
    ? advancement.configuration?.choices ?? []
    : [];
  return choices.reduce((sum, choice) => sum + (typeof choice.count === "number" ? choice.count : 0), 0);
}

function syncAdvancementChosenKeys(
  advancement: TraitAdvancementLike,
  chosen: ReadonlySet<string>,
): void {
  const serialized = [...chosen];

  if (advancement.value?.chosen instanceof Set) {
    advancement.value.chosen = new Set(serialized);
  } else if (Array.isArray(advancement.value?.chosen)) {
    advancement.value.chosen = [...serialized];
  } else if (advancement.value && typeof advancement.value === "object") {
    advancement.value.chosen = [...serialized];
  } else {
    advancement.value = { chosen: [...serialized] };
  }

  if (typeof advancement.updateSource === "function") {
    try {
      advancement.updateSource({ "value.chosen": serialized });
    } catch {
      advancement.updateSource({ value: { chosen: serialized } });
    }
  } else if (advancement._source && typeof advancement._source === "object") {
    if (!advancement._source.value || typeof advancement._source.value !== "object") {
      advancement._source.value = {};
    }
    advancement._source.value.chosen = [...serialized];
  }
}

async function grantItemsByUuid(
  actor: FoundryDocument,
  uuids: string[],
): Promise<void> {
  const items: Record<string, unknown>[] = [];

  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (!doc) continue;

    const obj = doc.toObject();
    delete obj._id;
    items.push(obj);
  }

  if (items.length === 0) return;
  await actor.createEmbeddedDocuments("Item", items);
}

/* ── Step 8: Portrait Upload ─────────────────────────────── */

async function applyPortrait(
  actor: FoundryDocument,
  portrait: PortraitSelection | undefined,
  characterName: string,
): Promise<void> {
  if (!portrait?.portraitDataUrl) return;

  // If it's already a file path (uploaded via FilePicker), update the actor img
  if (!portrait.portraitDataUrl.startsWith("data:")) {
    await actor.update({ img: portrait.portraitDataUrl });
    if (portrait.tokenDataUrl && !portrait.tokenDataUrl.startsWith("data:")) {
      await actor.update({ "prototypeToken.texture.src": portrait.tokenDataUrl });
    }
    return;
  }

  // Convert data URL to a File for upload
  try {
    const blob = dataUrlToBlob(portrait.portraitDataUrl);
    if (!blob) return;

    const safeName = characterName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    const fileName = `${safeName}-portrait.webp`;
    const file = new File([blob], fileName, { type: "image/webp" });

    // Upload via Foundry's FilePicker
    const FP = getFilePicker();
    if (!FP?.upload) {
      Log.warn("ActorCreationEngine: FilePicker.upload not available");
      return;
    }

    const result = await FP.upload("data", "portraits", file, {});
    const uploadedPath = result?.path;
    if (uploadedPath) {
      await actor.update({
        img: uploadedPath,
        "prototypeToken.texture.src": uploadedPath,
      });
      Log.info(`ActorCreationEngine: Portrait uploaded to ${uploadedPath}`);
    }
  } catch (err) {
    // Not critical — portrait can be set manually later
    Log.warn("ActorCreationEngine: Failed to upload portrait", err);
  }
}

/* ── Step 9: Set Ownership ───────────────────────────────── */

async function setOwnership(actor: FoundryDocument): Promise<void> {
  const userId = getGame()?.userId as string | undefined;
  if (userId) {
    await actor.update({ [`ownership.${userId}`]: 3 }); // OWNER level
    Log.debug(`ActorCreationEngine: Set OWNER permission for user ${userId}`);
  }
}

/* ── Step 8: Notify GM ───────────────────────────────────── */

function notifyGMCharacterCreated(characterName: string, actorId: string): void {
  try {
    const game = getGame();
    if (!game) return;

    const userName = game.user?.name ?? "A player";

    // Socket emit for GM notification
    const socket = getGameSocket(game);
    socket?.emit?.(`module.${MOD}`, {
      action: "characterCreated",
      characterName,
      actorId,
      userName,
    });

    // Also show a local notification (for the creating player)
    const ui = getUI();
    ui?.notifications?.info?.(`${characterName} has been created!`);
  } catch {
    // Non-critical — don't let notification failure block creation
  }
}

/* ── Utilities ───────────────────────────────────────────── */

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, base64] = dataUrl.split(",");
    if (!header || !base64) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] ?? "image/webp";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function getActorDocumentClass(
  actors: unknown,
): ActorCollectionWithClass["documentClass"] | undefined {
  if (!actors || typeof actors !== "object") return undefined;
  return (actors as ActorCollectionWithClass).documentClass;
}

function getFilePicker(): FilePickerLike | undefined {
  const g = globalThis as Record<string, unknown>;
  const filePicker = g.FilePicker;
  if (!filePicker || typeof filePicker !== "object") return undefined;
  return filePicker as FilePickerLike;
}

function getGameSocket(game: unknown): GameSocketLike | undefined {
  if (!game || typeof game !== "object") return undefined;
  return (game as { socket?: GameSocketLike }).socket;
}
