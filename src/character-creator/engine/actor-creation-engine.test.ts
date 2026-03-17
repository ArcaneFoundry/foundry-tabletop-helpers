import { beforeEach, describe, expect, it, vi } from "vitest";

const SPELL_PREPARATION_STATES = {
  unprepared: 0,
  prepared: 1,
  always: 2,
} as const;

const logErrorMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();
const logDebugMock = vi.fn();
const getGameMock = vi.fn();
const getUIMock = vi.fn();
const fromUuidMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    error: logErrorMock,
    info: logInfoMock,
    warn: logWarnMock,
    debug: logDebugMock,
  },
}));

vi.mock("../../types", () => ({
  getGame: getGameMock,
  getUI: getUIMock,
  fromUuid: fromUuidMock,
}));

function createWizardState(): any {
  return {
    config: {
      level1HpMethod: "max",
      startingLevel: 1,
    },
    selections: {
      review: { characterName: "Arannis Vale" },
      abilities: { scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } },
      background: {
        uuid: "Compendium.backgrounds.sage",
        asi: { assignments: { int: 1, wis: 1 } },
        grants: { skillProficiencies: ["arc"] },
        languages: {
          fixed: ["common"],
          chosen: ["draconic"],
        },
      },
      originFeat: { uuid: "Compendium.feats.magic-initiate" },
      class: { uuid: "Compendium.classes.wizard", identifier: "wizard", name: "Wizard" },
      subclass: { uuid: "Compendium.subclasses.evoker" },
      feats: { featUuid: "Compendium.feats.alert" },
      skills: { chosen: ["his", "ins"] },
      spells: {
        cantrips: ["Compendium.spells.fire-bolt"],
        spells: ["Compendium.spells.magic-missile"],
        maxPreparedSpells: 4,
      },
      portrait: undefined as { portraitDataUrl?: string; tokenDataUrl?: string } | undefined,
      species: { uuid: "Compendium.species.high-elf", languageGrants: ["elvish"] },
      equipment: { method: "gold", goldAmount: 125 },
    },
  };
}

