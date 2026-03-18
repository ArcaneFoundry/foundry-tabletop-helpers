/**
 * Character Creator — Card Selection DOM Utilities
 *
 * Shared targeted DOM update for card-grid selection steps
 * (Race, Background, Class, Subclass). Avoids full re-renders
 * by patching selected state and preview badge in-place.
 */

import { renderTemplate } from "../../types";
import type { CreatorIndexEntry } from "../character-creator-types";

interface CardDetailTemplatePatchOptions {
  templatePath: string;
  data: Record<string, unknown>;
  paneSelector?: string;
  requestId?: string;
}

/**
 * Patch the card grid selection state and shell header preview badge in-place.
 * Toggles the --selected class on cards and updates the selection preview.
 */
export function patchCardSelection(
  el: HTMLElement,
  selectedUuid: string,
  entry: CreatorIndexEntry,
): void {
  // Toggle selected class on all cards
  el.querySelectorAll<HTMLElement>("[data-card-uuid]").forEach((card) => {
    const isSelected = card.dataset.cardUuid === selectedUuid;
    card.classList.toggle("cc-select-card--selected", isSelected);
    card.setAttribute("aria-selected", String(isSelected));
  });

  // The preview badge lives in the shell header (sibling of step content).
  // Walk up to the wizard shell to find it.
  const shell = el.closest(".cc-wizard-shell") ?? document;

  const preview = shell.querySelector("[data-selection-preview]");
  if (preview) {
    preview.classList.remove("cc-selection-preview--empty");

    const img = preview.querySelector("[data-preview-img]") as HTMLImageElement | null;
    if (img) {
      img.src = entry.img;
      img.alt = entry.name;
    }

    const nameEl = preview.querySelector("[data-preview-name]");
    if (nameEl) nameEl.textContent = entry.name;

    const sourceEl = preview.querySelector("[data-preview-source]");
    if (sourceEl) sourceEl.textContent = entry.packLabel;
  }
}

/**
 * Start a card-selection UI update and return a request id that can be used
 * to guard later async detail rendering against stale responses.
 */
export function beginCardSelectionUpdate(
  el: HTMLElement,
  selectedUuid: string,
  entry: CreatorIndexEntry,
): string {
  patchCardSelection(el, selectedUuid, entry);
  const requestId = String(Date.now() + Math.random());
  el.dataset.cardSelectionRequestId = requestId;
  return requestId;
}

export function isCurrentCardSelectionUpdate(el: HTMLElement, requestId: string): boolean {
  return el.dataset.cardSelectionRequestId === requestId;
}

/**
 * Render a detail-pane template and swap it into the current step without
 * forcing a full wizard rerender.
 */
export async function patchCardDetailFromTemplate(
  el: HTMLElement,
  options: CardDetailTemplatePatchOptions,
): Promise<boolean> {
  const { templatePath, data, requestId, paneSelector = ".cc-card-detail-pane" } = options;
  if (requestId && !isCurrentCardSelectionUpdate(el, requestId)) return false;

  const html = await renderTemplate(templatePath, data);
  if (!html) return false;
  if (requestId && !isCurrentCardSelectionUpdate(el, requestId)) return false;

  const pane = el.querySelector<HTMLElement>(paneSelector);
  if (!pane) return false;

  const template = document.createElement("template");
  template.innerHTML = html.trim();
  pane.replaceChildren(template.content.cloneNode(true));
  return true;
}
