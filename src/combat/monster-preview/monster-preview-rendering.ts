import type {
  FeatureEntryViewModel,
  FeatureSectionViewModel,
  NPCViewModel,
} from "../../print-sheet/renderers/viewmodels/npc-viewmodel";
import type { MonsterPreviewContextInfo } from "./monster-preview-context";
import type { UpNextInfo } from "./monster-preview-up-next";
import type { MonsterPreviewStatusInfo } from "./monster-preview-status";
import {
  DEFAULT_MONSTER_PREVIEW_QUICK_ACTIONS,
  type MonsterPreviewQuickActionDefinition,
} from "./monster-preview-quick-actions";

export type MonsterPreviewHeaderCue = "pinned" | "persistent" | null;

export function buildMonsterPreviewHeaderFlashHTML(message?: string | null): string {
  if (!message) return "";
  return `<span class="mp-header-flash" aria-live="polite">${message}</span>`;
}

export function buildMonsterPreviewContentHTML(
  vm: NPCViewModel,
  upNext: UpNextInfo | null,
  actorId?: string | null,
  status?: MonsterPreviewStatusInfo,
  context?: MonsterPreviewContextInfo,
  quickActions?: MonsterPreviewQuickActionDefinition[],
): string {
  return `
    ${buildMonsterPreviewStatBlockHTML(vm, actorId, status, context, quickActions)}
    <div class="mp-up-next">${buildMonsterPreviewUpNextHTML(upNext)}</div>
  `;
}

export function buildMonsterPreviewInlineHTML(
  content: string,
  pinned = false,
  headerCue: MonsterPreviewHeaderCue = null,
  headerFlash?: string | null,
): string {
  return `
    <div class="mp-header">
      <span class="mp-title"><i class="fa-solid fa-dragon"></i> Monster Preview</span>
      ${buildMonsterPreviewHeaderCueHTML(headerCue)}
      ${buildMonsterPreviewHeaderFlashHTML(headerFlash)}
      <button class="mp-pin${pinned ? " is-active" : ""}" type="button" aria-label="${pinned ? "Unpin preview here" : "Pin preview here"}" data-tooltip="${pinned ? "Unpin Here" : "Pin Here"}" aria-pressed="${pinned ? "true" : "false"}">
        <i class="fa-solid fa-thumbtack"></i>
      </button>
      <button class="mp-popout" type="button" aria-label="Pop out" data-tooltip="Pop Out">
        <i class="fa-solid fa-up-right-from-square"></i>
      </button>
      <button class="mp-close" type="button" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mp-body">${content}</div>
  `;
}

export function buildMonsterPreviewPanelHTML(
  content: string,
  pinned = false,
  headerCue: MonsterPreviewHeaderCue = null,
  headerFlash?: string | null,
): string {
  return `
    <div class="mp-header" data-mp-drag>
      <span class="mp-title"><i class="fa-solid fa-dragon"></i> Monster Preview</span>
      ${buildMonsterPreviewHeaderCueHTML(headerCue)}
      ${buildMonsterPreviewHeaderFlashHTML(headerFlash)}
      <button class="mp-pin${pinned ? " is-active" : ""}" type="button" aria-label="${pinned ? "Unpin preview here" : "Pin preview here"}" data-tooltip="${pinned ? "Unpin Here" : "Pin Here"}" aria-pressed="${pinned ? "true" : "false"}">
        <i class="fa-solid fa-thumbtack"></i>
      </button>
      <button class="mp-reset-layout" type="button" aria-label="Reset preview layout" data-tooltip="Reset Layout">
        <i class="fa-solid fa-rotate-left"></i>
      </button>
      <button class="mp-minimize" type="button" aria-label="Minimize preview" data-tooltip="Minimize">
        <i class="fa-solid fa-window-minimize"></i>
      </button>
      <button class="mp-dock" type="button" aria-label="Dock to sidebar" data-tooltip="Dock to Sidebar">
        <i class="fa-solid fa-right-to-bracket"></i>
      </button>
      <button class="mp-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mp-body">${content}</div>
  `;
}

export function buildMonsterPreviewMinimizedPanelHTML(
  content: string,
  pinned = false,
  headerCue: MonsterPreviewHeaderCue = null,
  headerFlash?: string | null,
): string {
  return `
    <div class="mp-header" data-mp-drag>
      <span class="mp-title"><i class="fa-solid fa-dragon"></i> Monster Preview</span>
      ${buildMonsterPreviewHeaderCueHTML(headerCue)}
      ${buildMonsterPreviewHeaderFlashHTML(headerFlash)}
      <button class="mp-pin${pinned ? " is-active" : ""}" type="button" aria-label="${pinned ? "Unpin preview here" : "Pin preview here"}" data-tooltip="${pinned ? "Unpin Here" : "Pin Here"}" aria-pressed="${pinned ? "true" : "false"}">
        <i class="fa-solid fa-thumbtack"></i>
      </button>
      <button class="mp-reset-layout" type="button" aria-label="Reset preview layout" data-tooltip="Reset Layout">
        <i class="fa-solid fa-rotate-left"></i>
      </button>
      <button class="mp-expand" type="button" aria-label="Expand preview" data-tooltip="Expand">
        <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
      </button>
      <button class="mp-dock" type="button" aria-label="Dock to sidebar" data-tooltip="Dock to Sidebar">
        <i class="fa-solid fa-right-to-bracket"></i>
      </button>
      <button class="mp-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mp-body mp-body-minimized">${buildMonsterPreviewMinimizedContentHTML(content)}</div>
  `;
}

