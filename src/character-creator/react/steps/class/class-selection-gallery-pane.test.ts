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
          children,
          ...domProps
        } = props;
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }),
    }),
  };
});

import { ClassSelectionGalleryPane } from "./class-selection-gallery-pane";

type TestEntry = {
  uuid: string;
  name: string;
};

describe("ClassSelectionGalleryPane", () => {
  it("renders the gallery without the redundant intro chrome or a nested scroll owner", () => {
    const markup = renderToStaticMarkup(createElement(ClassSelectionGalleryPane<TestEntry>, {
      emptyState: createElement("div", null, "Empty"),
      entries: [
        { uuid: "class-1", name: "Barbarian" },
        { uuid: "class-2", name: "Wizard" },
      ],
      getEntryKey: (entry) => entry.uuid,
      prefersReducedMotion: true,
      renderEntry: (entry) => createElement("article", { "data-entry": entry.uuid }, entry.name),
    }));

    expect(markup).not.toContain("cc-class-selection-pane__intro");
    expect(markup).not.toContain('data-class-selection-eyebrow="true"');
    expect(markup).not.toContain('data-class-selection-badge="true"');
    expect(markup).toContain("cc-class-selection-pane__gallery-inner");
    expect(markup).not.toContain("cc-class-selection-pane__gallery-scroll");
    expect(markup).not.toContain("cc-class-selection-pane__gallery-shadow");
    expect(markup).not.toContain("overflow-y-auto");
    expect(markup).toContain("cc-class-chooser-grid");
    expect(markup).toContain("cc-class-selection-pane__gallery-shell");
    expect(markup.indexOf("cc-class-selection-pane__gallery-shell")).toBeLessThan(markup.indexOf("cc-class-selection-pane__gallery-inner"));
  });
});
