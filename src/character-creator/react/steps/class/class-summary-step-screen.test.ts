import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ClassSummaryStepScreen } from "./class-summary-step-screen";

describe("ClassSummaryStepScreen", () => {
  it("renders class metrics inside Opening Kit and keeps feature headers padded", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassSummaryStepScreen, {
        controller: {} as never,
        shellContext: {
          stepViewModel: {
            className: "Paladin",
            classImage: "",
            classIdentifier: "paladin",
            overview: "",
            primaryAbilitySummary: "STR / CHA",
            startingLevel: 1,
            hitDie: "d10",
            featureCount: 1,
            chosenSkills: ["Athletics"],
            chosenWeaponMasteries: ["Battleaxe (Topple)"],
            savingThrows: ["WIS", "CHA"],
            armorProficiencies: [],
            weaponProficiencies: [],
            toolProficiencies: [],
            selectedGrantGroups: [],
            features: [{ title: "Divine Sense", description: "<p>Sense celestial influence.</p>" }],
            hasChosenSkills: true,
            hasChosenWeaponMasteries: true,
            hasSavingThrows: true,
            hasArmorProficiencies: false,
            hasWeaponProficiencies: false,
            hasToolProficiencies: false,
            hasFeatures: true,
          },
        },
        state: {} as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Opening Kit");
    expect(markup).toContain("cc-class-summary__kit-metrics");
    expect(markup).not.toContain("cc-class-summary__metrics");
    expect(markup).toContain("Hit Die");
    expect(markup).toContain("Saving Throws");
    expect(markup).toContain("Prime Attribute");
    expect(markup).toContain("px-5 py-4");
    expect(markup).toContain('style="padding-block:1rem;padding-inline:1.25rem"');
    expect(markup).toContain("Current-Level Features");
    expect(markup.indexOf("Opening Kit")).toBeLessThan(markup.indexOf("Hit Die"));
  });
});
