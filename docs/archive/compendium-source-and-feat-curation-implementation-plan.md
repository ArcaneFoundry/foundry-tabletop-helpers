# Character Creator Compendium Source And Feat Curation Plan

## Goal

Improve how the Character Creator discovers, labels, filters, and previews compendium sources so that:

- GM pack selection is more trustworthy and easier to understand
- premium modules such as Heroes of Faerun surface useful labels instead of generic pack names
- feat packs stop showing obviously irrelevant content in the settings UI
- the origin feat workflow stops mixing valid origin feats with unrelated feats
- users can quickly inspect what a pack contains before enabling it
- 2014 SRD versus 2024-era SRD content is called out clearly

This plan is intentionally implementation-ready. It is organized around concrete code changes, data-model updates, UI behavior, validation, and rollout order.

## Current State

### Relevant Code Paths

- Settings menu pack detection: [character-creator-settings-menus.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/character-creator-settings-menus.ts)
- GM config sources tab: [gm-config-app.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/gm-config/gm-config-app.ts)
- GM sources template: [cc-gm-sources.hbs](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/templates/character-creator/cc-gm-sources.hbs)
- Compendium normalization/indexing: [compendium-indexer.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/data/compendium-indexer.ts)
- Origin feat step: [step-origin-choices.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/steps/step-origin-choices.ts)
- Type definitions for pack/source UI: [character-creator-types.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/character-creator-types.ts)

### Problems Confirmed

1. Pack detection is too eager.
   - [character-creator-settings-menus.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/character-creator-settings-menus.ts) currently detects pack relevance by indexing all `Item` packs and counting entries by raw `type`.
   - This causes feat selection lists to include packs that contain feats incidentally, even when the pack is not a good feat-source for character creation.

2. Pack labels are too shallow.
   - The UI currently shows the pack label only.
   - In live premium content, `dnd-heroes-faerun` exposes an `options` pack with label `Character Options`, which is too generic for GM decision-making.
   - The module metadata and live behavior suggest that pack/folder context is needed to make these packs understandable.

3. Source vintage is ambiguous.
   - The repo default still points to `dnd5e.*` SRD packs in [dnd5e-constants.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/data/dnd5e-constants.ts).
   - The user observation is valid: some displayed “SRD” labels map to older/system SRD content, while unlabeled premium/core-book packs represent 2024-era content.
   - We need explicit metadata in the UI instead of making GMs infer this from pack ids.

4. No preview/hover affordance exists in the source selector.
   - [cc-gm-sources.hbs](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/templates/character-creator/cc-gm-sources.hbs) shows only label, source, and count.
   - There is no fast way to inspect what a pack actually contains before enabling it.

5. Origin feat selection is too broad and too trusting.
   - [step-origin-choices.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/steps/step-origin-choices.ts) currently gathers “available origin feats” by collecting feats granted by backgrounds and then including those feat entries if they are `type === feat` with no level prerequisite.
   - This is not enough for mixed-content premium packs.
   - The screenshot confirms that Heroes of Faerun content is surfacing under generic “Character Options” labeling, and the rendered feat text still carries unresolved syntax like `[[lookup @prof]]`, which indicates a content-formatting gap for enriched premium content.

## External Findings That Should Inform The Work

### Foundry API

The current Foundry v13 compendium APIs support richer pack metadata than we are using now, including:

- pack metadata
- pack labels and package identity
- index field requests
- folder context on compendium documents and pack folder structures

That means we should not keep treating pack selection as “pack label plus item count.” The underlying platform supports stronger metadata-driven curation.

### Live Installed Content

From live server module metadata:

- [dnd-heroes-faerun module.json](/var/foundrydata/Data/modules/dnd-heroes-faerun/module.json)
  - exposes an `options` pack labeled `Character Options`
  - this is a premium item pack that mixes backgrounds, feats, subclasses, and other player-facing content
- [dnd-players-handbook module.json](/var/foundrydata/Data/modules/dnd-players-handbook/module.json)
  - exposes separate `classes`, `origins`, `feats`, `spells`, and `equipment` packs
  - includes `flags.dnd5e.types`, which is a much better source signal than blindly indexing every `Item` pack

### dnd5e Repository

