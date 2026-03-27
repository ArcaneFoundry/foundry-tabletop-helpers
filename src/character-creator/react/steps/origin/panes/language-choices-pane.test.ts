import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    motion: new Proxy({}, {
      get: (_target, tag: string) => React.forwardRef((props: Record<string, unknown>, ref) => {
        const {
          animate: _animate,
          initial: _initial,
          transition: _transition,
          variants: _variants,
          whileHover: _whileHover,
          whileTap: _whileTap,
          children,
          ...domProps
        } = props;
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }),
    }),
    useReducedMotion: () => true,
  };
});

import { LanguageChoicesPane } from "./language-choices-pane";

describe("LanguageChoicesPane", () => {
  it("renders a reusable language choice shell with counts, selection summary, and removable picks", () => {
    const markup = renderToStaticMarkup(createElement(LanguageChoicesPane, {
      description: "Choose two languages that suit the background.",
      emptyMessage: "No background language choices are available.",
      options: [
        { id: "elvish", label: "Elvish" },
        { id: "dwarvish", label: "Dwarvish" },
      ],
      onChange: vi.fn(),
      prefersReducedMotion: true,
      requiredCount: 2,
      selectedIds: ["elvish"],
      selectionLabel: "Select Languages",
      subtitle: "Acolyte",
      title: "Choose Languages",
    } as never));

    expect(markup).toContain("data-origins-language-scroll=\"true\"");
    expect(markup).toContain("Select Languages");
    expect(markup).toContain("Choose Languages");
    expect(markup).toContain("Acolyte");
    expect(markup).toContain("1 / 2 chosen");
    expect(markup).toContain("Chosen Languages");
    expect(markup).toContain("Elvish");
  });

  it("shows the empty selected summary when no languages are chosen yet", () => {
    const markup = renderToStaticMarkup(createElement(LanguageChoicesPane, {
      description: "Choose two languages that suit the background.",
      emptyMessage: "No background language choices are available.",
      options: [
        { id: "elvish", label: "Elvish" },
        { id: "dwarvish", label: "Dwarvish" },
      ],
      onChange: vi.fn(),
      prefersReducedMotion: true,
      requiredCount: 2,
      selectedIds: [],
      selectionLabel: "Select Languages",
      subtitle: "Acolyte",
      title: "Choose Languages",
    } as never));

    expect(markup).toContain("No languages selected yet.");
    expect(markup).toContain("0 / 2 chosen");
  });

  it("renders species-specific summary labels, validation notes, and removable chips", () => {
    const markup = renderToStaticMarkup(createElement(LanguageChoicesPane, {
      description: "Choose the additional languages granted by the species.",
      emptyMessage: "No species language choices are available.",
      options: [
        { id: "elvish", label: "Elvish" },
        { id: "dwarvish", label: "Dwarvish" },
      ],
      onChange: vi.fn(),
      prefersReducedMotion: true,
      requiredCount: 2,
      selectedIds: ["elvish"],
      selectedSummaryEmptyLabel: "No species languages selected yet.",
      selectedSummaryTitle: "Chosen Species Languages",
      selectionLabel: "Select Species Languages",
      statLabel: "Species Languages",
      subtitle: "Elf",
      title: "Choose Species Languages",
      validationMessages: [
        "Only 1 legal species language option remains, so this step will accept fewer picks than the species normally grants.",
      ],
      validationTitle: "Species Language Notes",
    } as never));

    expect(markup).toContain("Select Species Languages");
    expect(markup).toContain("Chosen Species Languages");
    expect(markup).toContain("Species Languages");
    expect(markup).toContain("Species Language Notes");
    expect(markup).toContain("cc-origin-summary-pill--interactive");
    expect(markup).toContain("Only 1 legal species language option remains");
  });
});
