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
          children,
          ...domProps
        } = props;
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }),
    }),
    useReducedMotion: () => true,
  };
});

import { SubclassStepScreen } from "./creator-cinematic-step-screens";

describe("SubclassStepScreen", () => {
  it("renders the cinematic subclass gallery with a selected inspector state", () => {
    const markup = renderToStaticMarkup(
      createElement(SubclassStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "subclass",
          stepViewModel: {
            entries: [
              {
                uuid: "subclass-battle-master",
                name: "Battle Master",
                img: "battle-master.webp",
                packId: "dnd-players-handbook.subclasses",
                packLabel: "Player's Handbook",
                type: "subclass",
                classIdentifier: "fighter",
                blurb: "A tactician who controls the shape of the battlefield.",
                description: "<p>Battle Masters turn martial discipline into precise battlefield control.</p>",
                selected: true,
              },
              {
                uuid: "subclass-eldritch-knight",
                name: "Eldritch Knight",
                img: "eldritch-knight.webp",
                packId: "dnd-players-handbook.subclasses",
                packLabel: "Player's Handbook",
                type: "subclass",
                classIdentifier: "fighter",
                blurb: "A warrior who binds steel to spellcraft.",
                description: "<p>Eldritch Knights fuse disciplined arms with arcane study.</p>",
              },
            ],
            selectedEntry: {
              uuid: "subclass-battle-master",
              name: "Battle Master",
              img: "battle-master.webp",
              packId: "dnd-players-handbook.subclasses",
              packLabel: "Player's Handbook",
              type: "subclass",
              classIdentifier: "fighter",
              blurb: "A tactician who controls the shape of the battlefield.",
              description: "<p>Battle Masters turn martial discipline into precise battlefield control.</p>",
              selected: true,
            },
          },
          steps: [],
        },
        state: {
          selections: {
            class: {
              uuid: "class-fighter",
              name: "Fighter",
              img: "fighter.webp",
              identifier: "fighter",
              skillPool: [],
              skillCount: 2,
              isSpellcaster: false,
              spellcastingAbility: "",
              spellcastingProgression: "",
            },
            subclass: {
              uuid: "subclass-battle-master",
              name: "Battle Master",
              img: "battle-master.webp",
              classIdentifier: "fighter",
            },
          },
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Choose Your Calling");
    expect(markup).toContain("Fighter Path");
    expect(markup).toContain("Battle Master");
    expect(markup).toContain("A tactician who controls the shape of the battlefield.");
    expect(markup).toContain("Specialization");
    expect(markup).toContain("Battle Masters turn martial discipline into precise battlefield control.");
    expect(markup).toContain("fa-solid fa-check");
  });
});