The current dnd5e line carries both SRD 5.1 and SRD 5.2 era concerns, so the settings UI should not imply that all “SRD” sources are equally current for 2024 creator workflows.

## Proposed Product Behavior

### 1. Better Pack Titles

For each selectable source row, display:

- primary display title
- compact source/version label
- item count
- optional “mixed content” marker

Display-title priority:

1. explicit curated override, if we define one
2. pack label plus meaningful folder context when available
3. pack label
4. collection id fallback

Examples:

- `Character Origins` for `dnd-players-handbook.origins`
- `Heroes of Faerun: Character Options` for the raw pack
- `Heroes of Faerun: Origin Feats` when the detected item subset is strongly clustered under that folder

Important constraint:

- do not replace the underlying pack id or the actual pack selection model
- only improve the display label and preview metadata

### 2. Source Vintage Labels

Every pack row should show one compact source-vintage badge, for example:

- `SRD 2014`
- `SRD 2024`
- `Core 2024`
- `Premium 2024`
- `Mixed`
- `Unknown`

Initial heuristic:

- `packageName === "dnd5e"` and classic SRD pack ids like `dnd5e.classes`, `dnd5e.feats`, `dnd5e.backgrounds`, etc. => `SRD 2014`
- official 2024 core book modules like `dnd-players-handbook`, `dnd-dungeon-masters-guide`, `dnd-monster-manual` => `Core 2024`
- official premium 2024 player-option modules like `dnd-heroes-faerun` => `Premium 2024`
- if content mix cannot be confidently classified => `Mixed` or `Unknown`

This does not need to be academically perfect in v1, but it must be explicit and useful.

### 3. Hover Preview For Pack Rows

Hovering or focusing a pack row in the sources UI should show a compact popup with:

- the resolved display title
- source-vintage badge
- content-type badge list
- a short sample list of included items, ideally 5 to 8 names
- for mixed item packs, a compact breakdown such as:
  - `18 backgrounds`
  - `12 origin feats`
  - `8 subclasses`

The popup should be:

- fast
- keyboard accessible
- safe to render from cached/indexed data only
- non-blocking if preview generation fails

The preview should not fetch every full document on hover. It should rely on a precomputed summary generated during pack detection/indexing.

### 4. Tighter Feat Pack Eligibility

For the `Feats` settings section, stop showing any pack merely because it contains one or more `feat` items.

Instead, determine whether a pack is a credible feat-source for the creator by scoring it against signals:

- pack metadata `flags.dnd5e.types` contains only or primarily `feat`
- pack label or folder label indicates feats, origins, character options, classes, or subclasses
- feat ratio is meaningfully high relative to all entries in the pack
- excluded if the pack is clearly monster/NPC/equipment oriented even if it contains incidental feat documents

Suggested v1 rule:

- include feat packs if one of these is true:
  - `flags.dnd5e.types` is exactly `["feat"]`
  - the pack label is feat/origin/character-options oriented and the pack contains a material feat count
  - the feat ratio exceeds a threshold such as 25% and total feat count exceeds a minimum such as 5
- exclude packs that are obviously monster/equipment packs unless explicitly whitelisted

This should remove noise like:

- monster feature packs
- equipment packs with incidental feat documents
- class packs where feats are only present as support documents unless they are truly part of creator-facing choices

### 5. Origin Feat Source Tightening

Origin feat selection should not rely on the full feat-source universe.

We should split “all feats usable in feat steps” from “origin feat candidates”:

- feat step source detection: broader, but still curated
- origin feat source detection: narrower and rules-aware

Origin feat candidate logic should prefer:

1. feats granted by enabled background/origin packs
2. packs or folders explicitly aligned with origins/character options
3. feats with no level prerequisite and content signals consistent with origin feats

For premium mixed packs like Heroes of Faerun:

- valid origin feats inside `Character Options` should remain selectable
- display should identify them as coming from a useful logical bucket, not just “Character Options”

### 6. Description Rendering Hardening For Premium Feats

The screenshot shows unresolved syntax in Heroes of Faerun feat text.

The existing formatting path via [compendium-indexer.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/data/compendium-indexer.ts) and [description-formatting.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/utils/description-formatting.ts) should be extended so premium feat text also handles:

