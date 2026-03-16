export interface MonsterPreviewContextInfo {
  tokenName?: string;
  initiative?: string;
  roundLabel?: string;
  turnLabel?: string;
}

interface CombatLike {
  round?: number;
}

interface CombatantLike {
  name?: string;
  initiative?: number | string | null;
  token?: {
    name?: string;
  } | null;
  actor?: {
    name?: string;
  } | null;
}

export function getMonsterPreviewContextInfo(
  combatant: CombatantLike | null | undefined,
  combat?: CombatLike | null,
): MonsterPreviewContextInfo {
  const tokenName = getDistinctTokenName(combatant);
  const initiative = formatCombatantInitiative(combatant?.initiative);
  const round = typeof combat?.round === "number" && combat.round > 0 ? `Round ${combat.round}` : undefined;

  return {
    tokenName,
    initiative,
    roundLabel: round,
    turnLabel: combatant ? "Acting now" : undefined,
  };
}

function getDistinctTokenName(combatant: CombatantLike | null | undefined): string | undefined {
  const tokenName = combatant?.token?.name ?? combatant?.name;
  const actorName = combatant?.actor?.name;
  if (!tokenName) return undefined;
  if (!actorName || tokenName !== actorName) return tokenName;
  return undefined;
}

function formatCombatantInitiative(initiative: number | string | null | undefined): string | undefined {
  if (typeof initiative === "number" && Number.isFinite(initiative)) {
    return `${initiative}`;
  }
  if (typeof initiative === "string" && initiative.trim()) {
    return initiative;
  }
  return undefined;
}
