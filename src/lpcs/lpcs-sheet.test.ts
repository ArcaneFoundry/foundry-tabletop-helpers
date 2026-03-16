import { afterEach, describe, expect, it, vi } from "vitest";

import { buildLPCSSheetClass } from "./lpcs-sheet";

function installFoundryGlobals(): void {
  class FakeActorSheetV2 {
    actor?: Record<string, unknown>;
    element: HTMLElement | null = null;
    isEditable = false;

    constructor(actor?: Record<string, unknown>) {
      this.actor = actor;
    }

    async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
      return { base: true, options };
    }

    async _preparePartContext(
      _partId: string,
      context: Record<string, unknown>,
      _options: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
      return context;
    }

    async _onRender(_context: Record<string, unknown>, _options: Record<string, unknown>): Promise<void> {}
  }

  const globals = globalThis as Record<string, unknown>;
  globals.foundry = {
    applications: {
      api: {
        HandlebarsApplicationMixin: <TBase extends new (...args: any[]) => object>(Base: TBase) =>
          class extends Base {
            constructor(...args: any[]) {
              super(...args);
            }
          },
      },
      sheets: {
        ActorSheetV2: FakeActorSheetV2,
      },
      apps: {
        DocumentSheetConfig: {},
      },
    },
  };
  globals.Actor = class {};
}

describe("lpcs sheet", () => {
  const originalFoundry = (globalThis as Record<string, unknown>).foundry;
  const originalActor = (globalThis as Record<string, unknown>).Actor;

  afterEach(() => {
    (globalThis as Record<string, unknown>).foundry = originalFoundry;
    (globalThis as Record<string, unknown>).Actor = originalActor;
  });

  it("builds a sheet class and prepares context from the typed actor shell", async () => {
    installFoundryGlobals();
    const SheetClass = buildLPCSSheetClass();
    expect(SheetClass).not.toBeNull();

    const actor = {
      name: "Arannis",
      img: "portrait.webp",
      system: {
        details: { level: 2, race: "Elf" },
        attributes: {
          hp: { value: 12, max: 18, temp: 1 },
          ac: { value: 14 },
          prof: 2,
          init: { total: 3 },
          movement: { walk: 30 },
        },
        abilities: {
          str: { value: 10, mod: 0, save: 0, proficient: 0 },
          dex: { value: 16, mod: 3, save: 5, proficient: 1 },
          con: { value: 12, mod: 1, save: 1, proficient: 0 },
          int: { value: 14, mod: 2, save: 2, proficient: 0 },
          wis: { value: 10, mod: 0, save: 0, proficient: 0 },
          cha: { value: 8, mod: -1, save: -1, proficient: 0 },
        },
        skills: {},
        currency: {},
        traits: {},
      },
      items: [],
    };

    const sheet = new (SheetClass as new (actor?: Record<string, unknown>) => {
      actor?: Record<string, unknown>;
      isEditable: boolean;
      title: string;
      _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>>;
    })(actor);
    sheet.isEditable = true;

    const context = await sheet._prepareContext({ test: true });

    expect(sheet.title).toBe("Arannis — Live Sheet");
    expect(context).toMatchObject({
      base: true,
      editable: true,
      vm: expect.objectContaining({
        name: "Arannis",
        ac: 14,
      }),
    });
  });

  it("uses the form handler to submit actor updates", async () => {
    installFoundryGlobals();
    const SheetClass = buildLPCSSheetClass() as unknown as {
      DEFAULT_OPTIONS: {
        form: {
          handler(
            this: { actor?: { update(data: Record<string, unknown>): Promise<unknown> } },
            event: Event,
            form: HTMLFormElement,
            formData: Record<string, unknown>,
          ): Promise<void>;
        };
      };
    };
    const update = vi.fn(async () => undefined);

    await SheetClass.DEFAULT_OPTIONS.form.handler.call(
      { actor: { update } },
      new Event("submit"),
      {} as HTMLFormElement,
      { "system.attributes.hp.value": 9 },
    );

    expect(update).toHaveBeenCalledWith({ "system.attributes.hp.value": 9 });
  });
});