- `[[lookup @prof]]` style tokens
- other dnd5e-enriched inline syntax that may survive `TextEditor.enrichHTML`
- mixed markup generated by premium content modules

This is adjacent to the source-selection work because bad source labeling and bad feat rendering currently compound each other in the origin feat UI.

## Proposed Technical Design

## A. Introduce Pack Analysis Metadata

Add a new analysis layer that sits above raw pack detection.

Suggested new structure:

- `DetectedPack`
  - keep current fields
  - add:
    - `displayLabel`
    - `rawLabel`
    - `sourceBadge`
    - `sourceEdition`
    - `contentBreakdown`
    - `sampleItems`
    - `folderHints`
    - `mixedContent`
    - `previewSummary`
    - `qualityScore`

- `CreatorIndexEntry`
  - add optional metadata fields:
    - `folderName`
    - `folderPath`
    - `sourceBadge`
    - `sourceEdition`
    - `contentTag`
    - `packDisplayLabel`

This should live in the character creator data layer, not be invented directly in templates.

## B. Add A Dedicated Pack Analysis Utility

Create a dedicated utility, likely under:

- `/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/data/pack-analysis.ts`

Responsibilities:

- read pack metadata
- inspect `flags.dnd5e.types`
- compute content-type breakdown from index entries
- derive source-vintage badge
- compute display label
- extract compact sample item names
- detect folder-derived labels where available
- score whether a pack is appropriate for each creator content section

This keeps source-detection policy out of:

- templates
- settings forms
- GM config app
- wizard steps

## C. Make Settings Menus Consume Analysis, Not Raw Counts

Update:

- [character-creator-settings-menus.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/character-creator-settings-menus.ts)
- [gm-config-app.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/gm-config/gm-config-app.ts)

Both should consume the same analyzed pack records so the compact submenu and the richer GM config app stay aligned.

Current duplication:

- `character-creator-settings-menus.ts` uses `detectPacks`
- `gm-config-app.ts` uses `_detectContentTypes`

Planned outcome:

- one shared source-analysis function
- one shared filtering policy
- one shared display/preview model

## D. Use Folder Signals Carefully

Folder names should influence display and preview, but not fully redefine pack identity.

Recommended rule:

- if one folder contains the overwhelming majority of matching content for the requested section, use that folder as a display hint
- otherwise keep the pack label and show folder names in the preview

Example:

- `dnd-heroes-faerun.options`
  - pack label: `Character Options`
  - if origin-feat matches cluster under folder `Origin Feats`, show:
    - title: `Heroes of Faerun: Origin Feats`
    - subtext: `from Character Options`

Do not hard-assume every pack has useful folder organization. This should be an enhancement, not a dependency.

## E. Split Feat Filtering Into Two Levels

Introduce two reusable filters:

1. `isPackRelevantForContentType(packAnalysis, type)`
2. `isEntryRelevantForWorkflow(entry, workflow)`

Workflows should include at minimum:

- `creator-feat`
- `origin-feat`
- `equipment`
- `spell`

This gives us cleaner boundaries:

- settings source list uses pack-level relevance
- wizard steps use entry-level workflow relevance

## F. Preview Data Should Be Cached

Pack preview summaries should be precomputed once during source detection and reused.

Do not:

- fetch full documents per hover
- rebuild previews every render
- make hover behavior dependent on expensive async work

Cache invalidation should follow the same rule as the compendium indexer:

- invalidate on pack-source changes
- invalidate on explicit compendium index refresh logic

## Implementation Phases

### Phase 1. Analysis And Metadata Foundation

Deliverables:

- new shared pack-analysis utility
- expanded `DetectedPack` and `PackEntry` metadata
- expanded `CreatorIndexEntry` metadata where needed
- tests for:
  - source-vintage classification
  - feat pack relevance scoring
  - folder-label derivation
  - sample preview generation

Files likely touched:

- [character-creator-settings-menus.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/character-creator-settings-menus.ts)
- [gm-config-app.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/gm-config/gm-config-app.ts)
- [character-creator-types.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/character-creator-types.ts)
- new `pack-analysis.ts`

### Phase 2. Settings UI Improvements

