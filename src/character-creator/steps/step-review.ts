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
  LoreSelection,
  PortraitSelection,
} from "../character-creator-types";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  SKILLS,
  LANGUAGE_LABELS,
  abilityModifier,
  formatModifier,
} from "../data/dnd5e-constants";
import { fromUuid } from "../../types";
import {
  buildPreparationNotice,
  getSpellPreparationPolicy,
  type SpellPreparationClassDocumentLike,
} from "../spell-preparation-policy";
import {
  buildEmptyClassAdvancementSelections,
  getClassAdvancementRequiredCount,
  languageLabel,
  toolLabel,
} from "./class-advancement-utils";
import {
  buildOriginSelectedGrantGroups,
  getRequiredSpeciesItemChoiceCount,
  getRequiredSpeciesLanguageChoiceCount,
  getRequiredSpeciesSkillChoiceCount,
} from "./origin-flow-utils";
import { deriveEquipmentState, formatCurrencyCp, resolveEquipmentFlow } from "./equipment-flow-utils";
import { ReviewStepScreen } from "../react/steps/cinematic/creator-cinematic-step-screens";

/* ── Helpers ─────────────────────────────────────────────── */

/** Look up a skill key to its display name. */
function skillName(key: string): string {
  return SKILLS[key]?.label ?? key;
}

/** Look up a language key to its display name. */
function languageName(key: string): string {
  return LANGUAGE_LABELS[key] ?? key;
}

