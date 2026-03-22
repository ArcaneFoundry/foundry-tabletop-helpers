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
- the class-selection, class-skills, and class-summary pages are now React-native steps

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

The class-selection, class-skills, class-summary, and weapon-masteries pages are now the leading React-native screens and the current visual reference for the migration.

Current behavior:

- class cards are rendered in React
- the class-skills selection page is rendered in React with an in-shell summary rail and proficiency panel
- the weapon-masteries page is rendered in React with a routed mastery list, selected-weapon summary, and mastery glossary
- the follow-up class-summary screen is rendered in React
- the page uses the React shell and Tailwind styling
- the class-selection header now uses a generated scenic banner treatment with light ornamental flourishes
- the main class-selection field now includes a subtle generated parchment texture layer behind the interactive content
- the class step now uses Motion-powered entry, hover, and selection feedback across the banner, progress rail, cards, chips, and footer controls
- selection state is shown directly on the chosen card through a selected-only crest badge
- the `class`, `classChoices`, and `weaponMasteries` steps now share one mounted React shell so the banner and aggregate class stepper stay resident while only the inner content pane transitions
- the lower class details panel has been removed
- richer class recap content now lives on the summary step instead
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
- React-native class selection and class summary steps
- React-native class-skills step

Still in progress:

- moving more steps onto the React contract
- continuing the visual system rollout across the rest of the wizard
- relocating summary and detail content into later steps where it fits the flow better
- removing stale legacy styling assumptions as React coverage expands
- keeping class-card summary extraction aligned with current PHB 2024 compendium data on the live server