export function buildMonsterPreviewHeaderCueHTML(headerCue: MonsterPreviewHeaderCue): string {
  if (!headerCue) return "";

  if (headerCue === "pinned") {
    return `<span class="mp-header-cue mp-header-cue-pinned"><i class="fa-solid fa-thumbtack"></i> Pinned Here</span>`;
  }

  return `<span class="mp-header-cue mp-header-cue-persistent"><i class="fa-solid fa-clock-rotate-left"></i> World Persistent</span>`;
}

export function buildMonsterPreviewStatBlockHTML(
  vm: NPCViewModel,
  actorId?: string | null,
  status?: MonsterPreviewStatusInfo,
  context?: MonsterPreviewContextInfo,
  quickActions?: MonsterPreviewQuickActionDefinition[],
): string {
  const parts: string[] = [];
  const isActiveTurn = Boolean(context?.turnLabel);
  const identityTag = actorId ? "button" : "div";
  const identityAttrs = actorId
    ? ` class="mp-identity${isActiveTurn ? " mp-identity-active" : ""} mp-open-actor" type="button" data-actor-id="${actorId}" aria-label="Open ${vm.name} sheet"`
    : ` class="mp-identity${isActiveTurn ? " mp-identity-active" : ""}"`;
  parts.push(`<${identityTag}${identityAttrs}>`);
  if (vm.hasPortrait) {
    parts.push(`<img class="mp-portrait" src="${vm.portraitUrl}" alt="" />`);
  }
  parts.push(`<div class="mp-name-block">`);
  parts.push(`<div class="mp-name">${vm.name}</div>`);
  parts.push(`<div class="mp-meta">${vm.meta}</div>`);
  if (isActiveTurn) {
    parts.push(`<div class="mp-active-turn-banner"><span class="mp-active-turn-pill"><i class="fa-solid fa-bolt"></i> ${context?.turnLabel}</span></div>`);
  }
  parts.push(buildMonsterPreviewContextHTML(context));
  parts.push(buildMonsterPreviewStatusHTML(status));
  parts.push(`</div></${identityTag}>`);
  parts.push(buildMonsterPreviewQuickActionsHTML(actorId, quickActions));

  if (vm.showStats) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-core-stats">`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">AC</span> <span class="mp-stat-value">${vm.ac}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">HP</span> <span class="mp-stat-value">${vm.hp}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">Speed</span> <span class="mp-stat-value">${vm.speed}</span></div>`);
    parts.push(`<div class="mp-stat"><span class="mp-stat-label">Init</span> <span class="mp-stat-value">${vm.initiative}</span></div>`);
    parts.push(`</div>`);
  }

  if (vm.showAbilities && vm.abilityRows.length > 0) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-abilities">`);
    for (const row of vm.abilityRows) {
      if (row.left) parts.push(buildMonsterPreviewAbilityCell(row.left));
      if (row.right) parts.push(buildMonsterPreviewAbilityCell(row.right));
    }
    parts.push(`</div>`);
  }

  if (vm.showTraits && vm.traitLines.length > 0) {
    parts.push(`<div class="mp-divider"></div>`);
    parts.push(`<div class="mp-traits">`);
    for (const trait of vm.traitLines) {
      parts.push(`<div class="mp-trait"><strong class="mp-trait-label">${trait.label}</strong> ${trait.value}</div>`);
    }
    parts.push(`</div>`);
  }

  if (vm.featureSections.length > 0) {
    for (const section of vm.featureSections) {
      if (!section.hasEntries) continue;
      parts.push(buildMonsterPreviewFeatureSection(section));
    }
  }

  return parts.join("");
}

export function buildMonsterPreviewStatusHTML(status?: MonsterPreviewStatusInfo): string {
  if (!status) return "";

  const badges: string[] = [];
  if (status.isDefeated) {
    badges.push(`<span class="mp-status-badge mp-status-defeated"><i class="fa-solid fa-skull"></i> Defeated</span>`);
  }
  if (status.isConcentrating) {
    badges.push(`<span class="mp-status-badge mp-status-concentrating"><i class="fa-solid fa-bullseye"></i> Concentrating</span>`);
  }
  for (const condition of status.conditions) {
    badges.push(`<span class="mp-status-badge mp-status-condition" data-status-id="${condition.id}">${condition.label}</span>`);
  }

  if (badges.length === 0) return "";
  return `<div class="mp-status-strip">${badges.join("")}</div>`;
}