function weaponMasteryName(entry: { label?: string; mastery?: string } | string): string {
  if (typeof entry !== "string") {
    return entry.mastery ? `${entry.label ?? "Weapon"} (${entry.mastery})` : (entry.label ?? "Weapon");
  }
  return entry
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function classItemChoiceNames(state: WizardState): string[] {
  const selections = state.selections.classAdvancements ?? buildEmptyClassAdvancementSelections();
  return (state.selections.class?.classAdvancementRequirements ?? [])
    .filter((requirement) => requirement.type === "itemChoices")
    .flatMap((requirement) => {
      const selectedIds = new Set(selections.itemChoices[requirement.id] ?? []);
      return (requirement.itemChoices ?? [])
        .filter((option) => selectedIds.has(option.uuid))
        .map((option) => option.name);
    });
}

/* ── Step Definition ─────────────────────────────────────── */

export function createReviewStep(): WizardStepDefinition {
  return {
    id: "review",
    label: "Review & Create",
    icon: "fa-solid fa-clipboard-check",
    renderMode: "react",
    reactComponent: ReviewStepScreen,
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
      const reviewData = sel.review as LoreSelection | undefined;
      const portraitData = sel.portrait as PortraitSelection | undefined;
      const portraitDataUrl = portraitData?.portraitDataUrl ?? "";
      const tokenArtMode = portraitData?.tokenArtMode
        ?? ((portraitData?.tokenDataUrl && portraitData.tokenDataUrl !== portraitDataUrl) ? "custom" : "portrait");
      const tokenDataUrl = tokenArtMode === "custom"
        ? (portraitData?.tokenDataUrl ?? "")
        : portraitDataUrl;
      const hasPortraitAsset = !!portraitDataUrl || (!!tokenDataUrl && tokenArtMode === "custom");

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

      const chosenSpeciesLanguages = sel.speciesChoices?.chosenLanguages ?? [];
      const chosenSpeciesSkills = sel.speciesChoices?.chosenSkills ?? [];
      const speciesLanguageChoiceCount = getRequiredSpeciesLanguageChoiceCount(state);
      const speciesSkillChoiceCount = getRequiredSpeciesSkillChoiceCount(state);
      const speciesItemChoiceCount = getRequiredSpeciesItemChoiceCount(state);
      const chosenSpeciesItems = Object.values(sel.speciesChoices?.chosenItems ?? {}).flat().length;
      const speciesSkillsSection = {
        id: "speciesSkills",
        label: "Species Skills",
        icon: "fa-solid fa-list-check",
        complete: chosenSpeciesSkills.length >= speciesSkillChoiceCount,
        summary: speciesSkillChoiceCount > 0
          ? `${chosenSpeciesSkills.length} / ${speciesSkillChoiceCount} skill choices`
          : "No species skill choices",
        isSimple: true,
      };
      const speciesLanguagesSection = {
        id: "speciesLanguages",
        label: "Species Languages",
        icon: "fa-solid fa-language",
        complete: chosenSpeciesLanguages.length >= speciesLanguageChoiceCount,
        summary: speciesLanguageChoiceCount > 0
          ? `${chosenSpeciesLanguages.length} / ${speciesLanguageChoiceCount} language choices`
          : "No species language choices",
        isSimple: true,
      };
      const speciesItemChoicesSection = {
        id: "speciesItemChoices",
        label: "Species Gifts",
        icon: "fa-solid fa-hand-sparkles",
        complete: chosenSpeciesItems >= speciesItemChoiceCount,
        summary: speciesItemChoiceCount > 0
          ? `${chosenSpeciesItems} / ${speciesItemChoiceCount} feature choices`
          : "No species gift choices",
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

      const backgroundLanguagesSection = {
        id: "backgroundLanguages",
        label: "Background Languages",
        icon: "fa-solid fa-language",
        complete: (bg?.languages.chosen.length ?? 0) >= (bg?.grants.languageChoiceCount ?? 0),
        summary: (bg?.grants.languageChoiceCount ?? 0) > 0
          ? `${bg?.languages.chosen.length ?? 0} / ${bg?.grants.languageChoiceCount ?? 0} language choices`
          : "No background language choices",
        isSimple: true,
      };

      const resolvedOriginFeatUuid = sel.originFeat?.uuid ?? bg?.grants.originFeatUuid ?? null;
      const originChoicesComplete = !bg?.grants.originFeatUuid || !!resolvedOriginFeatUuid;
      const originChoicesSummary = sel.originFeat?.name ?? bgOriginFeat ?? "No origin feat";

      const originChoicesSection = {
        id: "originChoices",
        label: "Origin Feat",
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

      const requiredClassSkills = Math.min(sel.class?.skillCount ?? 0, sel.class?.skillPool?.length ?? 0);
      const availableWeaponMasteries = sel.weaponMasteries?.availableWeaponMasteries ?? (sel.class?.weaponMasteryCount ?? 0);
      const requiredWeaponMasteries = Math.min(sel.class?.weaponMasteryCount ?? 0, availableWeaponMasteries);
      const classSkillNames = (sel.skills?.chosen ?? []).map(skillName);
      const weaponMasteryNames = (sel.weaponMasteries?.chosenWeaponMasteryDetails ?? []).length > 0
        ? (sel.weaponMasteries?.chosenWeaponMasteryDetails ?? []).map(weaponMasteryName)
        : (sel.weaponMasteries?.chosenWeaponMasteries ?? []).map(weaponMasteryName);
      const classAdvancementSelections = sel.classAdvancements ?? buildEmptyClassAdvancementSelections();
      const requiredExpertise = getClassAdvancementRequiredCount(state, "expertise");
      const requiredLanguages = getClassAdvancementRequiredCount(state, "languages");
      const requiredTools = getClassAdvancementRequiredCount(state, "tools");
      const requiredClassItems = (sel.class?.classAdvancementRequirements ?? [])
        .filter((requirement) => requirement.type === "itemChoices")
        .reduce((sum, requirement) => sum + requirement.requiredCount, 0);
      const expertiseNames = (classAdvancementSelections.expertiseSkills ?? []).map(skillName);
      const classLanguageNames = (classAdvancementSelections.chosenLanguages ?? []).map(languageLabel);
      const classToolNames = (classAdvancementSelections.chosenTools ?? []).map(toolLabel);
      const classItemNames = classItemChoiceNames(state);
      const classChoicesSection = {
        id: "classChoices",
        label: "Class Skills",
        icon: "fa-solid fa-list-check",
        complete: classSkillNames.length >= requiredClassSkills,
        classSkills: classSkillNames,
        hasClassSkills: classSkillNames.length > 0,
        isClassChoices: true,
      };

      const portraitSection = {
        id: "portrait",
        label: "Portrait",
        icon: "fa-solid fa-image-portrait",
        complete: true,
        summary: hasPortraitAsset
          ? (tokenArtMode === "custom"
            ? (portraitDataUrl ? "Portrait and custom token art bound" : "Custom token art bound")
            : "Portrait bound")
          : "Portrait optional",
        detail: tokenArtMode === "custom"
          ? (portraitDataUrl
            ? "Custom token art is set separately."
            : "Custom token art can stand in for the portrait when no portrait is chosen.")
          : "Token art follows the portrait by default.",
        img: portraitDataUrl || undefined,
        isSimple: true,
      };

      /* ── 5. Review ordering ─────────────────────────────── */
      const sections: Record<string, unknown>[] = [classSection];

      if (state.applicableSteps.includes("weaponMasteries")) {
        sections.push({
          id: "weaponMasteries",
          label: "Weapon Masteries",
          icon: "fa-solid fa-swords",
          complete: weaponMasteryNames.length >= requiredWeaponMasteries,
          summary: weaponMasteryNames.join(", ") || "Not selected",
          isSimple: true,
        });
      }

      if (state.applicableSteps.includes("classExpertise")) {
        sections.push({
          id: "classExpertise",
          label: "Expertise",
          icon: "fa-solid fa-bullseye",
          complete: expertiseNames.length >= requiredExpertise,
          summary: expertiseNames.join(", ") || "Not selected",
          isSimple: true,
        });
      }

      if (state.applicableSteps.includes("classLanguages")) {
        sections.push({
          id: "classLanguages",
          label: "Class Languages",
          icon: "fa-solid fa-language",
          complete: classLanguageNames.length >= requiredLanguages,
          summary: classLanguageNames.join(", ") || "Not selected",
          isSimple: true,
        });
      }

      if (state.applicableSteps.includes("classTools")) {
        sections.push({
          id: "classTools",
          label: "Class Tools",
          icon: "fa-solid fa-screwdriver-wrench",
          complete: classToolNames.length >= requiredTools,
          summary: classToolNames.join(", ") || "Not selected",
          isSimple: true,
        });
      }

      if (state.applicableSteps.includes("classItemChoices")) {
        sections.push({
          id: "classItemChoices",
          label: "Class Features",
          icon: "fa-solid fa-hand-sparkles",
          complete: classItemNames.length >= requiredClassItems,
          summary: classItemNames.join(", ") || "Not selected",
          isSimple: true,
        });
      }

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

      sections.push(
        speciesSection,
        speciesSkillsSection,
        speciesLanguagesSection,
        speciesItemChoicesSection,
        backgroundSection,
        backgroundAsiSection,
        backgroundLanguagesSection,
        originChoicesSection,
      );

      /* ── 7. Skills ──────────────────────────────────────── */
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
        selectedGrantGroups: buildOriginSelectedGrantGroups(state),
        backgroundSkills,
        speciesSkills,
        speciesItems,
        hasBackgroundSkills: backgroundSkills.length > 0,
        hasSpeciesSkills: speciesSkills.length > 0,
        hasSpeciesItems: speciesItems.length > 0,
        isSkills: true,
      });

      sections.push(classChoicesSection);

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
      let equipmentDetail = "";
      if (sel.equipment && sel.class?.uuid && sel.background?.uuid) {
        const equipmentResolution = await resolveEquipmentFlow(state);
        const derivedEquipment = deriveEquipmentState(state, equipmentResolution);
        const shopNameByUuid = new Map(equipmentResolution.shopInventory.map((entry) => [entry.uuid, entry.name]));
        const classChoice = derivedEquipment.selectedClassOption?.title ?? "Unchosen";
        const backgroundChoice = derivedEquipment.selectedBackgroundOption?.title ?? "Unchosen";
        equipmentSummary = `${classChoice} • ${backgroundChoice}`;
        const detailParts = [
          `Funds: ${formatCurrencyCp(derivedEquipment.remainingGoldCp)}`,
        ];
        if (derivedEquipment.purchases.length > 0) {
          detailParts.push(`Bought: ${derivedEquipment.purchases.map((entry) => `${entry.quantity}x ${shopNameByUuid.get(entry.uuid) ?? entry.uuid}`).join(", ")}`);
        }
        if (derivedEquipment.sales.length > 0) {
          detailParts.push(`Sold: ${derivedEquipment.sales.map((entry) => `${entry.quantity}x ${shopNameByUuid.get(entry.uuid) ?? entry.uuid}`).join(", ")}`);
        }
        equipmentDetail = detailParts.join(" • ");
      }
      sections.push({
        id: "equipment",
        label: "Equipment",
        icon: "fa-solid fa-sack",
        complete: !!sel.equipment,
        summary: equipmentSummary || "Not selected",
        detail: equipmentDetail || undefined,
        isSimple: true,
      });

      sections.push(portraitSection);

      const incompleteSections = sections.filter((section) => !section.complete);
      const allComplete = incompleteSections.length === 0;

      return {
        characterName: reviewData?.characterName ?? "",
        alignment: reviewData?.alignment ?? "",
        backgroundStory: reviewData?.backgroundStory ?? "",
        portraitDataUrl,
        tokenDataUrl,
        tokenArtMode,
        hasPortrait: !!portraitDataUrl,
        hasTokenArt: !!tokenDataUrl,
        tokenUsesPortrait: tokenArtMode !== "custom",
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
      const alignmentInput = el.querySelector("[data-lore-alignment]") as HTMLInputElement | null;
      const storyInput = el.querySelector("[data-background-story]") as HTMLTextAreaElement | null;
      if (nameInput) {
        nameInput.addEventListener("input", () => {
          const current = (state.selections.review as Record<string, unknown>) ?? {};
          callbacks.setDataSilent({ ...current, characterName: nameInput.value });
        });
      }
      if (alignmentInput) {
        alignmentInput.addEventListener("input", () => {
          const current = (state.selections.review as Record<string, unknown>) ?? {};
          callbacks.setDataSilent({ ...current, alignment: alignmentInput.value });
        });
      }
      if (storyInput) {
        storyInput.addEventListener("input", () => {
          const current = (state.selections.review as Record<string, unknown>) ?? {};
          callbacks.setDataSilent({ ...current, backgroundStory: storyInput.value });
        });
      }

      // Edit buttons — jump back to that step (handled by jumpToStep action in shell)
      // These use data-action="jumpToStep" data-step-id="..." which is already wired
    },
  };
}
