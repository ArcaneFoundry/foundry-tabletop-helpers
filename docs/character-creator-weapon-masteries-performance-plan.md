# Character Creator Weapon Masteries Performance Plan

## Problem

Transitioning from `classChoices` to `weaponMasteries` is noticeably slow on the live Foundry server.

Live timing instrumentation on March 21, 2026 showed:

- `class -> classChoices`: effectively instant
- `classChoices -> weaponMasteries`: about `11,978ms`
- the cost is inside `weaponMasteries.buildViewModel()`, not React routing

## Current Cause

The current `weaponMasteries` step does this synchronously before the pane can render:

1. loads item-pack indexes for the enabled item sources plus fallback packs
2. gathers every indexed weapon entry
3. fetches every candidate weapon document with `fromUuid()`
4. filters and normalizes the final options from full document data

That means the first render blocks on a large amount of compendium I/O and document hydration.

## Optimization Goals

1. make the first `weaponMasteries` render fast enough to feel immediate
2. preserve the current filtering rules:
   - mundane only
   - class proficiency only
   - mastery pool only
3. avoid changing user-facing behavior while improving the pipeline
4. keep enough instrumentation in place to verify the improvement live

## Recommended Strategy

### Phase 1: Index-first weapon option building

Extend the compendium indexer so weapon entries carry the fields we need directly from pack indexes:

- `system.mastery`
- `system.rarity`
- `system.magicalBonus`
- `system.properties`

Then build mastery options from `CreatorIndexEntry` data instead of fetching full documents for every weapon.

Use full document fetch as a fallback only when an indexed entry is missing a required field such as:

- identifier
- mastery
- weapon type
- rarity / magic flags needed for baseline filtering

Expected result:

- most entries resolve from index data only
- the expensive `fromUuid()` loop is reduced to zero or a very small subset

### Phase 2: Pack scope tightening

If Phase 1 is not enough, reduce the number of packs scanned for the mastery step:

- prefer enabled item packs first
- avoid broad fallback packs when an enabled pack already provides the needed weapon families
- optionally memoize the resolved mastery option list per class/pool/proficiency key signature

### Phase 3: Background refresh and prewarm

If we still want more responsiveness:

- prewarm fallback equipment pack indexes earlier in the class flow
- or build mastery options in the background right after class selection / skill completion

This should only happen after Phase 1, because the index-first path may make prewarming unnecessary.

## Instrumentation Plan

Keep the current coarse logs while optimizing:

- `CC Perf: goNext triggered refresh`
- `CC Perf: controller refresh complete`
- `CC Perf: buildWizardShellContext step complete`
- `CC Perf: weapon masteries options built`
- `CC Perf: weapon masteries buildViewModel complete`

These logs should let us compare:

- total step render time
- pack-load time
- document-fetch time
- cache-hit behavior

## First Implementation Slice

Implement Phase 1 now:

1. extend `CreatorIndexEntry` with weapon mastery-related metadata
2. extend `CompendiumIndexer` index fields and normalization
3. change `step-weapon-masteries.ts` to use indexed metadata first
4. keep a guarded slow fallback for incomplete entries
5. rerun targeted tests, typecheck, live integration, build, deploy, and verify

## Success Criteria

The first live render of `weaponMasteries` should drop from about `12s` to something much closer to the class-skills step, ideally below `1s` to `2s` on the live server.
