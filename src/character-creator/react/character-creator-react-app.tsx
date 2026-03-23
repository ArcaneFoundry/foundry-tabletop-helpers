import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Log, MOD } from "../../logger";
import { renderTemplate } from "../../types";
import { getFoundryReactMount, FoundryReactRenderer } from "../../ui/foundry/react/foundry-react-application";
import type { GMConfig } from "../character-creator-types";
import { buildWizardShellContext } from "../wizard/character-creator-app-helpers";
import {
  buildCharacterCreatorAppClass as buildLegacyCharacterCreatorAppClass,
  openCharacterCreatorWizard as openLegacyCharacterCreatorWizard,
} from "../wizard/character-creator-app";
import { getOrderedSteps, getStepAtmosphere } from "../wizard/step-registry";
import { WizardStateMachine } from "../wizard/wizard-state-machine";
import { WizardShell } from "./components/wizard-shell";
import { LegacyStepHost } from "./components/legacy-step-host";
import { ReactStepHost } from "./components/react-step-host";
import { WizardControllerProvider } from "./wizard-context";
import { CharacterCreatorWizardController } from "./wizard-controller";
import { ClassFlowRouteHost, isClassFlowStep } from "./steps/class/class-flow-route-host";
import { OriginFlowRouteHost, isOriginFlowStep } from "./steps/origin/origin-flow-route-host";
import { BuildFlowRouteHost, isBuildFlowStep } from "./steps/build/build-flow-route-host";
import { hydrateCharacterCreatorIndexesFromSettings } from "../character-creator-index-cache";
import {
  allowCustomBackgrounds,
  allowFirearms,
  allowMulticlass,
  allowOriginFeatChoice,
  allowUnrestrictedBackgroundAsi,
  getAllowedAbilityMethods,
  getDisabledContentUUIDs,
  getEquipmentMethod,
  getLevel1HpMethod,
  getMaxRerolls,
  getPackSources,
  getStartingLevel,
} from "../character-creator-settings";

interface RuntimeApplicationBase {
  element?: Element | null;
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

let _CharacterCreatorReactAppClass: RuntimeApplicationClass | null = null;

function CharacterCreatorReactView({ controller }: { controller: CharacterCreatorWizardController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    void controller.initialize();
  }, [controller]);

  if (!snapshot.shellContext) {
    return (
      <div className="fth-react-app-shell flex h-full min-h-0 items-center justify-center bg-fth-cc-ink text-fth-cc-light">
        <div className="rounded-fth-cc-lg border border-white/10 bg-black/20 px-5 py-4 font-fth-cc-ui text-sm uppercase tracking-[0.18em] text-fth-cc-muted">
          Loading Character Creator
        </div>
      </div>
    );
  }

  return (
    <WizardControllerProvider value={controller}>
      <WizardShell
        shellContext={snapshot.shellContext}
        stepContent={(
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              className="flex min-h-0 flex-1 overflow-hidden"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.992 }}
              key={isClassFlowStep(snapshot.shellContext.currentStepId) || isOriginFlowStep(snapshot.shellContext.currentStepId) || isBuildFlowStep(snapshot.shellContext.currentStepId)
                ? "creator-flow"
                : (snapshot.shellContext.currentStepId ?? "")}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8, scale: 1.008 }}
            >
              {isBuildFlowStep(snapshot.shellContext.currentStepId) ? (
                <div
                  className={[
                    "cc-step-content flex-1 overflow-hidden",
                    snapshot.shellContext.shellContentClass,
                  ].filter(Boolean).join(" ")}
                >
                  <BuildFlowRouteHost
                    controller={controller}
                    shellContext={snapshot.shellContext}
                    state={snapshot.state}
                    step={snapshot.currentStepDef!}
                  />
                </div>
              ) : snapshot.currentStepDef?.renderMode === "react" && isClassFlowStep(snapshot.shellContext.currentStepId) ? (
                <div
                  className={[
                    "cc-step-content flex-1 overflow-hidden",
                    snapshot.shellContext.shellContentClass,
                  ].filter(Boolean).join(" ")}
                >
                  <ClassFlowRouteHost
                    controller={controller}
                    pendingTransition={snapshot.pendingTransition}
                    shellContext={snapshot.shellContext}
                    state={snapshot.state}
                    step={snapshot.currentStepDef}
                  />
                </div>
              ) : snapshot.currentStepDef?.renderMode === "react" && isOriginFlowStep(snapshot.shellContext.currentStepId) ? (
                <div
                  className={[
                    "cc-step-content flex-1 overflow-hidden",
                    snapshot.shellContext.shellContentClass,
                  ].filter(Boolean).join(" ")}
                >
                  <OriginFlowRouteHost
                    controller={controller}
                    shellContext={snapshot.shellContext}
                    state={snapshot.state}
                    step={snapshot.currentStepDef}
                  />
                </div>
              ) : snapshot.currentStepDef?.renderMode === "react" && snapshot.currentStepDef.reactComponent ? (
                <div
                  className={[
                    "cc-step-content flex-1 overflow-hidden",
                    snapshot.shellContext.shellContentClass,
                  ].filter(Boolean).join(" ")}
                >
                  <ReactStepHost
                    controller={controller}
                    shellContext={snapshot.shellContext}
                    state={snapshot.state}
                    stepDef={snapshot.currentStepDef}
                  />
                </div>
              ) : (
                <LegacyStepHost
                  className={[
                    "cc-step-content",
                    snapshot.shellContext.shellContentClass,
                    "fth-react-scrollbar flex-1 overflow-y-auto",
                  ].filter(Boolean).join(" ")}
                  controller={controller}
                  stepContentHtml={snapshot.shellContext.stepContentHtml}
                  stepDef={snapshot.currentStepDef}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
        onBack={() => controller.goBack()}
        onCreateCharacter={() => controller.createCharacter()}
        onJumpToStep={(stepId) => controller.jumpToStep(stepId)}
        onNext={() => controller.goNext()}
      />
    </WizardControllerProvider>
  );
}