function createActor() {
  const items: Array<{
    id: string;
    type?: string;
    name?: string;
    system?: Record<string, unknown>;
    update: ReturnType<typeof vi.fn>;
    toObject: () => Record<string, unknown>;
  }> = [];

  const assignPath = (root: Record<string, unknown>, path: string, value: unknown) => {
    const segments = path.split(".");
    let current: Record<string, unknown> = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i]!;
      const next = current[key];
      if (typeof next !== "object" || next === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[segments.at(-1) ?? ""] = value;
  };

  const buildMockTraitAdvancement = (
    entry: Record<string, unknown>,
  ) => {
    const advancement = {
      ...entry,
      value: {
        chosen: new Set<string>(
          Array.isArray((entry.value as { chosen?: unknown[] } | undefined)?.chosen)
            ? ((entry.value as { chosen?: unknown[] }).chosen as string[])
            : [],
        ),
      },
      updateSource: vi.fn((updateData: Record<string, unknown>) => {
        const chosen = updateData["value.chosen"];
        if (Array.isArray(chosen)) {
          advancement.value.chosen = new Set(chosen as string[]);
        }
      }),
      apply: vi.fn(async (_level: number, data: { chosen: Set<string> }) => {
        advancement.value.chosen = new Set(data.chosen);
        for (const key of data.chosen) {
          if (key.startsWith("skills:")) {
            const skillKey = key.slice("skills:".length);
            assignPath(createActorInstance as unknown as Record<string, unknown>, `system.skills.${skillKey}.proficient`, 1);
            assignPath(createActorInstance as unknown as Record<string, unknown>, `system.skills.${skillKey}.value`, 1);
          }
          if (key.startsWith("languages:")) {
            const languageKey = key.split(":").at(-1);
            const existing = Array.isArray(createActorInstance.system.traits.languages.value)
              ? createActorInstance.system.traits.languages.value as string[]
              : [];
            createActorInstance.system.traits.languages.value = [...new Set([...existing, languageKey ?? ""])] as never;
          }
        }
      }),
      toObject: () => ({
        ...entry,
        value: {
          chosen: Array.from(advancement.value.chosen),
        },
      }),
    };

    return advancement;
  };

  const createEmbeddedItem = (data: Record<string, unknown>, index: number) => {
    const item: {
      id: string;
      type?: string;
      name?: string;
      system: Record<string, unknown>;
      update: ReturnType<typeof vi.fn>;
      toObject: () => Record<string, unknown>;
    } = {
      id: `item-${index + 1}`,
      type: typeof data.type === "string" ? data.type : undefined,
      name: typeof data.name === "string" ? data.name : undefined,
      system: typeof data.system === "object" && data.system !== null
        ? {
            ...(data.system as Record<string, unknown>),
            advancement: Array.isArray((data.system as { advancement?: unknown[] }).advancement)
                ? ((data.system as { advancement?: Record<string, unknown>[] }).advancement ?? []).map((entry: Record<string, unknown>) =>
                  entry?.type === "Trait" ? buildMockTraitAdvancement(entry) : entry
                )
              : (data.system as Record<string, unknown>).advancement,
          }
        : {},
      update: vi.fn(async (updateData: Record<string, unknown>) => {
        for (const [path, value] of Object.entries(updateData)) {
          if (path === "system.advancement" && Array.isArray(value)) {
            item.system = item.system ?? {};
            item.system.advancement = value.map((entry: unknown) =>
              typeof entry === "object" && entry !== null && (entry as { type?: string }).type === "Trait"
                ? buildMockTraitAdvancement(entry as Record<string, unknown>)
                : entry
            );
            continue;
          }
          assignPath(item as unknown as Record<string, unknown>, path, value);
        }
        return null;
      }),
      toObject: () => ({
        _id: item.id,
        name: item.name,
        type: item.type,
        system: {
          ...(item.system ?? {}),
          advancement: Array.isArray(item.system?.advancement)
            ? item.system.advancement.map((entry: unknown) =>
                typeof (entry as { toObject?: unknown }).toObject === "function"
                  ? (entry as { toObject: () => Record<string, unknown> }).toObject()
                  : entry
              )
            : item.system?.advancement,
        },
      }),
    };
    items.push(item);
    return item;
  };

  return {
    id: "actor-1",
    system: {
      attributes: {
        hp: {
          value: 0,
          max: 0,
        },
      },
      abilities: {
        str: { value: 10 },
        dex: { value: 10 },
        con: { value: 10 },
        int: { value: 10 },
        wis: { value: 10 },
        cha: { value: 10 },
      },
      details: {
        level: 0,
      },
      currency: {
        gp: 0,
      },
      traits: {
        languages: {
          value: [],
        },
      },
      skills: {
        ath: { proficient: 0, value: 0 },
        itm: { proficient: 0, value: 0 },
        arc: { proficient: 0, value: 0 },
        his: { proficient: 0, value: 0 },
        ins: { proficient: 0, value: 0 },
      },
    },
    items: {
      get(id: string) {
        return items.find((item) => item.id === id) ?? null;
      },
      [Symbol.iterator]: function* () {
        yield* items;
      },
    },
    update: vi.fn(async (updateData: Record<string, unknown>) => {
      for (const [path, value] of Object.entries(updateData)) {
        assignPath(createActorInstance as unknown as Record<string, unknown>, path, value);
      }
      return createActorInstance;
    }),
    updateEmbeddedDocuments: vi.fn(async (_type: string, updates: Array<Record<string, unknown>>) => {
      for (const update of updates) {
        const item = items.find((candidate) => candidate.id === update._id);
        if (!item) continue;
        if (typeof update.system === "object" && update.system !== null) {
          item.system = {
            ...item.system,
            ...(update.system as Record<string, unknown>),
            preparation: {
              ...((item.system?.preparation as Record<string, unknown> | undefined) ?? {}),
              ...(((update.system as Record<string, unknown>).preparation as Record<string, unknown> | undefined) ?? {}),
            },
          };
        }
      }
      return items;
    }),
    createEmbeddedDocuments: vi.fn(async (_type: string, docs: Record<string, unknown>[]) =>
      docs.map((doc, index) => createEmbeddedItem(doc, items.length + index))
    ),
  };
}

