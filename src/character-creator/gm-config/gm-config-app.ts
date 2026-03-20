/**
 * Character Creator — GM Configuration Panel
 *
 * ApplicationV2 (HandlebarsApplicationMixin) with three tabs:
 * Sources, Content Curation, and Rules Configuration.
 *
 * Built via runtime class factory pattern (same as LPCS).
 */

import { MOD, Log } from "../../logger";
import { getUI } from "../../types";
import type {
  PackSourceConfig,
  CreatorContentType,
  SourcesTabViewModel,
  CurationTabViewModel,
  CurationEntry,
  RulesConfigViewModel,
  GMConfigAppContext,
} from "../character-creator-types";
import { CONTENT_TYPE_LABELS } from "../character-creator-types";
import {
  getPackSources,
  setPackSources,
  setDisabledContentUUIDs,
  getAllowedAbilityMethods,
  setAllowedAbilityMethods,
  getStartingLevel,
  setStartingLevel,
  allowMulticlass,
  getEquipmentMethod,
  setEquipmentMethod,
  getLevel1HpMethod,
  setLevel1HpMethod,
  allowCustomBackgrounds,
  CC_SETTINGS,
} from "../character-creator-settings";
import {
  normalizeAbilityMethods,
} from "../character-creator-settings-normalization";
import { setSetting } from "../../types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { ContentFilter } from "../data/content-filter";
import { buildPackSourceGroups, invalidatePackAnalysisCache } from "../data/pack-analysis";

/* ── Runtime Foundry Class Resolution ────────────────────── */

interface RuntimeApplicationBase {
  element?: Element | null;
  render(options?: Record<string, unknown>): void;
  _preparePartContext?(partId: string, context: unknown, options: unknown): Promise<unknown>;
}

interface RuntimeApplicationClass {
  new (): RuntimeApplicationBase;
}

type RuntimeHandlebarsApplicationMixin = (base: RuntimeApplicationClass) => RuntimeApplicationClass;

interface GMConfigAppInstance extends RuntimeApplicationBase {
  tabGroups: Record<string, string>;
  _curationLoaded: boolean;
  _filter: ContentFilter | null;
  _searchText: string;
}

interface RulesFormLike {
  querySelector(selector: string): Element | null;
}

const getFoundryAppClasses = () => {
  const g = globalThis as Record<string, unknown>;
  const api = (g.foundry as Record<string, unknown> | undefined)
    ?.applications as Record<string, unknown> | undefined;
  return {
    HandlebarsApplicationMixin: (api?.api as Record<string, unknown> | undefined)
      ?.HandlebarsApplicationMixin as RuntimeHandlebarsApplicationMixin | undefined,
    ApplicationV2: (api?.api as Record<string, unknown> | undefined)
      ?.ApplicationV2 as RuntimeApplicationClass | undefined,
  };
};

/* ── Module-Level State ──────────────────────────────────── */

let _GMConfigAppClass: RuntimeApplicationClass | null = null;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Build the GMConfigApp class at runtime once Foundry globals are available.
 * Call during the `init` hook.
 */
