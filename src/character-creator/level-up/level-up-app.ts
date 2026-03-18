/**
 * Level-Up Manager — Main Application
 *
 * ApplicationV2 (HandlebarsApplicationMixin) that reuses the wizard shell
 * for the level-up workflow.
 */

import { MOD, Log } from "../../logger";
import { getGame, renderTemplate } from "../../types";
import type { FoundryDocument } from "../../types";
import { LevelUpStateMachine } from "./level-up-state-machine";
import { applyLevelUp } from "./actor-update-engine";
import { shouldShowLevelUp } from "./level-up-detection";
import { getStepAtmosphere } from "../wizard/step-registry";
import {
  allowMulticlass as getAllowMulticlass,
  ccLevelUpEnabled,
} from "../character-creator-settings";
import {
  activateLevelUpStep,
  applyLevelUpAtmosphere,
  buildLevelUpShellContext,
  createLevelUpStepCallbacks,
  type LevelUpShellContext,
  resetApplyLevelUpButton,
  setApplyLevelUpButtonPending,
  updateLevelUpWindowTitle,
} from "./level-up-app-helpers";

// Level-up step definitions
import { createClassChoiceStep } from "./steps/lu-step-class-choice";
import { createHpStep } from "./steps/lu-step-hp";
import { createFeaturesStep } from "./steps/lu-step-features";
import { createLuSubclassStep } from "./steps/lu-step-subclass";
import { createLuFeatsStep } from "./steps/lu-step-feats";
import { createLuSpellsStep } from "./steps/lu-step-spells";
import { createLuReviewStep } from "./steps/lu-step-review";
import type { LevelUpStepDef } from "./steps/lu-step-class-choice";

/* ── Runtime Foundry Class Resolution ────────────────────── */

interface RuntimeApplicationBase {
  element?: Element | null;
  title?: string;
  render(options?: Record<string, unknown>): void;
  close(options?: unknown): Promise<void>;
  _preparePartContext?(partId: string, context: unknown, options: unknown): Promise<unknown>;
}

interface RuntimeApplicationClass {
  new (): RuntimeApplicationBase;
}

type RuntimeHandlebarsApplicationMixin = (base: RuntimeApplicationClass) => RuntimeApplicationClass;

interface RuntimeFoundryAppClasses {
  HandlebarsApplicationMixin?: RuntimeHandlebarsApplicationMixin;
  ApplicationV2?: RuntimeApplicationClass;
}

interface LevelUpAppActorLike extends FoundryDocument {
  id: string;
}

interface ActorCollectionLike {
  get(id: string): LevelUpAppActorLike | null | undefined;
}

const getFoundryAppClasses = () => {
  const g = globalThis as Record<string, unknown>;
  const api = (g.foundry as Record<string, unknown> | undefined)
    ?.applications as Record<string, unknown> | undefined;
  const appApi = api?.api as Record<string, unknown> | undefined;
  return {
    HandlebarsApplicationMixin: appApi?.HandlebarsApplicationMixin as RuntimeHandlebarsApplicationMixin | undefined,
    ApplicationV2: appApi?.ApplicationV2 as RuntimeApplicationClass | undefined,
  } satisfies RuntimeFoundryAppClasses;
};

/* ── Module-Level State ──────────────────────────────────── */

let _LevelUpAppClass: RuntimeApplicationClass | null = null;

/** Registry of level-up step definitions. */
const LEVEL_UP_STEPS: LevelUpStepDef[] = [];

function registerLevelUpSteps(): void {
  if (LEVEL_UP_STEPS.length > 0) return;
  LEVEL_UP_STEPS.push(
    createClassChoiceStep(),
    createHpStep(),
    createFeaturesStep(),
    createLuSubclassStep(),
    createLuFeatsStep(),
    createLuSpellsStep(),
    createLuReviewStep(),
  );
}

/* ── Public API ──────────────────────────────────────────── */

/**
 * Build the LevelUpApp class at runtime.
 * Call during the `init` hook.
 */
