/**
 * Transforms EncounterGroupData into EncounterGroupViewModel.
 * 
 * Note: NPC blocks are rendered separately and passed in as pre-rendered HTML.
 */

import type { EncounterGroupData } from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import type { EncounterGroupViewModel } from "./encounter-viewmodel";
import { esc } from "./character-transformer-common";

/* ── Main Transformer ───────────────────────────────────────── */

export function transformEncounterGroupToViewModel(
  data: EncounterGroupData,
  options: PrintOptions,
  npcBlocks: string[],
): EncounterGroupViewModel {
  return {
    name: esc(data.name),
    npcBlocks,
    paperClass: `fth-paper-${options.paperSize}`,
  };
}
