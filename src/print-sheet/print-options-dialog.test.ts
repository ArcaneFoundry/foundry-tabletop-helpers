import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DefaultPrintOptions } from "../settings";
import type { SectionDef } from "./types";
import { showPrintOptionsDialog } from "./print-options-dialog";

const { getDialogClassMock, warnMock } = vi.hoisted(() => ({
  getDialogClassMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("../logger", () => ({
  Log: {
    warn: warnMock,
  },
}));

vi.mock("../types", () => ({
  getDialogClass: getDialogClassMock,
}));

const sections: SectionDef[] = [
  { key: "stats", label: "Stats", default: true },
  { key: "actions", label: "Actions", default: false },
];

const defaults: DefaultPrintOptions = {
  paperSize: "a4",
  portrait: "token",
  sections: {
    stats: false,
    actions: true,
  },
};

class FakeInput {
  constructor(
    public checked: boolean,
    public value: string,
  ) {}
}

class FakeFormHost {
  constructor(private readonly fields: Record<string, FakeInput | null>) {}

  querySelector(selector: string): FakeInput | null {
    return this.fields[selector] ?? null;
  }

  closest(): FakeFormHost {
    return this;
  }
}

function makeFormHost(overrides: {
  stats?: boolean;
  actions?: boolean;
  portrait?: string;
  paperSize?: string;
} = {}): FakeFormHost {
  const stats = overrides.stats ?? defaults.sections.stats;
  const actions = overrides.actions ?? defaults.sections.actions;
  const portrait = overrides.portrait ?? defaults.portrait;
  const paperSize = overrides.paperSize ?? defaults.paperSize;
  return new FakeFormHost({
    form: null,
    '[name="section-stats"]': new FakeInput(stats, String(stats)),
    '[name="section-actions"]': new FakeInput(actions, String(actions)),
    '[name="portrait"]:checked': new FakeInput(true, portrait),
    '[name="paperSize"]:checked': new FakeInput(true, paperSize),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("print options dialog", () => {
  it("falls back to defaults when the Dialog class is unavailable", async () => {
    getDialogClassMock.mockReturnValue(undefined);

    const result = await showPrintOptionsDialog("character", sections, defaults);

    expect(warnMock).toHaveBeenCalledWith("Dialog class not available; using defaults");
    expect(result).toEqual({
      paperSize: "a4",
      portrait: "token",
      sections: {
        stats: false,
        actions: true,
      },
    });
  });

  it("parses submitted form selections from the dialog callback", async () => {
    class FakeDialog {
      constructor(private readonly config: {
        buttons: {
          print: { callback(html: FakeFormHost): void };
        };
      }) {}

      render(): void {
        this.config.buttons.print.callback(makeFormHost({
          stats: true,
          actions: false,
          portrait: "none",
          paperSize: "letter",
        }));
      }
    }

    getDialogClassMock.mockReturnValue(FakeDialog);

    const result = await showPrintOptionsDialog("npc", sections, defaults);

    expect(result).toEqual({
      paperSize: "letter",
      portrait: "none",
      sections: {
        stats: true,
        actions: false,
      },
    });
  });

  it("resolves null when the dialog is cancelled or closed", async () => {
    class CancelDialog {
      constructor(private readonly config: {
        buttons: {
          cancel: { callback(): void };
        };
      }) {}

      render(): void {
        this.config.buttons.cancel.callback();
      }
    }

    getDialogClassMock.mockReturnValue(CancelDialog);
    await expect(showPrintOptionsDialog("party", sections, defaults)).resolves.toBeNull();

    class CloseDialog {
      constructor(private readonly config: {
        close(): void;
      }) {}

      render(): void {
        this.config.close();
      }
    }

    getDialogClassMock.mockReturnValue(CloseDialog);
    await expect(showPrintOptionsDialog("encounter", sections, defaults)).resolves.toBeNull();
  });
});
