import type { WizardSelections } from "./character-creator-types";

/** Starting gold by class (PHB standard). */
const CLASS_STARTING_GOLD: Record<string, number> = {
  barbarian: 40,
  bard: 100,
  cleric: 125,
  druid: 50,
  fighter: 150,
  monk: 13,
  paladin: 150,
  ranger: 125,
  rogue: 100,
  sorcerer: 75,
  warlock: 100,
  wizard: 100,
};

const DEFAULT_STARTING_GOLD = 100;

export function getStartingGoldForIdentifier(classIdentifier: string | undefined): number {
  const normalized = classIdentifier?.toLowerCase() ?? "";
  return CLASS_STARTING_GOLD[normalized] ?? DEFAULT_STARTING_GOLD;
}

export function getStartingGoldForSelections(selections: Pick<WizardSelections, "class">): number {
  return getStartingGoldForIdentifier(selections.class?.identifier);
}
