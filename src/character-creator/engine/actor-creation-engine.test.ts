import { beforeEach, describe, expect, it, vi } from "vitest";

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

function createWizardState() {
  return {
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
      class: { uuid: "Compendium.classes.wizard" },
      subclass: { uuid: "Compendium.subclasses.evoker" },
      feats: { featUuid: "Compendium.feats.alert" },
      skills: { chosen: ["his", "ins"] },
      spells: {
        cantrips: ["Compendium.spells.fire-bolt"],
        spells: ["Compendium.spells.magic-missile"],
      },
      portrait: undefined as { portraitDataUrl?: string; tokenDataUrl?: string } | undefined,
      species: { uuid: "Compendium.species.high-elf" },
    },
  };
}

function createActor() {
  return {
    id: "actor-1",
    update: vi.fn(async () => createActorInstance),
    createEmbeddedDocuments: vi.fn(async () => []),
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
      name: uuid.split(".").at(-1),
      type: "feat",
    }),
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
    expect(createActorInstance.update).toHaveBeenCalledWith({
      "system.skills.arc.proficient": 1,
      "system.skills.his.proficient": 1,
      "system.skills.ins.proficient": 1,
    });
    expect(createActorInstance.update).toHaveBeenCalledWith({
      "system.traits.languages.value": ["common", "draconic"],
    });
    expect(createActorInstance.update).toHaveBeenCalledWith({
      "ownership.user-1": 3,
    });

    const socketEmit = (getGameMock.mock.results[0]?.value as { socket: { emit: ReturnType<typeof vi.fn> } }).socket.emit;
    expect(socketEmit).toHaveBeenCalledWith("module.foundry-tabletop-helpers", {
      action: "characterCreated",
      characterName: "Arannis Vale",
      actorId: "actor-1",
      userName: "Player One",
    });
    expect(getUIMock.mock.results[0]?.value.notifications.info).toHaveBeenCalledWith("Arannis Vale has been created!");
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
});
