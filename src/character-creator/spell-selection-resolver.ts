import {
  getSpellPreparationPolicy,
  type SpellPreparationClassDocumentLike,
} from "./spell-preparation-policy";

export interface SpellcastingRule {
  id: string;
  label: string;
  mode: "known" | "prepared" | "known-prepared" | "pact";
  progression: "full" | "half" | "third" | "artificer" | "pact";
  listIdentifier: string;
  cantripsKnown?: Partial<Record<number, number>>;
  spellsKnown?: Partial<Record<number, number>>;
  replacementsPerLevel: number;
}

export interface ResolvedSpellcastingIdentity {
  ruleId: string;
  ruleLabel: string;
  listIdentifier: string;
  listLabel: string;
  sourceContextLabel: string;
}

export interface ResolvedSpellEntitlements extends ResolvedSpellcastingIdentity {
  maxSpellLevel: number;
  maxCantrips: number | null;
  maxSpells: number | null;
  preparedLimit: number | null;
  usesPreparedSpells: boolean;
  usesPreparedSpellPicker: boolean;
  swapLimit: number;
}

export interface ResolvedLevelUpSpellEntitlements extends ResolvedSpellEntitlements {
  currentLevel: number;
  targetLevel: number;
  newCantrips: number;
  newSpells: number;
}

const SPELLCASTING_RULES: Record<string, SpellcastingRule> = {
  bard: {
    id: "bard",
    label: "Bard",
    mode: "known",
    progression: "full",
    listIdentifier: "bard",
    replacementsPerLevel: 1,
    cantripsKnown: {
      1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4,
      11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4,
    },
    spellsKnown: {
      1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11, 9: 12, 10: 14,
      11: 15, 12: 15, 13: 16, 14: 16, 15: 17, 16: 17, 17: 18, 18: 19, 19: 19, 20: 20,
    },
  },
  sorcerer: {
    id: "sorcerer",
    label: "Sorcerer",
    mode: "known",
    progression: "full",
    listIdentifier: "sorcerer",
    replacementsPerLevel: 1,
    cantripsKnown: {
      1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5, 10: 6,
      11: 6, 12: 6, 13: 6, 14: 6, 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 6,
    },
    spellsKnown: {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11,
      11: 12, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 15, 19: 15, 20: 15,
    },
  },
  warlock: {
    id: "warlock",
    label: "Warlock",
    mode: "pact",
    progression: "pact",
    listIdentifier: "warlock",
    replacementsPerLevel: 1,
    cantripsKnown: {
      1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4,
      11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4,
    },
    spellsKnown: {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10,
      11: 11, 12: 11, 13: 12, 14: 12, 15: 13, 16: 13, 17: 14, 18: 14, 19: 15, 20: 15,
    },
  },
  ranger: {
    id: "ranger",
    label: "Ranger",
    mode: "known",
    progression: "half",
    listIdentifier: "ranger",
    replacementsPerLevel: 1,
    cantripsKnown: {
      1: 0, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3,
      11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3,
    },
    spellsKnown: {
      1: 0, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6,
      11: 7, 12: 7, 13: 8, 14: 8, 15: 9, 16: 9, 17: 10, 18: 10, 19: 11, 20: 11,
    },
  },
  wizard: {
    id: "wizard",
    label: "Wizard",
    mode: "known-prepared",
    progression: "full",
    listIdentifier: "wizard",
    replacementsPerLevel: 0,
    cantripsKnown: {
      1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 5,
      11: 5, 12: 5, 13: 5, 14: 5, 15: 5, 16: 5, 17: 5, 18: 5, 19: 5, 20: 5,
    },
    spellsKnown: {
      1: 6, 2: 8, 3: 10, 4: 12, 5: 14, 6: 16, 7: 18, 8: 20, 9: 22, 10: 24,
      11: 26, 12: 28, 13: 30, 14: 32, 15: 34, 16: 36, 17: 38, 18: 40, 19: 42, 20: 44,
    },
  },
  cleric: {
    id: "cleric",
    label: "Cleric",
    mode: "prepared",
    progression: "full",
    listIdentifier: "cleric",
    replacementsPerLevel: 0,
    cantripsKnown: {
      1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 5,
      11: 5, 12: 5, 13: 5, 14: 5, 15: 5, 16: 5, 17: 5, 18: 5, 19: 5, 20: 5,
    },
  },
  druid: {
    id: "druid",
    label: "Druid",
    mode: "prepared",
    progression: "full",
    listIdentifier: "druid",
    replacementsPerLevel: 0,
    cantripsKnown: {
      1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4,
      11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4,
    },
  },
  paladin: {
    id: "paladin",
    label: "Paladin",
    mode: "prepared",
    progression: "half",
    listIdentifier: "paladin",
    replacementsPerLevel: 0,
    cantripsKnown: {},
  },
  artificer: {
    id: "artificer",
    label: "Artificer",
    mode: "prepared",
    progression: "artificer",
    listIdentifier: "artificer",
    replacementsPerLevel: 0,
    cantripsKnown: {
      1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3,
      11: 3, 12: 3, 13: 3, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4,
    },
  },
  "eldritch-knight": {
    id: "eldritch-knight",
    label: "Eldritch Knight",
    mode: "known",
    progression: "third",
    listIdentifier: "wizard",
    replacementsPerLevel: 1,
    cantripsKnown: {
      1: 0, 2: 0, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3,
      11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3,
    },
    spellsKnown: {
      1: 0, 2: 0, 3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6, 10: 7,
      11: 8, 12: 8, 13: 9, 14: 10, 15: 10, 16: 11, 17: 11, 18: 11, 19: 12, 20: 13,
    },
  },
  "arcane-trickster": {
    id: "arcane-trickster",
    label: "Arcane Trickster",
    mode: "known",
    progression: "third",
    listIdentifier: "wizard",
    replacementsPerLevel: 1,
    cantripsKnown: {
      1: 0, 2: 0, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4,
      11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4,
    },
    spellsKnown: {
      1: 0, 2: 0, 3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6, 10: 7,
      11: 8, 12: 8, 13: 9, 14: 10, 15: 10, 16: 11, 17: 11, 18: 11, 19: 12, 20: 13,
    },
  },
};

