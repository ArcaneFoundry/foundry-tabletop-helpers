import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EquipmentStepScreen, mergeEquipmentSelection } from "./equipment-step-screen";

describe("EquipmentStepScreen", () => {
  it("renders both provision sources, mode consequences, and the combined loadout summary", () => {
    const markup = renderToStaticMarkup(createElement(EquipmentStepScreen, {
      controller: {
        updateCurrentStepData: () => undefined,
      },
      shellContext: {
        stepViewModel: {
          resolution: {
            classSource: {
              source: "class",
              label: "Wizard",
              img: "wizard.png",
              options: [
                {
                  id: "class-kit",
                  source: "class",
                  mode: "equipment",
                  title: "Scholar's Pack",
                  description: "Spellbook, component pouch, and a field satchel.",
                  items: [
                    { uuid: "item.spellbook", name: "Spellbook", quantity: 1, itemType: "Tool" },
                    { uuid: "item.pouch", name: "Component Pouch", quantity: 1, itemType: "Gear" },
                  ],
                  goldCp: 0,
                  totalValueCp: 0,
                },
                {
                  id: "class-gold",
                  source: "class",
                  mode: "gold",
                  title: "Take Gold Instead",
                  description: "Turn the class grant into coin.",
                  items: [],
                  goldCp: 0,
                  totalValueCp: 10000,
                },
              ],
            },
            backgroundSource: {
              source: "background",
              label: "Sage",
              img: "sage.png",
              options: [
                {
                  id: "background-kit",
                  source: "background",
                  mode: "equipment",
                  title: "Sage Supplies",
                  description: "Ink, parchment, and reference notes.",
                  items: [
                    { uuid: "item.ink", name: "Bottle of Ink", quantity: 1, itemType: "Consumable" },
                    { uuid: "item.paper", name: "Parchment", quantity: 10, itemType: "Adventuring Gear" },
                  ],
                  goldCp: 0,
                  totalValueCp: 0,
                },
              ],
            },
            shopInventory: [],
          },
          selection: {
            classOptionId: "class-gold",
            backgroundOptionId: "background-kit",
            purchases: {},
            sales: {},
            shopMode: "buy",
            baseGoldCp: 10000,
            remainingGoldCp: 10000,
          },
          derived: {
            selectedClassOption: {
              id: "class-gold",
              source: "class",
              mode: "gold",
              title: "Take Gold Instead",
              description: "Turn the class grant into coin.",
              items: [],
              goldCp: 0,
              totalValueCp: 10000,
            },
            selectedBackgroundOption: {
              id: "background-kit",
              source: "background",
              mode: "equipment",
              title: "Sage Supplies",
              description: "Ink, parchment, and reference notes.",
              items: [
                { uuid: "item.ink", name: "Bottle of Ink", quantity: 1, itemType: "Consumable" },
                { uuid: "item.paper", name: "Parchment", quantity: 10, itemType: "Adventuring Gear" },
              ],
              goldCp: 0,
              totalValueCp: 0,
            },
            baseGoldCp: 10000,
            remainingGoldCp: 10000,
            inventory: [
              { uuid: "item.ink", name: "Bottle of Ink", quantity: 1, itemType: "Consumable", priceCp: 100 },
              { uuid: "item.paper", name: "Parchment", quantity: 10, itemType: "Adventuring Gear", priceCp: 10 },
            ],
            purchases: [],
            sales: [],
          },
        },
      },
      state: {
        selections: {
          equipment: {
            classOptionId: "class-gold",
            backgroundOptionId: "background-kit",
            purchases: {},
            sales: {},
            shopMode: "buy",
            baseGoldCp: 10000,
            remainingGoldCp: 10000,
          },
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("Choose the provisions that will arm your first march");
    expect(markup).toContain("Class provisions");
    expect(markup).toContain("Background provisions");
    expect(markup).toContain("Scholar&#x27;s Pack");
    expect(markup).toContain("Take Gold Instead");
    expect(markup).toContain("Receive 100 gp");
    expect(markup).toContain("Sage Supplies");
    expect(markup).toContain("Loadout committed");
    expect(markup).toContain("Current forecast");
    expect(markup).toContain("Bottle of Ink");
    expect(markup).toContain("Parchment");
    expect(markup).toContain("Shop unlocks if gold remains");
    expect(markup).toContain("background-image:var(--cc-build-hero-image)");
    expect(markup).toContain("background-image:var(--cc-build-panel-image)");
    expect(markup).toContain("background-image:var(--cc-build-panel-soft-image)");
    expect(markup).toContain("cc-build-choice-layout");
    expect(markup).toContain("cc-build-choice-layout__rail");
    expect(markup).not.toContain("cc-theme-header--hero");
    expect(markup).not.toContain("cc-theme-panel--accent");
    expect(markup).not.toContain("cc-theme-panel--soft");
  });

  it("renders an explicit unsupported state when a source has no resolvable options", () => {
    const markup = renderToStaticMarkup(createElement(EquipmentStepScreen, {
      controller: {
        updateCurrentStepData: () => undefined,
      },
      shellContext: {
        stepViewModel: {
          resolution: {
            classSource: {
              source: "class",
              label: "Fighter",
              img: "fighter.png",
              options: [],
              unsupportedReason: "No supported class equipment options could be resolved from the current source data.",
            },
            backgroundSource: null,
            shopInventory: [],
          },
          selection: {},
          derived: {
            selectedClassOption: null,
            selectedBackgroundOption: null,
            baseGoldCp: 0,
            remainingGoldCp: 0,
            inventory: [],
            purchases: [],
            sales: [],
          },
        },
      },
      state: {
        selections: {
          equipment: {},
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("No supported class equipment options could be resolved from the current source data.");
    expect(markup).toContain("Choose a background before selecting background provisions.");
    expect(markup).toContain("Awaiting both source choices");
  });
});

describe("mergeEquipmentSelection", () => {
  it("preserves later shop state while replacing only the requested provision choice", () => {
    expect(mergeEquipmentSelection({
      classOptionId: "class-kit",
      backgroundOptionId: "background-kit",
      purchases: { rope: 1 },
      sales: { torch: 2 },
      shopMode: "sell",
      baseGoldCp: 10000,
      remainingGoldCp: 9400,
    }, {
      classOptionId: "class-gold",
    })).toEqual({
      classOptionId: "class-gold",
      backgroundOptionId: "background-kit",
      purchases: { rope: 1 },
      sales: { torch: 2 },
      shopMode: "sell",
      baseGoldCp: 10000,
      remainingGoldCp: 9400,
    });
  });
});
