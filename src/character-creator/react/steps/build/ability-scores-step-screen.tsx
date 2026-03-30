import type { ChangeEvent } from "react";

import type {
  AbilityKey,
  AbilityScoreMethod,
  ReactWizardStepProps,
  WizardState,
} from "../../../character-creator-types";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STANDARD_ARRAY,
} from "../../../data/dnd5e-constants";
import {
  createAbilityStateForMethod,
  defaultAssignments,
  defaultScores,
  getAbilityState,
  pointBuySpent,
  rollAllAbilities,
} from "../../../steps/step-abilities-model";
import { getClassRecommendation } from "../../../steps/step-class-model";

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

const METHOD_COPY: Record<AbilityScoreMethod, {
  eyebrow: string;
  title: string;
  summary: string;
  detail: string;
  inactive: string;
}> = {
  "4d6": {
    eyebrow: "Ritual / Dice-Driven",
    title: "Roll 4d6",
    summary: "Forge the six scores by chance, then assign the results one by one.",
    detail:
      "Let the dice decide the shape of the build. Roll the full array, then place each value where it belongs.",
    inactive: "Open the ritual dice path.",
  },
  pointBuy: {
    eyebrow: "Budget / Tuning-Driven",
    title: "Point Buy",
    summary: "Spend 27 points deliberately. Every increase should feel like a choice.",
    detail:
      "Tune the six abilities with a visible budget. The remaining pool should stay readable as you push any score upward.",
    inactive: "Refine the build with a budget.",
  },
  standardArray: {
    eyebrow: "Disciplined Allocation",
    title: "Standard Array",
    summary: "Place the fixed array into the six abilities and keep the distribution clean.",
    detail:
      "Use the established 15, 14, 13, 12, 10, 8 spread to lock in a balanced starting profile.",
    inactive: "Lock in the fixed array.",
  },
};

const DEFAULT_ABILITY_PRIORITY: AbilityKey[] = ["str", "dex", "con", "wis", "int", "cha"];