const SUBCLASS_RULE_ALIASES: Record<string, string> = {
  "eldritch knight": "eldritch-knight",
  "arcane trickster": "arcane-trickster",
};

const RULE_LABEL_OVERRIDES: Record<string, string> = {
  "arcane-trickster": "Arcane Trickster",
  "eldritch-knight": "Eldritch Knight",
};

export function getMaxSpellLevel(characterLevel: number, progression: string): number {
  if (progression === "pact") {
    return Math.min(5, Math.ceil(characterLevel / 2));
  }

  let casterLevel = characterLevel;
  if (progression === "half" || progression === "artificer") casterLevel = Math.ceil(characterLevel / 2);
  else if (progression === "third") casterLevel = Math.ceil(characterLevel / 3);

  if (casterLevel >= 17) return 9;
  if (casterLevel >= 15) return 8;
  if (casterLevel >= 13) return 7;
  if (casterLevel >= 11) return 6;
  if (casterLevel >= 9) return 5;
  if (casterLevel >= 7) return 4;
  if (casterLevel >= 5) return 3;
  if (casterLevel >= 3) return 2;
  return 1;
}

export function resolveCreationSpellEntitlements(args: {
  classIdentifier: string;
  className: string;
  level: number;
  progression?: string;
  subclassName?: string | null;
  classDoc?: SpellPreparationClassDocumentLike | null;
}): ResolvedSpellEntitlements {
  const identity = resolveSpellcastingIdentity(args.classIdentifier, args.className, args.subclassName);
  const rule = SPELLCASTING_RULES[identity.ruleId];
  const preparationPolicy = getSpellPreparationPolicy(
    args.classIdentifier,
    args.classDoc,
    args.level,
  );

  return {
    ...identity,
    maxSpellLevel: getMaxSpellLevel(args.level, rule?.progression ?? args.progression ?? "full"),
    maxCantrips: resolveProgressionValue(rule?.cantripsKnown, args.level),
    maxSpells: resolveProgressionValue(rule?.spellsKnown, args.level),
    preparedLimit: preparationPolicy.preparedLimit,
    usesPreparedSpells: preparationPolicy.usesPreparedSpells,
    usesPreparedSpellPicker: preparationPolicy.usesPreparedSpellPicker,
    swapLimit: rule?.replacementsPerLevel ?? 0,
  };
}

