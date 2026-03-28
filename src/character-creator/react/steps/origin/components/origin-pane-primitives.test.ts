import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { handleOriginGalleryCornerActionClick, OriginGalleryCard } from "./origin-pane-primitives";

describe("origin-pane-primitives", () => {
  it("stops propagation before invoking an origin gallery corner action", () => {
    const stopPropagation = vi.fn();
    const onClick = vi.fn();

    handleOriginGalleryCornerActionClick({ stopPropagation }, onClick);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits the footer shell when a gallery card has no footer content", () => {
    const markup = renderToStaticMarkup(createElement(OriginGalleryCard, {
      eyebrow: "Background",
      fallbackIcon: "fa-solid fa-scroll",
      media: undefined,
      onSelect: vi.fn(),
      prefersReducedMotion: true,
      selected: false,
      title: "Acolyte",
    }));

    expect(markup).not.toContain("data-origin-gallery-footer=\"true\"");
    expect(markup).not.toContain("data-origin-gallery-meta=\"true\"");
  });
});
