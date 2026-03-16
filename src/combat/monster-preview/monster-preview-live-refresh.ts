import { getGame } from "../../types";

interface ActorLike {
  id?: string;
  type?: string;
}

interface ActiveEffectLike {
  parent?: ActorLike | null;
}

interface CombatLike {
  combatant?: {
    actor?: ActorLike | null;
  } | null;
}

interface MonsterPreviewLiveRefreshOptions {
  getCurrentActorId: () => string | null;
  isDismissed: () => boolean;
  hasCachedContent: () => boolean;
  isEnabled: () => boolean;
  refreshActiveActorPreview: (actor: ActorLike, combat: CombatLike) => Promise<void>;
  debounceMs?: number;
}

export interface MonsterPreviewLiveRefreshController {
  handleActorUpdate: (actor: ActorLike | null | undefined) => void;
  handleEffectChange: (effect: ActiveEffectLike | null | undefined) => void;
}

export function createMonsterPreviewLiveRefreshController(
  options: MonsterPreviewLiveRefreshOptions,
): MonsterPreviewLiveRefreshController {
  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingActorId: string | null = null;

  function scheduleRefresh(actor: ActorLike | null | undefined): void {
    if (!shouldRefreshMonsterPreviewActor(actor, options)) return;

    pendingActorId = actor?.id ?? null;
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      updateTimer = null;
      void flushRefresh();
    }, options.debounceMs ?? 100);
  }

  async function flushRefresh(): Promise<void> {
    if (!pendingActorId) return;

    const actorId = pendingActorId;
    pendingActorId = null;

    const game = getGame() as { combat?: CombatLike } | undefined;
    const combat = game?.combat;
    const activeActor = combat?.combatant?.actor;
    if (!combat || !activeActor || activeActor.id !== actorId || activeActor.type !== "npc") return;

    await options.refreshActiveActorPreview(activeActor, combat);
  }

  return {
    handleActorUpdate: scheduleRefresh,
    handleEffectChange: (effect) => scheduleRefresh(effect?.parent),
  };
}

export function shouldRefreshMonsterPreviewActor(
  actor: ActorLike | null | undefined,
  options: Pick<
    MonsterPreviewLiveRefreshOptions,
    "getCurrentActorId" | "isDismissed" | "hasCachedContent" | "isEnabled"
  >,
): boolean {
  if (!options.isEnabled()) return false;
  if (options.isDismissed()) return false;
  if (!options.hasCachedContent()) return false;
  if (!actor || actor.type !== "npc" || !actor.id) return false;
  return actor.id === options.getCurrentActorId();
}
