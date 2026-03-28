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
            featureHeading: "First-Level Features",
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
    expect(markup).toContain("First-Level Features");
    expect(markup.indexOf("Opening Kit")).toBeLessThan(markup.indexOf("Hit Die"));
  });

  it("renders higher-level feature headings from the view model", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassSummaryStepScreen, {
        controller: {} as never,
        shellContext: {
          stepViewModel: {
            className: "Wizard",
            classImage: "",
            classIdentifier: "wizard",
            overview: "",
            primaryAbilitySummary: "INT",
            startingLevel: 3,
            featureHeading: "Third-Level Features",
            hitDie: "d6",
            featureCount: 1,
            chosenSkills: ["Arcana", "History"],
            chosenWeaponMasteries: [],
            savingThrows: ["INT", "WIS"],
            armorProficiencies: [],
            weaponProficiencies: [],
            toolProficiencies: [],
            selectedGrantGroups: [],
            features: [{ title: "Arcane Recovery", description: "<p>Recover spell power.</p>" }],
            hasChosenSkills: true,
            hasChosenWeaponMasteries: false,
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

    expect(markup).toContain("Third-Level Features");
    expect(markup).not.toContain("Current-Level Features");
  });

  it("lets a single opening-kit card span the wider layout", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassSummaryStepScreen, {
        controller: {} as never,
        shellContext: {
          stepViewModel: {
            className: "Rogue",
            classImage: "",
            classIdentifier: "rogue",
            overview: "",
            primaryAbilitySummary: "DEX",
            startingLevel: 1,
            featureHeading: "First-Level Features",
            hitDie: "d8",
            featureCount: 0,
            chosenSkills: ["Stealth", "Sleight of Hand"],
            chosenWeaponMasteries: [],
            savingThrows: ["DEX", "INT"],
            armorProficiencies: [],
            weaponProficiencies: [],
            toolProficiencies: [],
            selectedGrantGroups: [],
            features: [],
            hasChosenSkills: true,
            hasChosenWeaponMasteries: false,
            hasSavingThrows: true,
            hasArmorProficiencies: false,
            hasWeaponProficiencies: false,
            hasToolProficiencies: false,
            hasFeatures: false,
          },
        },
        state: {} as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Skills Chosen");
    expect(markup).toContain("lg:col-span-2");
  });
});
