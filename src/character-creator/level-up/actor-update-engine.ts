/**
 * Level-Up Manager — Actor Update Engine
 *
 * Applies level-up selections to an existing actor.
 * Unlike ActorCreationEngine, this updates — not creates.
 */

import { Log } from "../../logger";
import { getGame, fromUuid } from "../../types";
import type { FoundryDocument } from "../../types";
import type { LevelUpState, LevelUpClassChoice } from "./level-up-types";
import {
  buildAsiUpdatePayload,
  buildClassLevelUpdatePayload,
  buildHpUpdatePayload,
  collectLevelUpItemOperations,
  describeClassLevelTarget,
  prepareMulticlassItemData,
  resolveSpellsToDelete,
} from "./actor-update-engine-helpers";
import { resolveGrantedFeaturesForDocument } from "./level-up-feature-helpers";

interface ActorItemLike {
  id?: string;
  name?: string;
  type?: string;
  system?: {
    levels?: number;
    classIdentifier?: string;
    identifier?: string;
  };
  update(data: Record<string, unknown>): Promise<unknown>;
}

interface ActorItemCollectionLike extends Iterable<ActorItemLike> {
  get?(id: string): ActorItemLike | null | undefined;
}

interface ActorUpdateTarget extends FoundryDocument {
  items?: ActorItemCollectionLike;
  system?: {
    attributes?: {
      hp?: {
        value?: number;
        max?: number;
      };
    };
    abilities?: Record<string, { value?: number }>;
  } & Record<string, unknown>;
  update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<FoundryDocument>;
  createEmbeddedDocuments(type: string, data: Record<string, unknown>[], options?: Record<string, unknown>): Promise<FoundryDocument[]>;
  deleteEmbeddedDocuments?(type: string, ids: string[], options?: Record<string, unknown>): Promise<unknown>;
}

interface CompendiumDocumentLike {
  name?: string;
  type?: string;
  system?: {
    identifier?: string;
  };
  toObject(): Record<string, unknown>;
}

/* ── Public API ──────────────────────────────────────────── */

/**
 * Apply level-up changes to an existing actor.
 * Returns true on success.
 */
export async function applyLevelUp(state: LevelUpState): Promise<boolean> {
  const actor = getActorById(state.actorId);
  if (!actor) {
    Log.error("ActorUpdateEngine: Actor not found", { actorId: state.actorId });
    return false;
  }

  const sel = state.selections;
  const itemOps = collectLevelUpItemOperations(state);
  const featureGrantUuids = new Set(itemOps.featureUuids);

  try {
    // 1. Update class levels
    await updateClassLevels(actor, sel.classChoice, state.targetLevel);

    // 2. Update HP
    if (sel.hp) {
      await updateHp(actor, sel.hp.hpGained);
    }

    // 3. Add class feature grants that come from the new class item itself
    if (sel.classChoice?.mode === "multiclass" && sel.classChoice.newClassUuid) {
      const classFeatures = await resolveGrantedFeaturesForDocument(sel.classChoice.newClassUuid, { level: 1 });
      for (const feature of classFeatures) featureGrantUuids.add(feature.uuid);
    }

    // 4. Grant subclass
    if (sel.subclass?.uuid) {
      const subclassAlreadyPresent = hasMatchingSubclass(actor, sel.subclass.name, sel.classChoice?.classIdentifier);
      if (!subclassAlreadyPresent) {
        await grantItems(actor, [sel.subclass.uuid]);
      }

      const subclassFeatures = await resolveGrantedFeaturesForDocument(sel.subclass.uuid, { level: state.targetLevel });
      for (const feature of subclassFeatures) featureGrantUuids.add(feature.uuid);
    } else if (itemOps.subclassUuids.length > 0) {
      await grantItems(actor, itemOps.subclassUuids);
    }

    // 5. Grant features
    if (featureGrantUuids.size > 0) {
      await grantItems(actor, [...featureGrantUuids]);
    }

    // 6. Apply ASI or grant feat
    if (sel.feats) {
      if (sel.feats.choice === "asi" && sel.feats.asiAbilities) {
        await applyAsi(actor, sel.feats.asiAbilities);
      } else if (itemOps.featUuids.length > 0) {
        await grantItems(actor, itemOps.featUuids);
      }
    }

    // 7. Grant new spells
    if (itemOps.spellGrantUuids.length > 0) {
      await grantItems(actor, itemOps.spellGrantUuids);
    }

    if (itemOps.swappedOutSpellUuids.length > 0) {
      await removeSpells(actor, itemOps.swappedOutSpellUuids);
    }

    Log.info(`ActorUpdateEngine: Level-up complete for "${actor.name}" → Level ${state.targetLevel}`);
    return true;
  } catch (err) {
    Log.error("ActorUpdateEngine: Failed to apply level-up", err);
    return false;
  }
}

function hasMatchingSubclass(
  actor: ActorUpdateTarget,
  subclassName: string | undefined,
  classIdentifier: string | undefined,
): boolean {
  if (!subclassName) return false;
  const normalizedName = subclassName.toLowerCase();

  for (const item of actor.items ?? []) {
    if (item.type !== "subclass") continue;
    if ((item.name ?? "").toLowerCase() !== normalizedName) continue;
    if (!classIdentifier || item.system?.classIdentifier === classIdentifier) {
      return true;
    }
  }

  return false;
}

/* ── Internal Helpers ────────────────────────────────────── */

