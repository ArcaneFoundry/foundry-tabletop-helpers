@/Users/johngallego/.codex/RTK.md

For cross-repo workflow, kiosk contract, design-system rules, FoundryTester accounts, and Foundry/dnd5e source-of-truth, use the `developing-arcane-foundry-vtt-modules` skill (auto-loaded by Claude Code and Codex).

## Status

**Legacy v13 monolith.** This repo targets **Foundry VTT v13** (the rest of the workspace targets v14). Treat it as:

- A **behavior reference** — read to learn how a feature worked before porting
- A **porting source** — copy logic into the appropriate v14 repo, adapting for Shadow DOM, React-in-Foundry perf rules, and dnd5e current version
- **Not** a target for new features (except the in-flight Character Creator React migration noted below)

No casual v14 assumptions — v13 Foundry APIs differ meaningfully (ApplicationV1 forms, different FilePicker shape, etc.).

## Purpose (historical)

Foundry VTT v13 module for in-person D&D play. Goal: keep Foundry useful at a physical table across paper, tablets, phones, TV displays, and GM control surfaces. dnd5e-focused but with some system-agnostic utilities.

## Stack

- Foundry VTT v13, dnd5e (any 5.x)
- React 19 + Tailwind v4 + Motion 12 (mid-migration from Handlebars)
- Vite 5 + TypeScript + class-variance-authority + clsx + tailwind-merge
- Vitest 4 + Playwright (e2e)
- `@league-of-foundry-developers/foundry-vtt-types` v13 + fvtt-types
- Bundled server companion (`server-companion/`) — **precursor to arcane-foundry-companion-server**, superseded

## Subsystem inventory — what still lives here vs. has been ported

| Subsystem | Status | Successor |
|---|---|---|
| **Asset Vault** (FilePicker replacement, thumbnails, presets, server-backed optimization) | Superseded | `arcane-foundry-media-vault` |
| **Character Creator / Level-Up** (wizard, class-first flow, React migration in progress) | **Partially superseded, mid-migration** | `arcane-foundry-character-forge` (v14 target); this repo is still the reference implementation for Origins/Class/Build flows and the 2024 PHB integration |
| **Combat Command Center** (batch initiative, quick damage/heal/save, monster preview, party summary, rules reference, token health) | Superseded | `arcane-foundry-combat-dashboard` |
| **Theater of the Mind / scene swapping** | Superseded | `arcane-foundry-stage` |
| **Server companion** (Sharp image optimization, FFmpeg, thumbnail cache, folder/delete, Gemini portrait generation) | Superseded | `arcane-foundry-companion-server` (Fastify rewrite, stricter auth + traversal guards) |
| **Live Play Character Sheet** (touch-first, tablet/phone-optimized, HP/rests/conditions/rolls) | **Still canonical here** | No successor yet — this is the only home for the touch-first sheet |
| **Kiosk Mode** (hides Foundry chrome, canvas disable, fullscreen) | **Still canonical here** | No successor yet |
| **Print And Preview Sheets** (character, NPC, party, encounter sheets; PDF-ready output) | **Still canonical here** | No successor yet |
| **Reactive Soundscapes** (Soundscape Studio, live trigger support, music programs, ambience, manual moments, Calendaria weather triggers) | **Still canonical here** | No successor yet |
| **Window Rotation** (90°/180° rotate for shared displays) | **Still canonical here** | No successor yet |

When the user asks "does X exist somewhere?", check the table above before grep-ing the workspace.

## Key entry points that are still canonical

For features that haven't been ported, treat this repo's `src/` as authoritative. Top-level directories include:
- Live Play character sheet implementation
- Reactive Soundscapes (Studio + live controls + trigger system)
- Print pipeline (character, NPC, party, encounter sheets; smart feature summaries)
- Window rotation utilities
- Character Creator (React + Handlebars hybrid, mid-migration — this is the richest source for Origins/Class/Build wizard logic to port into arcane-foundry-character-forge)

Use `cymbal` to navigate. The monolith is large; don't spelunk blind.

## Public API

Attaches `window.fth` with rotation, combat, asset, character creator, and soundscape helpers. See `README.md` for the full list.

## Deployment (still used)

Module path on live server: `/var/foundrydata/Data/modules/foundry-tabletop-helpers/`

```bash
npm run build
rsync -av --delete dist/ root@foundry.digitalframeworks.org:/var/foundrydata/Data/modules/foundry-tabletop-helpers/
```

The legacy `server-companion/` is packaged separately and is superseded by the standalone `arcane-foundry-companion-server` repo. On the live server it runs as `fth-optimizer.service` pointing at `/opt/fth-optimizer/`, but that binary now comes from the new `arcane-foundry-companion-server` repo.

## Live-check identity

- **Test user:** `FoundryTester-Helpers` (GM). Shared password across all `FoundryTester-*` users — see `references/live-server.md` in the `developing-arcane-foundry-vtt-modules` skill for the full table.
- **Isolated Chrome profile:** `.cache/chrome-devtools-mcp/profile` via repo-local `.mcp.json`. Gitignored, collision-free with other module repos running in parallel. This repo is a **legacy v13 reference** — live-checks here are rare but the plumbing exists so they don't collide with active repos when they do run.

## Gotchas

- **v13 Foundry APIs** — don't casually copy v14 patterns in or out. ApplicationV1 sheets, older FilePicker shape, older Hooks, older dnd5e data model.
- **Handlebars + React hybrid** — the Character Creator wizard is mid-migration. Class/Origins/Build run in React; other steps still render in Handlebars via an adapter host.
- **Live Character Creator depends on PHB 2024 pack shapes on the live server.** Any change must stay compatible with current PHB 2024 documents on `foundry.digitalframeworks.org`.
- `package.json` version is `1.2.1` (not `0.x`). This is the oldest, most-shipped repo in the workspace.

## Commands

```bash
npm run typecheck
npm run test
npm run build
npm run ci           # typecheck + test + build
npm run dev          # vite watch
npm run zip          # build a module zip
npm run tarball
npm run build:server
npm run package:server
```
