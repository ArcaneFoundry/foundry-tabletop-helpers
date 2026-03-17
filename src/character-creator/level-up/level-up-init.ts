/**
 * Level-Up Manager — Init Orchestrator
 *
 * Registers hooks for level-up button injection and template preloading.
 */

import { MOD } from "../../logger";
import type { FoundryDocument, FoundryHooks } from "../../types";
import { getGame, getHooks, isDnd5eWorld, loadTemplates } from "../../types";
import { ccEnabled, ccLevelUpEnabled } from "../character-creator-settings";
import { buildLevelUpAppClass, openLevelUpWizard } from "./level-up-app";
import { shouldShowLevelUp } from "./level-up-detection";

export { openLevelUpWizard } from "./level-up-app";

interface ActorLike extends FoundryDocument {
  type?: string;
}

interface ActorSheetLike {
  document?: ActorLike;
  actor?: ActorLike;
}

interface HeaderHost {
  querySelector(selector: string): ElementLike | null;
  appendChild(child: ElementLike): void;
  insertBefore(child: ElementLike, reference: ElementLike | null): void;
}

interface ElementLike {
  className?: string;
  type?: string;
  title?: string;
  innerHTML?: string;
  querySelector(selector: string): ElementLike | null;
  appendChild?(child: ElementLike): void;
  insertBefore?(child: ElementLike, reference: ElementLike | null): void;
  addEventListener(event: string, listener: (event: EventLike) => void): void;
}

interface EventLike {
  preventDefault(): void;
  stopPropagation(): void;
}

interface HtmlWrapperLike {
  querySelector?(selector: string): HeaderHost | null;
  0?: {
    querySelector?(selector: string): HeaderHost | null;
  };
}

interface DirectoryEntryLike {
  dataset?: {
    documentId?: string;
  };
  0?: {
    dataset?: {
      documentId?: string;
    };
  };
}

interface DirectoryContextOption {
  name: string;
  icon: string;
  condition: (li: DirectoryEntryLike) => boolean;
  callback: (li: DirectoryEntryLike) => void;
}

/* ── Hook Registration ───────────────────────────────────── */

export function registerLevelUpHooks(): void {
  // Build the LevelUpApp class
  buildLevelUpAppClass();

  // Preload level-up templates
  loadTemplates([
    `modules/${MOD}/templates/character-creator/lu-step-class-choice.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-hp.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-features.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-spells.hbs`,
    `modules/${MOD}/templates/character-creator/lu-step-review.hbs`,
  ]);

  registerLevelUpSheetHook(getHooks());
  registerLevelUpDirectoryHook(getHooks());
}

/* ── Ready Phase ─────────────────────────────────────────── */

export function initLevelUpReady(): void {
  // Nothing needed at ready time currently
}

function registerLevelUpSheetHook(hooks: FoundryHooks | undefined): void {
  hooks?.on?.("renderActorSheet", onRenderActorSheet);
}

function registerLevelUpDirectoryHook(hooks: FoundryHooks | undefined): void {
  hooks?.on?.("getActorDirectoryEntryContext", onGetActorDirectoryEntryContext);
}

function onRenderActorSheet(app: ActorSheetLike, html: HtmlWrapperLike): void {
  if (!ccEnabled() || !ccLevelUpEnabled() || !isDnd5eWorld()) return;

  const actor = app.document ?? app.actor;
  if (!actor || actor.type !== "character") return;
  if (!shouldShowLevelUp(actor)) return;

  const header = getSheetHeader(html);
  if (!header) return;
  if (header.querySelector(".fth-level-up-btn")) return;

  const button = createLevelUpButton(actor);
  const closeBtn = header.querySelector(".header-control.close, [data-action='close']");
  if (closeBtn) {
    header.insertBefore(button, closeBtn);
  } else {
    header.appendChild(button);
  }
}

function onGetActorDirectoryEntryContext(_html: unknown, options: DirectoryContextOption[]): void {
  if (!ccEnabled() || !ccLevelUpEnabled() || !isDnd5eWorld()) return;

  options.push({
    name: "Level Up",
    icon: '<i class="fa-solid fa-arrow-up"></i>',
    condition: (li) => {
      const actorId = getDirectoryEntryActorId(li);
      if (!actorId) return false;
      const actor = getGame()?.actors?.get(actorId);
      if (!actor) return false;
      return shouldShowLevelUp(actor);
    },
    callback: (li) => {
      const actorId = getDirectoryEntryActorId(li);
      if (actorId) openLevelUpWizard(actorId);
    },
  });
}

function getSheetHeader(html: HtmlWrapperLike): HeaderHost | null {
  if (typeof html?.querySelector === "function") {
    return html.querySelector(".window-header, header");
  }
  return html?.[0]?.querySelector?.(".window-header, header") ?? null;
}

function createLevelUpButton(actor: ActorLike): ElementLike {
  const btn = document.createElement("button") as unknown as ElementLike;
  btn.type = "button";
  btn.className = "fth-level-up-btn";
  btn.title = "Level Up!";
  btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> Level Up!';
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openLevelUpWizard(actor.id);
  });
  return btn;
}

function getDirectoryEntryActorId(li: DirectoryEntryLike): string | undefined {
  return li?.dataset?.documentId ?? li?.[0]?.dataset?.documentId;
}

export const __levelUpInitInternals = {
  onRenderActorSheet,
  onGetActorDirectoryEntryContext,
};