let createActorInstance: ReturnType<typeof createActor>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  createActorInstance = createActor();

  getGameMock.mockReturnValue({
    userId: "user-1",
    user: { name: "Player One" },
    actors: {
      get(id: string) {
        return id === createActorInstance.id ? createActorInstance : null;
      },
      documentClass: {
        create: vi.fn(async () => createActorInstance),
      },
    },
    socket: {
      emit: vi.fn(),
    },
  });
  getUIMock.mockReturnValue({
    notifications: {
      info: vi.fn(),
    },
  });
  fromUuidMock.mockImplementation(async (uuid: string) => ({
    toObject: () => ({
      _id: `embedded-${uuid}`,
      name: uuid === "Compendium.features.action-surge"
        ? "Action Surge"
        : uuid === "Compendium.features.martial-archetype"
          ? "Martial Archetype"
          : uuid.split(".").at(-1),
      type: uuid.includes(".species.") ? "race"
        : uuid.includes(".backgrounds.") ? "background"
        : uuid.includes(".classes.") ? "class"
        : uuid.includes(".subclasses.") ? "subclass"
        : uuid.includes(".spells.") ? "spell"
        : "feat",
      system: uuid === "Compendium.classes.wizard"
        ? {
            hitDice: "d6",
            levels: 1,
            identifier: "wizard",
            spellcasting: {
              preparation: {
                formula: "@scale.wizard.max-prepared",
              },
            },
            advancement: [
              {
                type: "ItemGrant",
                level: 1,
                configuration: {
                  items: [
                    { uuid: "Compendium.features.spellcasting", name: "Spellcasting" },
                    { uuid: "Compendium.features.ritual-adept", name: "Ritual Adept" },
                    { uuid: "Compendium.features.arcane-recovery", name: "Arcane Recovery" },
                  ],
                },
              },
              {
                type: "Trait",
                title: "Skill Proficiencies",
                level: 1,
                value: { chosen: [] },
              },
            ],
          }
        : uuid === "Compendium.classes.cleric"
          ? {
              hitDice: "d8",
              levels: 1,
              identifier: "cleric",
              spellcasting: {
                preparation: {
                  formula: "@scale.cleric.max-prepared",
                },
              },
              advancement: [
                {
                  type: "ScaleValue",
                  configuration: {
                    identifier: "max-prepared",
                    scale: {
                      1: { value: 4 },
                      5: { value: 9 },
                    },
                  },
                },
              ],
            }
        : uuid === "Compendium.subclasses.life-domain"
          ? {
              classIdentifier: "cleric",
              identifier: "life-domain",
              advancement: [
                {
                  type: "ItemGrant",
                  level: 3,
                  configuration: {
                    items: [
                      { uuid: "Compendium.spells.bless", name: "Bless" },
                      { uuid: "Compendium.spells.cure-wounds", name: "Cure Wounds" },
                      { uuid: "Compendium.spells.aid", name: "Aid" },
                    ],
                  },
                },
              ],
            }
        : uuid === "Compendium.spells.fire-bolt"
          ? {
              level: 0,
              preparation: {
                mode: "prepared",
                prepared: false,
              },
            }
          : uuid === "Compendium.spells.magic-missile"
            ? {
                level: 1,
                preparation: {
                  mode: "always",
                  prepared: true,
                },
              }
        : uuid === "Compendium.classes.fighter"
          ? {
              hitDice: "d10",
              levels: 1,
              identifier: "fighter",
              advancement: [
                {
                  type: "ItemGrant",
                  level: 1,
                  configuration: {
                    items: [{ uuid: "Compendium.features.second-wind", name: "Second Wind" }],
                  },
                },
                { type: "ItemGrant", level: 2, configuration: { items: [{ uuid: "Compendium.features.action-surge", name: "Action Surge" }] } },
                { type: "ItemGrant", level: 3, configuration: { items: [{ uuid: "Compendium.features.martial-archetype", name: "Martial Archetype" }] } },
              ],
            }
          : uuid === "Compendium.backgrounds.sage"
            ? {
                advancement: [
                  {
                    type: "Trait",
                    title: "Background Proficiencies",
                    level: 0,
                    configuration: { grants: ["skills:arc"] },
                    value: { chosen: [] },
                  },
                  {
                    type: "Trait",
                    title: "Choose Languages",
                    level: 0,
                    configuration: { grants: ["languages:standard:common"] },
                    value: { chosen: [] },
                  },
                ],
              }
            : uuid === "Compendium.species.high-elf"
              ? {
                  advancement: [
                    {
                      type: "Trait",
                      title: "Languages",
                      level: 0,
                      configuration: { grants: ["languages:standard:elvish"] },
                      value: { chosen: [] },
                    },
                  ],
                }
          : {},
    }),
    system: uuid === "Compendium.classes.wizard"
      ? {
          hitDice: "d6",
          advancement: [
            {
              type: "ScaleValue",
              configuration: {
                identifier: "max-prepared",
                scale: {
                  1: { value: 4 },
                  2: { value: 5 },
                  3: { value: 6 },
                  4: { value: 7 },
                  5: { value: 9 },
                },
              },
            },
          ],
          spellcasting: {
            preparation: {
              formula: "@scale.wizard.max-prepared",
            },
          },
        }
      : uuid === "Compendium.classes.fighter"
        ? { hitDice: "d10" }
        : undefined,
  }));
  (globalThis as Record<string, unknown>).File = class FakeFile {
    constructor(
      public readonly parts: Blob[],
      public readonly name: string,
      public readonly options: { type: string },
    ) {}
  };
  (globalThis as Record<string, unknown>).Blob = Blob;
  (globalThis as Record<string, unknown>).atob = (data: string) => Buffer.from(data, "base64").toString("binary");
  delete (globalThis as Record<string, unknown>).FilePicker;
});