export function buildLevelUpAppClass(): void {
  const { HandlebarsApplicationMixin, ApplicationV2 } = getFoundryAppClasses();

  if (typeof HandlebarsApplicationMixin !== "function" || typeof ApplicationV2 !== "function") {
    Log.warn("Level-Up Manager: ApplicationV2 not available — disabled");
    return;
  }

  registerLevelUpSteps();

  const Base = HandlebarsApplicationMixin(ApplicationV2);

  class LevelUpApp extends Base {

    /* ── Instance State ──────────────────────────────── */

    private _machine: LevelUpStateMachine | null = null;
    private _actorId: string = "";

    /* ── Static Configuration ────────────────────────── */

    static DEFAULT_OPTIONS = {
      id: "fth-level-up-wizard",
      classes: ["fth-character-creator", "fth-cc-wizard", "fth-level-up"],
      tag: "div",
      window: {
        resizable: true,
        icon: "fa-solid fa-arrow-up",
        title: "Level Up",
      },
      position: { width: 780, height: 580 },
      actions: {
        goNext: LevelUpApp._onGoNext,
        goBack: LevelUpApp._onGoBack,
        jumpToStep: LevelUpApp._onJumpToStep,
        applyLevelUp: LevelUpApp._onApplyLevelUp,
      },
    };

    static PARTS = {
      shell: {
        template: `modules/${MOD}/templates/character-creator/cc-shell.hbs`,
        scrollable: [".cc-step-content"],
      },
    };

    /* ── Constructor ─────────────────────────────────── */

    setActor(actorId: string): void {
      this._actorId = actorId;
    }

    /* ── Lifecycle ───────────────────────────────────── */

    private _ensureMachine(): LevelUpStateMachine {
      if (!this._machine) {
        const actor = this._getActor();
        if (!actor) {
          throw new Error("Level-Up: Actor not found");
        }
        this._machine = new LevelUpStateMachine(actor, getAllowMulticlass());
      }
      return this._machine;
    }

    private _getActor(): LevelUpAppActorLike | null {
      const game = getGame();
      const actors = game?.actors as ActorCollectionLike | undefined;
      return actors?.get(this._actorId) ?? null;
    }

    private _getStepDef(stepId: string): LevelUpStepDef | undefined {
      return LEVEL_UP_STEPS.find((s) => s.id === stepId);
    }

    /* ── Rendering ───────────────────────────────────── */

    async _prepareContext(_options: unknown): Promise<LevelUpShellContext> {
      const machine = this._ensureMachine();
      const stepId = machine.currentStepId;
      const stepDef = this._getStepDef(stepId);
      const actor = this._getActor();
      return buildLevelUpShellContext(
        machine,
        stepId,
        stepDef,
        actor,
        renderTemplate,
        getStepAtmosphere,
      );
    }

    async _preparePartContext(partId: string, context: LevelUpShellContext, options: unknown): Promise<unknown> {
      const base = await super._preparePartContext?.(partId, context, options) ?? {};
      return { ...base, ...context };
    }

    async _onRender(_context: LevelUpShellContext, _options: unknown): Promise<void> {
      const machine = this._ensureMachine();
      const stepDef = this._getStepDef(machine.currentStepId);

      const callbacks = createLevelUpStepCallbacks(machine, () => {
        this.render({ force: true });
      });

      activateLevelUpStep(stepDef, machine, this.element, callbacks);
      applyLevelUpAtmosphere(this.element, getStepAtmosphere(machine.currentStepId));
      updateLevelUpWindowTitle(this, this._getActor());
    }

    /* ── Action Handlers ─────────────────────────────── */

    static _onGoNext(this: InstanceType<typeof LevelUpApp>): void {
      const machine = this._ensureMachine();
      if (machine.goNext()) {
        this.render({ force: true });
      }
    }

    static _onGoBack(this: InstanceType<typeof LevelUpApp>): void {
      const machine = this._ensureMachine();
      if (machine.goBack()) {
        this.render({ force: true });
      }
    }

    static _onJumpToStep(this: InstanceType<typeof LevelUpApp>, _event: Event, target: HTMLElement): void {
      const stepId = target.dataset.stepId;
      if (!stepId) return;
      const machine = this._ensureMachine();
      if (!machine.isReviewStep) return;
      if (machine.jumpTo(stepId)) {
        this.render({ force: true });
      }
    }

    static async _onApplyLevelUp(this: InstanceType<typeof LevelUpApp>): Promise<void> {
      const machine = this._ensureMachine();

      const btn = getApplyLevelUpButton(this.element);
      setApplyLevelUpButtonPending(btn);

      try {
        const success = await applyLevelUp(machine.state);
        if (success) {
          Log.info("Level-Up: Changes applied successfully");
          await this.close();
        } else {
          Log.error("Level-Up: Failed to apply changes");
          resetApplyLevelUpButton(btn);
        }
      } catch (err) {
        Log.error("Level-Up: Error applying changes", err);
        resetApplyLevelUpButton(btn);
      }
    }

    /* ── Close ───────────────────────────────────────── */

    async close(options?: unknown): Promise<void> {
      this._machine = null;
      return super.close(options);
    }
  }

  _LevelUpAppClass = LevelUpApp;
  Log.debug("Level-Up Manager: LevelUpApp class built");
}

/**
 * Open the Level-Up wizard for a specific actor.
 */
export function openLevelUpWizard(actorId: string): void {
  if (!_LevelUpAppClass) {
    Log.warn("Level-Up Manager: LevelUpApp not available");
    return;
  }

  if (!ccLevelUpEnabled()) {
    Log.info("Level-Up Manager: feature disabled in settings");
    return;
  }

  // Verify the actor exists and can level up
  const game = getGame();
  const actors = game?.actors as ActorCollectionLike | undefined;
  const actor = actors?.get(actorId) ?? null;
  if (!actor) {
    Log.warn("Level-Up Manager: Actor not found", { actorId });
    return;
  }

  if (!shouldShowLevelUp(actor)) {
    Log.info("Level-Up Manager: Actor is not eligible to level up");
    return;
  }

  const app = new _LevelUpAppClass();
  (app as RuntimeApplicationBase & { setActor(actorId: string): void }).setActor(actorId);
  app.render({ force: true });
}

export function getLevelUpAppClass(): RuntimeApplicationClass | null {
  return _LevelUpAppClass;
}

function getApplyLevelUpButton(root: Element | null | undefined): HTMLButtonElement | null {
  const button = root?.querySelector("[data-action='applyLevelUp']");
  return isApplyLevelUpButtonLike(button) ? button : null;
}

function isApplyLevelUpButtonLike(value: unknown): value is HTMLButtonElement {
  return typeof HTMLButtonElement !== "undefined" && value instanceof HTMLButtonElement;
}
