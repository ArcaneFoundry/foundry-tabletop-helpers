import { createCharacterFromWizard } from "../engine/actor-creation-engine";
import type {
  StepCallbacks,
  WizardStepRenderController,
  WizardShellContext,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { buildWizardShellContext } from "../wizard/character-creator-app-helpers";
import type { WizardStateMachine } from "../wizard/wizard-state-machine";
import { Log } from "../../logger";
import { ensureCharacterCreatorIndexesReady, ensureEquipmentShopMetadataReady, ensureOriginFeatMetadataReady } from "../character-creator-index-cache";
import { warmOriginFeatChoices } from "../steps/step-origin-choices";
import { getWeaponMasteryPackSources } from "../steps/step-weapon-masteries";

export interface CharacterCreatorWizardSnapshot {
  ready: boolean;
  shellContext: WizardShellContext | null;
  currentStepDef?: WizardStepDefinition;
  state: WizardState;
  pendingTransition: { targetStepId: string; message: string } | null;
}

interface WizardControllerOptions {
  renderTemplate: (path: string, data: Record<string, unknown>) => Promise<string>;
  getStepAtmosphere: (stepId: string) => string;
  closeWizard: () => Promise<void>;
}

interface RenderableActorLike {
  sheet?: {
    render(options?: Record<string, unknown>): void;
  };
}

export class CharacterCreatorWizardController implements WizardStepRenderController {
  private readonly _listeners = new Set<() => void>();
  private readonly _machine: WizardStateMachine;
  private readonly _options: WizardControllerOptions;
  private _shellContext: WizardShellContext | null = null;
  private _currentStepDef: WizardStepDefinition | undefined;
  private _snapshot: CharacterCreatorWizardSnapshot;
  private _activeStepElement: HTMLElement | null = null;
  private _renderRequestId = 0;
  private _destroyed = false;
  private _pendingTransition: { targetStepId: string; message: string } | null = null;

  constructor(machine: WizardStateMachine, options: WizardControllerOptions) {
    this._machine = machine;
    this._options = options;
    this._currentStepDef = machine.currentStepDef;
    this._snapshot = this._buildSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): CharacterCreatorWizardSnapshot => this._snapshot;

  getState(): WizardState {
    return this._machine.state;
  }

  async initialize(): Promise<void> {
    if (!this._shellContext) {
      await this.refresh();
    }
  }

  async refresh(): Promise<void> {
    const perfStart = globalThis.performance?.now?.() ?? Date.now();
    const requestId = ++this._renderRequestId;
    const currentStepDef = this._machine.currentStepDef;
    const shellContext = await buildWizardShellContext(
      this._machine,
      currentStepDef,
      this._options.renderTemplate,
      this._options.getStepAtmosphere,
    );

    if (this._destroyed || requestId !== this._renderRequestId) return;

    this._currentStepDef = currentStepDef;
    this._shellContext = shellContext;
    Log.info("CC Perf: controller refresh complete", {
      stepId: currentStepDef?.id ?? "unknown",
      durationMs: Math.round((globalThis.performance?.now?.() ?? Date.now()) - perfStart),
    });
    this._emit();
  }

  destroy(): void {
    this._destroyed = true;
    this._deactivateStep(this._currentStepDef, this._activeStepElement);
    this._listeners.clear();
    this._activeStepElement = null;
  }

  registerActiveStepElement(element: HTMLElement): void {
    this._activeStepElement = element;
  }

  activateCurrentStep(element: HTMLElement): void {
    this._activeStepElement = element;
    this._currentStepDef?.onActivate?.(
      this._machine.state,
      element,
      this._createStepCallbacks(this._machine.currentStepId),
    );
  }

  cleanupActiveStep(stepDef: WizardStepDefinition | undefined, element: HTMLElement): void {
    if (this._activeStepElement !== element) return;
    this._deactivateStep(stepDef, element);
    this._activeStepElement = null;
  }

  goNext(): void {
    if (this._pendingTransition) return;
    void this._goNext();
  }

  private async _goNext(): Promise<void> {
    const fromStepId = this._machine.currentStepId;
    const toStepId = this._machine.state.applicableSteps[this._machine.state.currentStep + 1] ?? "";
    const perfStart = globalThis.performance?.now?.() ?? Date.now();
    let originFeatWarmupMs: number | undefined;
    let equipmentWarmupMs: number | undefined;

    try {
      if (fromStepId === "classChoices" && toStepId === "weaponMasteries") {
        const masteryPackSources = getWeaponMasteryPackSources(this._machine.state.config.packSources);
        this._pendingTransition = {
          targetStepId: "weaponMasteries",
          message: "Preparing weapon mastery options...",
        };
        this._emit();
        await ensureCharacterCreatorIndexesReady(masteryPackSources, {
          contentKeys: ["items"],
          persistIfMissing: false,
        });
      }

      if (fromStepId === "backgroundLanguages" && toStepId === "originChoices") {
        const originFeatWarmupStart = globalThis.performance?.now?.() ?? Date.now();
        this._pendingTransition = {
          targetStepId: "originChoices",
          message: "Preparing origin feat options...",
        };
        this._emit();
        await ensureOriginFeatMetadataReady(this._machine.state.config.packSources, {
          persistIfMissing: true,
        });
        await warmOriginFeatChoices(this._machine.state);
        originFeatWarmupMs = Math.round((globalThis.performance?.now?.() ?? Date.now()) - originFeatWarmupStart);
      }

      if (toStepId === "equipment") {
        const equipmentWarmupStart = globalThis.performance?.now?.() ?? Date.now();
        this._pendingTransition = {
          targetStepId: "equipment",
          message: "Preparing starting gear and shop inventory...",
        };
        this._emit();
        await ensureEquipmentShopMetadataReady(this._machine.state.config.packSources, {
          persistIfMissing: true,
        });
        equipmentWarmupMs = Math.round((globalThis.performance?.now?.() ?? Date.now()) - equipmentWarmupStart);
      }

      this._deactivateActiveStep();
      if (this._machine.goNext()) {
        Log.info("CC Perf: goNext triggered refresh", {
          fromStepId,
          toStepId: this._machine.currentStepId || toStepId,
          transitionPrepMs: Math.round((globalThis.performance?.now?.() ?? Date.now()) - perfStart),
          ...(originFeatWarmupMs !== undefined ? { originFeatWarmupMs } : {}),
          ...(equipmentWarmupMs !== undefined ? { equipmentWarmupMs } : {}),
        });
        await this.refresh();
      }
    } finally {
      this._pendingTransition = null;
      this._emit();
    }
  }

  goBack(): void {
    this._deactivateActiveStep();
    if (this._machine.goBack()) {
      void this.refresh();
    }
  }

  jumpToStep(stepId: string): void {
    if (!this._machine.isReviewStep) return;
    this._deactivateActiveStep();
    if (this._machine.jumpTo(stepId)) {
      void this.refresh();
    }
  }

  async createCharacter(): Promise<void> {
    const reviewData = this._machine.state.selections.review as { characterName?: string } | undefined;
    const name = reviewData?.characterName?.trim();
    if (!name) {
      Log.warn("Character Creator: Please enter a character name");
      return;
    }

    const actor = await createCharacterFromWizard(this._machine.state);
    if (!actor) {
      Log.error("Character Creator: Failed to create character");
      return;
    }

    Log.info(`Character Creator: Successfully created "${name}"`);
    (actor as RenderableActorLike).sheet?.render({ force: true });
    await this._options.closeWizard();
  }

  updateCurrentStepData(value: unknown, options?: { silent?: boolean }): void {
    this.updateStepData(this._machine.currentStepId, value, options);
  }

  updateStepData(stepId: string, value: unknown, options?: { silent?: boolean }): void {
    if (options?.silent) {
      this._machine.setStepData(stepId, value);
      this._syncShellState();
      return;
    }

    this._machine.setStepData(stepId, value);
    void this.refresh();
  }

  private _createStepCallbacks(stepId: string): StepCallbacks {
    return {
      setData: (value: unknown) => {
        this._machine.setStepData(stepId, value);
        void this.refresh();
      },
      setDataSilent: (value: unknown) => {
        this._machine.setStepData(stepId, value);
        this._syncShellState();
      },
      rerender: () => {
        void this.refresh();
      },
    };
  }

  private _syncShellState(): void {
    const currentStepDef = this._machine.currentStepDef;
    this._currentStepDef = currentStepDef;

    if (this._shellContext) {
      this._shellContext = {
        ...this._shellContext,
        steps: this._machine.buildStepIndicatorData(),
        currentStepId: this._machine.currentStepId,
        currentStepLabel: currentStepDef?.label ?? "",
        currentStepIcon: currentStepDef?.icon ?? "",
        canGoBack: this._machine.canGoBack,
        canGoNext: this._machine.canGoNext,
        isReviewStep: this._machine.isReviewStep,
        statusHint: currentStepDef?.getStatusHint?.(this._machine.state) ?? "",
        atmosphereClass: this._options.getStepAtmosphere(this._machine.currentStepId),
      };
    }

    this._emit();
  }

  private _deactivateActiveStep(): void {
    this._deactivateStep(this._currentStepDef, this._activeStepElement);
    this._activeStepElement = null;
  }

  private _deactivateStep(stepDef: WizardStepDefinition | undefined, element: HTMLElement | null): void {
    if (!stepDef?.onDeactivate || !element) return;
    stepDef.onDeactivate(this._machine.state, element);
  }

  private _emit(): void {
    this._snapshot = this._buildSnapshot();
    for (const listener of this._listeners) {
      listener();
    }
  }

  private _buildSnapshot(): CharacterCreatorWizardSnapshot {
    return {
      ready: this._shellContext !== null,
      shellContext: this._shellContext,
      currentStepDef: this._currentStepDef,
      state: this._machine.state,
      pendingTransition: this._pendingTransition,
    };
  }
}
