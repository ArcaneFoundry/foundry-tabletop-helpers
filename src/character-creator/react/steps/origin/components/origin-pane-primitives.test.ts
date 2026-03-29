import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DetailCard, handleOriginGalleryCornerActionClick, OriginGalleryCard } from "./origin-pane-primitives";

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

  it("keeps the shared detail card treatment for origin feat panes", () => {
    const markup = renderToStaticMarkup(createElement(DetailCard, {
      entry: {
        uuid: "feat-1",
        name: "Lucky",
        img: "lucky.webp",
        packId: "phb",
        packLabel: "PHB",
        type: "feat",
        description: "<p>Detailed feat text.</p>",
      },
      fallbackIcon: "fa-solid fa-stars",
    }));

    expect(markup).toContain("Detailed feat text.");
    expect(markup).toContain("PHB");
    expect(markup).toContain("aspect-[1.15]");
    expect(markup).not.toContain("data-origin-detail-card=\"true\"");
  });
});