export function buildGMConfigAppClass(): void {
  const { HandlebarsApplicationMixin, ApplicationV2 } = getFoundryAppClasses();

  if (typeof HandlebarsApplicationMixin !== "function" || typeof ApplicationV2 !== "function") {
    Log.warn("Character Creator: ApplicationV2 not available — GM Config disabled");
    return;
  }

  const Base = HandlebarsApplicationMixin(ApplicationV2);

  class GMConfigApp extends Base {

    /* ── Instance State ────────────────────────────────────── */

    /** Whether compendium data for the curation tab has been loaded. */
    private _curationLoaded = false;

    /** In-memory content filter (mutated by toggle actions, saved explicitly). */
    private _filter: ContentFilter | null = null;

    /** Current search text for curation filtering. */
    private _searchText = "";

    /* ── Static Configuration ──────────────────────────────── */

    static DEFAULT_OPTIONS = {
      id: "fth-gm-config",
      classes: ["fth-character-creator", "fth-gm-config"],
      tag: "div",
      window: {
        resizable: true,
        icon: "fa-solid fa-hat-wizard",
        title: "Character Creator — GM Configuration",
      },
      position: { width: 720, height: 580 },
      actions: {
        togglePack: GMConfigApp._onTogglePack,
        toggleContent: GMConfigApp._onToggleContent,
        enableAll: GMConfigApp._onEnableAll,
        disableAll: GMConfigApp._onDisableAll,
        saveRules: GMConfigApp._onSaveRules,
        searchContent: GMConfigApp._onSearchContent,
      },
    };

    static PARTS = {
      tabs: { template: `modules/${MOD}/templates/character-creator/cc-gm-tabs.hbs` },
      sources: { template: `modules/${MOD}/templates/character-creator/cc-gm-sources.hbs`, scrollable: [".cc-gm-sources-list"] },
      curation: { template: `modules/${MOD}/templates/character-creator/cc-gm-curation.hbs`, scrollable: [".cc-gm-curation-list"] },
      rules: { template: `modules/${MOD}/templates/character-creator/cc-gm-rules.hbs` },
    };

    tabGroups = { main: "sources" };

    /* ── Rendering ─────────────────────────────────────────── */

    async _prepareContext(_options: unknown): Promise<GMConfigAppContext> {
      const activeTab = this.tabGroups["main"] ?? "sources";

      const tabs: GMConfigAppContext["tabs"] = {
        sources: {
          id: "sources",
          label: "Content Sources",
          icon: "fa-solid fa-books",
          active: activeTab === "sources",
        },
        curation: {
          id: "curation",
          label: "Content Curation",
          icon: "fa-solid fa-filter",
          active: activeTab === "curation",
        },
        rules: {
          id: "rules",
          label: "Rules Config",
          icon: "fa-solid fa-gavel",
          active: activeTab === "rules",
        },
      };

      const context: GMConfigAppContext = { tabs, activeTab };

      // Build only the active tab's data
      if (activeTab === "sources") {
        context.sources = await this._buildSourcesViewModel();
      } else if (activeTab === "curation") {
        context.curation = this._buildCurationViewModel();
      } else if (activeTab === "rules") {
        context.rules = this._buildRulesViewModel();
      }

      return context;
    }

    async _preparePartContext(partId: string, context: GMConfigAppContext, options: unknown): Promise<unknown> {
      const base = await super._preparePartContext?.(partId, context, options) ?? {};
      const activeTab = context.activeTab;

      // Only pass data for the active tab's part
      if (partId === "tabs") return { ...base, tabs: context.tabs, activeTab };
      if (partId === "sources") return { ...base, active: activeTab === "sources", ...context.sources };
      if (partId === "curation") return { ...base, active: activeTab === "curation", ...context.curation };
      if (partId === "rules") return { ...base, active: activeTab === "rules", ...context.rules };

      return base;
    }

    async _onRender(_context: unknown, _options: unknown): Promise<void> {
      // Bind tab click handlers
      const tabButtons = this.element?.querySelectorAll("[data-tab]");
      tabButtons?.forEach((btn: Element) => {
        btn.addEventListener("click", () => {
          const tab = (btn as HTMLElement).dataset.tab;
          if (!tab) return;
          this.tabGroups["main"] = tab;

          // Lazy-load curation data on first activation
          if (tab === "curation" && !this._curationLoaded) {
            this._loadCurationData();
          } else {
            this.render({ force: false });
          }
        });
      });
    }

    /* ── Tab Data Builders ─────────────────────────────────── */

    private async _buildSourcesViewModel(): Promise<SourcesTabViewModel> {
      const currentSources = getPackSources();
      const groups = (await buildPackSourceGroups(currentSources))
        .filter((group) => group.packs.length > 0);
      return { groups };
    }

    private _buildCurationViewModel(): CurationTabViewModel {
      if (!this._curationLoaded) {
        return { loaded: false, groups: [] };
      }

      if (!this._filter) {
        this._filter = ContentFilter.fromSettings();
      }

      const sources = getPackSources();
      const typeOrder: CreatorContentType[] = ["class", "subclass", "race", "background", "feat", "spell", "item"];
      const searchLower = this._searchText.toLowerCase();

      const groups = typeOrder.map((type) => {
        let entries = compendiumIndexer.getIndexedEntries(type, sources);

        // Apply search filter
        if (searchLower) {
          entries = entries.filter((e) =>
            e.name.toLowerCase().includes(searchLower) ||
            e.packLabel.toLowerCase().includes(searchLower),
          );
        }

        const curationEntries: CurationEntry[] = entries.map((e) => ({
          ...e,
          enabled: this._filter!.isEnabled(e.uuid),
        }));

        return {
          type,
          label: CONTENT_TYPE_LABELS[type],
          entries: curationEntries,
          enabledCount: curationEntries.filter((e) => e.enabled).length,
          totalCount: curationEntries.length,
        };
      }).filter((g) => g.totalCount > 0);

      return { loaded: true, groups };
    }

    private _buildRulesViewModel(): RulesConfigViewModel {
      const methods = getAllowedAbilityMethods();
      return {
        allowedAbilityMethods: {
          "4d6": methods.includes("4d6"),
          pointBuy: methods.includes("pointBuy"),
          standardArray: methods.includes("standardArray"),
        },
        startingLevel: getStartingLevel(),
        allowMulticlass: allowMulticlass(),
        equipmentMethod: getEquipmentMethod(),
        level1HpMethod: getLevel1HpMethod(),
        allowCustomBackgrounds: allowCustomBackgrounds(),
      };
    }

    private async _loadCurationData(): Promise<void> {
      const sources = getPackSources();
      await compendiumIndexer.loadPacks(sources);
      this._curationLoaded = true;
      this._filter = ContentFilter.fromSettings();
      this.render({ force: false });
    }

    /* ── Action Handlers ───────────────────────────────────── */

    static async _onTogglePack(this: GMConfigAppInstance, _event: Event, target: HTMLElement): Promise<void> {
      const packId = target.dataset.packId;
      const typeKey = target.dataset.typeKey as keyof PackSourceConfig | undefined;
      if (!packId || !typeKey) return;

      const sources = getPackSources();
      const current = sources[typeKey] ?? [];
      const isChecked = (target as HTMLInputElement).checked;

      if (isChecked && !current.includes(packId)) {
        sources[typeKey] = [...current, packId];
      } else if (!isChecked) {
        sources[typeKey] = current.filter((id) => id !== packId);
      }

      await setPackSources(sources);
      compendiumIndexer.invalidate();
      invalidatePackAnalysisCache();
      this._curationLoaded = false;
      this.render({ force: false });
    }

    static async _onToggleContent(this: GMConfigAppInstance, _event: Event, target: HTMLElement): Promise<void> {
      const uuid = target.dataset.uuid;
      if (!uuid || !this._filter) return;

      const isChecked = (target as HTMLInputElement).checked;
      this._filter.toggle(uuid, isChecked);
      await setDisabledContentUUIDs(this._filter.toArray());
      this.render({ parts: ["curation"] });
    }

    static async _onEnableAll(this: GMConfigAppInstance, _event: Event, target: HTMLElement): Promise<void> {
      const type = target.dataset.type as CreatorContentType | undefined;
      if (!type || !this._filter) return;

      const sources = getPackSources();
      const entries = compendiumIndexer.getIndexedEntries(type, sources);
      this._filter.enableAll(entries);
      await setDisabledContentUUIDs(this._filter.toArray());
      this.render({ parts: ["curation"] });
    }

    static async _onDisableAll(this: GMConfigAppInstance, _event: Event, target: HTMLElement): Promise<void> {
      const type = target.dataset.type as CreatorContentType | undefined;
      if (!type || !this._filter) return;

      const sources = getPackSources();
      const entries = compendiumIndexer.getIndexedEntries(type, sources);
      this._filter.disableAll(entries);
      await setDisabledContentUUIDs(this._filter.toArray());
      this.render({ parts: ["curation"] });
    }

    static async _onSaveRules(this: GMConfigAppInstance, _event: Event, _target: HTMLElement): Promise<void> {
      const form = getRulesForm(this.element);
      if (!form) return;

      // Ability methods
      const methods: string[] = [];
      if (getChecked(form, '[name="method-4d6"]')) methods.push("4d6");
      if (getChecked(form, '[name="method-pointBuy"]')) methods.push("pointBuy");
      if (getChecked(form, '[name="method-standardArray"]')) methods.push("standardArray");
      const normalizedMethods = normalizeAbilityMethods(methods);
      if (normalizedMethods.usedFallback) {
        getUI()?.notifications?.warn?.("At least one ability score method must remain enabled. Defaulting to all standard methods.");
      }
      await setAllowedAbilityMethods(normalizedMethods.methods);

      // Scalar settings
      await setStartingLevel(Number(getInputValue(form, '[name="startingLevel"]')));

      const multiclass = getChecked(form, '[name="allowMulticlass"]');
      await setSetting(MOD, CC_SETTINGS.ALLOW_MULTICLASS, multiclass);

      await setEquipmentMethod(getInputValue(form, '[name="equipmentMethod"]:checked'));

      await setLevel1HpMethod(getInputValue(form, '[name="level1HpMethod"]:checked'));

      const customBg = getChecked(form, '[name="allowCustomBackgrounds"]');
      await setSetting(MOD, CC_SETTINGS.ALLOW_CUSTOM_BACKGROUNDS, customBg);

      getUI()?.notifications?.info("Character Creator configuration saved.");
    }

    static _onSearchContent(this: GMConfigAppInstance, _event: Event, target: HTMLElement): void {
      this._searchText = getElementValue(target) ?? "";
      this.render({ parts: ["curation"] });
    }
  }

  _GMConfigAppClass = GMConfigApp;
  Log.debug("Character Creator: GMConfigApp class built");
}

