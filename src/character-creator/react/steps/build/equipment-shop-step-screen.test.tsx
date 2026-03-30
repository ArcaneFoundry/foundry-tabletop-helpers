import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  EquipmentShopStepScreen,
  mergeEquipmentShopSelection,
  updateEquipmentLedgerStepData,
  updateEquipmentTransactionSelection,
} from "./equipment-shop-step-screen";

describe("EquipmentShopStepScreen", () => {
  it("renders the mounted shop inventory, live funds summary, and projected inventory", () => {
    const markup = renderToStaticMarkup(createElement(EquipmentShopStepScreen, {
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
                  description: "Ink and references.",
                  items: [
                    { uuid: "item.book", name: "Book", quantity: 1, itemType: "Gear", priceCp: 2500 },
                  ],
                  goldCp: 0,
                  totalValueCp: 0,
                },
              ],
            },
            shopInventory: [
              {
                uuid: "item.rope",
                name: "Rope",
                img: "rope.png",
                packId: "items",
                packLabel: "PHB",
                type: "item",
                itemType: "Adventuring Gear",
                priceCp: 100,
              },
              {
                uuid: "item.torch",
                name: "Torch",
                img: "torch.png",
                packId: "items",
                packLabel: "PHB",
                type: "item",
                itemType: "Adventuring Gear",
                priceCp: 10,
              },
            ],
          },
          selection: {
            classOptionId: "class-gold",
            backgroundOptionId: "background-kit",
            purchases: { "item.rope": 1 },
            sales: {},
            shopMode: "buy",
            baseGoldCp: 10000,
            remainingGoldCp: 9900,
          },
        },
      },
      state: {
        selections: {
          equipment: {
            classOptionId: "class-gold",
            backgroundOptionId: "background-kit",
            purchases: { "item.rope": 1 },
            sales: {},
            shopMode: "buy",
            baseGoldCp: 10000,
            remainingGoldCp: 9900,
          },
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("Spend the coin your loadout leaves behind");
    expect(markup).toContain("Buy Equipment");
    expect(markup).toContain("Sell Equipment");
    expect(markup).toContain("Rope");
    expect(markup).toContain("Torch");
    expect(markup).toContain("Remaining funds");
    expect(markup).toContain("Marked to buy");
    expect(markup).toContain("Projected inventory");
    expect(markup).toContain("Book");
    expect(markup).toContain("content-visibility:auto");
  });

  it("renders an explicit empty state when no supported shop inventory is available", () => {
    const markup = renderToStaticMarkup(createElement(EquipmentShopStepScreen, {
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
              options: [
                {
                  id: "class-gold",
                  source: "class",
                  mode: "gold",
                  title: "Take Gold Instead",
                  description: "Turn the class grant into coin.",
                  items: [],
                  goldCp: 0,
                  totalValueCp: 5000,
                },
              ],
            },
            backgroundSource: {
              source: "background",
              label: "Soldier",
              img: "soldier.png",
              options: [
                {
                  id: "background-kit",
                  source: "background",
                  mode: "equipment",
                  title: "Soldier's Pack",
                  description: "Uniform, insignia, and common gear.",
                  items: [],
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
            baseGoldCp: 5000,
            remainingGoldCp: 5000,
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
            baseGoldCp: 5000,
            remainingGoldCp: 5000,
          },
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("No supported mundane shop inventory is currently available from the enabled item packs.");
    expect(markup).toContain("Funds still in purse");
  });
});

describe("equipment shop selection helpers", () => {
  it("preserves the existing equipment selection while switching shop mode", () => {
    expect(mergeEquipmentShopSelection({
      classOptionId: "class-kit",
      backgroundOptionId: "background-kit",
      purchases: { rope: 1 },
      sales: { torch: 1 },
      shopMode: "buy",
      baseGoldCp: 10000,
      remainingGoldCp: 9800,
    }, {
      shopMode: "sell",
    })).toEqual({
      classOptionId: "class-kit",
      backgroundOptionId: "background-kit",
      purchases: { rope: 1 },
      sales: { torch: 1 },
      shopMode: "sell",
      baseGoldCp: 10000,
      remainingGoldCp: 9800,
    });
  });

  it("writes purchase and sale quantities through the existing equipment selection model", () => {
    const withPurchase = updateEquipmentTransactionSelection({
      classOptionId: "class-kit",
      backgroundOptionId: "background-kit",
      purchases: { rope: 1 },
      sales: {},
      shopMode: "buy",
      baseGoldCp: 10000,
      remainingGoldCp: 9900,
    }, "purchase", "item.torch", 2);

    expect(withPurchase).toMatchObject({
      purchases: { rope: 1, "item.torch": 2 },
      sales: {},
    });

    expect(updateEquipmentTransactionSelection(withPurchase, "purchase", "item.torch", 0)).toMatchObject({
      purchases: { rope: 1 },
      sales: {},
    });

    expect(updateEquipmentTransactionSelection(withPurchase, "sale", "item.rope", 1)).toMatchObject({
      purchases: { rope: 1, "item.torch": 2 },
      sales: { "item.rope": 1 },
    });
  });

  it("writes shop updates back to the equipment ledger step instead of equipmentShop", () => {
    const updateStepData = vi.fn();

    updateEquipmentLedgerStepData({
      updateCurrentStepData: () => undefined,
      updateStepData,
    } as never, {
      classOptionId: "class-gold",
      backgroundOptionId: "background-kit",
      purchases: { "item.rope": 1 },
      sales: {},
      shopMode: "buy",
      baseGoldCp: 10000,
      remainingGoldCp: 9900,
    });

    expect(updateStepData).toHaveBeenCalledWith("equipment", {
      classOptionId: "class-gold",
      backgroundOptionId: "background-kit",
      purchases: { "item.rope": 1 },
      sales: {},
      shopMode: "buy",
      baseGoldCp: 10000,
      remainingGoldCp: 9900,
    }, undefined);
  });
});