describe("actor creation engine", () => {
  it("creates a character, embeds items, applies updates, and notifies the gm/player", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();

    const actor = await createCharacterFromWizard(state as never);

    expect(actor).toBe(createActorInstance);
    expect(createActorInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.abilities.str.value": 8,
      "system.abilities.int.value": 16,
      "system.abilities.wis.value": 13,
    }));
    expect(createActorInstance.createEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      expect.arrayContaining([
        expect.objectContaining({ name: "high-elf" }),
        expect.not.objectContaining({ _id: expect.anything() }),
      ]),
    );
    expect(createActorInstance.system.skills.arc).toMatchObject({ proficient: 1, value: 1 });
    expect(createActorInstance.system.skills.his).toMatchObject({ proficient: 1, value: 1 });
    expect(createActorInstance.system.skills.ins).toMatchObject({ proficient: 1, value: 1 });
    expect([...createActorInstance.system.traits.languages.value].sort()).toEqual(["common", "draconic", "elvish"]);
    expect(createActorInstance.update).toHaveBeenCalledWith({
      "system.attributes.hp.max": 7,
      "system.attributes.hp.value": 7,
    });
    expect(createActorInstance.update).toHaveBeenCalledWith({
      "system.currency.gp": 125,
    });
    expect(createActorInstance.update).toHaveBeenCalledWith({
      "ownership.user-1": 3,
    });

    const embeddedSpellDocs = (createActorInstance.createEmbeddedDocuments as ReturnType<typeof vi.fn>)
      .mock.calls
      .flatMap(([, docs]) => docs)
      .filter((doc): doc is Record<string, unknown> => typeof doc === "object" && doc !== null)
      .filter((doc) => doc.type === "spell");
    const fireBolt = embeddedSpellDocs.find((doc) => doc.name === "fire-bolt");
    const magicMissile = embeddedSpellDocs.find((doc) => doc.name === "magic-missile");

    expect(fireBolt).toMatchObject({
      system: {
        level: 0,
        method: "spell",
        prepared: SPELL_PREPARATION_STATES.always,
      },
    });
    expect(magicMissile).toMatchObject({
      system: {
        level: 1,
        method: "spell",
        prepared: SPELL_PREPARATION_STATES.unprepared,
      },
    });
    expect([...createActorInstance.items]
      .find((item) => item.name === "fire-bolt")).toMatchObject({
        system: {
          level: 0,
          method: "spell",
          prepared: SPELL_PREPARATION_STATES.always,
        },
      });
    expect([...createActorInstance.items]
      .find((item) => item.name === "magic-missile")).toMatchObject({
        system: {
          level: 1,
          method: "spell",
          prepared: SPELL_PREPARATION_STATES.prepared,
        },
      });

    const socketEmit = (getGameMock.mock.results[0]?.value as { socket: { emit: ReturnType<typeof vi.fn> } }).socket.emit;
    expect(socketEmit).toHaveBeenCalledWith("module.foundry-tabletop-helpers", {
      action: "characterCreated",
      characterName: "Arannis Vale",
      actorId: "actor-1",
      userName: "Player One",
    });
    expect(getUIMock.mock.results[0]?.value.notifications.info).toHaveBeenCalledWith("Arannis Vale has been created!");

    const classItem = Array.from(createActorInstance.items).find((item) => item.type === "class");
    const backgroundItem = Array.from(createActorInstance.items).find((item) => item.type === "background");
    const speciesItem = Array.from(createActorInstance.items).find((item) => item.type === "race");
    const classAdvancement = ((classItem?.toObject().system as {
      advancement?: Array<{ title?: string; value?: { chosen?: string[] } }>;
    } | undefined)?.advancement ?? []);
    const backgroundAdvancement = ((backgroundItem?.toObject().system as { advancement?: Array<{ value?: { chosen?: string[] } }> } | undefined)?.advancement ?? []);
    const speciesAdvancement = ((speciesItem?.toObject().system as { advancement?: Array<{ value?: { chosen?: string[] } }> } | undefined)?.advancement ?? []);
    const classSkillsAdvancement = classAdvancement.find((entry) => entry.title === "Skill Proficiencies");
    expect(classSkillsAdvancement?.value?.chosen).toEqual(["skills:his", "skills:ins"]);
    expect(backgroundAdvancement[0]?.value?.chosen).toEqual(["skills:arc"]);
    expect([...(backgroundAdvancement[1]?.value?.chosen ?? [])].sort()).toEqual([
      "languages:standard:common",
      "languages:standard:draconic",
    ]);
    expect(speciesAdvancement[0]?.value?.chosen).toEqual(["languages:standard:elvish"]);
  });

  it("seeds an initial prepared subset for higher-level wizard creation from the final actor class item", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.config.startingLevel = 5;
    state.selections.spells = {
      cantrips: ["Compendium.spells.fire-bolt"],
      spells: [
        "Compendium.spells.alarm",
        "Compendium.spells.comprehend-languages",
        "Compendium.spells.detect-magic",
        "Compendium.spells.false-life",
        "Compendium.spells.feather-fall",
        "Compendium.spells.find-familiar",
        "Compendium.spells.identify",
        "Compendium.spells.mage-armor",
        "Compendium.spells.magic-missile",
        "Compendium.spells.shield",
      ],
    };

    await createCharacterFromWizard(state as never);

    const spellItems = [...createActorInstance.items].filter((item) => item.type === "spell");
    const isPrepared = (item: typeof spellItems[number]) =>
      Number(item.system?.prepared ?? SPELL_PREPARATION_STATES.unprepared) === SPELL_PREPARATION_STATES.prepared;
    const preparedNames = spellItems
      .filter((item) => isPrepared(item) === true)
      .map((item) => item.name);
    const unpreparedNames = spellItems
      .filter((item) => isPrepared(item) === false)
      .map((item) => item.name);

    expect(preparedNames).toEqual(expect.arrayContaining([
      "alarm",
      "comprehend-languages",
      "detect-magic",
      "false-life",
      "feather-fall",
      "find-familiar",
      "identify",
      "mage-armor",
      "magic-missile",
    ]));
    expect(unpreparedNames).toContain("shield");
  });

  it("respects explicit prepared spell choices instead of selection order during wizard creation", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.config.startingLevel = 5;
    state.selections.spells = {
      cantrips: ["Compendium.spells.fire-bolt"],
      spells: [
        "Compendium.spells.alarm",
        "Compendium.spells.comprehend-languages",
        "Compendium.spells.detect-magic",
        "Compendium.spells.false-life",
      ],
      preparedSpells: [
        "Compendium.spells.detect-magic",
        "Compendium.spells.false-life",
      ],
    } as never;

    await createCharacterFromWizard(state as never);

    const spellItems = [...createActorInstance.items].filter((item) => item.type === "spell");
    const isPrepared = (item: typeof spellItems[number]) =>
      Number(item.system?.prepared ?? SPELL_PREPARATION_STATES.unprepared) === SPELL_PREPARATION_STATES.prepared;

    expect(spellItems.find((item) => item.name === "detect-magic")).toMatchObject({
      system: { prepared: SPELL_PREPARATION_STATES.prepared },
    });
    expect(spellItems.find((item) => item.name === "false-life")).toMatchObject({
      system: { prepared: SPELL_PREPARATION_STATES.prepared },
    });
    expect(isPrepared(spellItems.find((item) => item.name === "alarm")!)).toBe(false);
    expect(isPrepared(spellItems.find((item) => item.name === "comprehend-languages")!)).toBe(false);
  });

  it("respects explicit prepared spell choices for other prepared casters", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.selections.class = {
      uuid: "Compendium.classes.cleric",
      identifier: "cleric",
      name: "Cleric",
    } as never;
    state.config.startingLevel = 5;
    state.selections.spells = {
      cantrips: ["Compendium.spells.fire-bolt"],
      spells: [
        "Compendium.spells.alarm",
        "Compendium.spells.comprehend-languages",
        "Compendium.spells.detect-magic",
        "Compendium.spells.false-life",
      ],
      preparedSpells: [
        "Compendium.spells.detect-magic",
        "Compendium.spells.false-life",
      ],
      maxPreparedSpells: 9,
    } as never;

    await createCharacterFromWizard(state as never);

    const spellItems = [...createActorInstance.items].filter((item) => item.type === "spell");
    const isPrepared = (item: typeof spellItems[number]) =>
      Number(item.system?.prepared ?? SPELL_PREPARATION_STATES.unprepared) === SPELL_PREPARATION_STATES.prepared;

    expect(spellItems.find((item) => item.name === "detect-magic")).toMatchObject({
      system: { method: "spell", prepared: SPELL_PREPARATION_STATES.prepared },
    });
    expect(spellItems.find((item) => item.name === "false-life")).toMatchObject({
      system: { method: "spell", prepared: SPELL_PREPARATION_STATES.prepared },
    });
    expect(spellItems.find((item) => item.name === "alarm")).toMatchObject({
      system: { method: "spell", prepared: SPELL_PREPARATION_STATES.unprepared },
    });
    expect(isPrepared(spellItems.find((item) => item.name === "comprehend-languages")!)).toBe(false);
  });

  it("skips manually embedding subclass-granted prepared spells during higher-level cleric creation", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.selections.class = {
      uuid: "Compendium.classes.cleric",
      identifier: "cleric",
      name: "Cleric",
    } as never;
    state.selections.subclass = {
      uuid: "Compendium.subclasses.life-domain",
      identifier: "life-domain",
      name: "Life Domain",
    } as never;
    state.config.startingLevel = 5;
    state.selections.spells = {
      cantrips: ["Compendium.spells.fire-bolt"],
      spells: [
        "Compendium.spells.bless",
        "Compendium.spells.cure-wounds",
        "Compendium.spells.aid",
        "Compendium.spells.detect-magic",
      ],
      preparedSpells: [
        "Compendium.spells.bless",
        "Compendium.spells.detect-magic",
      ],
      maxPreparedSpells: 9,
    } as never;

    await createCharacterFromWizard(state as never);

    const embeddedItemCalls = (createActorInstance.createEmbeddedDocuments as ReturnType<typeof vi.fn>).mock.calls;
    const initiallyEmbeddedSpellDocs = ((embeddedItemCalls[0]?.[1] ?? []) as unknown[])
      .filter((doc: unknown): doc is Record<string, unknown> => typeof doc === "object" && doc !== null)
      .filter((doc: Record<string, unknown>) => doc.type === "spell");
    const initiallyEmbeddedSpellNames = initiallyEmbeddedSpellDocs.map((doc) => doc.name);
    const allEmbeddedSpellNames = embeddedItemCalls
      .flatMap(([, docs]) => docs)
      .filter((doc: unknown): doc is Record<string, unknown> => typeof doc === "object" && doc !== null)
      .filter((doc: Record<string, unknown>) => doc.type === "spell")
      .map((doc: Record<string, unknown>) => doc.name);

    expect(initiallyEmbeddedSpellNames).toContain("fire-bolt");
    expect(initiallyEmbeddedSpellNames).toContain("detect-magic");
    expect(initiallyEmbeddedSpellNames).not.toContain("bless");
    expect(initiallyEmbeddedSpellNames).not.toContain("cure-wounds");
    expect(initiallyEmbeddedSpellNames).not.toContain("aid");
    expect(allEmbeddedSpellNames.filter((name) => name === "bless")).toHaveLength(1);
    expect(allEmbeddedSpellNames.filter((name) => name === "cure-wounds")).toHaveLength(1);
    expect(allEmbeddedSpellNames.filter((name) => name === "aid")).toHaveLength(1);
    expect([...createActorInstance.items].find((item) => item.name === "detect-magic")).toMatchObject({
      system: { method: "spell", prepared: SPELL_PREPARATION_STATES.prepared },
    });
  });

  it("uploads data-url portraits through FilePicker and applies the uploaded path", async () => {
    const upload = vi.fn(async () => ({ path: "portraits/arannis-vale-portrait.webp" }));
    (globalThis as Record<string, unknown>).FilePicker = { upload };

    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.selections.portrait = {
      portraitDataUrl: "data:image/webp;base64,ZmFrZQ==",
    };

    await createCharacterFromWizard(state as never);

    expect(upload).toHaveBeenCalledWith(
      "data",
      "portraits",
      expect.objectContaining({ name: "arannis-vale-portrait.webp" }),
      {},
    );
    expect(createActorInstance.update).toHaveBeenCalledWith({
      img: "portraits/arannis-vale-portrait.webp",
      "prototypeToken.texture.src": "portraits/arannis-vale-portrait.webp",
    });
  });

  it("falls back to recommended starting gold when equipment packs are selected", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.selections.equipment = {
      method: "equipment",
      goldAmount: 100,
    };

    await createCharacterFromWizard(state as never);

    expect(createActorInstance.update).toHaveBeenCalledWith({
      "system.currency.gp": 100,
    });
  });

  it("reapplies higher-level ability, proficiency, language, and hp selections after progression", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.config.startingLevel = 5;
    state.selections.background.asi.assignments = { str: 1, dex: 1, con: 1 } as never;
    state.selections.background.languages = {
      fixed: ["common"],
      chosen: ["commonSign"],
    };
    state.selections.species = { uuid: "Compendium.species.human", languageGrants: [] };
    state.selections.feats = { choice: "asi", asiAbilities: ["int"] } as never;

    await createCharacterFromWizard(state as never);

    expect(createActorInstance.system.abilities).toMatchObject({
      str: { value: 9 },
      dex: { value: 15 },
      con: { value: 14 },
      int: { value: 17 },
      wis: { value: 12 },
      cha: { value: 10 },
    });
    expect(createActorInstance.system.traits.languages.value).toEqual(["common", "commonSign"]);
    expect(createActorInstance.system.attributes.hp).toMatchObject({
      max: 32,
      value: 32,
    });
    expect(createActorInstance.system.skills.arc).toMatchObject({ proficient: 1, value: 1 });
    expect(createActorInstance.system.skills.his).toMatchObject({ proficient: 1, value: 1 });
    expect(createActorInstance.system.skills.ins).toMatchObject({ proficient: 1, value: 1 });
  });

  it("uses embedded advancement grants for background skills and languages when selection state is incomplete", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.selections.background.grants.skillProficiencies = [];
    state.selections.background.languages = {
      fixed: [],
      chosen: ["draconic"],
    };

    await createCharacterFromWizard(state as never);

    expect(createActorInstance.system.skills.arc).toMatchObject({ proficient: 1, value: 1 });
    expect([...createActorInstance.system.traits.languages.value].sort()).toEqual(["common", "draconic", "elvish"]);

    const backgroundItem = Array.from(createActorInstance.items).find((item) => item.type === "background");
    const backgroundAdvancement = ((backgroundItem?.toObject().system as { advancement?: Array<{ value?: { chosen?: string[] } }> } | undefined)?.advancement ?? []);
    expect(backgroundAdvancement[0]?.value?.chosen).toEqual(["skills:arc"]);
    expect([...(backgroundAdvancement[1]?.value?.chosen ?? [])].sort()).toEqual([
      "languages:standard:common",
      "languages:standard:draconic",
    ]);
  });

  it("rolls level 1 hp when the GM setting requests it", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.config.level1HpMethod = "roll";

    await createCharacterFromWizard(state as never);

    expect(createActorInstance.update).toHaveBeenCalledWith({
      "system.attributes.hp.max": 5,
      "system.attributes.hp.value": 5,
    });

    randomSpy.mockRestore();
  });

  it("returns null cleanly when the actor document class is unavailable", async () => {
    getGameMock.mockReturnValue({
      userId: "user-1",
      actors: {},
    });

    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const result = await createCharacterFromWizard(createWizardState() as never);

    expect(result).toBeNull();
    expect(logErrorMock).toHaveBeenCalledWith("ActorCreationEngine: Actor document class not available");
  });

  it.each([
    { startingLevel: 3, expectedLevel: 3, expectedHp: 28, expectedFeatures: ["Action Surge", "Martial Archetype"] },
    { startingLevel: 4, expectedLevel: 4, expectedHp: 36, expectedFeatures: ["Action Surge", "Martial Archetype"] },
    { startingLevel: 5, expectedLevel: 5, expectedHp: 44, expectedFeatures: ["Action Surge", "Martial Archetype"] },
  ])("applies higher-level fighter progression during creation through level $startingLevel", async ({
    startingLevel,
    expectedLevel,
    expectedHp,
    expectedFeatures,
  }) => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.config.startingLevel = startingLevel;
    state.selections.class = {
      uuid: "Compendium.classes.fighter",
      identifier: "fighter",
      name: "Fighter",
    };
    state.selections.subclass = { uuid: "Compendium.subclasses.champion" };
    state.selections.spells = { cantrips: [], spells: [] };
    state.selections.feats = {
      choice: "asi",
      asiAbilities: ["str", "con"],
    } as never;

    await createCharacterFromWizard(state as never);

    const classItem = Array.from(createActorInstance.items).find((item) => item.type === "class");
    expect(classItem?.system?.levels).toBe(expectedLevel);
    expect(createActorInstance.system.details.level).toBe(expectedLevel);
    expect(createActorInstance.system.attributes.hp.max).toBe(expectedHp);
    expect(createActorInstance.system.attributes.hp.value).toBe(expectedHp);

    if (startingLevel >= 4) {
      expect(createActorInstance.system.abilities.str.value).toBe(9);
      expect(createActorInstance.system.abilities.con.value).toBe(14);
    }

    for (const featureName of expectedFeatures) {
      expect(createActorInstance.createEmbeddedDocuments).toHaveBeenCalledWith(
        "Item",
        expect.arrayContaining([expect.objectContaining({ name: featureName })]),
      );
    }
  });

  it("uses the configured creation selections for higher-level HP gains instead of stale actor constitution", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.config.startingLevel = 5;
    state.selections.class = {
      uuid: "Compendium.classes.fighter",
      identifier: "fighter",
      name: "Fighter",
    };
    state.selections.background = {
      ...state.selections.background,
      asi: { assignments: { str: 2, con: 1 } },
    } as never;
    state.selections.subclass = { uuid: "Compendium.subclasses.champion" };
    state.selections.spells = { cantrips: [], spells: [] };
    state.selections.feats = {
      choice: "asi",
      asiAbilities: ["str"],
    } as never;

    createActorInstance.system.abilities.con.value = 12;
    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.classes.fighter") {
        return {
          system: {
            hd: { denomination: "d10" },
          },
          toObject: () => ({
            name: "Fighter",
            type: "class",
            system: {
              identifier: "fighter",
              levels: 1,
              hd: { denomination: "d10" },
              advancement: [
                {
                  type: "ItemGrant",
                  level: 2,
                  configuration: { items: [{ uuid: "Compendium.features.action-surge", name: "Action Surge" }] },
                },
                {
                  type: "ItemGrant",
                  level: 3,
                  configuration: { items: [{ uuid: "Compendium.features.martial-archetype", name: "Martial Archetype" }] },
                },
                {
                  type: "ItemGrant",
                  level: 5,
                  configuration: { items: [{ uuid: "Compendium.features.extra-attack", name: "Extra Attack" }] },
                },
              ],
            },
          }),
        };
      }

      return null;
    });

    await createCharacterFromWizard(state as never);

    expect(createActorInstance.system.attributes.hp.max).toBe(44);
    expect(createActorInstance.system.attributes.hp.value).toBe(44);
  });

  it("grants baseline class features and subclass feature grants during higher-level wizard creation", async () => {
    const { createCharacterFromWizard } = await import("./actor-creation-engine");
    const state = createWizardState();
    state.config.startingLevel = 5;
    state.selections.class = {
      uuid: "Compendium.classes.wizard",
      identifier: "wizard",
      name: "Wizard",
    };
    state.selections.subclass = {
      uuid: "Compendium.subclasses.bladesinger",
      name: "Bladesinger",
      classIdentifier: "wizard",
    } as never;
    state.selections.spells = { cantrips: [], spells: [] };
    delete (state.selections as { feats?: unknown }).feats;

    fromUuidMock.mockImplementation(async (uuid: string) => ({
      toObject: () => ({
        _id: `embedded-${uuid}`,
        name: uuid === "Compendium.features.spellcasting"
          ? "Spellcasting"
          : uuid === "Compendium.features.ritual-adept"
            ? "Ritual Adept"
            : uuid === "Compendium.features.arcane-recovery"
              ? "Arcane Recovery"
              : uuid === "Compendium.features.scholar"
                ? "Scholar"
                : uuid === "Compendium.features.memorize-spell"
                  ? "Memorize Spell"
                  : uuid === "Compendium.features.bladesong"
                    ? "Bladesong"
                    : uuid === "Compendium.features.training-in-war-and-song"
                      ? "Training in War and Song"
                      : uuid.split(".").at(-1),
        type: uuid.includes(".species.") ? "race"
          : uuid.includes(".backgrounds.") ? "background"
          : uuid.includes(".classes.") ? "class"
          : uuid.includes(".subclasses.") ? "subclass"
          : uuid.includes(".spells.") ? "spell"
          : "feat",
        system: uuid === "Compendium.classes.wizard"
          ? {
              hitDice: "d6",
              levels: 1,
              identifier: "wizard",
              advancement: [
                {
                  type: "ItemGrant",
                  level: 1,
                  configuration: {
                    items: [
                      { uuid: "Compendium.features.spellcasting", name: "Spellcasting" },
                      { uuid: "Compendium.features.ritual-adept", name: "Ritual Adept" },
                      { uuid: "Compendium.features.arcane-recovery", name: "Arcane Recovery" },
                    ],
                  },
                },
                {
                  type: "ItemGrant",
                  level: 2,
                  configuration: {
                    items: [{ uuid: "Compendium.features.scholar", name: "Scholar" }],
                  },
                },
                {
                  type: "ItemGrant",
                  level: 5,
                  configuration: {
                    items: [{ uuid: "Compendium.features.memorize-spell", name: "Memorize Spell" }],
                  },
                },
                {
                  type: "Trait",
                  title: "Skill Proficiencies",
                  level: 1,
                  value: { chosen: [] },
                },
              ],
            }
          : uuid === "Compendium.subclasses.bladesinger"
            ? {
                classIdentifier: "wizard",
                identifier: "bladesinger",
                advancement: [
                  {
                    type: "ItemGrant",
                    level: 3,
                    configuration: {
                      items: [
                        { uuid: "Compendium.features.bladesong", name: "Bladesong" },
                        { uuid: "Compendium.features.training-in-war-and-song", name: "Training in War and Song" },
                      ],
                    },
                  },
                ],
              }
            : uuid === "Compendium.backgrounds.sage"
              ? {
                  advancement: [
                    {
                      type: "Trait",
                      title: "Background Proficiencies",
                      level: 0,
                      configuration: { grants: ["skills:arc"] },
                      value: { chosen: [] },
                    },
                    {
                      type: "Trait",
                      title: "Choose Languages",
                      level: 0,
                      configuration: { grants: ["languages:standard:common"] },
                      value: { chosen: [] },
                    },
                  ],
                }
              : uuid === "Compendium.species.high-elf"
                ? {
                    advancement: [
                      {
                        type: "Trait",
                        title: "Languages",
                        level: 0,
                        configuration: { grants: ["languages:standard:elvish"] },
                        value: { chosen: [] },
                      },
                    ],
                  }
                : {},
      }),
      system: uuid === "Compendium.classes.wizard"
        ? { hitDice: "d6" }
        : undefined,
    }));

    await createCharacterFromWizard(state as never);

    const embeddedItemNames = createActorInstance.createEmbeddedDocuments.mock.calls
      .flatMap(([, docs]) => (docs as Array<{ name?: string }>).map((doc) => doc.name ?? ""));

    expect(embeddedItemNames).toEqual(expect.arrayContaining([
      "Spellcasting",
      "Ritual Adept",
      "Arcane Recovery",
      "Scholar",
      "Memorize Spell",
      "Bladesong",
      "Training in War and Song",
    ]));
  });
});
