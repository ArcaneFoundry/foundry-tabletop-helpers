# Character Creator Wizard Redesign Plan

## Goal

Rework the Character Creator into a clearer class-first flow that better matches the 2024 D&D onboarding experience while preserving the recent stability work on actor creation, spell prep, and higher-level progression.

## Target Experience

Planned end-state step flow:

1. Class selection
2. Class-specific choices
3. Class grants summary
4. Background
5. Background ASI
6. Origin choices
7. Species
8. Species-specific choices
9. Combined origin summary
10. Ability scores
11. Equipment / gold path
12. Mundane store
13. Spells
14. Portrait + token
15. Personal details
16. Final review

## Delivery Strategy

We should land this as a staged refactor rather than a single rewrite.

### Phase 1: Wizard Backbone

- Make the flow class-first in the step registry.
- Fix dependency-cascade assumptions that were built around the old origin-first order.
- Introduce dedicated step placeholders/real steps for the new class-first structure so future work has stable IDs and templates.

### Phase 2: Class-First UX

- Extend class selection with:
  - primary ability badges
  - short recommendation text
  - parsed class grant metadata needed downstream
- Add a `classChoices` step for class-specific decisions and previews.
- Add a `classSummary` step that surfaces:
  - hit die
  - level-1 max HP preview
  - saving throws
  - armor and weapon proficiencies
  - early feature list through the configured starting level

### Phase 3: Origin Flow Rewrite

- Split current background grants logic into:
  - background selection
  - background ASI
  - origin choices
- Move class skill duplication enforcement into the new class/background-aware flow.
- Add species-specific option handling and a combined origin summary step.

### Phase 4: Equipment / Store

- Separate package selection from spend-gold shopping.
- Add a mundane store UI backed by indexed compendium items.
- Track spend, refunds, and remaining gold.
- Add a DM-facing TODO/settings hook for inventory control.

### Phase 5: Finish Flow

- Add personal-details step mapped to dnd5e actor fields.
- Rebuild review to summarize the new steps truthfully.
- Ensure actor creation writes every new selection correctly.

### Phase 6: Validation

- Regression tests for each new step and dependency path.
- Focused live validation for:
  - a martial class
  - a species with extra options
  - a prepared caster

## Phase 1-2 Scope For This Slice

This implementation slice focuses on the first safe backbone move:

- reorder the wizard so `class` comes first
- add `classChoices`
- add `classSummary`
- enrich class selection with recommendation and grant metadata

To avoid breaking the current rules-correct skill/background interaction, final class skill commitment remains in the existing later-step flow until Phase 3 rewires background and origin choices together.

## Main Risks

- Moving actual class skill picks ahead of background choice too early can create duplicate-skill traps under 2024 rules.
- Weapon mastery support likely needs richer parsing than the current class indexing layer exposes.
- Review and actor creation should only be switched to the new state fields once the whole origin/class dependency chain is migrated.

## Immediate Follow-Up After This Slice

1. Split `backgroundGrants` into `backgroundAsi` and later origin-choice concerns.
2. Move class-skill commitment out of the legacy `skills` step and into the new class/background-aware flow.
3. Introduce species-specific options and combined origin summary.
