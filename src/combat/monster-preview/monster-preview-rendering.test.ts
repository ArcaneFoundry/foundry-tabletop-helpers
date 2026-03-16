import { describe, expect, it } from "vitest";

import {
  buildMonsterPreviewContentHTML,
  buildMonsterPreviewHeaderFlashHTML,
  buildMonsterPreviewHeaderCueHTML,
  buildMonsterPreviewContextHTML,
  buildMonsterPreviewInlineHTML,
  buildMonsterPreviewMinimizedContentHTML,
  buildMonsterPreviewMinimizedPanelHTML,
  buildMonsterPreviewPanelHTML,
  buildMonsterPreviewQuickActionsHTML,
  buildMonsterPreviewStatusHTML,
  buildMonsterPreviewStatBlockHTML,
  buildMonsterPreviewUpNextHTML,
} from "./monster-preview-rendering";
import { DEFAULT_MONSTER_PREVIEW_QUICK_ACTIONS } from "./monster-preview-quick-actions";
import type { NPCViewModel } from "../../print-sheet/renderers/viewmodels/npc-viewmodel";

function makeNpcViewModel(): NPCViewModel {
  return {
    name: "Adult Red Dragon",
    meta: "Huge Dragon, Chaotic Evil",
    portraitUrl: "dragon.webp",
    hasPortrait: true,
    ac: "19",
    hp: "256 (19d12 + 133)",
    speed: "40 ft., fly 80 ft.",
    initiative: "+0",
    showStats: true,
    showAbilities: true,
    abilityRows: [
      {
        left: { key: "STR", value: 27, mod: "+8", save: "+14" },
        right: { key: "DEX", value: 10, mod: "+0", save: "+6" },
      },
    ],
    showTraits: true,
    traitLines: [
      { label: "Senses", value: "blindsight 60 ft." },
      { label: "Languages", value: "Common, Draconic" },
    ],
    featureSections: [
      {
        title: "Actions",
        intro: "The dragon can take 3 legendary actions.",
        hasEntries: true,
        entries: [
          { nameWithUses: "Multiattack", description: "The dragon makes three attacks." },
        ],
      },
      {
        title: "Empty",
        intro: "",
        hasEntries: false,
        entries: [],
      },
    ],
  } as NPCViewModel;
}

