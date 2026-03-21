import { MOD } from "../../logger";
import type {
  AbilityKey,
  StepCallbacks,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { ABILITY_KEYS, ABILITY_LABELS } from "../data/dnd5e-constants";

interface SelectElementLike {
  dataset: DOMStringMap;
  value: string;
  addEventListener(event: string, handler: () => void): void;
}

function getAbilityKey(value: string | undefined): AbilityKey | null {
  if (!value) return null;
  return ABILITY_KEYS.includes(value as AbilityKey) ? value as AbilityKey : null;
}

function allowsUnrestrictedBackgroundAsi(state: WizardState): boolean {
  return !!state.config.allowUnrestrictedBackgroundAsi;
}

function getAllowedBackgroundAsiAbilities(state: WizardState): AbilityKey[] {
  if (allowsUnrestrictedBackgroundAsi(state)) return [...ABILITY_KEYS];
  const suggested = state.selections.background?.grants.asiSuggested ?? [];
  const allowed = suggested.filter((key): key is AbilityKey => ABILITY_KEYS.includes(key as AbilityKey));
  return allowed.length > 0 ? allowed : [...ABILITY_KEYS];
}

export function createBackgroundAsiStep(): WizardStepDefinition {
  return {
    id: "backgroundAsi",
    label: "Background Ability Scores",
    icon: "fa-solid fa-chart-line",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-background-asi.hbs`,
    dependencies: ["background"],
    isApplicable: (state) => !!state.selections.background?.uuid,

    isComplete(state: WizardState): boolean {
      const bg = state.selections.background;
      if (!bg?.grants) return false;
      if (bg.grants.asiPoints <= 0) return true;
      const total = Object.values(bg.asi.assignments).reduce((sum, value) => sum + (value ?? 0), 0);
      return total === bg.grants.asiPoints;
    },

    getStatusHint(state: WizardState): string {
      const bg = state.selections.background;
      if (!bg?.grants) return "Select a background first";
      const total = Object.values(bg.asi.assignments).reduce((sum, value) => sum + (value ?? 0), 0);
      const remaining = Math.max(0, (bg.grants.asiPoints ?? 0) - total);
      return remaining > 0 ? `Assign ${remaining} more ability score point${remaining === 1 ? "" : "s"}` : "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const bg = state.selections.background;
      if (!bg?.grants) return { hasBackground: false };

      const totalUsed = Object.values(bg.asi.assignments).reduce((sum, value) => sum + (value ?? 0), 0);
      const classRecommendedAbilities = new Set(state.selections.class?.primaryAbilities ?? []);
      const allowedAbilities = new Set(getAllowedBackgroundAsiAbilities(state));
      const visibleAbilityKeys = allowsUnrestrictedBackgroundAsi(state)
        ? [...ABILITY_KEYS]
        : getAllowedBackgroundAsiAbilities(state);
      const asiAbilities = visibleAbilityKeys.map((key) => {
        const value = bg.asi.assignments[key] ?? 0;
        const backgroundSuggested = bg.grants.asiSuggested.includes(key);
        const classRecommended = classRecommendedAbilities.has(key);
        const remaining = bg.grants.asiPoints - totalUsed;
        const allowedByBackground = allowedAbilities.has(key);
        const options = [
          { value: 0, label: "+0", selected: value === 0 },
        ];
        if (allowedByBackground) {
          options.push({ value: 1, label: "+1", selected: value === 1 });
        }
        if (allowedByBackground && bg.grants.asiCap >= 2) {
          const canGetTwo = value === 2 || remaining >= (2 - value);
          if (canGetTwo) options.push({ value: 2, label: "+2", selected: value === 2 });
        }
        return {
          key,
          label: ABILITY_LABELS[key],
          backgroundSuggested,
          classRecommended,
          allowedByBackground,
          emphasized: backgroundSuggested || classRecommended,
          options,
        };
      });

      return {
        hasBackground: true,
        backgroundName: bg.name,
        backgroundImg: bg.img,
        hasASI: bg.grants.asiPoints > 0,
        backgroundAsiRestricted: !allowsUnrestrictedBackgroundAsi(state),
        asiAbilities,
        asiPointsUsed: totalUsed,
        asiPoints: bg.grants.asiPoints,
        asiComplete: totalUsed === bg.grants.asiPoints,
        hasClassRecommendations: classRecommendedAbilities.size > 0,
        choiceModes: [
          {
            label: "+2 / +1",
            selected: Object.values(bg.asi.assignments).some((value) => value === 2),
          },
          {
            label: "+1 / +1 / +1",
            selected: Object.values(bg.asi.assignments).filter((value) => value === 1).length === 3,
          },
        ],
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      const bg = state.selections.background;
      if (!bg?.grants) return;
      const allowedAbilities = new Set(getAllowedBackgroundAsiAbilities(state));

      getSelectElements(el, "[data-asi-ability]").forEach((select) => {
        select.addEventListener("change", () => {
          const ability = getAbilityKey(select.dataset.asiAbility);
          if (!ability) return;
          const newValue = Number.parseInt(select.value, 10) || 0;

          if (newValue > 0 && !allowedAbilities.has(ability)) {
            select.value = String(bg.asi.assignments[ability] ?? 0);
            return;
          }

          if (newValue > bg.grants.asiCap) {
            select.value = String(bg.asi.assignments[ability] ?? 0);
            return;
          }

          const otherTotal = Object.entries(bg.asi.assignments)
            .filter(([key]) => key !== ability)
            .reduce((sum, [, value]) => sum + (value ?? 0), 0);
          const proposedTotal = otherTotal + newValue;

          if (proposedTotal > bg.grants.asiPoints) {
            select.value = String(bg.asi.assignments[ability] ?? 0);
            return;
          }

          if (newValue === 0) delete bg.asi.assignments[ability];
          else bg.asi.assignments[ability] = newValue;

          callbacks.setDataSilent({ assignments: { ...bg.asi.assignments } });
        });
      });
    },
  };
}

function getSelectElements(root: ParentNode, selector: string): SelectElementLike[] {
  return Array.from(root.querySelectorAll(selector))
    .filter((value) => typeof value === "object" && value !== null && "dataset" in value && "value" in value)
    .map((value) => value as unknown as SelectElementLike);
}
