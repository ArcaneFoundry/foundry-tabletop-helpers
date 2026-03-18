import { Log, MOD } from "../logger";
import { getFormApplicationClass, getGame, getUI, setSetting } from "../types";
import type { AbilityScoreMethod, PackSourceConfig } from "./character-creator-types";
import { compendiumIndexer } from "./data/compendium-indexer";
import {
  allowMulticlass,
  ccAutoOpen,
  ccEnabled,
  ccLevelUpEnabled,
  getAllowedAbilityMethods,
  getEquipmentMethod,
  getLevel1HpMethod,
  getMaxRerolls,
  getPackSources,
  getStartingLevel,
  setAllowedAbilityMethods,
  setEquipmentMethod,
  setLevel1HpMethod,
  setMaxRerolls,
  setPackSources,
  setStartingLevel,
} from "./character-creator-settings-accessors";
import { CC_SETTINGS } from "./character-creator-settings-shared";
import {
  normalizeAbilityMethods,
} from "./character-creator-settings-normalization";

interface FormAppLike {
  activateListeners?(html: unknown): void;
  close?(): Promise<void>;
  getData?(): Promise<Record<string, unknown>> | Record<string, unknown>;
  _updateObject?(event: Event, formData: Record<string, unknown>): Promise<void> | void;
}

interface FormAppConstructor {
  new (...args: unknown[]): FormAppLike;
  defaultOptions?: Record<string, unknown>;
}

interface SettingsMenuRegistration {
  registerMenu(module: string, key: string, data: Record<string, unknown>): void;
}

interface CompendiumPackLike {
  collection?: string;
  documentName?: string;
  metadata?: {
    id?: string;
    label?: string;
    packageName?: string;
    package?: string;
  };
  size?: number;
  getIndex(options?: { fields?: string[] }): Promise<Array<{ type?: string }>>;
}

interface FoundryUtilsLike {
  mergeObject?(
    original: Record<string, unknown>,
    other: Record<string, unknown>,
    options?: { inplace?: boolean },
  ): Record<string, unknown>;
}

const CONTENT_TYPE_ITEM_TYPES: Record<string, { types: Set<string>; label: string }> = {
  classes: { types: new Set(["class"]), label: "Classes" },
  subclasses: { types: new Set(["subclass"]), label: "Subclasses" },
  races: { types: new Set(["race"]), label: "Species / Races" },
  backgrounds: { types: new Set(["background"]), label: "Backgrounds" },
  feats: { types: new Set(["feat"]), label: "Feats" },
  spells: { types: new Set(["spell"]), label: "Spells" },
  items: { types: new Set(["weapon", "equipment", "consumable", "tool", "loot"]), label: "Equipment" },
};

interface DetectedPack {
  collection: string;
  label: string;
  packageName: string;
  count: number;
  enabled: boolean;
}

async function detectPacks(sourceKey: string, currentSources: string[]): Promise<DetectedPack[]> {
  const game = getGame();
  if (!game?.packs) return [];

  const info = CONTENT_TYPE_ITEM_TYPES[sourceKey];
  if (!info) return [];

  const enabledSet = new Set(currentSources);
  const results: DetectedPack[] = [];

  for (const pack of getPackIterable(game.packs)) {
    if (pack.documentName !== "Item") continue;

    try {
      const index = await pack.getIndex({ fields: ["type"] });
      let count = 0;
      for (const entry of index) {
        if (info.types.has(entry.type as string)) count++;
      }
      if (count === 0) continue;

      const collection = pack.collection ?? pack.metadata?.id ?? "";
      results.push({
        collection,
        label: pack.metadata?.label ?? collection,
        packageName: pack.metadata?.packageName ?? pack.metadata?.package ?? "unknown",
        count,
        enabled: enabledSet.has(collection),
      });
    } catch {
      /* Skip packs that fail to index */
    }
  }

  return results;
}

export function registerCharacterCreatorSettingsMenus(settings: SettingsMenuRegistration): void {
  registerSettingsMenu(settings);
  registerCompendiumSelectMenu(settings);
}

