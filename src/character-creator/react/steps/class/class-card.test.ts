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
  });

  it("uses the same media footprint for selected and unselected cards", () => {
    expect(getClassCardMediaClassName(true)).toBe(getClassCardMediaClassName(false));
  });
});
