import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, {
      get: (_target, tag: string) => React.forwardRef((props: Record<string, unknown>, ref) => {
        const {
          animate: _animate,
          exit: _exit,
          initial: _initial,
          transition: _transition,
          whileHover: _whileHover,
          whileTap: _whileTap,
          children,
          ...domProps
        } = props;
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }),
    }),
    useReducedMotion: () => false,
  };
});

import { ClassCard, getClassCardMediaClassName, type ClassCardEntry } from "./class-card";

function createEntry(overrides?: Partial<ClassCardEntry>): ClassCardEntry {
  return {
    uuid: "Compendium.test.classes.Item.barbarian",
    name: "Barbarian",
    type: "class",
    img: "barbarian.webp",
    identifier: "barbarian",
    packId: "test.classes",
    packLabel: "Classes",
    cardImg: "barbarian-card.webp",
    selected: false,
    hitDie: "D12",
    primaryAbilityText: "Strength",
    primaryAbilityBadgeText: "STR",
    primaryAbilityHint: "Strength and Constitution recommended.",
    savingThrowText: "Strength / Constitution",
    savingThrowBadgeText: "STR / CON",
    ...overrides,
  };
}

describe("ClassCard", () => {
  it("does not render the removed descriptive copy block", () => {
    const markup = renderToStaticMarkup(createElement(ClassCard, {
      entry: createEntry(),
      onSelect: async () => {},
      prefersReducedMotion: true,
      selected: false,
    }));

    expect(markup).not.toContain("Strength and Constitution recommended.");
    expect(markup).toContain("D12");
    expect(markup).toContain("STR");
    expect(markup).toContain("STR / CON");
    expect(markup).toContain("bg-[image:var(--cc-class-card-outer)]");
    expect(markup).toContain("bg-[image:var(--cc-class-card-inner)]");
    expect(markup).toContain("var(--cc-class-card-chip-bg)");
    expect(markup).toContain("var(--cc-class-card-chip-border)");
    expect(markup).toContain("var(--cc-class-card-chip-text)");
    expect(markup).toContain("var(--cc-class-card-chip-icon)");
    expect(markup).not.toContain("shadow-[inset_0_1px_0_rgba(255,240,219,0.14)]");
    expect(markup).not.toContain("bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cc-surface-accent-soft)_84%,transparent),transparent)]");
    expect(markup).not.toContain("shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--cc-border-subtle)_18%,transparent),inset_0_-16px_24px_color-mix(in_srgb,var(--cc-bg-base)_22%,transparent)]");
    expect(markup).not.toContain("shadow-[0_8px_16px_rgba(0,0,0,0.16)]");
  });

  it("uses motion-driven lift behavior without CSS hover transform classes", () => {
    const markup = renderToStaticMarkup(createElement(ClassCard, {
      entry: createEntry(),
      onSelect: async () => {},
      prefersReducedMotion: false,
      selected: false,
    }));

    expect(markup).not.toContain("hover:-translate-y-1");
    expect(markup).not.toContain("hover:shadow-[0_30px_55px_rgba(0,0,0,0.34)]");
    expect(markup).not.toContain("group-hover:scale-[1.03]");
  });

  it("uses the same media footprint for selected and unselected cards", () => {
    expect(getClassCardMediaClassName(true)).toBe(getClassCardMediaClassName(false));
  });

  it("renders a selected-state treatment and a readable class label stack", () => {
    const markup = renderToStaticMarkup(createElement(ClassCard, {
      entry: createEntry({ selected: true }),
      onSelect: async () => {},
      prefersReducedMotion: true,
      selected: true,
    }));

    expect(markup).toContain("Selected Class");
    expect(markup).toContain("var(--cc-class-card-selected-bg)");
    expect(markup).toContain("var(--cc-class-card-selected-border)");
    expect(markup).toContain("var(--cc-class-card-selected-text)");
    expect(markup).toContain("var(--cc-class-card-chip-bg)");
    expect(markup).toContain("var(--cc-class-card-chip-shadow)");
    expect(markup).not.toContain("shadow-[0_0_16px_color-mix(in_srgb,var(--cc-surface-accent-soft)_52%,transparent)]");
  });
});
