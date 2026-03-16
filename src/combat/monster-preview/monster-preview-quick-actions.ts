export interface MonsterPreviewQuickActionDefinition {
  id: string;
  label: string;
  action: string;
  icon: string;
  ability?: string;
  skill?: string;
}

export interface MonsterPreviewQuickActionChoice extends MonsterPreviewQuickActionDefinition {
  enabled: boolean;
}

export const DEFAULT_MONSTER_PREVIEW_QUICK_ACTION_IDS = [
  "open-sheet",
  "roll-initiative",
  "roll-skill:prc",
  "roll-skill:ste",
  "roll-save:wis",
] as const;

const QUICK_ACTION_DEFINITIONS: readonly MonsterPreviewQuickActionDefinition[] = [
  { id: "open-sheet", label: "Sheet", action: "open-sheet", icon: "fa-book-open" },
  { id: "roll-initiative", label: "Init", action: "roll-initiative", icon: "fa-dice-d20" },
  { id: "roll-skill:prc", label: "Perception", action: "roll-skill", skill: "prc", icon: "fa-eye" },
  { id: "roll-skill:ste", label: "Stealth", action: "roll-skill", skill: "ste", icon: "fa-user-ninja" },
  { id: "roll-save:wis", label: "Wis Save", action: "roll-save", ability: "wis", icon: "fa-shield-halved" },
] as const;

export const DEFAULT_MONSTER_PREVIEW_QUICK_ACTIONS = [...QUICK_ACTION_DEFINITIONS];

export function getMonsterPreviewQuickActionChoices(settingValue?: string | null): MonsterPreviewQuickActionChoice[] {
  const enabledIds = new Set(resolveMonsterPreviewQuickActions(settingValue).map((action) => action.id));
  return QUICK_ACTION_DEFINITIONS.map((definition) => ({
    ...definition,
    enabled: enabledIds.has(definition.id),
  }));
}

export function resolveMonsterPreviewQuickActions(settingValue?: string | null): MonsterPreviewQuickActionDefinition[] {
  const normalized = typeof settingValue === "string"
    ? settingValue.trim().toLowerCase()
    : "";
  if (normalized === "none") return [];

  const requestedIds = normalized
    ? normalized.split(",").map((part) => part.trim()).filter(Boolean)
    : [...DEFAULT_MONSTER_PREVIEW_QUICK_ACTION_IDS];

  const requestedSet = new Set(requestedIds);
  const resolved = QUICK_ACTION_DEFINITIONS.filter((definition) => requestedSet.has(definition.id));

  return resolved.length > 0
    ? resolved
    : [...QUICK_ACTION_DEFINITIONS];
}

export function serializeMonsterPreviewQuickActionSelection(rawSelection: unknown): string {
  const selectedIds = Array.isArray(rawSelection)
    ? rawSelection.map(String)
    : rawSelection
      ? [String(rawSelection)]
      : [];
  const selectedSet = new Set(selectedIds);
  const orderedIds = QUICK_ACTION_DEFINITIONS
    .filter((definition) => selectedSet.has(definition.id))
    .map((definition) => definition.id);

  return orderedIds.length > 0 ? orderedIds.join(",") : "none";
}
