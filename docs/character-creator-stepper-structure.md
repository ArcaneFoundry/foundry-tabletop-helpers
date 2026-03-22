# Character Creator Stepper Structure

This document defines the intended stepper hierarchy for the Character Creator React migration.

## Core Rule

The top-level stepper should represent major character-creation stages.
Small satellite icons around a main stage should represent the inner required selections within that stage.

This means:

- the user does not "leave Class" when moving from class selection to class skills
- the user does not "leave Origins" when moving between species, background, and related origin grants
- child steps should only appear when the selected content actually requires them

## Proposed Main Stages

1. Class
2. Origins
3. Build
4. Finalize

## Class Stage

Main node:

- `class`

Potential child nodes:

- `classChoices`
  - class skill selections
- `weaponMasteries`
  - only for classes that grant weapon mastery choices at the current level
- `subclass`
  - only when the selected class and starting level require an actual subclass choice

Notes:

- `classSummary` should behave like an in-stage transition/review surface, not a separate major stage in the long-term stepper model
- the current first implementation uses `Features` as a tail node, but the long-term direction should keep class-specific follow-up work visually grouped under `Class`

## Origins Stage

Main nodes that should visually collapse into one major origin stage:

- `species`
- `background`

Potential child nodes within the stage:

- `speciesChoices`
  - species language choices
  - species skill choices
  - species spell/item choice groups
- `backgroundAsi`
  - background ability score assignment
- `originChoices`
  - optional origin feat override or confirmation flow

Notes:

- `originSummary` should behave like an in-stage summary/review surface instead of a separate major stage
- this stage is likely the next strongest candidate for the same aggregate-stepper treatment now being prototyped for `Class`

## Build Stage

Main stage contents:

- `abilities`
- `feats`
- `spells`
- `equipment`

Potential child behavior:

- `spells` can surface sub-progress for cantrips, spells known/prepared, and any class-specific spell selection limits
- `feats` may need internal sub-progress if we support multi-pick feat or ASI bundles in one surface
- `equipment` may later expose internal sub-progress if we split package selection from individual item picks

## Finalize Stage

Main stage contents:

- `portrait`
- `review`

Notes:

- this stage is mostly linear and may not need satellites unless portrait generation expands into a richer workflow

## Current Data-Driven Child Steps We Already Know About

From the current repo state and live PHB 2024 content, the following grant-driven selection steps already exist or are already modeled:

- class skills
- weapon masteries
- subclass choice at higher starting levels
- species languages
- species skills
- species item/spell choice groups
- background ASI allocation
- origin feat override/selection
- spells

These are the main candidates for satellite-step treatment.