describe("monster preview rendering", () => {
  it("renders the monster stat block with abilities, traits, and features", () => {
    const html = buildMonsterPreviewStatBlockHTML(
      makeNpcViewModel(),
      "dragon-1",
      {
        isDefeated: false,
        isConcentrating: true,
        conditions: [{ id: "poisoned", label: "Poisoned" }],
      },
      {
        tokenName: "Dragon Alpha",
        initiative: "18",
        turnLabel: "Acting now",
        roundLabel: "Round 3",
      },
    );

    expect(html).toContain("Adult Red Dragon");
    expect(html).toContain("Huge Dragon, Chaotic Evil");
    expect(html).toContain("mp-portrait");
    expect(html).toContain("mp-open-actor");
    expect(html).toContain("data-actor-id=\"dragon-1\"");
    expect(html).toContain("Dragon Alpha");
    expect(html).toContain("Init 18");
    expect(html).toContain("Acting now");
    expect(html).toContain("mp-identity-active");
    expect(html).toContain("mp-active-turn-pill");
    expect(html).toContain("Concentrating");
    expect(html).toContain("Poisoned");
    expect(html).toContain("data-mp-action=\"roll-initiative\"");
    expect(html).toContain("Save +14");
    expect(html).toContain("Senses");
    expect(html).toContain("Multiattack.");
    expect(html).not.toContain("mp-section-title\">Empty");
  });

  it("renders a compact status strip only when status badges exist", () => {
    const statusHtml = buildMonsterPreviewStatusHTML({
      isDefeated: true,
      isConcentrating: true,
      conditions: [{ id: "prone", label: "Prone" }],
    });
    const emptyHtml = buildMonsterPreviewStatusHTML({
      isDefeated: false,
      isConcentrating: false,
      conditions: [],
    });

    expect(statusHtml).toContain("mp-status-strip");
    expect(statusHtml).toContain("Defeated");
    expect(statusHtml).toContain("Concentrating");
    expect(statusHtml).toContain("Prone");
    expect(emptyHtml).toBe("");
  });

  it("renders a compact context strip only when encounter cues exist", () => {
    const contextHtml = buildMonsterPreviewContextHTML({
      tokenName: "Goblin 3",
      initiative: "17",
      turnLabel: "Acting now",
      roundLabel: "Round 2",
    });
    const emptyHtml = buildMonsterPreviewContextHTML({});

    expect(contextHtml).toContain("mp-context-strip");
    expect(contextHtml).toContain("Goblin 3");
    expect(contextHtml).toContain("Init 17");
    expect(contextHtml).toContain("Acting now");
    expect(contextHtml).toContain("Round 2");
    expect(emptyHtml).toBe("");
  });

  it("renders header persistence cues only when requested", () => {
    expect(buildMonsterPreviewHeaderCueHTML("pinned")).toContain("Pinned Here");
    expect(buildMonsterPreviewHeaderCueHTML("persistent")).toContain("World Persistent");
    expect(buildMonsterPreviewHeaderCueHTML(null)).toBe("");
  });

  it("renders transient header feedback only when present", () => {
    expect(buildMonsterPreviewHeaderFlashHTML("Docked")).toContain("Docked");
    expect(buildMonsterPreviewHeaderFlashHTML(null)).toBe("");
  });

  it("does not add active-turn emphasis when the preview is not on the acting combatant", () => {
    const html = buildMonsterPreviewStatBlockHTML(
      makeNpcViewModel(),
      "dragon-1",
      {
        isDefeated: false,
        isConcentrating: false,
        conditions: [],
      },
      {
        tokenName: "Dragon Alpha",
        initiative: "18",
        roundLabel: "Round 3",
      },
    );

    expect(html).not.toContain("mp-identity-active");
    expect(html).not.toContain("mp-active-turn-pill");
  });

  it("renders compact quick actions when an actor id is available", () => {
    const html = buildMonsterPreviewQuickActionsHTML("dragon-1");

    expect(html).toContain("mp-quick-actions");
    expect(html).toContain("data-mp-action=\"open-sheet\"");
    expect(html).toContain("data-mp-action=\"roll-initiative\"");
    expect(html).toContain("data-skill=\"prc\"");
    expect(html).toContain("data-ability=\"wis\"");
  });

  it("renders only the configured quick action subset", () => {
    const html = buildMonsterPreviewQuickActionsHTML("dragon-1", [
      DEFAULT_MONSTER_PREVIEW_QUICK_ACTIONS[0],
      DEFAULT_MONSTER_PREVIEW_QUICK_ACTIONS[3],
    ]);

    expect(html).toContain("Sheet");
    expect(html).toContain("Stealth");
    expect(html).not.toContain("Perception");
    expect(html).not.toContain("Wis Save");
  });

  it("renders a minimized floating panel with identity-only content", () => {
    const content = buildMonsterPreviewContentHTML(
      makeNpcViewModel(),
      null,
      "dragon-1",
      {
        isDefeated: false,
        isConcentrating: false,
        conditions: [],
      },
      {
        tokenName: "Dragon Alpha",
        initiative: "18",
        turnLabel: "Acting now",
      },
    );

    const minimizedContent = buildMonsterPreviewMinimizedContentHTML(content);
    const minimizedPanel = buildMonsterPreviewMinimizedPanelHTML(content, true, "pinned", "Pinned");

    expect(minimizedContent).toContain("mp-minimized-content");
    expect(minimizedContent).toContain("Dragon Alpha");
    expect(minimizedContent).not.toContain("Perception");
    expect(minimizedPanel).toContain("mp-expand");
    expect(minimizedPanel).toContain("mp-pin is-active");
    expect(minimizedPanel).toContain("Pinned Here");
    expect(minimizedPanel).toContain("mp-header-flash");
    expect(minimizedPanel).toContain("mp-reset-layout");
    expect(minimizedPanel).toContain("mp-body-minimized");
  });

  it("renders up-next rows for npc and pc combatants", () => {
    const npcHtml = buildMonsterPreviewUpNextHTML({
      actorId: "goblin-1",
      name: "Goblin Boss",
      isNPC: true,
      cr: "1",
      ac: 17,
      hpValue: 9,
      hpMax: 21,
    });
    const pcHtml = buildMonsterPreviewUpNextHTML({
      name: "Aric",
      isNPC: false,
    });

    expect(npcHtml).toContain("Goblin Boss");
    expect(npcHtml).toContain("CR 1");
    expect(npcHtml).toContain("AC 17");
    expect(npcHtml).toContain("HP 9/21");
    expect(npcHtml).toContain("fa-skull");
    expect(npcHtml).toContain("data-actor-id=\"goblin-1\"");
    expect(pcHtml).toContain("fa-user");
    expect(pcHtml).not.toContain("mp-upnext-stats");
  });

  it("wraps shared content for inline and floating modes", () => {
    const content = buildMonsterPreviewContentHTML(
      makeNpcViewModel(),
      { actorId: "pc-1", name: "Cleric", isNPC: false },
      "dragon-1",
      {
        isDefeated: false,
        isConcentrating: false,
        conditions: [{ id: "blinded", label: "Blinded" }],
      },
      {
        tokenName: "Dragon Alpha",
        initiative: "18",
        roundLabel: "Round 3",
        turnLabel: "Acting now",
      },
    );
    const inlineHtml = buildMonsterPreviewInlineHTML(content, false, "persistent", "Docked");
    const panelHtml = buildMonsterPreviewPanelHTML(content, true, "pinned", "Pinned");

    expect(content).toContain("mp-up-next");
    expect(content).toContain("data-actor-id=\"dragon-1\"");
    expect(content).toContain("Blinded");
    expect(content).toContain("Dragon Alpha");
    expect(content).toContain("Perception");
    expect(inlineHtml).toContain("mp-popout");
    expect(inlineHtml).toContain("mp-pin");
    expect(inlineHtml).toContain("World Persistent");
    expect(inlineHtml).toContain("Pin Here");
    expect(inlineHtml).toContain("Docked");
    expect(inlineHtml).toContain("Monster Preview");
    expect(panelHtml).toContain("data-mp-drag");
    expect(panelHtml).toContain("mp-dock");
    expect(panelHtml).toContain("mp-pin is-active");
    expect(panelHtml).toContain("Pinned Here");
    expect(panelHtml).toContain("Unpin Here");
    expect(panelHtml).toContain("mp-header-flash");
    expect(panelHtml).toContain("mp-reset-layout");
  });
});