Deliverables:

- richer row titles
- source-vintage badges
- mixed-content badges
- compact hover/focus preview popup
- same behavior in both compendium submenu and GM sources tab

Files likely touched:

- [cc-compendium-select.hbs](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/templates/character-creator/cc-compendium-select.hbs)
- [cc-gm-sources.hbs](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/templates/character-creator/cc-gm-sources.hbs)
- GM/settings stylesheets

### Phase 3. Feat Source Tightening

Deliverables:

- stricter feat-pack inclusion rules in settings
- origin-feat workflow filter separated from generic feat workflow
- regression tests for:
  - incidental monster feature packs excluded from feat selection
  - equipment packs excluded from feat-source lists unless intentionally allowed
  - Heroes of Faerun options pack retained when it contains valid origin feats

Files likely touched:

- [character-creator-settings-menus.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/character-creator-settings-menus.ts)
- [gm-config-app.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/gm-config/gm-config-app.ts)
- [step-origin-choices.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/steps/step-origin-choices.ts)
- [step-feats.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/steps/step-feats.ts)

### Phase 4. Premium Description Rendering Cleanup

Deliverables:

- extend description formatting for remaining premium dnd5e inline syntax
- targeted regression coverage using Heroes of Faerun examples

Files likely touched:

- [description-formatting.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/utils/description-formatting.ts)
- [compendium-indexer.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/data/compendium-indexer.ts)

## Detailed Rules For Feat Pack Inclusion

These rules should be encoded and tested explicitly.

### Include

- dedicated feat packs
- dedicated origin packs that contain feat items
- mixed player-option packs with a meaningful population of creator-facing feats
- official 2024 core-book packs where feats are one of the intended pack contents

### Exclude

- monster feature packs
- packs dominated by equipment/loot with only stray feat records
- packs dominated by NPC/actor support content
- packs whose feat items are really class or monster support documents and not player-selectable creator feats

### Warn But Allow

For edge-case mixed packs:

- show them if they pass the threshold
- mark them as `Mixed`
- expose the breakdown in the preview popup so the GM understands the tradeoff

## Hover Preview UX

### Interaction

- hover on desktop
- focus on keyboard navigation
- tap-to-preview fallback if needed on touch-oriented UIs

### Content

- title
- source badge
- item count
- 5 to 8 example item names
- content breakdown chips
- optional note like `Includes origin feats`

### Constraints

- must not block checkbox interaction
- must not flicker during pointer travel
- should be implemented as a small shared tooltip/popover utility instead of one-off row DOM mutation

## Testing Requirements

Automated coverage should include:

- settings-menu pack detection
- GM config sources grouping
- feat section exclusion of monster/equipment noise
- folder-derived display naming for mixed packs
- source-vintage labeling
- origin-feat candidate narrowing
- preview summary generation
- description-formatting regression for premium feat syntax

Live verification should include:

- `dnd5e` default SRD packs
- `dnd-players-handbook`
- `dnd-heroes-faerun`
- at least one pack that should now be excluded from feats

## Open Questions To Resolve During Implementation

1. Should folder-derived titles appear only in the preview, or directly in the checkbox row title when confidence is high?
2. How aggressive should feat-pack exclusion be for mixed player-option packs?
3. Do we want manual overrides for pack labeling/classification in addition to heuristics?
4. Should the source-vintage badge also appear in creator step cards and detail panes, or stay settings-only for now?

## Recommended Implementation Order

1. Build pack-analysis utility and metadata model
2. Replace duplicate pack detection logic in settings menu and GM config app
3. Add source-vintage badges and hover previews
4. Tighten feat pack inclusion rules
5. Tighten origin-feat workflow filtering
6. Clean up premium feat description rendering

## Suggested Acceptance Criteria

- Heroes of Faerun origin-feat-capable content is no longer presented only as generic `Character Options` when a better folder-derived label is available
- feat source settings no longer show obviously irrelevant monster/equipment packs
- each source row clearly signals 2014 SRD versus 2024-oriented content when known
- hovering or focusing a source row reveals a compact pack preview
- origin feat selection remains able to surface valid premium origin feats
- premium feat descriptions no longer show unresolved inline syntax in the common cases we have already observed
