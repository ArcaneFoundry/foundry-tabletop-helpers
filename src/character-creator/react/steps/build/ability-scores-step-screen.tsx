import type { ChangeEvent } from "react";

import type {
  AbilityKey,
  AbilityScoreMethod,
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { ABILITY_KEYS, POINT_BUY_BUDGET, POINT_BUY_MAX, POINT_BUY_MIN, STANDARD_ARRAY } from "../../../data/dnd5e-constants";
import {
  createAbilityStateForMethod,
  defaultAssignments,
  defaultScores,
  getAbilityState,
  pointBuySpent,
  rollAllAbilities,
} from "../../../steps/step-abilities-model";

type AbilityStepViewModel = {
  method: AbilityScoreMethod;
  methodTabs: Array<{
    id: AbilityScoreMethod;
    label: string;
    icon: string;
    active: boolean;
  }>;
  abilities: Array<{
    key: AbilityKey;
    label: string;
    abbrev: string;
    value: number;
    backgroundBonus: number;
    total: number;
    modifierStr: string;
    canIncrement: boolean;
    canDecrement: boolean;
  }>;
  isPointBuy: boolean;
  isRoll: boolean;
  isStandardArray: boolean;
  isAssignment: boolean;
  pointsRemaining: number;
  pointsBudget: number;
  budgetClass: "ok" | "low" | "over";
  hasRolled: boolean;
  rolledValues: number[];
  assignmentOptions: Array<{
    key: AbilityKey;
    label: string;
    currentIdx: number;
    options: Array<{
      index: number;
      value: number;
      selected: boolean;
      disabled: boolean;
    }>;
  }>;
  pointBuyCosts: Array<{
    score: number;
    cost: number;
  }>;
};

export function AbilityScoresStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as AbilityStepViewModel | undefined;
  if (!viewModel) return null;

  const current = getAbilityState(state);

  const updateState = (nextState: ReturnType<typeof getAbilityState>) => {
    controller.updateCurrentStepData(nextState);
  };

  const handleMethodChange = (method: AbilityScoreMethod) => {
    updateState(createAbilityStateForMethod(method, current));
  };

  const handleRoll = () => {
    updateState({
      ...current,
      rolledValues: rollAllAbilities(),
      assignments: defaultAssignments(),
      scores: defaultScores(),
      rerollCount: (current.rerollCount ?? 0) + 1,
    });
  };

  const handleAdjust = (key: AbilityKey, delta: number) => {
    const newValue = current.scores[key] + delta;
    if (newValue < POINT_BUY_MIN || newValue > POINT_BUY_MAX) return;

    const nextScores = { ...current.scores, [key]: newValue };
    if (pointBuySpent(nextScores) > POINT_BUY_BUDGET) return;

    updateState({
      ...current,
      scores: nextScores,
    });
  };

  const handleAssignmentChange = (key: AbilityKey, event: ChangeEvent<HTMLSelectElement>) => {
    const nextIndex = Number(event.target.value);
    const pool = current.method === "4d6" ? (current.rolledValues ?? []) : [...STANDARD_ARRAY];
    const nextAssignments = {
      ...current.assignments,
      [key]: Number.isNaN(nextIndex) ? -1 : nextIndex,
    };
    const nextScores = { ...defaultScores() };

    for (const abilityKey of ABILITY_KEYS) {
      const assignedIndex = nextAssignments[abilityKey];
      if (assignedIndex >= 0 && assignedIndex < pool.length) {
        nextScores[abilityKey] = pool[assignedIndex];
      }
    }

    updateState({
      ...current,
      assignments: nextAssignments,
      scores: nextScores,
    });
  };

  return (
    <section className="fth-react-scrollbar flex min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <div className="cc-abilities mx-auto w-full max-w-5xl">
        <div className="cc-method-tabs">
          {viewModel.methodTabs.map((method) => (
            <button
              className={`cc-method-tab${method.active ? " cc-method-tab--active" : ""}`}
              data-method={method.id}
              key={method.id}
              onClick={() => handleMethodChange(method.id)}
              type="button"
            >
              <i className={method.icon} aria-hidden="true" />
              <span>{method.label}</span>
            </button>
          ))}
        </div>

        {viewModel.isPointBuy ? (
          <div className={`cc-point-budget cc-point-budget--${viewModel.budgetClass}`}>
            <span className="cc-point-budget__label">Points:</span>
            <span className="cc-point-budget__value">{viewModel.pointsRemaining}</span>
            <span className="cc-point-budget__of">/ {viewModel.pointsBudget}</span>
          </div>
        ) : null}

        {viewModel.isRoll ? (
          <div className="cc-roll-controls">
            <button className="cc-roll-btn" onClick={handleRoll} type="button">
              <i className="fa-solid fa-dice" aria-hidden="true" />
              <span>{viewModel.hasRolled ? "Reroll All" : "Roll Abilities"}</span>
            </button>
            {viewModel.hasRolled ? (
              <div className="cc-rolled-values">
                {viewModel.rolledValues.map((value, index) => (
                  <span className="cc-rolled-value" key={`${value}-${index}`}>
                    {value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="cc-ability-grid">
          {viewModel.abilities.map((ability) => (
            <div className="cc-ability-card" key={ability.key}>
              <div className="cc-ability-card__abbrev">{ability.abbrev}</div>
              <div className="cc-ability-card__value">{ability.total}</div>
              <div className="cc-ability-card__modifier">{ability.modifierStr}</div>
              {ability.backgroundBonus ? (
                <div className="cc-ability-card__bonus">
                  <span className="cc-ability-card__bonus-base">{ability.value}</span>
                  <span className="cc-ability-card__bonus-plus">+{ability.backgroundBonus}</span>
                  <span className="cc-ability-card__bonus-eq">=</span>
                  <span className="cc-ability-card__bonus-total">{ability.total}</span>
                </div>
              ) : null}
              <div className="cc-ability-card__label">{ability.label}</div>

              {viewModel.isPointBuy ? (
                <div className="cc-ability-card__controls">
                  <button
                    className="cc-adjust-btn"
                    disabled={!ability.canDecrement}
                    onClick={() => handleAdjust(ability.key, -1)}
                    type="button"
                  >
                    <i className="fa-solid fa-minus" aria-hidden="true" />
                  </button>
                  <button
                    className="cc-adjust-btn"
                    disabled={!ability.canIncrement}
                    onClick={() => handleAdjust(ability.key, 1)}
                    type="button"
                  >
                    <i className="fa-solid fa-plus" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {viewModel.isAssignment ? (
          <div className="cc-assignments">
            <p className="cc-assignments__hint">
              {viewModel.isRoll
                ? (viewModel.hasRolled ? "Assign each rolled value to an ability score." : "Roll your ability scores, then assign them below.")
                : "Assign each value from the standard array (15, 14, 13, 12, 10, 8) to an ability score."}
            </p>
            {(viewModel.hasRolled || viewModel.isStandardArray) ? (
              <div className="cc-assignment-grid">
                {viewModel.assignmentOptions.map((assignment) => (
                  <div className="cc-assignment-row" key={assignment.key}>
                    <label className="cc-assignment-row__label" htmlFor={`ability-assignment-${assignment.key}`}>
                      {assignment.label}
                    </label>
                    <select
                      className="cc-assignment-row__select"
                      id={`ability-assignment-${assignment.key}`}
                      onChange={(event) => handleAssignmentChange(assignment.key, event)}
                      value={assignment.currentIdx >= 0 ? String(assignment.currentIdx) : ""}
                    >
                      <option value="">—</option>
                      {assignment.options.map((option) => (
                        <option
                          disabled={option.disabled}
                          key={`${assignment.key}-${option.index}`}
                          value={option.index}
                        >
                          {option.value}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {viewModel.isPointBuy ? (
          <div className="cc-cost-table">
            <div className="cc-cost-table__title">Point Cost Reference</div>
            <div className="cc-cost-table__grid">
              {viewModel.pointBuyCosts.map((entry) => (
                <div className="cc-cost-table__entry" key={entry.score}>
                  <span className="cc-cost-table__score">{entry.score}</span>
                  <span className="cc-cost-table__cost">{entry.cost}pt</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
