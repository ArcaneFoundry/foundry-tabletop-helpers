# Character Creator React + Tailwind Status

This document replaces the early migration plan with the current architecture and implementation status for the character creator UI transition.

## Summary

The character creator is now in an active, incremental migration from Handlebars plus legacy CSS to a React + Tailwind rendering stack.

The migration is intentionally not a rewrite. The current approach is:

- keep the wizard logic, state machine, compendium pipeline, and actor-creation domain logic intact
- move window ownership to a React-capable Foundry application shell
- support both React-native and legacy Handlebars steps during the transition
- use Tailwind as the default styling layer
- keep Foundry VTT v13 and `dnd5e` 5.3.x compatibility as the baseline

## Current State

The following foundation is already in place:

- React and Tailwind are wired into the module build
- a Foundry `ApplicationV2` React wrapper is present
- the React character creator shell is active
- the shell can host both `react` and `legacy` step render modes
- legacy steps still run through an adapter so the migration can continue step by step
- the mounted class flow is now React-native across class selection, class-driven substeps, and class summary
- the mounted Origins flow now follows the confirmed class handoff and is React-native across background selection, background-driven substeps, species selection, species-driven substeps, and origin summary

This means the rendering layer is now hybrid by design.

## Architectural Decisions

These decisions are now current project direction, not tentative proposals:

1. Borrow the React-in-Foundry approach from Aeris Core, but do not add `aeris-core` as a runtime dependency.
2. Keep React ownership scoped to our own module application lifecycle.
3. Preserve the existing `WizardStateMachine` and current domain logic rather than rewriting the behavior layer.
4. Migrate one step at a time behind an explicit `legacy | react` step contract.
5. Treat Tailwind as the default authoring surface for UI styling.
6. Keep handwritten CSS limited to narrowly scoped resets, tokens, and Foundry-specific exceptions.

## Current Character Creator UI Shape

### Shell and Step Hosting

The React shell now owns the character creator window and renders:

- shared shell framing
- navigation
- step host selection
- React-native steps directly
- legacy Handlebars steps through an adapter host

This lets new React work land without breaking the rest of the wizard.

### Domain Boundaries

The migration keeps these responsibilities outside the React components:

- wizard navigation and validity rules
- compendium indexing and document loading
- actor-creation logic
- `dnd5e` parsing and normalization
- existing step completion and dependency behavior

React components should consume normalized view-model data and controller callbacks, not raw system internals.

### Styling Approach

Tailwind is now the default styling path for the new UI.

Handwritten CSS is still allowed only for:

- Tailwind entry and token definition
- scoped resets required to neutralize Foundry defaults inside our app roots
- narrow browser or Foundry-specific exceptions that do not belong in utilities

The current module-wide reset strategy is intentionally scoped to our own UI roots so Foundry and other modules are unaffected.

## Class Step Status

The mounted class flow is now the leading React-native slice and the current visual reference for the migration.

Current behavior:

- class cards are rendered in React
- the class-skills selection page is rendered in React with an in-shell summary rail and proficiency panel
- the class flow now adds React-native class advancement steps for expertise, languages, tools, and item-choice requirements when the selected class needs them at the current starting level
- the weapon-masteries page is rendered in React with a routed mastery list, selected-weapon summary, and mastery glossary
- the follow-up class-summary screen is rendered in React
- the page uses the React shell and Tailwind styling
- the class-selection header now uses a generated scenic banner treatment with light ornamental flourishes
- the main class-selection field now includes a subtle generated parchment texture layer behind the interactive content
- the class step now uses Motion-powered entry, hover, and selection feedback across the banner, progress rail, cards, chips, and footer controls
- selection state is shown directly on the chosen card through a selected-only crest badge
- the `class`, `classChoices`, `classExpertise`, `classLanguages`, `classTools`, `weaponMasteries`, `classItemChoices`, and `classSummary` steps now share one mounted React shell so the banner and class stepper stay resident while only the inner content pane transitions
- the progress rail has moved from the earlier orbiting child-icons concept to a milestone-plus-subrail model: the current section is `Class` or the confirmed class name, the next major chapter is `Origins`, and the subrail reflects only the active section's actual required substeps
- class advancement requirements are now normalized on the class selection model and reused by step applicability, summary generation, review output, and actor creation
- class summary is now gated on completion of all required class-driven selections instead of acting as an unconditional follow-up page
- class summary now acts as the class-phase confirmation point and shows exact selected grants for titled requirements such as expertise, languages, tools, and class item choices
- class-granted weapon masteries now route immediately after class skills and currently derive only from class-known weapon proficiencies; if later origin or feature grants need additional mastery picks, they should surface in a separate later mastery flow
- the compendium-source settings menu now exposes `Save and Index` plus `Rebuild Indexes`, and persists a world-level normalized compendium cache for the currently selected Character Creator sources
- the class flow now warms item indexes in the background during the skills pane, validates content-scoped persistent snapshots, and shows an in-shell loading state while preparing weapon masteries instead of leaving the user on a dead click
- creator weapon-choice flows now respect a GM `Allow Firearms` world setting; it defaults off and currently hides weapons marked by dnd5e ammunition type `firearmBullet` from weapon mastery choices first
- the lower class details panel has been removed
- richer class recap content now lives on the summary step instead
- the class-summary screen has been reworked into a cleaner recap of selected class picks, current-level proficiencies, and only the newly granted class features for the working level
- feature descriptions on the summary step are expandable in place and now run through the shared description formatting pipeline so leaked Foundry token markup is cleaned up before display
- the in-page progress treatment is compact so more space is available for class cards
- class cards expose compact portrait chips for hit die, curated primary ability display, and starting saving throw proficiencies without covering the artwork

