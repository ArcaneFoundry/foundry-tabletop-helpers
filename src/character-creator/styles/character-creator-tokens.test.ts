import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("character creator light-theme token overrides", () => {
  it("strengthens creator-specific contrast tokens without changing the shared light theme globally", () => {
    const css = readFileSync(new URL("./character-creator-tokens.css", import.meta.url), "utf8");

    expect(css).toContain('.fth-character-creator.fth-theme-root[data-fth-theme="light"]');
    expect(css).toContain('[data-fth-theme="light"] .fth-character-creator');
    expect(css).toContain("--fth-color-border: rgb(138 103 52 / 0.28);");
    expect(css).toContain("--fth-theme-status-image: linear-gradient(180deg, rgb(168 121 47 / 0.24), rgb(168 121 47 / 0.12));");
    expect(css).toContain("--fth-theme-card-chip-bg: rgb(244 232 211 / 0.88);");
    expect(css).toContain("--fth-theme-card-selected-border: rgb(168 121 47 / 0.5);");
    expect(css).toContain("--cc-text-kicker: color-mix(in srgb, var(--fth-color-accent) 62%, var(--fth-color-text) 38%);");
  });
});