function registerSettingsMenu(settings: SettingsMenuRegistration): void {
  try {
    const FormAppBase = getFormApplicationClass();
    const BaseWithDefaults = getFormAppBase(FormAppBase);

    class CharacterCreatorSettingsForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        return mergeDefaultOptions(base, {
          id: `${MOD}-cc-settings`,
          title: "Character Creator Settings",
          template: `modules/${MOD}/templates/character-creator/cc-settings.hbs`,
          width: 480,
          height: "auto",
        });
      }

      async getData() {
        const methods = getAllowedAbilityMethods();
        return {
          ccEnabled: ccEnabled(),
          ccAutoOpen: ccAutoOpen(),
          ccLevelUpEnabled: ccLevelUpEnabled(),
          method_4d6: methods.includes("4d6"),
          method_pointBuy: methods.includes("pointBuy"),
          method_standardArray: methods.includes("standardArray"),
          maxRerolls: getMaxRerolls(),
          startingLevel: getStartingLevel(),
          allowMulticlass: allowMulticlass(),
          equipmentMethod: getEquipmentMethod(),
          level1HpMethod: getLevel1HpMethod(),
        };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const methods: AbilityScoreMethod[] = [];
        if (formData.method_4d6) methods.push("4d6");
        if (formData.method_pointBuy) methods.push("pointBuy");
        if (formData.method_standardArray) methods.push("standardArray");
        const normalizedMethods = normalizeAbilityMethods(methods);
        if (normalizedMethods.usedFallback) {
          getUI()?.notifications?.warn?.(
            "At least one ability score method must be enabled. Defaulting to all standard methods.",
          );
        }
        await Promise.all([
          setSetting(MOD, CC_SETTINGS.ENABLED, !!formData.ccEnabled),
          setSetting(MOD, CC_SETTINGS.AUTO_OPEN, !!formData.ccAutoOpen),
          setSetting(MOD, CC_SETTINGS.LEVEL_UP_ENABLED, !!formData.ccLevelUpEnabled),
          setAllowedAbilityMethods(normalizedMethods.methods),
          setMaxRerolls(Number(formData.maxRerolls)),
          setStartingLevel(Number(formData.startingLevel)),
          setSetting(MOD, CC_SETTINGS.ALLOW_MULTICLASS, !!formData.allowMulticlass),
          setEquipmentMethod(String(formData.equipmentMethod ?? "")),
          setLevel1HpMethod(String(formData.level1HpMethod ?? "")),
        ]);

        getUI()?.notifications?.info?.("Character Creator settings saved.");
      }

      activateListeners(html: unknown): void {
        super.activateListeners?.(html);
        bindExplicitFormSubmit(this, html);
      }
    }

    settings.registerMenu(MOD, "ccSettingsMenu", {
      name: "Character Creator",
      label: "Configure",
      hint: "Configure character creation rules, ability score methods, and level-up options.",
      icon: "fa-solid fa-hat-wizard",
      type: CharacterCreatorSettingsForm,
      restricted: true,
    });
  } catch (error) {
    Log.warn("Character Creator: failed to register settings menu", error);
  }
}

