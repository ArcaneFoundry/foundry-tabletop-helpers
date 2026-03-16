import "./styles.css";
import "./lpcs/lpcs-styles.css";
import "./initiative/initiative-dialog.css";
import "./combat/styles/combat-batch-initiative.css";
import "./combat/styles/combat-damage-workflow.css";
import "./combat/styles/combat-monster-preview.css";
import "./combat/styles/combat-party-summary.css";
import "./combat/styles/combat-rules-reference.css";
import "./asset-manager/styles/asset-manager.css";
import "./character-creator/styles/character-creator-styles.css";
import { attachFthApi } from "./fth-api";
import { Log, MOD, type Level } from "./logger";
import { registerSettings } from "./settings";
import { registerPrintSheetHooks } from "./print-sheet/print-sheet";
import { registerWindowRotationHooks, initWindowRotationReady } from "./window-rotation/index";
import { getGame, getHooks, getSetting, isGM } from "./types";
import { registerLPCSSettings } from "./lpcs/lpcs-settings";
import { registerLPCSSheet, preloadLPCSTemplates } from "./lpcs/lpcs-sheet";
import { autoOpenLPCS } from "./lpcs/lpcs-auto-open";
import { registerInitiativeSettings, registerInitiativeHooks } from "./initiative/initiative-dialog";
import { initKioskSetup, initKioskReady } from "./kiosk/kiosk-init";
import { registerCombatSettings } from "./combat/combat-settings";
import { registerCombatHooks, initCombatReady } from "./combat/combat-init";
import { registerAssetManagerSettings, isAssetManagerEnabled, loadSavedPresets } from "./asset-manager/asset-manager-settings";
import { registerAssetManagerPicker, openAssetManager } from "./asset-manager/asset-manager-picker";
import {
  registerCharacterCreatorSettings,
  registerCharacterCreatorHooks,
  initCharacterCreatorReady,
} from "./character-creator/character-creator-init";

interface SceneControlTool {
  name: string;
  title: string;
  icon: string;
  order: number;
  button: boolean;
  visible: boolean;
  onChange: () => void;
}

interface SceneControls {
  tokens?: {
    tools?: Record<string, SceneControlTool>;
  };
}

/* ── Hook Registration ─────────────────────────────────────── */

getHooks()?.on?.("init", () => {
  onInit();
});

getHooks()?.on?.("setup", () => {
  onSetup();
});

getHooks()?.on?.("ready", () => {
  onReady();
});

function onInit(): void {
  registerSettings();
  registerWindowRotationHooks();
  registerPrintSheetHooks();

  const settings = getGame()?.settings;

  // LPCS — Live Play Character Sheet
  if (settings) registerLPCSSettings(settings);
  registerLPCSSheet();
  void preloadLPCSTemplates();

  // Initiative — Quick Initiative Roll Dialog
  if (settings) registerInitiativeSettings(settings);
  registerInitiativeHooks();

  // Combat Command Center — Batch Initiative, Token Indicators, etc.
  if (settings) registerCombatSettings(settings);
  registerCombatHooks();

  // Asset Manager — settings registered at init, picker override deferred to setup
  if (settings) registerAssetManagerSettings(settings);

  // Character Creator & Level-Up Manager
  if (settings) registerCharacterCreatorSettings(settings);
  registerCharacterCreatorHooks();

  registerAssetManagerSceneControlHook();

  const logLevel = getSetting<string>(MOD, "logLevel");
  if (logLevel) Log.setLevel(logLevel as Level);
  Log.info("init");
}

function onSetup(): void {
  // Asset Manager — FilePicker override (needs game.user + settings, available at setup)
  registerAssetManagerPicker();
  initKioskSetup();
}

function onReady(): void {
  Log.info("ready", {
    core: getGame()?.version,
    system: getGame()?.system?.id,
    user: getGame()?.user?.id,
  });

  // Socket listener + macro pack provisioning
  initWindowRotationReady();

  // Kiosk — full-screen sheet mode for designated players (before auto-open
  // so kiosk handles its own sheet opening with maximize/fullscreen)
  initKioskReady();

  // LPCS — auto-open sheet for assigned player characters
  autoOpenLPCS();

  // Combat Command Center — ready-phase initialization
  initCombatReady();

  // Asset Manager — load saved preset overrides
  loadSavedPresets();

  // Character Creator — ready-phase initialization
  initCharacterCreatorReady();

  attachFthApi();

  Log.debug("window.fth API attached");
}

function registerAssetManagerSceneControlHook(): void {
  getHooks()?.on?.("getSceneControlButtons", onGetSceneControlButtonsAssetManager);
}

function onGetSceneControlButtonsAssetManager(controls: SceneControls): void {
  if (!isAssetManagerEnabled() || !isGM()) return;
  if (!controls.tokens?.tools) return;

  controls.tokens.tools["fth-asset-manager"] = {
    name: "fth-asset-manager",
    title: "Asset Manager",
    icon: "fa-solid fa-folder-open",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => openAssetManager(),
  };
}

export const __indexInternals = {
  onInit,
  onSetup,
  onReady,
  onGetSceneControlButtonsAssetManager,
};