export function AbilityScoresStepScreen({
  shellContext,
  state,
  controller,
}: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as AbilityStepViewModel | undefined;
  if (!viewModel) return null;

  const current = getAbilityState(state);
  const selectedMethod = METHOD_COPY[viewModel.method];
  const isAssignmentMode = viewModel.isAssignment;
  const assignedCount = isAssignmentMode
    ? ABILITY_KEYS.reduce(
        (count, key) => count + (current.assignments[key] >= 0 ? 1 : 0),
        0,
      )
    : 0;
  const openCount = isAssignmentMode ? ABILITY_KEYS.length - assignedCount : 0;
  const canQuickAssign = isAssignmentMode && (
    viewModel.isStandardArray || (viewModel.isRoll && viewModel.hasRolled)
  );

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

  const handleQuickAssign = () => {
    const nextState = buildQuickAssignedAbilityState(state, current);
    if (!nextState) return;
    updateState(nextState);
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

  const handleAssignmentChange = (
    key: AbilityKey,
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
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
    <section className="flex flex-col px-4 py-5 md:px-6 md:py-6">
      <div className="cc-abilities mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="cc-theme-header cc-theme-header--hero rounded-[1.5rem] px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <div className="cc-theme-kicker font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.28em]">
                Ability Scores
              </div>
              <h2 className="cc-theme-title m-0 font-fth-cc-display text-[1.65rem] leading-[1.05] md:text-[1.9rem]">
                Choose the ritual that forges your six abilities
              </h2>
              <p className="cc-theme-copy m-0 text-[0.98rem] leading-7 md:text-[1.03rem]">
                {selectedMethod.detail}
              </p>
            </div>

            <div className="cc-theme-panel cc-theme-panel--soft min-w-[14rem] rounded-[1.1rem] px-4 py-3">
              <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em]">
                Active Method
              </div>
              <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.25rem] leading-none">
                {selectedMethod.title}
              </div>
              <p className="cc-theme-body-muted m-0 mt-2 text-[0.86rem] leading-6">
                {selectedMethod.summary}
              </p>
            </div>
          </div>
        </header>

        <div className="cc-method-tabs shrink-0">
          {viewModel.methodTabs.map((method) => (
            <button
              className={`cc-method-tab${method.active ? " cc-method-tab--active" : ""}`}
              data-method={method.id}
              key={method.id}
              onClick={() => handleMethodChange(method.id)}
              type="button"
            >
              <span className="cc-method-tab__badge">
                <i className={method.icon} aria-hidden="true" />
              </span>
              <span className="cc-method-tab__content">
                <span className="cc-method-tab__eyebrow">{METHOD_COPY[method.id].eyebrow}</span>
                <span className="cc-method-tab__label">{method.label}</span>
                <span className="cc-method-tab__summary">{METHOD_COPY[method.id].summary}</span>
              </span>
              <span className="cc-method-tab__state">
                {method.active ? "Selected" : METHOD_COPY[method.id].inactive}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col">
          <section className="cc-method-panel w-full">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em]">
                  {selectedMethod.eyebrow}
                </div>
                <h3 className="cc-theme-title m-0 font-fth-cc-display text-[1.2rem] leading-none">
                  {selectedMethod.title}
                </h3>
                <p className="cc-theme-body-muted m-0 text-[0.92rem] leading-6">
                  {selectedMethod.detail}
                </p>
              </div>

              {viewModel.isPointBuy ? (
                <div className={`cc-point-budget cc-point-budget--${viewModel.budgetClass}`}>
                  <span className="cc-point-budget__label">Remaining</span>
                  <span className="cc-point-budget__value">{viewModel.pointsRemaining}</span>
                  <span className="cc-point-budget__of">of {viewModel.pointsBudget}</span>
                </div>
              ) : null}
            </div>

            {viewModel.isRoll ? (
              <div className="cc-roll-controls">
                <div className="cc-roll-controls__copy">
                  <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em]">
                    Dice Ritual
                  </div>
                  <p className="cc-theme-body-muted m-0 text-[0.92rem] leading-6">
                    {viewModel.hasRolled
                      ? "The array is ready. Re-roll if you want a different fate, then assign the results below."
                      : "Roll the full array to reveal the six values before you assign them."}
                  </p>
                </div>
                <div className="cc-roll-controls__actions">
                  <button className="cc-roll-btn" onClick={handleRoll} type="button">
                    <i className="fa-solid fa-dice" aria-hidden="true" />
                    <span>{viewModel.hasRolled ? "Reroll All" : "Roll Abilities"}</span>
                  </button>
                  {isAssignmentMode && canQuickAssign ? (
                    <button
                      className="cc-roll-btn"
                      onClick={handleQuickAssign}
                      type="button"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                      <span>Quick Assign</span>
                    </button>
                  ) : null}
                  <span className="cc-roll-controls__state">
                    {canQuickAssign
                      ? `Quick assigns ${getQuickAssignPriorityText(state)} first`
                      : viewModel.hasRolled
                      ? openCount > 0
                        ? `${openCount} values still open`
                        : "Results ready for assignment"
                      : "No rolls yet"}
                  </span>
                </div>
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

            {viewModel.isStandardArray ? (
              <div className="cc-roll-controls">
                <div className="cc-roll-controls__copy">
                  <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em]">
                    Fixed Allocation
                  </div>
                  <p className="cc-theme-body-muted m-0 text-[0.92rem] leading-6">
                    Assign the full array of 15, 14, 13, 12, 10, and 8 to keep the build disciplined and predictable.
                  </p>
                </div>
                <div className="cc-roll-controls__actions">
                  {isAssignmentMode && canQuickAssign ? (
                    <button className="cc-roll-btn" onClick={handleQuickAssign} type="button">
                      <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                      <span>Quick Assign</span>
                    </button>
                  ) : null}
                  <span className="cc-roll-controls__state">
                    {canQuickAssign
                      ? `Quick assigns ${getQuickAssignPriorityText(state)} first`
                      : openCount > 0
                        ? `${openCount} values still open`
                        : "Array fully assigned"}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="cc-ability-grid">
              {viewModel.abilities.map((ability) => {
                const assignedIndex = current.assignments[ability.key];
                const isAssigned = isAssignmentMode && assignedIndex >= 0;

                return (
                  <article
                    className={[
                      "cc-ability-card",
                      isAssigned ? "cc-ability-card--selected" : "",
                      isAssignmentMode ? "cc-ability-card--assignment" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-assignment-state={
                      isAssignmentMode ? (isAssigned ? "assigned" : "open") : "point-buy"
                    }
                    key={ability.key}
                  >
                    <div className="cc-ability-card__header">
                      <div className="cc-ability-card__identity">
                        <div className="cc-ability-card__abbrev">{ability.abbrev}</div>
                        <div className="cc-ability-card__label">{ability.label}</div>
                      </div>
                      {isAssignmentMode ? (
                        <div
                          className={[
                            "cc-ability-card__state",
                            isAssigned
                              ? "cc-ability-card__state--assigned"
                              : "cc-ability-card__state--open",
                          ].join(" ")}
                        >
                          {isAssigned ? "Assigned" : "Open"}
                        </div>
                      ) : null}
                    </div>

                    <div className="cc-ability-card__scoreline">
                      <div className="cc-ability-card__value">{ability.total}</div>
                      <div className="cc-ability-card__modifier">{ability.modifierStr}</div>
                    </div>

                    {ability.backgroundBonus ? (
                      <div className="cc-ability-card__bonus">
                        <span className="cc-ability-card__bonus-label">Base + background</span>
                        <span className="cc-ability-card__bonus-pill">{ability.value}</span>
                        <span className="cc-ability-card__bonus-plus">+</span>
                        <span className="cc-ability-card__bonus-pill">{ability.backgroundBonus}</span>
                        <span className="cc-ability-card__bonus-eq">=</span>
                        <span className="cc-ability-card__bonus-pill cc-ability-card__bonus-pill--total">
                          {ability.total}
                        </span>
                      </div>
                    ) : (
                      <div className="cc-ability-card__bonus cc-ability-card__bonus--base-only">
                        <span className="cc-ability-card__bonus-label">Base score only</span>
                      </div>
                    )}

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
                    ) : isAssignmentMode ? (
                      <div className="cc-ability-card__assignment-note">
                        {isAssigned
                          ? "Chosen from the pool below."
                          : "Awaiting assignment from the pool below."}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {viewModel.isAssignment ? (
              <div className="cc-assignments">
                <div className="cc-assignment-summary">
                  <div className="cc-assignment-summary__title">Assignment Pool</div>
                  <div className="cc-assignment-summary__stats">
                    <span className="cc-assignment-summary__count">{assignedCount} assigned</span>
                    <span className="cc-assignment-summary__divider">/</span>
                    <span className="cc-assignment-summary__count">{ABILITY_KEYS.length} abilities</span>
                    <span className="cc-assignment-summary__open">{openCount} open</span>
                  </div>
                </div>
                <p className="cc-assignments__hint">
                  {viewModel.isRoll
                    ? viewModel.hasRolled
                      ? "Assign each rolled value to an ability score."
                      : "Roll your ability scores, then assign them below."
                    : "Assign each value from the standard array (15, 14, 13, 12, 10, 8) to an ability score."}
                </p>
                {viewModel.hasRolled || viewModel.isStandardArray ? (
                  <div className="cc-assignment-grid">
                    {viewModel.assignmentOptions.map((assignment) => (
                      <div className="cc-assignment-row" key={assignment.key}>
                        <div className="cc-assignment-row__meta">
                          <label
                            className="cc-assignment-row__label"
                            htmlFor={`ability-assignment-${assignment.key}`}
                          >
                            {assignment.label}
                          </label>
                          <div className="cc-assignment-row__hint">
                            {assignment.currentIdx >= 0
                              ? "Chosen from the pool below."
                              : "Choose a score from the pool below."}
                          </div>
                        </div>
                        <div className="cc-assignment-row__control">
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
                          <div
                            className={[
                              "cc-assignment-row__state",
                              assignment.currentIdx >= 0
                                ? "cc-assignment-row__state--assigned"
                                : "cc-assignment-row__state--open",
                            ].join(" ")}
                          >
                            {assignment.currentIdx >= 0
                              ? `Value ${assignment.options[assignment.currentIdx]?.value ?? "?"}`
                              : "Open"}
                          </div>
                        </div>
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
          </section>
        </div>
      </div>
    </section>
  );
}

function getQuickAssignPriorityOrder(state: WizardState): AbilityKey[] {
  const primaryAbilities = getQuickAssignPrimaryAbilities(state);
  return [...new Set([...primaryAbilities, ...DEFAULT_ABILITY_PRIORITY])];
}

function getQuickAssignPriorityText(state: WizardState): string {
  const abilities = getQuickAssignPrimaryAbilities(state);
  return abilities.length > 0
    ? abilities.map((ability) => ABILITY_LABELS[ability]).join(" / ")
    : "the class order";
}

function getQuickAssignPrimaryAbilities(state: WizardState): AbilityKey[] {
  const selectedClass = state.selections.class;
  const recommendation = selectedClass
    ? getClassRecommendation(selectedClass.identifier ?? "")
    : { primaryAbilities: [] as AbilityKey[] };

  return selectedClass?.primaryAbilities?.length
    ? selectedClass.primaryAbilities
    : recommendation.primaryAbilities;
}

function buildQuickAssignedAbilityState(
  state: WizardState,
  current: ReturnType<typeof getAbilityState>,
): ReturnType<typeof getAbilityState> | null {
  const pool = current.method === "4d6"
    ? [...(current.rolledValues ?? [])]
    : current.method === "standardArray"
      ? [...STANDARD_ARRAY]
      : [];

  if (pool.length !== 6) return null;

  const sortedPool = pool
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const prioritizedAbilities = getQuickAssignPriorityOrder(state);
  const nextAssignments = defaultAssignments();
  const nextScores = defaultScores();

  sortedPool.forEach((entry, index) => {
    const abilityKey = prioritizedAbilities[index] ?? DEFAULT_ABILITY_PRIORITY[index];
    if (!abilityKey) return;
    nextAssignments[abilityKey] = entry.index;
    nextScores[abilityKey] = entry.value;
  });

  return {
    ...current,
    assignments: nextAssignments,
    scores: nextScores,
  };
}

export const __abilityScoresInternals = {
  buildQuickAssignedAbilityState,
  getQuickAssignPriorityOrder,
  getQuickAssignPriorityText,
};
