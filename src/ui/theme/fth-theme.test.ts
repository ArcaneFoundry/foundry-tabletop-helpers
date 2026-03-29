import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOD } from "../../logger";
import {
  __themeInternals,
  applyFthThemeToNode,
  FTH_THEME_MODE_SETTING_KEY,
  getFthThemeMode,
  handleFthThemeModeChange,
  resolveFthTheme,
} from "./fth-theme";

function makeClassList(initial: string[] = []) {
  const values = new Set(initial);
  return {
    add: (...tokens: string[]) => tokens.forEach((token) => values.add(token)),
    toggle: (token: string, force?: boolean) => {
      if (force === undefined) {
        if (values.has(token)) values.delete(token);
        else values.add(token);
        return;
      }
      if (force) values.add(token);
      else values.delete(token);
    },
    contains: (token: string) => values.has(token),
  };
}

class FakeNode {
  dataset: Record<string, string | undefined> = {};
  style: { colorScheme?: string } = {};
  classList = makeClassList();
  private readonly children: FakeNode[] = [];

  constructor(private readonly classes: string[] = []) {
    this.classList.add(...classes);
  }

  append(...nodes: FakeNode[]): void {
    this.children.push(...nodes);
  }

  matches(selector: string): boolean {
    return selector
      .split(",")
      .map((part) => part.trim().replace(/^\./, ""))
      .some((className) => this.classes.includes(className));
  }

  querySelectorAll(selector: string): FakeNode[] {
    const results: FakeNode[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }
}

describe("fth-theme", () => {
  const originalGame = (globalThis as Record<string, unknown>).game;
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalDocument = (globalThis as Record<string, unknown>).document;

  const store = new Map<string, unknown>();
  const addEventListenerMock = vi.fn();
  const removeEventListenerMock = vi.fn();

  beforeEach(() => {
    store.clear();
    addEventListenerMock.mockReset();
    removeEventListenerMock.mockReset();

    (globalThis as Record<string, unknown>).game = {
      settings: {
        get: (module: string, key: string) => store.get(`${module}.${key}`),
      },
    };

    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn(() => ({
        matches: true,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      })),
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).game = originalGame;
    (globalThis as Record<string, unknown>).window = originalWindow;
    (globalThis as Record<string, unknown>).document = originalDocument;
  });

  it("resolves the stored theme mode and falls back to system", () => {
    expect(getFthThemeMode()).toBe("system");

    store.set(`${MOD}.${FTH_THEME_MODE_SETTING_KEY}`, "dark");
    expect(getFthThemeMode()).toBe("dark");

    store.set(`${MOD}.${FTH_THEME_MODE_SETTING_KEY}`, "weird");
    expect(getFthThemeMode()).toBe("system");
  });

  it("resolves explicit and system-driven themes", () => {
    expect(resolveFthTheme("light", true)).toBe("light");
    expect(resolveFthTheme("dark", false)).toBe("dark");
    expect(resolveFthTheme("system", true)).toBe("dark");
    expect(resolveFthTheme("system", false)).toBe("light");
  });

  it("applies theme attributes and classes to matching roots", () => {
    store.set(`${MOD}.${FTH_THEME_MODE_SETTING_KEY}`, "dark");

    const documentRoot = new FakeNode(["app"]);
    const creatorRoot = new FakeNode(["fth-character-creator"]);
    const mountRoot = new FakeNode(["fth-ui-root"]);
    const unrelated = new FakeNode(["not-themed"]);
    documentRoot.append(creatorRoot, mountRoot, unrelated);

    applyFthThemeToNode(documentRoot);

    for (const node of [creatorRoot, mountRoot]) {
      expect(node.dataset.fthTheme).toBe("dark");
      expect(node.style.colorScheme).toBe("dark");
      expect(node.classList.contains("fth-theme-root")).toBe(true);
      expect(node.classList.contains("dark")).toBe(true);
    }
    expect(unrelated.dataset.fthTheme).toBeUndefined();
  });

  it("refreshes document roots and tracks the system listener in system mode", () => {
    store.set(`${MOD}.${FTH_THEME_MODE_SETTING_KEY}`, "system");

    const documentRoot = new FakeNode(["app"]);
    const lpcsRoot = new FakeNode(["lpcs-sheet"]);
    documentRoot.append(lpcsRoot);
    (globalThis as Record<string, unknown>).document = {
      documentElement: documentRoot,
    };

    handleFthThemeModeChange();

    expect(addEventListenerMock).toHaveBeenCalledWith("change", expect.any(Function));
    expect(lpcsRoot.dataset.fthTheme).toBe("dark");
    expect(__themeInternals.FTH_THEME_ROOT_SELECTOR).toContain(".lpcs-sheet");
  });

  it("includes downstream FTH surfaces in the theme root selector", () => {
    expect(__themeInternals.FTH_THEME_ROOT_SELECTOR).toContain(".fth-asset-picker");
    expect(__themeInternals.FTH_THEME_ROOT_SELECTOR).toContain(".batch-initiative-dialog");
    expect(__themeInternals.FTH_THEME_ROOT_SELECTOR).toContain(".fth-damage-panel");
    expect(__themeInternals.FTH_THEME_ROOT_SELECTOR).toContain(".fth-monster-preview");
    expect(__themeInternals.FTH_THEME_ROOT_SELECTOR).toContain(".fth-party-summary");
    expect(__themeInternals.FTH_THEME_ROOT_SELECTOR).toContain(".fth-rules-reference");
  });
});
