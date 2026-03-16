import { DND_CONDITIONS } from "../combat-types";

export interface MonsterPreviewStatusInfo {
  isDefeated: boolean;
  isConcentrating: boolean;
  conditions: Array<{ id: string; label: string }>;
}

interface ActorLike {
  system?: {
    attributes?: {
      hp?: {
        value?: number;
      };
    };
  };
  effects?: Iterable<{
    statuses?: Iterable<string>;
  }>;
}

interface CombatantLike {
  defeated?: boolean;
  isDefeated?: boolean;
}

const CONDITION_IDS = new Set(DND_CONDITIONS.map((c) => c.id));
const CONDITION_LABEL_MAP = new Map(DND_CONDITIONS.map((c) => [c.id, c.label]));

export function getMonsterPreviewStatusInfo(
  actor: ActorLike | null | undefined,
  combatant?: CombatantLike | null,
): MonsterPreviewStatusInfo {
  const hpValue = actor?.system?.attributes?.hp?.value;
  const isDefeated = combatant?.defeated === true
    || combatant?.isDefeated === true
    || (typeof hpValue === "number" && hpValue <= 0);

  const statuses = collectActorStatuses(actor);
  const isConcentrating = statuses.has("concentrating");
  const conditions: Array<{ id: string; label: string }> = [];

  for (const statusId of statuses) {
    if (statusId === "concentrating") continue;
    if (!CONDITION_IDS.has(statusId)) continue;
    conditions.push({ id: statusId, label: CONDITION_LABEL_MAP.get(statusId) ?? statusId });
  }

  return {
    isDefeated,
    isConcentrating,
    conditions,
  };
}

function collectActorStatuses(actor: ActorLike | null | undefined): Set<string> {
  const statuses = new Set<string>();
  if (!actor?.effects) return statuses;

  for (const effect of actor.effects) {
    if (!effect.statuses) continue;
    for (const statusId of effect.statuses) {
      statuses.add(statusId);
    }
  }

  return statuses;
}
