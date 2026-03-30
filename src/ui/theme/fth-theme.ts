import { Log, MOD } from "../../logger";
import { getHooks, getSetting } from "../../types";
import { safe } from "../../utils";

export const FTH_THEME_MODE_SETTING_KEY = "themeMode";
export type FthThemeMode = "system" | "light" | "dark";
export type ResolvedFthTheme = "light" | "dark";

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";
const FTH_THEME_ROOT_SELECTOR = [
  ".fth-ui-root",
  ".fth-character-creator",
  ".lpcs-sheet",
  ".fth-asset-picker",
  ".am-upload-dialog-window",
  ".batch-initiative-dialog",
  ".fth-damage-panel",
  ".fth-monster-preview",
  ".fth-party-summary",
  ".fth-rules-reference",
].join(", ");

type ElementLike = {
  classList?: {
    add: (...tokens: string[]) => void;
    toggle: (token: string, force?: boolean) => void;
  };
  dataset?: Record<string, string | undefined>;
  style?: {
    colorScheme?: string;
  };
  matches?: (selector: string) => boolean;
  querySelectorAll?: (selector: string) => Iterable<ElementLike>;
};

type ParentNodeLike = ElementLike;

let systemThemeMediaQuery: MediaQueryList | null = null;
let systemThemeChangeHandler: ((event: MediaQueryListEvent) => void) | null = null;

export function getFthThemeMode(): FthThemeMode {
  const value = getSetting<string>(MOD, FTH_THEME_MODE_SETTING_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

export function resolveFthTheme(
  mode: FthThemeMode = getFthThemeMode(),
  prefersDark = getSystemPrefersDark(),
): ResolvedFthTheme {
  if (mode === "light" || mode === "dark") return mode;
  return prefersDark ? "dark" : "light";
}

export function applyFthThemeToNode(root: ParentNodeLike | null | undefined): void {
  if (!root) return;

  const resolved = resolveFthTheme();
  const candidates = new Set<ElementLike>();
  if (typeof root.matches === "function" && root.matches(FTH_THEME_ROOT_SELECTOR)) {
    candidates.add(root);
  }

  if (typeof root.querySelectorAll === "function") {
    for (const candidate of root.querySelectorAll(FTH_THEME_ROOT_SELECTOR)) {
      candidates.add(candidate as ElementLike);
    }
  }

  for (const candidate of candidates) {
    candidate.classList?.add("fth-theme-root");
    candidate.classList?.toggle("dark", resolved === "dark");
    if (candidate.dataset) candidate.dataset.fthTheme = resolved;
    if (candidate.style) candidate.style.colorScheme = resolved;
  }
}

export function refreshFthThemeRoots(): void {
  if (typeof document === "undefined") return;
  applyFthThemeToNode(document.documentElement as unknown as ParentNodeLike);
}

export function handleFthThemeModeChange(): void {
  syncSystemThemeListener();
  refreshFthThemeRoots();
  Log.debug("FTH theme mode changed", {
    mode: getFthThemeMode(),
    resolved: resolveFthTheme(),
  });
}

export function initFthTheme(): void {
  syncSystemThemeListener();
  refreshFthThemeRoots();
}

export function registerFthThemeHooks(): void {
  const hooks = getHooks();
  hooks?.on?.(
    "renderApplicationV2",
    ((app: { element?: ParentNodeLike | null }) =>
      safe(() => {
        applyFthThemeToNode(app?.element);
      }, "renderApplicationV2:fthTheme")) as (...args: unknown[]) => void,
  );

  hooks?.on?.(
    "renderApplication",
    ((app: { element?: ParentNodeLike | null }, html?: ParentNodeLike | ParentNodeLike[] | null) =>
      safe(() => {
        applyFthThemeToNode(app?.element);
        if (Array.isArray(html)) applyFthThemeToNode(html[0]);
        else applyFthThemeToNode(html ?? null);
      }, "renderApplication:fthTheme")) as (...args: unknown[]) => void,
  );
}

function syncSystemThemeListener(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

  const mode = getFthThemeMode();
  const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);

  if (systemThemeMediaQuery && systemThemeChangeHandler) {
    if (typeof systemThemeMediaQuery.removeEventListener === "function") {
      systemThemeMediaQuery.removeEventListener("change", systemThemeChangeHandler);
    } else if (typeof systemThemeMediaQuery.removeListener === "function") {
      systemThemeMediaQuery.removeListener(systemThemeChangeHandler);
    }
  }

  systemThemeMediaQuery = mediaQuery;
  systemThemeChangeHandler = (event: MediaQueryListEvent) => {
    if (getFthThemeMode() !== "system") return;
    refreshFthThemeRoots();
    Log.debug("FTH theme refreshed from system preference", { prefersDark: event.matches });
  };

  if (mode !== "system") return;

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", systemThemeChangeHandler);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(systemThemeChangeHandler);
  }
}

export const __themeInternals = {
  SYSTEM_DARK_QUERY,
  FTH_THEME_ROOT_SELECTOR,
};
