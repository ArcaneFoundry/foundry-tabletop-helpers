## Character Creator Persistent Indexing Plan

### Goal

Move expensive compendium indexing work out of the player-facing Character Creator flow and into a reusable world-level cache, while keeping the wizard resilient when no cache exists yet.

### Problem Summary

The current `classChoices -> weaponMasteries` transition is still too slow on live data because the first entry to the weapon masteries step triggers pack indexing for equipment sources during the navigation click path.

Recent live timings:

- `weaponMasteries.buildViewModel`: about `11.98s` before the index-first fast path
- `weaponMasteries.buildViewModel`: about `11.05s` after the index-first fast path

The optimization helped, but the remaining bottleneck is still loading and indexing source packs on demand.

### Proposed Approach

Use three layers together:

1. Persistent world-level cache built from settings
2. Opportunistic background warmup during the class flow
3. In-flow loading fallback when the cache is still missing

### Settings Flow

The Character Creator compendium-source menu becomes the main cache-management surface.

New behavior:

- `Save and Index`
  - saves the selected compendium sources
  - rebuilds the normalized pack index cache immediately
  - persists the cache in module world settings
- `Rebuild Indexes`
  - rebuilds the persistent cache without requiring pack-source changes
- visible cache status
  - `Not indexed`
  - `Indexed`
  - `Out of date`
  - `Indexing...`

The settings UI should show a spinner and disable repeated submits while indexing runs.

### Persistent Cache Shape

Persist normalized index data, not full documents.

Recommended snapshot contents:

- cache format version
- module version
- Foundry core version
- `dnd5e` system version
- normalized pack-source signature
- generated timestamp
- cached pack ids
- normalized `CreatorIndexEntry[]` values grouped by pack id

This lets the cache be invalidated when:

- selected packs change
- module cache schema changes
- Foundry or `dnd5e` versions change

### Wizard Warmup

When the user is on the class skills pane and the selected class grants weapon masteries:

- start a non-blocking preload of item pack indexes in the background
- prefer hydrating from the persistent cache first
- if needed, load missing packs into session memory

This reduces the odds that the user ever waits on the masteries transition.

### Fallback Loading State

If the user clicks `Next` from skills to weapon masteries and the required item indexes are still not ready:

- keep the mounted class shell visible
- keep the header and stepper mounted
- replace only the content pane with a loading state
- finish indexing
- continue into the mastery pane once ready

This avoids the current “frozen click” feeling.

### Scope For This Slice

This implementation slice will:

- add persistent index settings and accessors
- add compendium-indexer export/import and validation support
- add `Save and Index` and `Rebuild Indexes` to the compendium-source settings menu
- add class-flow background warmup during the skills pane
- add content-pane loading fallback before the mastery pane is rendered

This slice will not:

- fully cache hydrated document descriptions
- prebuild every future step-specific derived view model
- add pack-content hashing beyond version and selected-pack invalidation

### Risks

- world setting size may grow if many large item packs are selected
- persistent caches can go stale if pack contents change outside our settings flow
- players should still be able to proceed even if only session warmup is available

### Validation Plan

1. Targeted unit tests for persistent cache import/export and validity checks
2. Settings-menu flow verification for save/index and rebuild behavior
3. Live Foundry check:
   - configure sources
   - build persistent cache
   - run `Fighter -> Skills -> Weapon Masteries`
   - confirm the transition is materially faster
4. Build and deploy
5. Final live verification after deploy
