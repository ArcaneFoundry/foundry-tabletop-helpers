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

import { ClassSelectionGalleryPane, shouldShowClassSelectionGalleryScrollShadow } from "./class-selection-gallery-pane";

type TestEntry = {
  uuid: string;
  name: string;
};

describe("ClassSelectionGalleryPane", () => {
  it("toggles the scroll shadow from the scroll position helper", () => {
    expect(shouldShowClassSelectionGalleryScrollShadow(0)).toBe(false);
    expect(shouldShowClassSelectionGalleryScrollShadow(1)).toBe(true);
  });

  it("renders a fixed intro block above the sole gallery scroll owner", () => {
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

    expect(markup).toContain("cc-class-selection-pane__intro");
    expect(markup).toContain("cc-class-selection-pane__gallery-scroll");
    expect(markup).toContain("cc-class-selection-pane__gallery-shadow");
    expect(markup).toContain("cc-class-selection-pane__gallery-inner");
    expect(markup).toContain('data-scroll-region="class-gallery"');
    expect(markup).toContain('data-scroll-shadow="false"');
    expect(markup.match(/overflow-y-auto/g)).toHaveLength(1);
    expect(markup).toContain("cc-class-chooser-grid");
    expect(markup.indexOf("cc-class-selection-pane__intro")).toBeLessThan(markup.indexOf("cc-class-selection-pane__gallery-scroll"));
  });
});
