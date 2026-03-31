import { beforeAll, describe, expect, it } from "vitest";

import { getOrderedSteps, registerAllSteps } from "./step-registry";

describe("step registry ordering", () => {
  beforeAll(() => {
    registerAllSteps();
  });

  it("keeps the canonical creator sequence aligned with the major workflow", () => {
    const ordered = getOrderedSteps().map((step) => step.id);

    const classIndex = ordered.indexOf("class");
    const speciesIndex = ordered.indexOf("species");
    const backgroundIndex = ordered.indexOf("background");
    const originSummaryIndex = ordered.indexOf("originSummary");
    const classChoicesIndex = ordered.indexOf("classChoices");
    const abilitiesIndex = ordered.indexOf("abilities");
    const featsIndex = ordered.indexOf("feats");
    const spellsIndex = ordered.indexOf("spells");
    const equipmentIndex = ordered.indexOf("equipment");
    const equipmentShopIndex = ordered.indexOf("equipmentShop");
    const portraitIndex = ordered.indexOf("portrait");
    const reviewIndex = ordered.indexOf("review");

    expect(classIndex).toBeGreaterThanOrEqual(0);
    expect(speciesIndex).toBeGreaterThan(classIndex);
    expect(backgroundIndex).toBeGreaterThan(speciesIndex);
    expect(originSummaryIndex).toBeGreaterThan(backgroundIndex);
    expect(classChoicesIndex).toBeGreaterThan(originSummaryIndex);
    expect(abilitiesIndex).toBeGreaterThan(classChoicesIndex);
    expect(featsIndex).toBeGreaterThan(abilitiesIndex);
    expect(spellsIndex).toBeGreaterThan(featsIndex);
    expect(equipmentIndex).toBeGreaterThan(spellsIndex);
    expect(equipmentShopIndex).toBeGreaterThan(equipmentIndex);
    expect(portraitIndex).toBeGreaterThan(equipmentShopIndex);
    expect(reviewIndex).toBeGreaterThan(portraitIndex);
  });
});
