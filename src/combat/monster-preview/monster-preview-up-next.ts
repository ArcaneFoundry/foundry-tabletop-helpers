export interface UpNextInfo {
  actorId?: string;
  name: string;
  isNPC: boolean;
  ac?: number;
  hpValue?: number;
  hpMax?: number;
  cr?: string;
}

interface CombatLike {
  turn?: number;
  turns?: CombatantLike[];
}

interface CombatantLike {
  actor?: ActorLike | null;
  defeated?: boolean;
  isDefeated?: boolean;
}

interface ActorLike {
  id?: string;
  type?: string;
  name?: string;
  system?: {
    attributes?: {
      ac?: { value?: number };
      hp?: { value?: number; max?: number };
    };
    details?: {
      cr?: { toString(): string } | string | number;
    };
  };
}

export function getMonsterPreviewUpNextData(combat: CombatLike): UpNextInfo | null {
  const turns = combat.turns;
  if (!Array.isArray(turns) || turns.length <= 1) return null;

  const currentIdx = typeof combat.turn === "number" ? combat.turn : 0;
  for (let offset = 1; offset < turns.length; offset += 1) {
    const nextCombatant = turns[(currentIdx + offset) % turns.length];
    if (!nextCombatant || isDefeatedCombatant(nextCombatant)) continue;

    const nextActor = nextCombatant.actor;
    if (!nextActor) continue;

    const isNPC = nextActor.type === "npc";
    const info: UpNextInfo = {
      actorId: nextActor.id,
      name: nextActor.name ?? "Unknown",
      isNPC,
    };

    if (isNPC) {
      info.ac = nextActor.system?.attributes?.ac?.value;
      info.hpValue = nextActor.system?.attributes?.hp?.value;
      info.hpMax = nextActor.system?.attributes?.hp?.max;
      const cr = nextActor.system?.details?.cr;
      if (cr !== undefined && cr !== null) info.cr = cr.toString();
    }

    return info;
  }

  return null;
}

function isDefeatedCombatant(combatant: CombatantLike): boolean {
  return combatant.defeated === true || combatant.isDefeated === true;
}
