# Character Creator Wizard Status

This document replaces the earlier redesign plan with a current-state status note.

## Summary

The class-first character creator redesign has largely landed. The wizard, level-up flow, actor creation engine, GM configuration, and portrait step are now implemented and covered by automated tests. The original redesign plan is no longer an accurate description of the current state of the project.

## Implemented

- Class-first wizard flow
- Dedicated class choice and class summary steps
- Background, background ASI, origin choice, species choice, and origin summary steps
- Ability, feat, spell, equipment, portrait, and review steps
- Actor creation engine for dnd5e 2024-style onboarding
- Level-up detection and level-up application flow
- GM configuration and compendium/source curation
- Portrait generation integration through the optional companion server
- Active React + Tailwind transition on top of the shipped wizard flow, with the class selection and class summary steps now serving as the current visual reference
- Compact class-card reference treatment for hit die, curated primary ability display, and starting saving throw summaries

## Partially Implemented Or Deferred

- Equipment exists as a guided step, but the earlier "mundane store" concept from the redesign plan has not been split into a separate shopping flow
- A dedicated personal-details step is not present as a standalone wizard step
- Some future-facing comments in the code still describe portrait or placeholder behavior that no longer matches the implementation
- The React + Tailwind migration is only partially rolled out; class selection and class summary are React-native, and the rest of the wizard is still mixed legacy and React

## Current Risks

- The feature surface is now broad enough that documentation can fall behind quickly
- Character creation depends heavily on dnd5e compendium structure, so upstream system changes remain a compatibility risk
- Portrait generation depends on external companion-server configuration and Gemini availability
- The hybrid render path means both React and legacy step behavior need to be kept working until the migration is further along
- Class summary chips on the class-selection step depend on current PHB 2024 compendium item shapes as configured on the live server

## Recommended Follow-Up

1. Keep this document as a status note rather than a future plan unless a new major redesign begins
2. Treat the class selection and class summary steps as the current design reference for the broader React + Tailwind migration
3. Keep richer summary and details content in later steps instead of restoring a heavy detail pane on the class-selection page
4. Align stale code comments and README references with the shipped workflow and the current visual direction
