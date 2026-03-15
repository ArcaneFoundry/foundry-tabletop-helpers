import { Log, MOD, type Level } from "./logger";
import { openAssetManager } from "./asset-manager/asset-manager-picker";
import { buildCombatApi, type FthCombatApi } from "./combat/combat-init";
import {
  openCharacterCreatorWizard,
  openGMConfigApp,
  openLevelUpWizard,
} from "./character-creator/character-creator-init";
import { getGame } from "./types";
import { buildRotationApi, type FthRotationApi } from "./window-rotation/index";

export interface FthApi extends FthRotationApi, FthCombatApi {
  setLevel: (level: Level) => void;
  version?: string;
  assetManager: () => void;
  characterCreator: () => void;
  characterCreatorConfig: () => void;
  levelUp: (actorId: string) => void;
}

interface WindowWithFth extends Window {
  fth?: FthApi;
}

export function buildFthApi(): FthApi {
  return {
    setLevel: (level: Level) => Log.setLevel(level),
    version: getFthVersion(),
    ...buildRotationApi(),
    ...buildCombatApi(),
    assetManager: () => openAssetManager(),
    characterCreator: () => openCharacterCreatorWizard(),
    characterCreatorConfig: () => openGMConfigApp(),
    levelUp: (actorId: string) => openLevelUpWizard(actorId),
  };
}

export function attachFthApi(): FthApi {
  const api = buildFthApi();
  const win = getWindow();
  if (win) win.fth = api;
  return api;
}

function getFthVersion(): string | undefined {
  return getGame()?.modules?.get(MOD)?.version;
}

function getWindow(): WindowWithFth | undefined {
  return "window" in globalThis ? globalThis.window as WindowWithFth : undefined;
}

export const __fthApiInternals = {
  getFthVersion,
  getWindow,
};
