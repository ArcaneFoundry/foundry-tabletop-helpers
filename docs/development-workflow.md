# Development Workflow

This document describes the current day-to-day workflow for module changes in this repo.

## Core Loop

Use this order unless the task clearly does not need one of the steps:

1. Work in a small slice.
2. Run the smallest relevant unit tests and local checks.
3. Perform a live integration test in Foundry.
4. Run a production build.
5. Deploy the built module to the Foundry server.
6. Perform one more live verification on the deployed build.

The practical goal is to catch cheap regressions locally first, then verify real Foundry behavior before and after deployment.

## Local Commands

From the repo root:

- `npm run typecheck`
- `npm run test`
- `npm run test -- path/to/file.test.ts`
- `npm run build`
- `npm run ci`

Most UI work should use targeted tests while iterating, then `npm run build` before deployment.

## Live Integration Testing

Use the live Foundry host when the change affects:

- Foundry window lifecycle behavior
- rendered UI layout or styling
- step navigation
- compendium-backed content loading
- module boot or registration behavior
- anything that has already behaved differently in Foundry than in tests

Current live host:

- URL: `https://foundry.digitalframeworks.org`

Current test account used for interactive validation:

- username: `FoundryTester`
- password: managed out of band for active development sessions

Typical live test expectations:

1. Open the relevant workflow in Foundry.
2. Verify the changed behavior directly.
3. Check resize behavior if the UI is window-based.
4. Confirm navigation and action buttons still work.
5. Confirm no new console errors were introduced.

Current Character Creator deployment note:

- the live world on `foundry.digitalframeworks.org` is currently configured to source classes from `dnd-players-handbook.classes`
- the same live world now exercises Origins from the configured PHB/Heroes of Faerun background and species packs, so origin-step validation should be checked against current 2024 document shapes as well
- class and step validation should therefore be checked against current PHB 2024 item shapes, not only SRD packs
- class save proficiencies currently appear in Foundry content under both `Saving Throws` and `Saving Throw Proficiencies`, depending on pack/source
- the class section now includes dynamic class-driven substeps such as expertise, languages, tools, weapon masteries, and item-choice advancements when the selected class requires them
- the Origins section now runs as a mounted React flow under a single `Origins` milestone and can inject background/species substeps such as skill-conflict resolution, aptitudes, languages, origin feat selection, species skills, species languages, and species item-choice selections

## Build

Build from the repo root:

```bash
npm run build
```

This runs:

1. TypeScript typecheck
2. Vite build
3. manifest generation

Deploy only built artifacts from `dist/`.

## Deploy To Foundry

Current module deployment target:

- host: `root@foundry.digitalframeworks.org`
- path: `/var/foundrydata/Data/modules/foundry-tabletop-helpers/`

Deploy command:

```bash
rsync -av --delete dist/ root@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/
```

After deploy:

1. Re-open the workflow in Foundry.
2. Confirm the shipped behavior matches the local result.
3. Verify the updated files exist remotely when needed.

For ordinary module asset deploys, restarting `foundry.service` is usually unnecessary.

## Character Creator Workflow Notes

Character creator work should follow the same loop, with extra care around migration safety:

- preserve existing wizard logic and state-machine behavior
- keep Foundry VTT v13 compatibility
- keep `dnd5e` 5.3.x compatibility
- avoid rewriting the full wizard in one pass
- keep legacy steps working while React-native steps are introduced

For React/Tailwind character creator work, the expected sequence is:

1. implement a narrow slice
2. run targeted unit tests
3. live-test the step in Foundry
4. run `npm run build`
5. deploy
6. live-test the deployed build

Current class-flow note:

- the mounted React class shell now spans `class`, `classChoices`, `classExpertise`, `classLanguages`, `classTools`, `weaponMasteries`, `classItemChoices`, and `classSummary`
- `classSummary` should not be considered complete until all required class-driven selections for the working level are finished
- weapon-mastery validation should cover both the loading interstitial and the final mastery pane because indexing warmup, cache hydration, and fallback document fetches can affect each stage differently
- class summary now hands off into Origins with a `Confirm` action, and the top-level progress rail should read as the chosen class plus `Origins`, not as separate top-level background/species stages

Current Origins-flow note:

- the mounted React Origins shell now spans `background`, `backgroundSkillConflicts`, `backgroundAsi`, `backgroundLanguages`, `originChoices`, `species`, `speciesSkills`, `speciesLanguages`, `speciesItemChoices`, and `originSummary`
- Background and Species selection now use full-width art-led React card grids, so live tests should cover layout, selection-state feedback, and resize behavior for those panes rather than the older split detail layout
- language-selection screens should never offer `Common` as a selectable option, but should still allow explicit variants such as `Common Sign Language`
- origin-feat validation should cover both the warmup interstitial and the final selection screen because feat availability now depends on hydrated origin-feat metadata on indexed background and feat entries

## Documentation Expectations

When shipped behavior changes:

- update `README.md`
- update the relevant status docs in `docs/`
- remove or replace stale planning language when it no longer reflects reality

Status docs are preferred over speculative plans once a feature has already landed or the architecture is already in progress.
