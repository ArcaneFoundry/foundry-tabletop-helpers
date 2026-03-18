/**
 * Character Creator — Step 11: Review & Create
 *
 * Full character summary with edit-back buttons, character name input,
 * and the "Create Character" action.
 *
 * Updated for 2024 PHB rules: species (replaces race), background grants,
 * origin feat, ASI from background, and language selections.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  StepCallbacks,
  AbilityKey,
} from "../character-creator-types";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  SKILLS,
  LANGUAGE_LABELS,
  abilityModifier,
  formatModifier,
} from "../data/dnd5e-constants";
import { getStartingGoldForSelections } from "../starting-resources";
import { fromUuid } from "../../types";
import {
  buildPreparationNotice,
  getSpellPreparationPolicy,
  type SpellPreparationClassDocumentLike,
} from "../spell-preparation-policy";

/* ── Helpers ─────────────────────────────────────────────── */

/** Look up a skill key to its display name. */
function skillName(key: string): string {
  return SKILLS[key]?.label ?? key;
}

/** Look up a language key to its display name. */
function languageName(key: string): string {
  return LANGUAGE_LABELS[key] ?? key;
}

/** Format ASI assignments as "WIS +2, CHA +1". */
function formatASI(assignments: Partial<Record<AbilityKey, number>>): string {
  const parts: string[] = [];
  for (const key of ABILITY_KEYS) {
    const val = assignments[key];
    if (val && val > 0) {
      parts.push(`${ABILITY_LABELS[key]} +${val}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "None assigned";
}

/* ── Step Definition ─────────────────────────────────────── */

export function createReviewStep(): WizardStepDefinition {
  return {
    id: "review",
    label: "Review & Create",
    icon: "fa-solid fa-clipboard-check",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-review.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      // Review is complete when the character name is entered
      const name = (state.selections.review as { characterName?: string } | undefined)?.characterName;
      return !!name && name.trim().length > 0;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const sel = state.selections;
      const reviewData = sel.review as { characterName?: string } | undefined;

      /* ── 1. Species ──────────────────────────────────────── */
      const speciesSection = {
        id: "species",
        label: "Species",
        icon: "fa-solid fa-users",
        complete: !!sel.species?.uuid,
        summary: sel.species?.name ?? "Not selected",
        img: sel.species?.img,
        isSimple: true,
        traits: sel.species?.traits ?? [],
        hasTraits: (sel.species?.traits?.length ?? 0) > 0,
      };

      const speciesChoiceCount = sel.species?.languageChoiceCount ?? 0;
      const chosenSpeciesLanguages = sel.speciesChoices?.chosenLanguages ?? [];
      const speciesSkillChoiceCount = sel.species?.skillChoiceCount ?? 0;
      const chosenSpeciesSkills = sel.speciesChoices?.chosenSkills ?? [];
      const speciesItemChoiceCount = (sel.species?.itemChoiceGroups ?? [])
        .reduce((sum, group) => sum + group.count, 0);
      const chosenSpeciesItems = Object.values(sel.speciesChoices?.chosenItems ?? {}).flat().length;
      const speciesChoicesSection = {
        id: "speciesChoices",
        label: "Species Choices",
        icon: "fa-solid fa-wand-magic-sparkles",
        complete: chosenSpeciesLanguages.length >= speciesChoiceCount
          && chosenSpeciesSkills.length >= speciesSkillChoiceCount
          && chosenSpeciesItems >= speciesItemChoiceCount,
        summary: [
          speciesChoiceCount > 0 ? `${chosenSpeciesLanguages.length} / ${speciesChoiceCount} language choices` : "",
          speciesSkillChoiceCount > 0 ? `${chosenSpeciesSkills.length} / ${speciesSkillChoiceCount} skill choices` : "",
          speciesItemChoiceCount > 0 ? `${chosenSpeciesItems} / ${speciesItemChoiceCount} spell/item choices` : "",
        ].filter(Boolean).join(", ") || "No additional species choices",
        isSimple: true,
      };

      /* ── 2. Background ──────────────────────────────────── */
      const bg = sel.background;
      const bgSkills = bg?.grants.skillProficiencies.map(skillName) ?? [];
      const bgTool = bg?.grants.toolProficiency ?? null;
      const bgOriginFeat = bg?.grants.originFeatName ?? null;
      const bgLanguagesFixed = bg?.languages.fixed.map(languageName) ?? [];
      const bgLanguagesChosen = bg?.languages.chosen.map(languageName) ?? [];
      const bgASI = bg?.asi.assignments ? formatASI(bg.asi.assignments) : "None assigned";

      // Complete check: uuid AND ASI fully assigned AND languages fully chosen
      const asiTotal = bg?.asi.assignments
        ? Object.values(bg.asi.assignments).reduce((sum, v) => sum + (v ?? 0), 0)
        : 0;
      const asiNeeded = bg?.grants.asiPoints ?? 0;
      const backgroundSection = {
        id: "background",
        label: "Background",
        icon: "fa-solid fa-scroll",
        complete: !!bg?.uuid,
        summary: bg?.name ?? "Not selected",
        img: bg?.img,
        isBackground: true,
        bgSkills,
        bgTool,
        bgOriginFeat,
        bgLanguagesFixed,
        bgLanguagesChosen,
        bgASI,
        hasBgDetails: !!bg?.uuid,
      };

      const backgroundAsiSection = {
        id: "backgroundAsi",
        label: "Background ASI",
        icon: "fa-solid fa-chart-line",
        complete: asiTotal >= asiNeeded,
        summary: bgASI,
        isSimple: true,
      };

      const originChoicesComplete = (sel.skills?.chosen.length ?? 0) >= (sel.class?.skillCount ?? 0)
        && (bg?.languages.chosen.length ?? 0) >= (bg?.grants.languageChoiceCount ?? 0)
        && (!bg?.grants.originFeatUuid || !!sel.originFeat?.uuid);
      const originChoicesSummary = [
        `${sel.skills?.chosen.length ?? 0} class skills`,
        `${bg?.languages.chosen.length ?? 0} chosen languages`,
        sel.originFeat?.name ?? bgOriginFeat,
      ].filter(Boolean).join(", ");

      const originChoicesSection = {
        id: "originChoices",
        label: "Origin Choices",
        icon: "fa-solid fa-hand-sparkles",
        complete: originChoicesComplete,
        summary: originChoicesSummary || "Not selected",
        img: sel.originFeat?.img,
        isSimple: true,
      };

      /* ── 4. Class ───────────────────────────────────────── */
      const classSection = {
        id: "class",
        label: "Class",
        icon: "fa-solid fa-shield-halved",
        complete: !!sel.class?.uuid,
        summary: sel.class?.name ?? "Not selected",
        img: sel.class?.img,
        isSimple: true,
      };

      /* ── 5. Subclass (conditional) ──────────────────────── */
      const sections: Record<string, unknown>[] = [
        classSection,
        backgroundSection,
        backgroundAsiSection,
        originChoicesSection,
        speciesSection,
        speciesChoicesSection,
      ];

      if (state.applicableSteps.includes("subclass")) {
        sections.push({
          id: "subclass",
          label: "Subclass",
          icon: "fa-solid fa-book-sparkles",
          complete: !!sel.subclass?.uuid,
          summary: sel.subclass?.name ?? "Not selected",
          img: sel.subclass?.img,
          isSimple: true,
        });
      }

      /* ── 6. Abilities ───────────────────────────────────── */
      const bgBonuses = bg?.asi.assignments ?? {};
      const abilities = ABILITY_KEYS.map((key: AbilityKey) => {
        const baseScore = sel.abilities?.scores?.[key] ?? 10;
        const bonus = bgBonuses[key] ?? 0;
        const totalScore = baseScore + bonus;
        const mod = abilityModifier(totalScore);
        return {
          key,
          label: ABILITY_LABELS[key],
          score: totalScore,
          baseScore,
          bonus,
          hasBonus: bonus > 0,
          modifier: formatModifier(mod),
          isPositive: mod >= 0,
        };
      });

      sections.push({
        id: "abilities",
        label: "Ability Scores",
        icon: "fa-solid fa-dice-d20",
        complete: !!sel.abilities && Object.values(sel.abilities.scores).every((v) => v > 0),
        summary: abilities,
        isAbilities: true,
      });

      /* ── 7. Skills ──────────────────────────────────────── */
      const classSkills = sel.skills?.chosen.map(skillName) ?? [];
      const backgroundSkills = bg?.grants.skillProficiencies.map(skillName) ?? [];
      const speciesSkills = [
        ...(sel.species?.skillGrants ?? []),
        ...(sel.speciesChoices?.chosenSkills ?? []),
      ].map(skillName);
      const speciesItems = Object.values(sel.speciesChoices?.chosenItems ?? {})
        .flatMap((uuids) => uuids)
        .map((uuid) => {
          const group = (sel.species?.itemChoiceGroups ?? []).find((candidate) =>
            candidate.options.some((option) => option.uuid === uuid)
          );
          return group?.options.find((option) => option.uuid === uuid)?.name ?? uuid;
        });

      sections.push({
        id: "originSummary",
        label: "Origin Summary",
        icon: "fa-solid fa-layer-group",
        complete: !!bg?.uuid && !!sel.species?.uuid,
        classSkills,
        backgroundSkills,
        speciesSkills,
        speciesItems,
        hasClassSkills: classSkills.length > 0,
        hasBackgroundSkills: backgroundSkills.length > 0,
        hasSpeciesSkills: speciesSkills.length > 0,
        hasSpeciesItems: speciesItems.length > 0,
        isSkills: true,
      });

      /* ── 8. Feats (conditional) ─────────────────────────── */
      if (state.applicableSteps.includes("feats")) {
        let featSummary = "";
        if (sel.feats) {
          if (sel.feats.choice === "asi") {
            const asiAbilities = sel.feats.asiAbilities?.map((a) => ABILITY_LABELS[a]).join(", ");
            featSummary = `Ability Score Improvement: ${asiAbilities ?? "None"}`;
          } else {
            featSummary = sel.feats.featName ?? "Selected feat";
          }
        }
        sections.push({
          id: "feats",
          label: "Feats & ASI",
          icon: "fa-solid fa-star",
          complete: !!sel.feats,
          summary: featSummary || "Not selected",
          img: sel.feats?.featImg,
          isSimple: true,
        });
      }

      /* ── 9. Spells (conditional) ────────────────────────── */
      if (state.applicableSteps.includes("spells")) {
        const cantripCount = sel.spells?.cantrips?.length ?? 0;
        const spellCount = sel.spells?.spells?.length ?? 0;
        const classDoc = sel.class?.uuid
          ? await fromUuid(sel.class.uuid) as SpellPreparationClassDocumentLike | null
          : null;
        const preparationPolicy = getSpellPreparationPolicy(
          sel.class?.identifier ?? "",
          classDoc,
          state.config.startingLevel,
        );
        const preparedCount = sel.spells?.preparedSpells?.length ?? 0;
        const preparationDetail = buildPreparationNotice(sel.class?.name ?? "spellcaster", spellCount, preparationPolicy);
        sections.push({
          id: "spells",
          label: "Spells",
          icon: "fa-solid fa-wand-sparkles",
          complete: cantripCount > 0 || spellCount > 0,
          summary: preparationPolicy.usesPreparedSpellPicker
            ? `${cantripCount} cantrips, ${spellCount} spells, ${preparedCount} prepared`
            : `${cantripCount} cantrips, ${spellCount} spells`,
          detail: preparationDetail,
          isSimple: true,
        });
      }

      /* ── 10. Equipment ──────────────────────────────────── */
      let equipmentSummary = "";
      if (sel.equipment) {
        if (sel.equipment.method === "gold") {
          equipmentSummary = `Starting gold: ${sel.equipment.goldAmount ?? 0} gp`;
        } else {
          equipmentSummary = `Recommended gold fallback: ${getStartingGoldForSelections(sel)} gp`;
        }
      }
      sections.push({
        id: "equipment",
        label: "Equipment",
        icon: "fa-solid fa-sack",
        complete: !!sel.equipment,
        summary: equipmentSummary || "Not selected",
        isSimple: true,
      });

      const incompleteSections = sections.filter((section) => !section.complete);
      const allComplete = incompleteSections.length === 0;

      return {
        characterName: reviewData?.characterName ?? "",
        sections,
        allComplete,
        incompleteSectionLabels: incompleteSections.map((section) => section.label),
        isReview: true,
        startingLevel: state.config.startingLevel,
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      // Character name input — save silently on keystroke (no re-render needed)
      const nameInput = el.querySelector("[data-character-name]") as HTMLInputElement | null;
      if (nameInput) {
        nameInput.addEventListener("input", () => {
          const current = (state.selections.review as Record<string, unknown>) ?? {};
          callbacks.setDataSilent({ ...current, characterName: nameInput.value });
        });
      }

      // Edit buttons — jump back to that step (handled by jumpToStep action in shell)
      // These use data-action="jumpToStep" data-step-id="..." which is already wired
    },
  };
}
