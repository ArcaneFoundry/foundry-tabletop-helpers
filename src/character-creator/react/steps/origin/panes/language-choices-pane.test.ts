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
});
