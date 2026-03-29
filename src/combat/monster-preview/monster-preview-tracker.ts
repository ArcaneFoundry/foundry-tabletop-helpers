import { buildMonsterPreviewInlineHTML, type MonsterPreviewHeaderCue } from "./monster-preview-rendering";
import { applyFthThemeToNode } from "../../ui/theme/fth-theme";

export function findMonsterPreviewTrackerElement(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>("#combat")
    ?? doc.querySelector<HTMLElement>("[data-tab='combat']");
}

interface InjectMonsterPreviewOptions {
  cachedContentHTML: string;
  dismissed: boolean;
  pinned: boolean;
  headerCue: MonsterPreviewHeaderCue;
  headerFlash?: string | null;
  attachInlineListeners: (el: HTMLElement) => void;
}

export function injectMonsterPreviewIntoTracker(
  trackerEl: HTMLElement,
  options: InjectMonsterPreviewOptions,
): void {
  trackerEl.querySelector("#fth-mp-inline")?.remove();

  if (!options.cachedContentHTML || options.dismissed) return;

  const combatantList = trackerEl.querySelector<HTMLElement>(".combat-tracker")
    ?? trackerEl.querySelector<HTMLElement>("[class*='combatant']")?.parentElement
    ?? trackerEl.querySelector<HTMLElement>("ol, ul");

  const inlineEl = document.createElement("div");
  inlineEl.id = "fth-mp-inline";
  inlineEl.className = "fth-monster-preview fth-mp-inline";
  applyFthThemeToNode(inlineEl);
  inlineEl.innerHTML = buildMonsterPreviewInlineHTML(
    options.cachedContentHTML,
    options.pinned,
    options.headerCue,
    options.headerFlash,
  );

  if (combatantList) {
    combatantList.parentNode?.insertBefore(inlineEl, combatantList.nextSibling);
  } else {
    trackerEl.appendChild(inlineEl);
  }

  options.attachInlineListeners(inlineEl);
}