export function resolveLevelUpSpellEntitlements(args: {
  classIdentifier: string;
  className: string;
  currentLevel: number;
  targetLevel: number;
  progression?: string;
  subclassName?: string | null;
  classDoc?: SpellPreparationClassDocumentLike | null;
}): ResolvedLevelUpSpellEntitlements {
  const identity = resolveSpellcastingIdentity(args.classIdentifier, args.className, args.subclassName);
  const rule = SPELLCASTING_RULES[identity.ruleId];
  const preparationPolicy = getSpellPreparationPolicy(
    args.classIdentifier,
    args.classDoc,
    args.targetLevel,
  );
  const targetCantrips = resolveProgressionValue(rule?.cantripsKnown, args.targetLevel) ?? 0;
  const currentCantrips = resolveProgressionValue(rule?.cantripsKnown, args.currentLevel) ?? 0;
  const targetSpells = resolveProgressionValue(rule?.spellsKnown, args.targetLevel);
  const currentSpells = resolveProgressionValue(rule?.spellsKnown, args.currentLevel) ?? 0;

  return {
    ...identity,
    currentLevel: args.currentLevel,
    targetLevel: args.targetLevel,
    maxSpellLevel: getMaxSpellLevel(args.targetLevel, rule?.progression ?? args.progression ?? "full"),
    maxCantrips: targetCantrips,
    maxSpells: targetSpells,
    preparedLimit: preparationPolicy.preparedLimit,
    usesPreparedSpells: preparationPolicy.usesPreparedSpells,
    usesPreparedSpellPicker: preparationPolicy.usesPreparedSpellPicker,
    swapLimit: args.targetLevel > args.currentLevel ? (rule?.replacementsPerLevel ?? 0) : 0,
    newCantrips: Math.max(0, targetCantrips - currentCantrips),
    newSpells: Math.max(0, (targetSpells ?? 0) - currentSpells),
  };
}

export function resolveSpellcastingIdentity(
  classIdentifier: string,
  className: string,
  subclassName?: string | null,
): ResolvedSpellcastingIdentity {
  const normalizedSubclass = normalizeSpellRuleId(subclassName ?? "");
  const ruleId = SPELLCASTING_RULES[normalizedSubclass]
    ? normalizedSubclass
    : normalizeSpellRuleId(classIdentifier);
  const rule = SPELLCASTING_RULES[ruleId];
  const ruleLabel = rule?.label ?? formatSpellcastingLabel(className || classIdentifier);
  const listIdentifier = rule?.listIdentifier ?? normalizeSpellRuleId(classIdentifier);
  const listLabel = RULE_LABEL_OVERRIDES[listIdentifier] ?? formatSpellcastingLabel(listIdentifier);
  const sourceContextLabel = rule && rule.id !== listIdentifier
    ? `${ruleLabel} draws from the ${listLabel} spell list`
    : `Filtered to the ${listLabel} spell list`;

  return {
    ruleId,
    ruleLabel,
    listIdentifier,
    listLabel,
    sourceContextLabel,
  };
}

export function resolveProgressionValue(
  values: Partial<Record<number, number>> | undefined,
  level: number,
): number | null {
  if (!values) return null;

  const matchingLevel = Object.keys(values)
    .map((key) => Number.parseInt(key, 10))
    .filter((entry) => Number.isFinite(entry) && entry <= level)
    .sort((left, right) => right - left)[0];

  if (matchingLevel === undefined) return null;
  return values[matchingLevel] ?? null;
}

export function normalizeSpellRuleId(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  return SUBCLASS_RULE_ALIASES[normalized.replace(/-/g, " ")] ?? normalized;
}

export function formatSpellcastingLabel(value: string): string {
  const normalized = normalizeSpellRuleId(value);
  if (RULE_LABEL_OVERRIDES[normalized]) return RULE_LABEL_OVERRIDES[normalized];
  return normalized
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export const __spellSelectionResolverInternals = {
  SPELLCASTING_RULES,
  resolveProgressionValue,
};