function registerCompendiumSelectMenu(settings: SettingsMenuRegistration): void {
  try {
    const FormAppBase = getFormApplicationClass();
    const BaseWithDefaults = getFormAppBase(FormAppBase);

    class CompendiumSelectForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        return mergeDefaultOptions(base, {
          id: `${MOD}-cc-compendium-select`,
          title: "Character Creator — Compendium Sources",
          template: `modules/${MOD}/templates/character-creator/cc-compendium-select.hbs`,
          width: 560,
          height: "auto",
        });
      }

      async getData() {
        const currentSources = getPackSources();
        const groups: Array<{ type: string; label: string; packs: DetectedPack[] }> = [];

        for (const [sourceKey, info] of Object.entries(CONTENT_TYPE_ITEM_TYPES)) {
          const currentIds = currentSources[sourceKey as keyof PackSourceConfig] ?? [];
          const packs = await detectPacks(sourceKey, currentIds);
          groups.push({ type: sourceKey, label: info.label, packs });
        }

        return { groups };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const newSources: Record<string, string[]> = {
          classes: [],
          subclasses: [],
          races: [],
          backgrounds: [],
          feats: [],
          spells: [],
          items: [],
        };

        for (const [key, value] of Object.entries(formData)) {
          if (!key.startsWith("pack__") || !value) continue;
          const parts = key.split("__");
          if (parts.length < 3) continue;
          const sourceKey = parts[1];
          const collection = parts.slice(2).join("__");
          if (newSources[sourceKey]) newSources[sourceKey].push(collection);
        }

        await setPackSources(newSources as unknown as PackSourceConfig);
        compendiumIndexer.invalidate();
        getUI()?.notifications?.info?.("Compendium sources updated. Changes take effect on next wizard open.");
      }

      activateListeners(html: unknown): void {
        super.activateListeners?.(html);
        bindExplicitFormSubmit(this, html);
      }
    }

    settings.registerMenu(MOD, "ccCompendiumSelectMenu", {
      name: "Compendium Sources",
      label: "Select Compendiums",
      hint: "Choose which compendium packs provide classes, species, backgrounds, feats, and spells for the character creator.",
      icon: "fa-solid fa-book-open",
      type: CompendiumSelectForm,
      restricted: true,
    });
  } catch (error) {
    Log.warn("Character Creator: failed to register compendium select menu", error);
  }
}

function getFormAppBase(FormAppBase: unknown): FormAppConstructor {
  return typeof FormAppBase === "function" ? (FormAppBase as FormAppConstructor) : class {} as FormAppConstructor;
}

function bindExplicitFormSubmit(app: FormAppLike, html: unknown): void {
  const root = getRootElement(html);
  const form = root?.querySelector("form");
  if (!form || form.dataset.fthExplicitSubmitBound === "true") return;

  form.dataset.fthExplicitSubmitBound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await app._updateObject?.(event, extractFormData(form));
    await app.close?.();
  });
}

function getRootElement(html: unknown): HTMLElement | null {
  if (typeof HTMLElement !== "undefined" && html instanceof HTMLElement) return html;
  if (html && typeof html === "object" && typeof (html as { querySelector?: unknown }).querySelector === "function") {
    return html as HTMLElement;
  }
  if (html && typeof html === "object") {
    const maybeJQuery = html as { 0?: unknown; length?: number };
    if (
      typeof maybeJQuery.length === "number"
      && typeof HTMLElement !== "undefined"
      && maybeJQuery[0] instanceof HTMLElement
    ) {
      return maybeJQuery[0];
    }
  }
  return null;
}

function extractFormData(form: HTMLFormElement): Record<string, unknown> {
  const formData: Record<string, unknown> = {};
  const elements = Array.from(form.elements);

  for (const element of elements) {
    if (!isFormValueElement(element)) continue;
    if (!element.name || element.disabled) continue;

    if (element.type === "checkbox") {
      formData[element.name] = element.checked;
      continue;
    }

    formData[element.name] = element.value;
  }

  return formData;
}

interface FormValueElementLike {
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  type?: string;
  value?: string;
}

function isFormValueElement(element: unknown): element is FormValueElementLike {
  return !!element && typeof element === "object" && "name" in element && "disabled" in element;
}

function getPackIterable(packs: unknown): CompendiumPackLike[] {
  if (!packs || typeof packs !== "object" || !(Symbol.iterator in packs)) return [];
  return Array.from(packs as Iterable<unknown>).filter(isCompendiumPackLike);
}

function isCompendiumPackLike(value: unknown): value is CompendiumPackLike {
  return typeof value === "object" && value !== null && typeof (value as CompendiumPackLike).getIndex === "function";
}

function mergeDefaultOptions(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const utils = getFoundryUtils();
  if (utils?.mergeObject) return utils.mergeObject(base, extra, { inplace: false });
  return { ...base, ...extra };
}

function getFoundryUtils(): FoundryUtilsLike | undefined {
  const g = globalThis as Record<string, unknown>;
  const foundryNs = g.foundry;
  if (!foundryNs || typeof foundryNs !== "object") return undefined;
  const utils = (foundryNs as { utils?: unknown }).utils;
  return utils && typeof utils === "object" ? (utils as FoundryUtilsLike) : undefined;
}