function getActorById(id: string): ActorUpdateTarget | null {
  const game = getGame();
  if (!game?.actors) return null;
  return (game.actors.get(id) as ActorUpdateTarget | undefined) ?? null;
}

/**
 * Update class item levels (or add new class for multiclass).
 */
async function updateClassLevels(
  actor: ActorUpdateTarget,
  classChoice?: LevelUpClassChoice,
  targetLevel?: number,
): Promise<void> {
  if (!classChoice) return;

  if (classChoice.mode === "existing" && classChoice.classItemId) {
    // Increment levels on existing class item
    const classItem = actor.items?.get?.(classChoice.classItemId) ?? null;
    if (classItem) {
      const currentLevels = classItem.system?.levels ?? 0;
      const desiredLevel = targetLevel ?? (currentLevels + 1);
      await classItem.update(buildClassLevelUpdatePayload(desiredLevel));
      const description = describeClassLevelTarget(classChoice, currentLevels);
      if (description) Log.debug(`ActorUpdateEngine: ${description}`);
    }
  } else if (classChoice.mode === "multiclass" && classChoice.newClassUuid) {
    // Add new class item from compendium
    const doc = await getCompendiumDocument(classChoice.newClassUuid);
    if (doc) {
      const obj = prepareMulticlassItemData(doc.toObject());
      await actor.createEmbeddedDocuments("Item", [obj]);
      const description = describeClassLevelTarget(classChoice, 0);
      if (description) Log.debug(`ActorUpdateEngine: ${description}`);
    }
  }
}

/**
 * Update actor HP (add hpGained to max and current).
 */
async function updateHp(actor: ActorUpdateTarget, hpGained: number): Promise<void> {
  const hp = actor.system?.attributes?.hp;
  const updates = buildHpUpdatePayload(hp, hpGained);
  await actor.update(updates);
  Log.debug(`ActorUpdateEngine: HP ${(hp?.max ?? 0)} → ${updates["system.attributes.hp.max"]}`);
}

/**
 * Grant items from compendium UUIDs.
 */
async function grantItems(actor: ActorUpdateTarget, uuids: string[]): Promise<void> {
  const items: Record<string, unknown>[] = [];
  for (const uuid of uuids) {
    const doc = await getCompendiumDocument(uuid);
    if (doc) {
      if (actorAlreadyHasGrantedItem(actor, doc)) continue;
      const obj = doc.toObject();
      delete obj._id;
      items.push(obj);
    }
  }
  if (items.length > 0) {
    await actor.createEmbeddedDocuments("Item", items);
    Log.debug(`ActorUpdateEngine: Granted ${items.length} items`);
  }
}

function actorAlreadyHasGrantedItem(
  actor: ActorUpdateTarget,
  doc: CompendiumDocumentLike,
): boolean {
  const obj = doc.toObject();
  const docType = typeof obj.type === "string"
    ? obj.type
    : typeof doc.type === "string"
      ? doc.type
      : undefined;
  const docName = typeof obj.name === "string"
    ? obj.name.trim().toLowerCase()
    : typeof doc.name === "string"
      ? doc.name.trim().toLowerCase()
      : "";
  const system = typeof obj.system === "object" && obj.system !== null
    ? obj.system as Record<string, unknown>
    : typeof doc.system === "object" && doc.system !== null
      ? doc.system as Record<string, unknown>
      : {};
  const identifier = typeof system.identifier === "string"
    ? system.identifier.trim().toLowerCase()
    : "";

  for (const item of actor.items ?? []) {
    if (docType && item.type && item.type !== docType) continue;

    const itemIdentifier = typeof item.system?.identifier === "string"
      ? item.system.identifier.trim().toLowerCase()
      : "";
    if (identifier && itemIdentifier === identifier) return true;

    const itemName = typeof item.name === "string" ? item.name.trim().toLowerCase() : "";
    if (docName && itemName === docName) return true;
  }

  return false;
}

/**
 * Apply Ability Score Improvement.
 * If 1 ability selected: +2. If 2 abilities: +1 each.
 */
async function applyAsi(actor: ActorUpdateTarget, abilities: string[]): Promise<void> {
  const updates = buildAsiUpdatePayload(actor.system?.abilities, abilities);

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
    Log.debug(`ActorUpdateEngine: Applied ASI`, updates);
  }
}

/**
 * Remove spells that were swapped out.
 * Finds spells on the actor by matching name against compendium originals.
 */
async function removeSpells(actor: ActorUpdateTarget, uuids: string[]): Promise<void> {
  // Resolve the names of spells to remove
  const namesToRemove = new Set<string>();
  for (const uuid of uuids) {
    const doc = await getCompendiumDocument(uuid);
    if (doc?.name) namesToRemove.add(doc.name);
  }

  if (namesToRemove.size === 0) return;

  // Find matching items on the actor
  const items = actor.items;
  if (!items) return;
  const idsToDelete = resolveSpellsToDelete(items, namesToRemove);

  if (idsToDelete.length > 0) {
    await actor.deleteEmbeddedDocuments?.("Item", idsToDelete);
    Log.debug(`ActorUpdateEngine: Removed ${idsToDelete.length} swapped-out spells`);
  }
}

async function getCompendiumDocument(uuid: string): Promise<CompendiumDocumentLike | null> {
  return await fromUuid(uuid) as CompendiumDocumentLike | null;
}