export function buildMonsterPreviewContextHTML(context?: MonsterPreviewContextInfo): string {
  if (!context) return "";

  const chips: string[] = [];
  if (context.tokenName) {
    chips.push(`<span class="mp-context-chip mp-context-token"><i class="fa-solid fa-location-crosshairs"></i> ${context.tokenName}</span>`);
  }
  if (context.initiative) {
    chips.push(`<span class="mp-context-chip mp-context-init"><i class="fa-solid fa-list-ol"></i> Init ${context.initiative}</span>`);
  }
  if (context.turnLabel) {
    chips.push(`<span class="mp-context-chip mp-context-turn">${context.turnLabel}</span>`);
  }
  if (context.roundLabel) {
    chips.push(`<span class="mp-context-chip mp-context-round">${context.roundLabel}</span>`);
  }

  if (chips.length === 0) return "";
  return `<div class="mp-context-strip">${chips.join("")}</div>`;
}

export function buildMonsterPreviewQuickActionsHTML(
  actorId?: string | null,
  quickActions: MonsterPreviewQuickActionDefinition[] = DEFAULT_MONSTER_PREVIEW_QUICK_ACTIONS,
): string {
  if (!actorId || quickActions.length === 0) return "";

  return `
    <div class="mp-quick-actions">
      ${quickActions.map((quickAction) => `
        <button
          class="mp-quick-action"
          type="button"
          data-mp-action="${quickAction.action}"
          data-actor-id="${actorId}"
          ${quickAction.skill ? `data-skill="${quickAction.skill}"` : ""}
          ${quickAction.ability ? `data-ability="${quickAction.ability}"` : ""}
        >${quickAction.label}</button>
      `).join("")}
    </div>
  `;
}

export function buildMonsterPreviewMinimizedContentHTML(content: string): string {
  return `
    <div class="mp-minimized-content">
      ${extractMonsterPreviewIdentityHTML(content)}
    </div>
  `;
}

function extractMonsterPreviewIdentityHTML(content: string): string {
  const match = content.match(/<(button|div)\s+class="mp-identity[\s\S]*?<\/\1>/);
  return match?.[0] ?? "";
}

export function buildMonsterPreviewAbilityCell(cell: { key: string; value: number; mod: string; save: string }): string {
  return `
    <div class="mp-ability">
      <span class="mp-ability-key">${cell.key}</span>
      <span class="mp-ability-score">${cell.value} <span class="mp-ability-mod">(${cell.mod})</span></span>
      <span class="mp-ability-save">Save ${cell.save}</span>
    </div>
  `;
}

export function buildMonsterPreviewFeatureSection(section: FeatureSectionViewModel): string {
  const parts: string[] = [];
  parts.push(`<div class="mp-divider"></div>`);
  parts.push(`<div class="mp-feature-section">`);
  parts.push(`<div class="mp-section-title">${section.title}</div>`);
  if (section.intro) {
    parts.push(`<div class="mp-section-intro">${section.intro}</div>`);
  }
  for (const entry of section.entries) {
    parts.push(buildMonsterPreviewFeatureEntry(entry));
  }
  parts.push(`</div>`);
  return parts.join("");
}

export function buildMonsterPreviewFeatureEntry(entry: FeatureEntryViewModel): string {
  return `
    <div class="mp-feature">
      <span class="mp-feature-name">${entry.nameWithUses}.</span>
      <span class="mp-feature-desc">${entry.description}</span>
    </div>
  `;
}

export function buildMonsterPreviewUpNextHTML(upNext: UpNextInfo | null): string {
  if (!upNext) return "";

  let statsHtml = "";
  if (upNext.isNPC) {
    const statParts: string[] = [];
    if (upNext.cr !== undefined) statParts.push(`CR ${upNext.cr}`);
    if (upNext.ac !== undefined) statParts.push(`AC ${upNext.ac}`);
    if (upNext.hpValue !== undefined && upNext.hpMax !== undefined) {
      statParts.push(`HP ${upNext.hpValue}/${upNext.hpMax}`);
    } else if (upNext.hpValue !== undefined) {
      statParts.push(`HP ${upNext.hpValue}`);
    } else if (upNext.hpMax !== undefined) {
      statParts.push(`HP ${upNext.hpMax}`);
    }
    statsHtml = statParts.length > 0
      ? `<span class="mp-upnext-stats">${statParts.join(" · ")}</span>`
      : "";
  }

  const icon = upNext.isNPC
    ? `<i class="fa-solid fa-skull"></i>`
    : `<i class="fa-solid fa-user"></i>`;

  const rowTag = upNext.actorId ? "button" : "div";
  const rowAttrs = upNext.actorId
    ? ` class="mp-upnext-row mp-open-actor" type="button" data-actor-id="${upNext.actorId}" aria-label="Open ${upNext.name} sheet"`
    : ` class="mp-upnext-row"`;

  return `
    <div class="mp-upnext-divider"></div>
    <${rowTag}${rowAttrs}>
      <span class="mp-upnext-label">Up Next</span>
      <span class="mp-upnext-name">${icon} ${upNext.name}</span>
      ${statsHtml}
    </${rowTag}>
  `;
}