/**
 * Open the GM Configuration panel.
 * Safe to call at any time — silently no-ops if the class isn't built yet.
 */
export function openGMConfigApp(): void {
  if (!_GMConfigAppClass) {
    Log.warn("Character Creator: GMConfigApp not available");
    return;
  }
  new _GMConfigAppClass().render({ force: true });
}

export function getGMConfigAppClass(): RuntimeApplicationClass | null {
  return _GMConfigAppClass;
}

function getRulesForm(element: Element | null | undefined): RulesFormLike | null {
  const form = element?.querySelector(".cc-rules-form");
  return isRulesFormLike(form) ? form : null;
}

function getChecked(form: RulesFormLike, selector: string): boolean {
  const input = form.querySelector(selector);
  return isCheckboxLike(input) ? input.checked : false;
}

function getInputValue(form: RulesFormLike, selector: string): string | undefined {
  const input = form.querySelector(selector);
  return getElementValue(input);
}

function getElementValue(element: Element | null | undefined): string | undefined {
  if (!element || !("value" in element)) return undefined;
  const value = (element as { value?: unknown }).value;
  return typeof value === "string" ? value : undefined;
}

function isCheckboxLike(element: Element | null | undefined): element is Element & { checked: boolean } {
  return !!element && "checked" in element && typeof (element as { checked?: unknown }).checked === "boolean";
}

function isRulesFormLike(value: unknown): value is RulesFormLike {
  return typeof value === "object" && value !== null && "querySelector" in value
    && typeof (value as { querySelector?: unknown }).querySelector === "function";
}
