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

import { SpellsStepScreen, SubclassStepScreen } from "./creator-cinematic-step-screens";

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

describe("SpellsStepScreen", () => {
  it("renders the cinematic wizard spellbook flow with cantrip and leveled spell groups", () => {
    const markup = renderToStaticMarkup(
      createElement(SpellsStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "spells",
          stepViewModel: {
            className: "Wizard",
            cantrips: [
              {
                uuid: "spell-light",
                name: "Light",
                img: "light.webp",
                packId: "phb.spells",
                packLabel: "Player's Handbook",
                type: "spell",
                schoolLabel: "Evocation",
              },
            ],
            cantripCount: 1,
            maxCantrips: 4,
            spellsByLevel: [
              {
                level: 1,
                label: "Level 1",
                spells: [
                  {
                    uuid: "spell-magic-missile",
                    name: "Magic Missile",
                    img: "magic-missile.webp",
                    packId: "phb.spells",
                    packLabel: "Player's Handbook",
                    type: "spell",
                    schoolLabel: "Evocation",
                  },
                ],
              },
            ],
            spellCount: 1,
            maxSpells: 6,
            selectionSummary: "1 / 4 cantrips, 1 / 6 spells",
            preparationNotice: "Choose which leveled spells start prepared for this Wizard. You can change them later on the sheet.",
            hasPreparationNotice: true,
            showPreparedPicker: true,
            preparedCount: 1,
            preparedLimit: 4,
          },
          steps: [],
        },
        state: {
          selections: {
            spells: {
              cantrips: ["spell-light"],
              spells: ["spell-magic-missile"],
              preparedSpells: ["spell-magic-missile"],
              maxCantrips: 4,
              maxSpells: 6,
              maxPreparedSpells: 4,
            },
          },
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Open the Grimoire");
    expect(markup).toContain("Selection State");
    expect(markup).toContain("1 / 4 cantrips, 1 / 6 spells");
    expect(markup).toContain("Cantrips");
    expect(markup).toContain("Level 1");
    expect(markup).toContain("Light");
    expect(markup).toContain("Magic Missile");
    expect(markup).toContain("Prepared Workings");
    expect(markup).toContain("Prepared Now");
    expect(markup).toContain("Chosen Invocations");
  });

  it("renders prepared-caster controls and prepared summaries for explicit prepared pickers", () => {
    const markup = renderToStaticMarkup(
      createElement(SpellsStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "spells",
          stepViewModel: {
            className: "Cleric",
            cantrips: [],
            cantripCount: 0,
            maxCantrips: 3,
            spellsByLevel: [
              {
                level: 1,
                label: "Level 1",
                spells: [
                  {
                    uuid: "spell-bless",
                    name: "Bless",
                    img: "bless.webp",
                    packId: "phb.spells",
                    packLabel: "Player's Handbook",
                    type: "spell",
                    schoolLabel: "Enchantment",
                    prepared: true,
                  },
                  {
                    uuid: "spell-guiding-bolt",
                    name: "Guiding Bolt",
                    img: "guiding-bolt.webp",
                    packId: "phb.spells",
                    packLabel: "Player's Handbook",
                    type: "spell",
                    schoolLabel: "Evocation",
                  },
                ],
              },
            ],
            spellCount: 2,
            maxSpells: null,
            selectionSummary: "0 / 3 cantrips, 2 spells",
            preparationNotice: "Choose which 1 leveled spell start prepared for this Cleric. You can change them later on the sheet.",
            hasPreparationNotice: true,
            showPreparedPicker: true,
            preparedCount: 1,
            preparedLimit: 1,
          },
          steps: [],
        },
        state: {
          selections: {
            spells: {
              cantrips: [],
              spells: ["spell-bless", "spell-guiding-bolt"],
              preparedSpells: ["spell-bless"],
              maxCantrips: 3,
              maxPreparedSpells: 1,
            },
          },
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Cleric");
    expect(markup).toContain("Choose which 1 leveled spell start prepared for this Cleric.");
    expect(markup).toContain("Bless");
    expect(markup).toContain("Guiding Bolt");
    expect(markup).toContain("Prepared");
    expect(markup).toContain("Mark Prepared");
  });

  it("renders explicit empty states when filtered cantrips or leveled spells are absent", () => {
    const markup = renderToStaticMarkup(
      createElement(SpellsStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "spells",
          stepViewModel: {
            className: "Paladin",
            cantrips: [],
            cantripCount: 0,
            maxCantrips: null,
            spellsByLevel: [],
            spellCount: 0,
            maxSpells: 0,
            selectionSummary: "0 cantrips, 0 / 0 spells",
            hasPreparationNotice: false,
            showPreparedPicker: false,
            preparedLimit: null,
          },
          steps: [],
        },
        state: {
          selections: {
            spells: {
              cantrips: [],
              spells: [],
            },
          },
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("No cantrips are available for Paladin from the enabled spell data right now.");
    expect(markup).toContain("Leveled Spells");
    expect(markup).toContain("No valid entries");
    expect(markup).toContain("No leveled spells are available for Paladin from the enabled spell data right now.");
  });
});
