import type {
  AbilityKey,
  AbilityScoreMethod,
  AbilityScoreState,
  WizardState,
} from "../character-creator-types";
import {
  ABILITY_ABBREVS,
  ABILITY_KEYS,
  ABILITY_LABELS,
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STANDARD_ARRAY,
  abilityModifier,
  formatModifier,
} from "../data/dnd5e-constants";

export function defaultScores(): Record<AbilityKey, number> {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
}

export function defaultAssignments(): Record<AbilityKey, number> {
  return { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 };
}

export function createAbilityStateForMethod(
  method: AbilityScoreMethod,
  current?: AbilityScoreState,
): AbilityScoreState {
  return {
    method,
    scores: method === "pointBuy" ? (current?.method === "pointBuy" ? current.scores : defaultScores()) : defaultScores(),
    assignments: defaultAssignments(),
    rolledValues: method === "4d6" ? current?.rolledValues : undefined,
    rerollCount: method === "4d6" ? (current?.rerollCount ?? 0) : 0,
  };
}

export function getAbilityState(state: WizardState): AbilityScoreState {
  const selection = state.selections.abilities;
  if (selection) return selection;

  const defaultMethod = state.config.allowedAbilityMethods[0] ?? "4d6";
  return createAbilityStateForMethod(defaultMethod);
}

export function isAbilityStateComplete(data: AbilityScoreState | undefined): boolean {
  if (!data) return false;
  if (data.method === "pointBuy") {
    return ABILITY_KEYS.every((key) => data.scores[key] > 0);
  }

  const pool = data.method === "4d6" ? data.rolledValues : STANDARD_ARRAY;
  if (!pool || pool.length !== 6) return false;

  return ABILITY_KEYS.every((key) => {
    const assignedIndex = data.assignments[key];
    return Number.isInteger(assignedIndex) && assignedIndex >= 0 && assignedIndex < pool.length;
  });
}

function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

export function rollAllAbilities(): number[] {
  return Array.from({ length: 6 }, () => roll4d6DropLowest());
}

export function pointBuySpent(scores: Record<AbilityKey, number>): number {
  let total = 0;
  for (const key of ABILITY_KEYS) {
    total += POINT_BUY_COSTS[scores[key]] ?? 0;
  }
  return total;
}

export function buildAbilitiesVM(state: WizardState): Record<string, unknown> {
  const data = getAbilityState(state);
  const methods = state.config.allowedAbilityMethods;

  const methodTabs = [
    { id: "4d6", label: "Roll 4d6", icon: "fa-solid fa-dice", active: data.method === "4d6" },
    { id: "pointBuy", label: "Point Buy", icon: "fa-solid fa-coins", active: data.method === "pointBuy" },
    { id: "standardArray", label: "Standard Array", icon: "fa-solid fa-list-ol", active: data.method === "standardArray" },
  ].filter((method) => methods.includes(method.id as AbilityScoreMethod));

  const bgAsi = state.selections.background?.asi?.assignments ?? {};
  const abilities = ABILITY_KEYS.map((key) => {
    const value = data.scores[key];
    const backgroundBonus = bgAsi[key] ?? 0;
    const total = value + backgroundBonus;
    const modifier = abilityModifier(total);
    return {
      key,
      label: ABILITY_LABELS[key],
      abbrev: ABILITY_ABBREVS[key],
      value,
      backgroundBonus,
      total,
      modifier,
      modifierStr: formatModifier(modifier),
      canIncrement: data.method === "pointBuy" && value < POINT_BUY_MAX,
      canDecrement: data.method === "pointBuy" && value > POINT_BUY_MIN,
    };
  });

  const hasBackgroundBonus = abilities.some((ability) => ability.backgroundBonus > 0);
  const spent = data.method === "pointBuy" ? pointBuySpent(data.scores) : 0;
  const remaining = POINT_BUY_BUDGET - spent;

  if (data.method === "pointBuy") {
    for (const ability of abilities) {
      if (!ability.canIncrement) continue;
      const nextCost = POINT_BUY_COSTS[ability.value + 1] ?? 99;
      const currentCost = POINT_BUY_COSTS[ability.value] ?? 0;
      if (nextCost - currentCost > remaining) {
        ability.canIncrement = false;
      }
    }
  }

  const valuePool = data.method === "4d6" ? data.rolledValues ?? [] : [...STANDARD_ARRAY];
  const assignmentOptions = (data.method === "4d6" || data.method === "standardArray")
    ? ABILITY_KEYS.map((key) => {
        const currentIdx = data.assignments[key];
        const usedIndices = new Set(
          Object.entries(data.assignments)
            .filter(([abilityKey, index]) => abilityKey !== key && index >= 0)
            .map(([, index]) => index),
        );

        return {
          key,
          label: ABILITY_ABBREVS[key],
          currentIdx,
          options: valuePool.map((value, index) => ({
            index,
            value,
            selected: index === currentIdx,
            disabled: usedIndices.has(index),
          })),
        };
      })
    : [];

  return {
    stepId: "abilities",
    stepTitle: "Build:",
    stepLabel: "Abilities",
    stepIcon: "fa-solid fa-dice-d20",
    hideStepIndicator: true,
    hideShellHeader: true,
    shellContentClass: "cc-step-content--build-flow",
    method: data.method,
    methodTabs,
    abilities,
    hasBackgroundBonus,
    isPointBuy: data.method === "pointBuy",
    isRoll: data.method === "4d6",
    isStandardArray: data.method === "standardArray",
    isAssignment: data.method === "4d6" || data.method === "standardArray",
    pointsSpent: spent,
    pointsRemaining: remaining,
    pointsBudget: POINT_BUY_BUDGET,
    budgetClass: remaining < 0 ? "over" : remaining <= 3 ? "low" : "ok",
    hasRolled: data.method === "4d6" && !!data.rolledValues,
    rolledValues: data.rolledValues ?? [],
    rerollCount: data.rerollCount ?? 0,
    assignmentOptions,
    pointBuyCosts: Object.entries(POINT_BUY_COSTS).map(([score, cost]) => ({
      score: Number(score),
      cost,
    })),
  };
}