Current design direction:

- functional first
- fantasy RPG flair
- parchment, brass, and carved-plaque styling
- stronger selected-state feedback
- tablet-friendly layout inside Foundry windows
- future AI-generated art support should focus on shell-level plaques, parchment textures, and light ornament kits before adding heavier card decoration; see [character-creator-class-step-art-direction.md](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/docs/character-creator-class-step-art-direction.md)

Important product note:

- rich class summary and deeper explanatory content are no longer shown on the class-selection page and now live on the later class-summary step

## Origins Step Status

Origins are now the second major React-native chapter in the live character-creation flow.

Current behavior:

- confirming the class summary keeps the user inside the mounted creator shell; only the inner content pane changes while the shared header and progress rail remain in place
- the top-level progress rail now treats Background and Species as one major `Origins` milestone instead of separate top-level stages
- `background`, `backgroundSkillConflicts`, `backgroundAsi`, `backgroundLanguages`, `originChoices`, `species`, `speciesSkills`, `speciesLanguages`, `speciesItemChoices`, and `originSummary` now run through the React shell
- Background and Species selection use art-led card grids with top nameplates and no split detail panel
- the origin flow is background-first
- the background flow now includes an in-flow skill-conflict step that rewrites overlapping class skill picks when a background grants the same proficiencies
- background aptitude restrictions now honor live 2024 PHB background limits even when the allowed ability scores are described only in advancement hint text
- language-selection screens now apply one shared picker rule: never offer `Common` as a selectable bonus language, while still allowing explicit variants such as `Common Sign Language`
- the origin-feat screen now supports reverting back to the background's default feat after a custom swap
- the origin summary follows the same grouped-summary approach as the class summary and shows exact selected grants under the originating advancement titles

Current performance/state note:

- origin-feat availability no longer depends on a full background-and-feat document walk at step time
- indexed feat entries now cache normalized feat-category and prerequisite-level metadata
- indexed background entries now cache the granted origin-feat UUID
- the persistent compendium snapshot now stores that metadata so warm and hydrated paths can resolve origin-feat choices without refetching every background and feat document
- the controller now warms origin-feat metadata during the `backgroundLanguages -> originChoices` transition and logs whether the result came from hydrated cache, fallback enrichment, or an in-memory hit

## Constraints That Still Matter

The migration still has to respect a few non-negotiable realities:

- Foundry window lifecycle and render behavior
- `dnd5e` compendium-backed data volatility
- official content modules on the live server
- mixed React and legacy step rendering during the transition
- tablet-friendly performance in a real Foundry client

## Recommended Working Pattern

For character creator migration work:

1. change one narrow UI slice at a time
2. run targeted tests first
3. live-test the affected flow in Foundry
4. run `npm run build`
5. deploy the built module
6. live-test the deployed result

See [development-workflow.md](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/docs/development-workflow.md) for the exact workflow.

## What Is Complete Vs. In Progress

Complete enough to build on:

- React/Tailwind tooling
- Foundry React app wrapper
- React wizard shell
- legacy-step adapter path
- mounted React class flow across class selection, class-driven substeps, and summary
- mounted React Origins flow across background selection, origin substeps, species selection, species substeps, and origin summary
- dynamic class requirement parsing through the configured starting level
- milestone-plus-subrail class stepper model
- persistent compendium indexing plus background warmup for weapon mastery preparation
- persisted origin-feat metadata plus warmup-driven origin-feat preparation

Still in progress:

- moving more steps onto the React contract
- continuing the visual system rollout across the rest of the wizard
- removing stale legacy styling assumptions as React coverage expands
- keeping class-card summary extraction aligned with current PHB 2024 compendium data on the live server
- tightening the remaining class-summary and class-advancement polish as more PHB classes are exercised live
- continuing to reduce the remaining `weaponMasteries` first-render cost when indexed metadata still falls back to full document reads
- continuing to harden live species/background verification coverage now that Origins are mounted and React-native
