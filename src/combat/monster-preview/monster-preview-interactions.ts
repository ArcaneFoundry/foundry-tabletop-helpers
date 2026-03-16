interface MonsterPreviewInlineListenerOptions {
  onDismiss: () => void;
  onPopout: () => void;
  onTogglePin: () => void;
  onOpenActor: (actorId: string) => void;
  onRunQuickAction: (action: MonsterPreviewQuickAction) => void;
}

interface MonsterPreviewFloatingListenerOptions {
  onDismiss: () => void;
  onDock: () => void;
  onTogglePin: () => void;
  onResetLayout: () => void;
  onToggleMinimize: () => void;
  onOpenActor: (actorId: string) => void;
  onRunQuickAction: (action: MonsterPreviewQuickAction) => void;
}

export interface MonsterPreviewQuickAction {
  action: string;
  actorId: string;
  ability?: string;
  skill?: string;
}

export function attachMonsterPreviewInlineListeners(
  el: HTMLElement,
  options: MonsterPreviewInlineListenerOptions,
): void {
  el.querySelector(".mp-close")?.addEventListener("click", options.onDismiss);
  el.querySelector(".mp-pin")?.addEventListener("click", options.onTogglePin);
  el.querySelector(".mp-popout")?.addEventListener("click", options.onPopout);
  attachActorOpenListeners(el, options.onOpenActor);
  attachQuickActionListeners(el, options.onRunQuickAction);
}

export function attachMonsterPreviewFloatingListeners(
  el: HTMLElement,
  options: MonsterPreviewFloatingListenerOptions,
): void {
  el.querySelector(".mp-close")?.addEventListener("click", options.onDismiss);
  el.querySelector(".mp-pin")?.addEventListener("click", options.onTogglePin);
  el.querySelector(".mp-dock")?.addEventListener("click", options.onDock);
  el.querySelector(".mp-reset-layout")?.addEventListener("click", options.onResetLayout);
  el.querySelector(".mp-minimize, .mp-expand")?.addEventListener("click", options.onToggleMinimize);
  attachActorOpenListeners(el, options.onOpenActor);
  attachQuickActionListeners(el, options.onRunQuickAction);
}

function attachActorOpenListeners(el: HTMLElement, onOpenActor: (actorId: string) => void): void {
  el.querySelectorAll<HTMLElement>(".mp-open-actor").forEach((target) => {
    target.addEventListener("click", () => {
      const actorId = target.dataset.actorId;
      if (actorId) onOpenActor(actorId);
    });
  });
}

function attachQuickActionListeners(
  el: HTMLElement,
  onRunQuickAction: (action: MonsterPreviewQuickAction) => void,
): void {
  el.querySelectorAll<HTMLElement>(".mp-quick-action").forEach((target) => {
    target.addEventListener("click", () => {
      const actorId = target.dataset.actorId;
      const action = target.dataset.mpAction;
      if (!actorId || !action) return;
      onRunQuickAction({
        action,
        actorId,
        ability: target.dataset.ability,
        skill: target.dataset.skill,
      });
    });
  });
}
