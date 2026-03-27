import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FeatsStepScreen } from "./feats-step-screen";

describe("FeatsStepScreen", () => {
  it("renders the extracted ASI screen with attunement cards and summary content", () => {
    const markup = renderToStaticMarkup(createElement(FeatsStepScreen, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          choice: "asi",
          isAsi: true,
          isFeat: false,
          asiCount: 1,
          maxAsiPicks: 2,
          abilities: [
            {
              key: "str",
              label: "Strength",
              score: 15,
              modifier: "+2",
              selected: true,
              atMax: false,
            },
            {
              key: "dex",
              label: "Dexterity",
              score: 20,
              modifier: "+5",
              selected: false,
              atMax: true,
            },
          ],
          feats: [],
          selectedFeat: null,
          hasFeats: false,
          emptyMessage: "No feats available.",
        },
      },
      state: {
        selections: {
          feats: {
            choice: "asi",
            asiAbilities: ["str"],
          },
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("Shape Your Ascension");
    expect(markup).toContain("Ability Attunement");
    expect(markup).toContain("Attunement Picks");
    expect(markup).toContain("Strength");
    expect(markup).toContain("Current score 15");
    expect(markup).toContain("Attuned");
    expect(markup).toContain("At Maximum");
    expect(markup).toContain("Strength");
    expect(markup).toContain("1 of 2 picks chosen");
    expect(markup).not.toContain("Choose a feat to inspect");
  });

  it("renders the feat catalog and selected feat inspector from the extracted build-step file", () => {
    const markup = renderToStaticMarkup(createElement(FeatsStepScreen, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          choice: "feat",
          isAsi: false,
          isFeat: true,
          asiCount: 0,
          maxAsiPicks: 2,
          abilities: [],
          feats: [
            {
              uuid: "Compendium.feat.alert",
              name: "Alert",
              img: "alert.png",
              packLabel: "PHB",
              selected: false,
            },
            {
              uuid: "Compendium.feat.tough",
              name: "Tough",
              img: "tough.png",
              packLabel: "PHB",
              selected: true,
            },
          ],
          selectedFeat: {
            uuid: "Compendium.feat.tough",
            name: "Tough",
            img: "tough.png",
            packLabel: "PHB",
            selected: true,
          },
          hasFeats: true,
          emptyMessage: "No feats available.",
        },
      },
      state: {
        selections: {
          feats: {
            choice: "feat",
            featUuid: "Compendium.feat.tough",
            featName: "Tough",
            featImg: "tough.png",
          },
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("Feat Catalog");
    expect(markup).toContain("Choose a feat artifact to bind into the build");
    expect(markup).toContain("Alert");
    expect(markup).toContain("Tough");
    expect(markup).toContain("Selected Feat");
    expect(markup).toContain("PHB");
    expect(markup).toContain("Selected: Tough");
    expect(markup).toContain("Bound to build");
    expect(markup).toContain("Selection State");
  });

  it("renders an intentional empty catalog state when no feats are indexed", () => {
    const markup = renderToStaticMarkup(createElement(FeatsStepScreen, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          choice: "feat",
          isAsi: false,
          isFeat: true,
          asiCount: 0,
          maxAsiPicks: 2,
          abilities: [],
          feats: [],
          selectedFeat: null,
          hasFeats: false,
          emptyMessage: "No feats available. Check your GM configuration.",
        },
      },
      state: {
        selections: {
          feats: {
            choice: "feat",
          },
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("No feats indexed");
    expect(markup).toContain("Catalog sealed");
    expect(markup).toContain("No feats available. Check your GM configuration.");
  });
});
