import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  buildOriginDuplicateDisambiguator,
  HeaderFlourish,
  DetailCard,
  handleOriginGalleryCornerActionClick,
  OriginGalleryCard,
  SummaryListCard,
} from "./origin-pane-primitives";

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

    expect(markup).toContain("cc-theme-card--raised");
    expect(markup).not.toContain("data-origin-gallery-footer=\"true\"");
    expect(markup).not.toContain("data-origin-gallery-meta=\"true\"");
  });

  it("renders a visible source label on origin gallery cards", () => {
    const markup = renderToStaticMarkup(createElement(OriginGalleryCard, {
      eyebrow: "Background",
      fallbackIcon: "fa-solid fa-scroll",
      media: undefined,
      onSelect: vi.fn(),
      prefersReducedMotion: true,
      selected: false,
      sourceLabel: "PHB",
      title: "Acolyte",
    }));

    expect(markup).toContain("PHB");
    expect(markup).toContain("cc-theme-media-frame");
  });

  it("uses shared flourish tokens instead of raw gold-on-dark gradients", () => {
    const markup = renderToStaticMarkup(createElement(HeaderFlourish, { side: "left" }));

    expect(markup).toContain("--cc-origin-flourish-line");
    expect(markup).toContain("--cc-origin-flourish-gem-shell");
    expect(markup).toContain("--cc-origin-flourish-gem-core");
    expect(markup).not.toContain("rgba(214,177,111");
    expect(markup).not.toContain("#d6b16f");
  });

  it("renders summary empty states with the shared muted theme treatment", () => {
    const markup = renderToStaticMarkup(createElement(SummaryListCard, {
      emptyLabel: "No claimed entries yet.",
      entries: [],
      iconClass: "fa-solid fa-scroll",
      title: "Fixed Background Skills",
    }));

    expect(markup).toContain("text-[color:var(--cc-text-secondary)]");
    expect(markup).not.toContain("#6b5040");
  });

  it("promotes duplicate-entry disambiguation into the gallery header", () => {
    const markup = renderToStaticMarkup(createElement(OriginGalleryCard, {
      eyebrow: "Species",
      fallbackIcon: "fa-solid fa-dna",
      media: undefined,
      onSelect: vi.fn(),
      prefersReducedMotion: true,
      selected: false,
      sourceLabel: "Character Origins",
      title: "Dragonborn",
      variantLabel: "Draconic Ancestry + Draconic Flight",
    }));

    expect(markup).toContain("data-origin-disambiguator=\"true\"");
    expect(markup).toContain("Draconic Ancestry + Draconic Flight");
    expect(markup).toContain("Character Origins");
  });

  it("keeps the selected origin gallery affordance token-backed", () => {
    const markup = renderToStaticMarkup(createElement(OriginGalleryCard, {
      eyebrow: "Background",
      fallbackIcon: "fa-solid fa-scroll",
      media: undefined,
      onSelect: vi.fn(),
      prefersReducedMotion: true,
      selected: true,
      title: "Acolyte",
    }));

    expect(markup).toContain("--cc-origin-flourish-gem-core");
    expect(markup).toContain("shadow-[var(--cc-shadow-button)]");
    expect(markup).not.toContain("rgba(0,0,0,0.24)");
    expect(markup).not.toContain("text-white");
  });

  it("builds a duplicate disambiguator from unique trait summaries before pack labels", () => {
    const label = buildOriginDuplicateDisambiguator(
      {
        uuid: "dragonborn-1",
        name: "Dragonborn",
        packId: "pack-1",
        packLabel: "Character Origins",
        type: "species",
        blurb: "A draconic folk with ancient ancestry.",
        traits: ["Draconic Ancestry", "Draconic Flight"],
      },
      [
        {
          uuid: "dragonborn-1",
          name: "Dragonborn",
          packId: "pack-1",
          packLabel: "Character Origins",
          type: "species",
          blurb: "A draconic folk with ancient ancestry.",
          traits: ["Draconic Ancestry", "Draconic Flight"],
        },
        {
          uuid: "dragonborn-2",
          name: "Dragonborn",
          packId: "pack-1",
          packLabel: "Character Origins",
          type: "species",
          blurb: "A draconic folk shaped by flight alone.",
          traits: ["Draconic Flight"],
        },
      ],
    );

    expect(label).toBe("Draconic Ancestry + Draconic Flight");
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
    expect(markup).toContain("cc-theme-media-frame");
    expect(markup).not.toContain("data-origin-detail-card=\"true\"");
  });
});
