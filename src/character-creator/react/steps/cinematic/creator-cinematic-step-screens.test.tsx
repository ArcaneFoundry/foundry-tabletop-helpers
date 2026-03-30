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

import { PortraitStepScreen, SpellsStepScreen, SubclassStepScreen } from "./creator-cinematic-step-screens";
import { ReviewStepScreen } from "./creator-cinematic-step-screens";

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
    expect(markup).toContain("Chosen Spells");
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

describe("PortraitStepScreen", () => {
  it("renders the portrait atelier with prompt, action, and generated-results sections", () => {
    const markup = renderToStaticMarkup(
      createElement(PortraitStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "portrait",
          stepViewModel: {
            serverAvailable: true,
            autoPrompt: "Arcane portrait prompt",
            hasPortrait: false,
            portraitDataUrl: "",
            tokenDataUrl: "",
            source: "none",
            raceName: "Elf",
            className: "Wizard",
          },
          steps: [],
        },
        state: {
          selections: {},
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Choose the Visage");
    expect(markup).toContain("Portrait Atelier");
    expect(markup).toContain("Shape the Likeness");
    expect(markup).toContain("cc-theme-panel--soft");
    expect(markup).toContain("cc-theme-hero-shell");
    expect(markup).toContain("cc-theme-badge");
    expect(markup).toContain("cc-theme-card--raised");
    expect(markup).toContain("Portrait Prompt");
    expect(markup).toContain("Arcane portrait prompt");
    expect(markup).toContain('id="portrait-prompt"');
    expect(markup).toContain('name="portraitPrompt"');
    expect(markup).toContain('autoComplete="off"');
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain("Generate Portraits");
    expect(markup).toContain("Upload Portrait");
    expect(markup).toContain("Generated Portraits");
    expect(markup).toContain("No portraits have been summoned yet.");
    expect(markup).toContain("Awaiting Likeness");
    expect(markup).toContain("Portrait optional");
  });

  it("renders a bound portrait preview and clear action when a portrait is already selected", () => {
    const markup = renderToStaticMarkup(
      createElement(PortraitStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "portrait",
          stepViewModel: {
            serverAvailable: true,
            autoPrompt: "Arcane portrait prompt",
            hasPortrait: true,
            portraitDataUrl: "portrait.webp",
            tokenDataUrl: "portrait.webp",
            source: "uploaded",
            raceName: "Elf",
            className: "Wizard",
          },
          steps: [],
        },
        state: {
          selections: {
            portrait: {
              portraitDataUrl: "portrait.webp",
              tokenDataUrl: "portrait.webp",
              source: "uploaded",
            },
          },
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Bound Likeness");
    expect(markup).toContain("Selected portrait");
    expect(markup).toContain("Clear");
    expect(markup).toContain("Uploaded likeness");
    expect(markup).toContain("Ready for final review");
    expect(markup).toContain("cc-theme-media-frame");
  });
});

describe("ReviewStepScreen", () => {
  it("renders the finalized review composition with edit-back affordances and name guidance", () => {
    const markup = renderToStaticMarkup(
      createElement(ReviewStepScreen, {
        controller: {
          jumpToStep: vi.fn(),
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "review",
          stepViewModel: {
            characterName: "Arannis Vale",
            allComplete: false,
            incompleteSectionLabels: ["Equipment", "Spells"],
            startingLevel: 5,
            sections: [
              { id: "class", label: "Class", summary: "Wizard", complete: true, img: "wizard.webp", icon: "", isSimple: true },
              { id: "background", label: "Background", summary: "Sage", complete: true, img: "sage.webp", icon: "", isBackground: true },
              { id: "species", label: "Species", summary: "Human", complete: true, img: "human.webp", icon: "", isSimple: true },
              {
                id: "abilities",
                label: "Ability Scores",
                summary: [
                  { key: "str", score: 8, modifier: "-1" },
                  { key: "dex", score: 14, modifier: "+2" },
                ],
                complete: true,
                icon: "",
                isAbilities: true,
              },
              {
                id: "originSummary",
                label: "Origin Summary",
                complete: true,
                icon: "",
                isSkills: true,
                selectedGrantGroups: [
                  { id: "skills", title: "Skills", iconClass: "fa-solid fa-list-check", entries: ["Arcana", "History"] },
                ],
              },
              { id: "feats", label: "Feats & ASI", summary: "Ability Score Improvement: Intelligence, Wisdom", complete: true, icon: "", isSimple: true },
              { id: "equipment", label: "Equipment", summary: "Scholar's Pack • Sage Supplies", detail: "Funds: 100 gp", complete: false, icon: "", isSimple: true },
              { id: "spells", label: "Spells", summary: "4 cantrips, 14 spells, 9 prepared", detail: "Choose which 9 leveled spells start prepared for this Wizard.", complete: false, icon: "", isSimple: true },
            ],
          },
          steps: [],
        },
        state: {
          selections: {
            review: { characterName: "Arannis Vale" },
            class: { name: "Wizard", img: "wizard.webp" },
            background: { name: "Sage", img: "sage.webp" },
            species: { name: "Human", img: "human.webp" },
          },
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("The Ritual Is Complete");
    expect(markup).toContain("cc-theme-hero-shell");
    expect(markup).toContain("cc-theme-panel--accent");
    expect(markup).toContain("cc-theme-card--soft");
    expect(markup).toContain("cc-theme-media-frame__fade");
    expect(markup).toContain("2 unresolved");
    expect(markup).toContain("Jump back to revise any card");
    expect(markup).toContain("Character Name");
    expect(markup).toContain('for="review-character-name"');
    expect(markup).toContain('id="review-character-name"');
    expect(markup).toContain('name="characterName"');
    expect(markup).toContain('autoComplete="off"');
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain("The final binding uses this name exactly as shown here.");
    expect(markup).toContain("Bound Identity");
    expect(markup).toContain("cc-theme-card--selected");
    expect(markup).toContain("Edit");
    expect(markup).toContain("Jump back");
    expect(markup).toContain("Readiness");
    expect(markup).toContain("Needs attention");
  });
});