export function buildCharacterCreatorReactAppClass(): void {
  buildLegacyCharacterCreatorAppClass();

  const { HandlebarsApplicationMixin, ApplicationV2 } = getFoundryAppClasses();
  if (typeof HandlebarsApplicationMixin !== "function" || typeof ApplicationV2 !== "function") {
    Log.warn("Character Creator: React ApplicationV2 wrapper not available");
    return;
  }

  const Base = HandlebarsApplicationMixin(ApplicationV2);

  class CharacterCreatorReactApp extends Base {
    static DEFAULT_OPTIONS = {
      id: "fth-character-creator-wizard-react",
      classes: ["fth-character-creator", "fth-cc-wizard", "fth-cc-wizard--react"],
      tag: "div",
      window: {
        resizable: true,
        icon: "fa-solid fa-hat-wizard",
        title: "Character Creator",
      },
      position: { width: 860, height: 640 },
    };

    static PARTS = {
      root: {
        template: `modules/${MOD}/templates/character-creator/cc-react-root.hbs`,
      },
    };

    private _machine: WizardStateMachine | null = null;
    private _controller: CharacterCreatorWizardController | null = null;
    private _reactRenderer = new FoundryReactRenderer();

    async _prepareContext(_options: unknown): Promise<Record<string, never>> {
      return {};
    }

    async _preparePartContext(partId: string, context: Record<string, never>, options: unknown): Promise<unknown> {
      const base = await super._preparePartContext?.(partId, context, options) ?? {};
      return { ...base, ...context };
    }

    async _onRender(_context: Record<string, never>, _options: unknown): Promise<void> {
      const mount = getFoundryReactMount(this.element);
      if (!mount) return;

      const controller = this._ensureController();
      this._reactRenderer.render(mount, <CharacterCreatorReactView controller={controller} />);
    }

    async close(options?: unknown): Promise<void> {
      this._controller?.destroy();
      this._controller = null;
      this._machine = null;
      this._reactRenderer.unmount();
      return super.close(options);
    }

    private _ensureController(): CharacterCreatorWizardController {
      if (!this._controller) {
        const machine = this._ensureMachine();
        this._controller = new CharacterCreatorWizardController(machine, {
          renderTemplate,
          getStepAtmosphere,
          closeWizard: async () => {
            await this.close();
          },
        });
      }

      return this._controller;
    }

    private _ensureMachine(): WizardStateMachine {
      if (!this._machine) {
        this._machine = new WizardStateMachine(this._snapshotGMConfig(), getOrderedSteps());
      }

      return this._machine;
    }

    private _snapshotGMConfig(): GMConfig {
      const packSources = getPackSources();
      hydrateCharacterCreatorIndexesFromSettings(packSources);
      return {
        packSources,
        disabledUUIDs: new Set(getDisabledContentUUIDs()),
        allowedAbilityMethods: getAllowedAbilityMethods(),
        maxRerolls: getMaxRerolls(),
        startingLevel: getStartingLevel(),
        allowMulticlass: allowMulticlass(),
        allowFirearms: allowFirearms(),
        equipmentMethod: getEquipmentMethod(),
        level1HpMethod: getLevel1HpMethod(),
        allowCustomBackgrounds: allowCustomBackgrounds(),
        allowOriginFeatChoice: allowOriginFeatChoice(),
        allowUnrestrictedBackgroundAsi: allowUnrestrictedBackgroundAsi(),
      };
    }
  }

  _CharacterCreatorReactAppClass = CharacterCreatorReactApp;
  Log.debug("Character Creator: CharacterCreatorReactApp class built");
}

export function getCharacterCreatorReactAppClass(): RuntimeApplicationClass | null {
  return _CharacterCreatorReactAppClass;
}

export function openCharacterCreatorWizard(): void {
  if (_CharacterCreatorReactAppClass) {
    renderReactWizardApp(_CharacterCreatorReactAppClass);
    return;
  }

  buildCharacterCreatorReactAppClass();

  if (_CharacterCreatorReactAppClass) {
    renderReactWizardApp(_CharacterCreatorReactAppClass);
    return;
  }

  openLegacyCharacterCreatorWizard();
}

export const __characterCreatorReactAppInternals = {
  buildWizardShellContext,
};

function renderReactWizardApp(AppClass: RuntimeApplicationClass): void {
  new AppClass().render({ force: true });
}
