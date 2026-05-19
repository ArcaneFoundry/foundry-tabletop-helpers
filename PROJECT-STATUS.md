# Foundry Tabletop Helpers - Project Status

> Last updated: 2026-05-08 (docs sync)

## Purpose

Foundry Tabletop Helpers is the legacy Foundry VTT v13 monolith for in-person D&D table support. It remains useful as behavior reference and porting source, but new v14 feature work should normally land in the focused `arcane-foundry-*` repos.

## Status Snapshot

- **Current state:** Legacy module at version 1.2.1 on `main`. The repo still builds and ships the v13 module, but most major subsystems now have v14 successors across the Arcane Foundry workspace.
- **Verification:** Available local commands are `npm run typecheck`, `npm run test`, `npm run build`, and `npm run ci`. This 2026-05-08 docs sync did not rerun them.
- **Next step:** Use this repo only to answer legacy behavior questions or to port a specific unported subsystem. Before porting, confirm the destination repo and write/update that destination's plan/status doc rather than adding new feature scope here.
- **Where to read:** `AGENTS.md` contains detailed legacy guidance; this snapshot keeps the current cross-repo status short.

## Current Role

Treat this repo as:

- **Behavior reference** for historical v13 implementations.
- **Porting source** when moving a specific feature into a focused v14 Arcane Foundry module.
- **Maintenance-only target** for the legacy deployment path unless the user explicitly asks for a v13 fix.

Do not assume v14 Foundry APIs here. This repo uses older v13 Foundry surfaces and a Handlebars/React hybrid shape in several areas.

## Subsystem Map

| Legacy subsystem | Current status | Successor / note |
|---|---|---|
| Asset Vault | Superseded | `arcane-foundry-media-vault` |
| Character Creator / Level-Up | Partially superseded | `arcane-foundry-character-forge`; this repo remains a reference for older Origins/Class/Build flow details |
| Combat Command Center | Superseded | `arcane-foundry-combat-dashboard` |
| Theater of the Mind / scene swapping | Superseded | `arcane-foundry-stage` |
| Server companion | Superseded | `arcane-foundry-companion-server` |
| Live Play Character Sheet | Superseded for active v14 work | `arcane-foundry-live-sheet`; this repo remains historical reference |
| Kiosk Mode | Superseded for shared runtime policy | `arcane-foundry-core` plus consumers such as `arcane-foundry-live-sheet` and `arcane-foundry-stage` |
| Reactive Soundscapes | Superseded for active v14 work | `arcane-foundry-soundsmith`; this repo remains historical reference |
| Window Rotation | Superseded for shared runtime policy | `arcane-foundry-core` |
| Print and preview sheets | Not yet actively ported | Port only after a concrete v14 destination and scope are chosen |

## Verification Contract

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run ci` for the combined local gate

Live checks are rare for this legacy v13 repo. If needed, use the `FoundryTester-Helpers` GM seat and keep evidence under `output/playwright/`.

## Next Recommended Step

No broad cleanup or new feature work is recommended here. The next useful action is a targeted port decision for the remaining unported print/preview sheet work: identify the destination repo, define the v14 scope, and copy only the behavior needed for that slice.
