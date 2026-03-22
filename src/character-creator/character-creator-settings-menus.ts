import { Log, MOD } from "../logger";
import { getFormApplicationClass, getUI, setSetting } from "../types";
import type { AbilityScoreMethod, PackSourceConfig } from "./character-creator-types";
import { compendiumIndexer } from "./data/compendium-indexer";
import { buildPackSourceGroups, invalidatePackAnalysisCache } from "./data/pack-analysis";
import {
  getCharacterCreatorIndexStatus,
  rebuildCharacterCreatorIndexCache,
} from "./character-creator-index-cache";
import {
  allowOriginFeatChoice,
  allowUnrestrictedBackgroundAsi,
  allowFirearms,
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

interface FoundryUtilsLike {
  mergeObject?(
    original: Record<string, unknown>,
    other: Record<string, unknown>,
    options?: { inplace?: boolean },
  ): Record<string, unknown>;
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
          allowFirearms: allowFirearms(),
          equipmentMethod: getEquipmentMethod(),
          level1HpMethod: getLevel1HpMethod(),
          allowOriginFeatChoice: allowOriginFeatChoice(),
          allowUnrestrictedBackgroundAsi: allowUnrestrictedBackgroundAsi(),
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
          setSetting(MOD, CC_SETTINGS.ALLOW_FIREARMS, !!formData.allowFirearms),
          setEquipmentMethod(String(formData.equipmentMethod ?? "")),
          setLevel1HpMethod(String(formData.level1HpMethod ?? "")),
          setSetting(MOD, CC_SETTINGS.ALLOW_ORIGIN_FEAT_CHOICE, !!formData.allowOriginFeatChoice),
          setSetting(MOD, CC_SETTINGS.ALLOW_UNRESTRICTED_BACKGROUND_ASI, !!formData.allowUnrestrictedBackgroundAsi),
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
      private _root: HTMLElement | null = null;

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
        const groups = await buildPackSourceGroups(currentSources);
        return {
          groups,
          indexStatus: getCharacterCreatorIndexStatus(currentSources),
        };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const submitAction = typeof formData.__submitAction === "string" ? formData.__submitAction : "saveAndIndex";
        const newSources: PackSourceConfig = {
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
          if (sourceKey in newSources) newSources[sourceKey as keyof PackSourceConfig].push(collection);
        }

        this.setBusyState(
          true,
          submitAction === "rebuildIndexes" ? "Rebuilding compendium indexes..." : "Saving sources and building compendium indexes...",
        );

        try {
          await setPackSources(newSources);
          compendiumIndexer.invalidate();
          invalidatePackAnalysisCache();
          await rebuildCharacterCreatorIndexCache(newSources);
          getUI()?.notifications?.info?.(
            submitAction === "rebuildIndexes"
              ? "Character Creator compendium indexes rebuilt."
              : "Compendium sources saved and indexed.",
          );
        } finally {
          this.setBusyState(false);
        }
      }

      activateListeners(html: unknown): void {
        super.activateListeners?.(html);
        this._root = getRootElement(html);
        bindExplicitFormSubmit(this, html);
      }

      private setBusyState(isBusy: boolean, message = ""): void {
        const form = this._root?.querySelector("form");
        if (!form) return;

        const buttons = Array.from(form.querySelectorAll("button"));
        for (const button of buttons) {
          button.disabled = isBusy;
          button.setAttribute("aria-busy", isBusy ? "true" : "false");
        }

        form.classList.toggle("cc-compendium-select--busy", isBusy);
        const status = this._root?.querySelector("[data-indexing-status-message]");
        if (status) {
          status.textContent = isBusy ? message : "";
        }
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
    const submitter = getSubmitterAction(event);
    await app._updateObject?.(event, extractFormData(form, submitter));
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

function extractFormData(form: HTMLFormElement, submitAction?: string): Record<string, unknown> {
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

  if (submitAction) formData.__submitAction = submitAction;
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

function getSubmitterAction(event: Event): string | undefined {
  const submitter = (event as Event & { submitter?: unknown }).submitter;
  if (!submitter || typeof submitter !== "object") return undefined;
  const dataset = (submitter as { dataset?: Record<string, string | undefined> }).dataset;
  return dataset?.submitAction;
}
