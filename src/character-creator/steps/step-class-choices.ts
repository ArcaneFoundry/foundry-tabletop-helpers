import { MOD } from "../../logger";
import type {
  ClassChoicesState,
  StepCallbacks,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { ABILITY_ABBREVS, SKILLS } from "../data/dnd5e-constants";

interface DatasetElementLike {
  dataset: DOMStringMap;
  addEventListener(event: string, handler: () => void): void;
  closest(selector: string): Element | null;
}

interface ToggleInputLike extends DatasetElementLike {
  checked: boolean;
  disabled: boolean;
}

const SKILL_META: Record<string, { icon: string; description: string }> = {
  acr: { icon: "fa-person-running", description: "Balance, tumble, dive, and keep your footing when the battlefield turns treacherous." },
  ani: { icon: "fa-paw", description: "Read and calm beasts, mount up, or guide animals through danger." },
  arc: { icon: "fa-stars", description: "Recall magical lore, arcane traditions, and the hidden logic of spells." },
  ath: { icon: "fa-dumbbell", description: "Climb, jump, grapple, swim, and force your way through physical challenges." },
  dec: { icon: "fa-masks-theater", description: "Bluff, mislead, and sell the lie when words are your sharpest weapon." },
  his: { icon: "fa-landmark", description: "Recall legends, lineages, wars, and the long memory of the world." },
  ins: { icon: "fa-eye", description: "Read motives, catch falsehoods, and sense what others are trying to hide." },
  itm: { icon: "fa-bolt", description: "Project menace, force the issue, and make your presence impossible to ignore." },
  inv: { icon: "fa-magnifying-glass", description: "Piece together clues, examine details, and uncover what others missed." },
  med: { icon: "fa-staff-snake", description: "Diagnose wounds, stabilize the fallen, and understand the body under strain." },
  nat: { icon: "fa-leaf", description: "Recall the laws of the wild: terrain, plants, beasts, and natural phenomena." },
  prc: { icon: "fa-binoculars", description: "Spot danger, hear the hidden approach, and notice what the room is trying to conceal." },
  prf: { icon: "fa-music", description: "Command attention through song, dance, drama, and force of stage presence." },
  per: { icon: "fa-comments", description: "Charm, negotiate, inspire, and move others with conviction." },
  rel: { icon: "fa-book-bible", description: "Recall rites, deities, sacred histories, and the doctrines of faith." },
  slt: { icon: "fa-hand-sparkles", description: "Palm objects, slip tools into place, and work delicate tricks without notice." },
  ste: { icon: "fa-user-ninja", description: "Move in silence, melt into shadow, and strike without warning." },
  sur: { icon: "fa-compass", description: "Track, forage, navigate, and keep the party alive beyond the last road." },
};

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function getChosenSkills(state: WizardState): string[] {
  return state.selections.skills?.chosen ?? [];
}

function getAvailableSkillKeys(state: WizardState): string[] {
  return state.selections.class?.skillPool ?? [];
}

function getRequiredSkillCount(state: WizardState): number {
  return Math.min(state.selections.class?.skillCount ?? 0, getAvailableSkillKeys(state).length);
}

function buildClassChoicesState(state: WizardState): ClassChoicesState {
  return {
    chosenSkills: getChosenSkills(state),
  };
}

function patchToggleRows(
  el: HTMLElement,
  selector: string,
  chosen: Set<string>,
  maxPicks: number,
): void {
  const atMax = maxPicks > 0 && chosen.size >= maxPicks;
  getToggleInputs(el, selector).forEach((input) => {
    const key = input.dataset.choiceValue;
    if (!key) return;
    const isChosen = chosen.has(key);
    input.checked = isChosen;
    input.disabled = !isChosen && atMax;
    const row = input.closest(".cc-choice-option");
    if (row) row.classList.toggle("cc-choice-option--selected", isChosen);
  });
}

function patchSectionCount(el: HTMLElement, section: string, value: number): void {
  const countEl = el.querySelector<HTMLElement>(`[data-choice-count="${section}"]`);
  if (countEl) countEl.textContent = String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function patchSelectedChips(
  el: HTMLElement,
  section: string,
  entries: Array<{ label: string; iconClass?: string; tooltip: string }>,
): void {
  const host = el.querySelector<HTMLElement>(`[data-selected-chips="${section}"]`);
  if (!host) return;
  host.innerHTML = entries.map((entry) =>
    `<span class="cc-choice-chip cc-tooltip-anchor" tabindex="0" data-tooltip="${escapeHtml(entry.tooltip)}"><i class="fa-solid ${entry.iconClass ?? "fa-book"}"></i><span>${escapeHtml(entry.label)}</span></span>`
  ).join("");
}

export function createClassChoicesStep(): WizardStepDefinition {
  return {
    id: "classChoices",
    label: "Class Skills",
    icon: "fa-solid fa-list-check",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-choices.hbs`,
    dependencies: ["class"],
    isApplicable: (state) => !!state.selections.class?.uuid,

    isComplete(state: WizardState): boolean {
      if (!state.selections.class?.uuid) return false;
      return getChosenSkills(state).length >= getRequiredSkillCount(state);
    },

    getStatusHint(state: WizardState): string {
      const chosenSkills = getChosenSkills(state).length;
      const requiredSkills = getRequiredSkillCount(state);
      if (chosenSkills < requiredSkills) {
        const remaining = requiredSkills - chosenSkills;
        return `Choose ${remaining} more class skill${remaining === 1 ? "" : "s"}`;
      }
      return "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const classSelection = state.selections.class;
      const chosenSkills = new Set(getChosenSkills(state));
      const requiredSkillCount = getRequiredSkillCount(state);
      const skillPool = getAvailableSkillKeys(state).map((key) => ({
        key,
        label: skillLabel(key),
        abilityAbbrev: ABILITY_ABBREVS[SKILLS[key]?.ability ?? "int"],
        checked: chosenSkills.has(key),
        disabled: !chosenSkills.has(key) && chosenSkills.size >= requiredSkillCount,
        iconClass: SKILL_META[key]?.icon ?? "fa-book",
        tooltip: `${skillLabel(key)} (${ABILITY_ABBREVS[SKILLS[key]?.ability ?? "int"]}) — ${SKILL_META[key]?.description ?? "Class skill option."}`,
      }));

      return {
        className: classSelection?.name ?? "Class",
        primaryAbilityHint: classSelection?.primaryAbilityHint ?? "",
        skillSection: {
          hasChoices: requiredSkillCount > 0,
          chosenCount: chosenSkills.size,
          maxCount: requiredSkillCount,
          selectedEntries: skillPool
            .filter((entry) => entry.checked)
            .map((entry) => ({ label: entry.label, iconClass: entry.iconClass, tooltip: entry.tooltip })),
          options: skillPool,
          emptyMessage: "This class does not expose additional class skill choices.",
        },
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      getToggleInputs(el, "[data-choice-section='skills']").forEach((input) => {
        input.addEventListener("change", () => {
          const key = input.dataset.choiceValue;
          if (!key) return;

          const chosen = new Set(getChosenSkills(state));
          const limit = getRequiredSkillCount(state);
          if (input.checked) {
            if (chosen.size >= limit) {
              input.checked = false;
              return;
            }
            chosen.add(key);
          } else {
            chosen.delete(key);
          }

          const chosenSkills = [...chosen];
          state.selections.skills = { chosen: chosenSkills };
          state.selections.classChoices = { chosenSkills };

          patchToggleRows(el, "[data-choice-section='skills']", chosen, limit);
          patchSectionCount(el, "skills", chosen.size);
          patchSelectedChips(
            el,
            "skills",
            chosenSkills.map((skill) => ({
              label: skillLabel(skill),
              iconClass: SKILL_META[skill]?.icon ?? "fa-book",
              tooltip: `${skillLabel(skill)} (${ABILITY_ABBREVS[SKILLS[skill]?.ability ?? "int"]}) — ${SKILL_META[skill]?.description ?? "Class skill option."}`,
            })),
          );
          callbacks.setDataSilent(buildClassChoicesState(state));
        });
      });

      state.selections.classChoices = buildClassChoicesState(state);
      callbacks.setDataSilent(buildClassChoicesState(state));
    },
  };
}

function getToggleInputs(root: ParentNode, selector: string): ToggleInputLike[] {
  return Array.from(root.querySelectorAll(selector))
    .filter((value) =>
      typeof value === "object" && value !== null && "dataset" in value && "checked" in value && "disabled" in value
    )
    .map((value) => value as unknown as ToggleInputLike);
}
