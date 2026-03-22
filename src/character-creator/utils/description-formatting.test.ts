import { describe, expect, it } from "vitest";

import { formatInjectedDescriptionHtml } from "./description-formatting";

describe("description formatting", () => {
  it("formats plain-text grants into readable paragraphs and labels", () => {
    const input = [
      "Ability Scores: Constitution, Intelligence, Wisdom",
      "Feat: @UUID[Compendium.test.Item.foo]{Emerald Enclave Fledgling}",
      "Equipment: Choose A or B: (A) Shortbow, [[/award 13GP]]; or (B) [[/award 50GP]]",
      "",
      "You learned to survive in the wilds.",
    ].join("\n");

    expect(formatInjectedDescriptionHtml(input)).toBe(
      "<p><strong class=\"cc-card-detail__fact-label\">Ability Scores:</strong> Constitution, Intelligence, Wisdom</p>"
      + "<p><strong class=\"cc-card-detail__fact-label\">Feat:</strong> Emerald Enclave Fledgling</p>"
      + "<p><strong class=\"cc-card-detail__fact-label\">Equipment:</strong> <strong class=\"cc-card-detail__choice-heading\">Choose A or B:</strong> <strong class=\"cc-card-detail__choice-marker\">(A)</strong> Shortbow, 13 GP<br><strong class=\"cc-card-detail__choice-marker\">(B)</strong> 50 GP</p>"
      + "<p>You learned to survive in the wilds.</p>"
    );
  });

  it("preserves html while formatting leading fact labels", () => {
    const input = "<p>Skill Proficiencies: Nature and Survival</p><p>Stay watchful.</p>";

    expect(formatInjectedDescriptionHtml(input)).toBe(
      "<p><strong class=\"cc-card-detail__fact-label\">Skill Proficiencies:</strong> Nature and Survival</p><p>Stay watchful.</p>"
    );
  });

  it("converts unresolved premium lookup syntax into readable fallback text", () => {
    const input = [
      "<p>Uses: [[lookup @prof]]</p>",
      "<p>You can add [[lookup @abilities.wis.mod]] to the roll.</p>",
      "<p>[[lookup @name]] can also draw [[/item Longsword]].</p>",
      "<p>(currently [[lookup @unknown.path]])</p>",
    ].join("");

    expect(formatInjectedDescriptionHtml(input)).toBe(
      "<p><strong class=\"cc-card-detail__fact-label\">Uses:</strong> your proficiency bonus</p>"
      + "<p>You can add your Wisdom modifier to the roll.</p>"
      + "<p>You can also draw Longsword.</p>"
      + "<p>(currently)</p>"
    );
  });

  it("normalizes unresolved reference tokens into readable labels", () => {
    const input = "<p>Take &Reference[Dash], &Reference[Disengage], or &amp;Reference[Hide].</p>";

    expect(formatInjectedDescriptionHtml(input)).toBe(
      "<p>Take Dash, Disengage, or Hide.</p>",
    );
  });
});
