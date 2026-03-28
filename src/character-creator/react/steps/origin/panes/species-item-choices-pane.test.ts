import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SpeciesItemChoicesPane } from "./species-item-choices-pane";

describe("SpeciesItemChoicesPane", () => {
  it("renders grouped item-choice sections with local counters and validation guidance", () => {
    const markup = renderToStaticMarkup(createElement(SpeciesItemChoicesPane, {
      controller: {
        refresh: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          description: "Choose the gifts that complete this species grant.",
          requiredCount: 2,
          title: "Choose Species Gifts",
        },
      },
      state: {
        selections: {
          species: {
            advancementRequirements: [
              {
                advancementType: "ItemGrant",
                groupKey: "astral-gift",
                id: "astral-gift",
                itemChoices: [
                  {
                    uuid: "gift-spark",
                    name: "Gift of Sparks",
                    img: "gift-sparks.webp",
                  },
                  {
                    uuid: "gift-glow",
                    name: "Gift of Glow",
                    img: "gift-glow.webp",
                  },
                ],
                level: 0,
                pool: ["*"],
                requiredCount: 1,
                source: "species",
                type: "itemChoices",
                title: "Astral Gift",
              },
              {
                advancementType: "ItemGrant",
                groupKey: "rune-gift",
                id: "rune-gift",
                itemChoices: [
                  {
                    uuid: "gift-rune",
                    name: "Gift of Runes",
                    img: "gift-runes.webp",
                  },
                ],
                level: 0,
                pool: ["*"],
                requiredCount: 2,
                source: "species",
                type: "itemChoices",
                title: "Rune Gift",
              },
            ],
            name: "Aasimar",
          },
          speciesChoices: {
            chosenItems: {
              "astral-gift": ["gift-spark"],
            },
          },
        },
      },
    } as never));

    expect(markup).toContain("cc-origin-species-item-choices-pane");
    expect(markup).toContain("cc-origin-species-item-choices-pane__group");
    expect(markup).toContain("cc-origin-species-item-choices-pane__validation");
    expect(markup).toContain("Grouped Requirements");
    expect(markup).toContain("2 sections");
    expect(markup).toContain("1 / 2 chosen");
    expect(markup).toContain("Astral Gift");
    expect(markup).toContain("Rune Gift");
    expect(markup).toContain("1 / 1 selected");
    expect(markup).toContain("0 / 1 selected");
    expect(markup).toContain("Sparse group allowed");
    expect(markup).toContain("Requirement met");
    expect(markup).toContain("The enabled compendium data exposes fewer choices");
    expect(markup).toContain("data-selected=\"true\"");
    expect(markup).toContain("Selected choice");
    expect(markup).toContain("Available choice");
  });

  it("shows a focused empty state when no item choices are available", () => {
    const markup = renderToStaticMarkup(createElement(SpeciesItemChoicesPane, {
      controller: {
        refresh: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          description: "Choose the gifts that complete this species grant.",
          itemChoiceEmptyMessage: "This species does not expose any item choices.",
          requiredCount: 0,
          title: "Choose Species Gifts",
        },
      },
      state: {
        selections: {
          species: {
            advancementRequirements: [],
            name: "Aasimar",
          },
          speciesChoices: {
            chosenItems: {},
          },
        },
      },
    } as never));

    expect(markup).toContain("This species does not expose any item choices.");
    expect(markup).toContain("Selections");
    expect(markup).toContain("Groups");
    expect(markup).not.toContain("cc-origin-species-item-choices-pane__group");
  });
});
