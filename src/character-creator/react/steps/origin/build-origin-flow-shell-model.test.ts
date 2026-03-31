import { describe, expect, it } from "vitest";

import { buildOriginFlowShellModel } from "./build-origin-flow-shell-model";

describe("buildOriginFlowShellModel", () => {
  it("maps origin steps onto the expected pane and title", () => {
    const model = buildOriginFlowShellModel(
      {
        selections: {
          class: {
            identifier: "fighter",
          },
        },
      } as never,
      [
        { id: "class", label: "Class", icon: "fa-solid fa-shield", status: "complete", active: false },
        { id: "backgroundSkillConflicts", label: "Resolve Overlapping Skills", icon: "fa-solid fa-list-check", status: "pending", active: false },
        { id: "backgroundAsi", label: "Background Ability Scores", icon: "fa-solid fa-chart-line", status: "pending", active: true },
        { id: "species", label: "Species", icon: "fa-solid fa-dna", status: "pending", active: false },
        { id: "originSummary", label: "Origin Summary", icon: "fa-solid fa-stars", status: "pending", active: false },
      ],
      "backgroundAsi",
    );

    expect(model.currentPane).toBe("backgroundAsi");
    expect(model.title).toBe("Shape Your Aptitudes");
    expect(model.selectedClassIdentifier).toBe("fighter");
  });

  it("falls back to the background pane for unrecognized step ids", () => {
    const model = buildOriginFlowShellModel(
      {
        selections: {},
      } as never,
      [
        { id: "class", label: "Class", icon: "fa-solid fa-shield", status: "pending", active: false },
      ],
      "not-a-real-step",
    );

    expect(model.currentPane).toBe("background");
    expect(model.title).toBe("Choose Your Background");
  });
});
