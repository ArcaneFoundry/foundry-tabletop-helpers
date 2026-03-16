/**
 * Pre-print options dialog.
 * Shows the user all available sections (auto-selected) and lets them
 * deselect anything they don't want printed. Also includes portrait mode
 * and paper size options.
 */

import { Log } from "../logger";
import { getDialogClass } from "../types";
import type { DefaultPrintOptions } from "../settings";
import type { PaperSize, PortraitMode, PrintOptions, SectionDef, SheetType } from "./types";

/** Human-readable labels for sheet types */
const SHEET_LABELS: Record<SheetType, string> = {
  character: "Character Sheet",
  npc: "NPC Stat Block",
  encounter: "Encounter Group",
  party: "Party Summary",
};

interface FormQueryRoot {
  querySelector?(selector: string): Element | null;
  closest?(selector: string): Element | null;
}

interface FormHost extends FormQueryRoot {}

interface DialogHtmlWrapper {
  get?(index: number): FormHost | undefined;
  length?: number;
  0?: FormHost;
}

function isDialogHtmlWrapper(value: FormHost | DialogHtmlWrapper): value is DialogHtmlWrapper {
  return typeof value === "object" && value !== null
    && ("get" in value || 0 in value);
}

interface DialogButtonConfig {
  icon: string;
  label: string;
  callback: (html: HTMLElement | DialogHtmlWrapper) => void;
}

interface DialogConfig {
  title: string;
  content: string;
  buttons: {
    print: DialogButtonConfig;
    cancel: DialogButtonConfig;
  };
  default: "print";
  close: () => void;
}

interface DialogInstance {
  render(force: boolean): void;
}

type DialogConstructor = new (options: DialogConfig) => DialogInstance;

/**
 * Build the inner HTML for the options form.
 * @param sheetType The type of sheet being printed
 * @param sections Available section definitions
 * @param defaults Optional saved defaults to pre-populate the form
 */
function buildDialogContent(
  sheetType: SheetType,
  sections: SectionDef[],
  defaults?: DefaultPrintOptions,
): string {
  const sectionCheckboxes = sections
    .map((s) => {
      // Use saved default if available, otherwise use section's default
      const checked = defaults?.sections?.[s.key] ?? s.default;
      return `
    <div class="form-group">
      <label class="checkbox">
        <input type="checkbox" name="section-${s.key}" ${checked ? "checked" : ""} />
        ${s.label}
      </label>
    </div>`;
    })
    .join("");

  // Portrait options only for character and NPC sheets
  const showPortrait = sheetType === "character" || sheetType === "npc";
  const portraitValue = defaults?.portrait ?? "portrait";
  const portraitHtml = showPortrait
    ? `
    <fieldset>
      <legend>Image</legend>
      <div class="form-group">
        <label class="radio"><input type="radio" name="portrait" value="portrait" ${portraitValue === "portrait" ? "checked" : ""} /> Portrait</label>
      </div>
      <div class="form-group">
        <label class="radio"><input type="radio" name="portrait" value="token" ${portraitValue === "token" ? "checked" : ""} /> Token Art</label>
      </div>
      <div class="form-group">
        <label class="radio"><input type="radio" name="portrait" value="none" ${portraitValue === "none" ? "checked" : ""} /> No Image</label>
      </div>
    </fieldset>`
    : "";

  const paperValue = defaults?.paperSize ?? "letter";
  return `
    <form class="fth-print-options">
      <p style="margin-bottom:8px;">Configure your <strong>${SHEET_LABELS[sheetType]}</strong> print options:</p>
      <fieldset>
        <legend>Sections</legend>
        ${sectionCheckboxes}
      </fieldset>
      ${portraitHtml}
      <fieldset>
        <legend>Paper Size</legend>
        <div class="form-group">
          <label class="radio"><input type="radio" name="paperSize" value="letter" ${paperValue === "letter" ? "checked" : ""} /> US Letter</label>
        </div>
        <div class="form-group">
          <label class="radio"><input type="radio" name="paperSize" value="a4" ${paperValue === "a4" ? "checked" : ""} /> A4</label>
        </div>
      </fieldset>
    </form>`;
}

/**
 * Parse the dialog form into a PrintOptions object.
 */
function parseForm(
  html: FormHost | DialogHtmlWrapper,
  sections: SectionDef[],
): PrintOptions {
  const isHTMLElement = typeof HTMLElement !== "undefined" && html instanceof HTMLElement;
  const el: FormHost | null =
    isHTMLElement
      ? html as FormHost
      : isDialogHtmlWrapper(html)
        ? html.get?.(0) ?? html[0] ?? null
        : html;
  const form = ((el?.querySelector?.("form") ?? el?.closest?.("form") ?? el) as FormQueryRoot | null) ?? null;

  const sectionValues: Record<string, boolean> = {};
  for (const s of sections) {
    const cb = form?.querySelector?.(
      `[name="section-${s.key}"]`,
    ) as HTMLInputElement | null;
    sectionValues[s.key] = cb ? cb.checked : s.default;
  }

  const portraitRadio = form?.querySelector?.(
    '[name="portrait"]:checked',
  ) as HTMLInputElement | null;
  const portrait: PortraitMode =
    (portraitRadio?.value as PortraitMode) ?? "portrait";

  const paperRadio = form?.querySelector?.(
    '[name="paperSize"]:checked',
  ) as HTMLInputElement | null;
  const paperSize: PaperSize = (paperRadio?.value as PaperSize) ?? "letter";

  return { paperSize, portrait, sections: sectionValues };
}

/**
 * Show the pre-print options dialog and return the user's selections.
 * Returns null if the user cancels.
 * @param sheetType The type of sheet being printed
 * @param sections Available section definitions
 * @param defaults Optional saved defaults to pre-populate the form
 */
export async function showPrintOptionsDialog(
  sheetType: SheetType,
  sections: SectionDef[],
  defaults?: DefaultPrintOptions,
): Promise<PrintOptions | null> {
  const DialogClass = getDialogClass();
  if (!DialogClass) {
    Log.warn("Dialog class not available; using defaults");
    const sectionDefaults: Record<string, boolean> = {};
    for (const s of sections) sectionDefaults[s.key] = defaults?.sections?.[s.key] ?? s.default;
    return {
      paperSize: defaults?.paperSize ?? "letter",
      portrait: defaults?.portrait ?? "portrait",
      sections: sectionDefaults,
    };
  }

  const content = buildDialogContent(sheetType, sections, defaults);

  // Cast to a more usable type since we've already verified it exists
  const Dialog = DialogClass as DialogConstructor;

  return new Promise<PrintOptions | null>((resolve) => {
    new Dialog({
      title: `Print ${SHEET_LABELS[sheetType]}`,
      content,
      buttons: {
        print: {
          icon: '<i class="fa-solid fa-print"></i>',
          label: "Print",
          callback: (html: FormHost | DialogHtmlWrapper) => resolve(parseForm(html, sections)),
        },
        cancel: {
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: "Cancel",
          callback: () => resolve(null),
        },
      },
      default: "print",
      close: () => resolve(null),
    }).render(true);
  });
}
