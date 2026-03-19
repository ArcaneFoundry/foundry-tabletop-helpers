# Project Map

Use this reference when you need to orient yourself in the repo, find the right module to edit, or identify the canonical docs and entry points.

## Top-Level Files

- `README.md`
  - Public-facing feature summary, setup, install, and development commands. Keep it aligned with shipped behavior.
- `module.template.json`
  - Source of truth for release metadata and manifest fields.
- `module.json`
  - Checked-in manifest. Keep compatible with the current public install path and repo owner.
- `package.json`
  - Root module scripts for typecheck, test, build, CI, server build, packaging, and archive creation.
- `scripts/build-manifest.mjs`
  - Generates final manifest fields during build.
- `scripts/link-foundry.mjs`
  - Local linking helper for Foundry development.

## Main Module Entry Points

- `src/index.ts`
  - Main Foundry lifecycle entry point. Registers settings, hooks, styles, feature initializers, and attaches `window.fth`.
- `src/fth-api.ts`
  - Public API builder exposed as `window.fth`.
- `src/settings.ts`
  - Core settings registration and accessors.
- `src/settings-menus.ts`
  - Settings UIs such as kiosk player selection and print defaults.

## Major Feature Areas

- `src/lpcs/`
  - Live Play Character Sheet.
- `src/kiosk/`
  - Kiosk mode setup and kiosk sheet behavior.
- `src/print-sheet/`
  - Print and preview rendering pipeline, templates, and viewmodels.
- `src/combat/`
  - Batch initiative, damage workflow, monster preview, party summary, rules reference, and token health.
- `src/asset-manager/`
  - Asset Vault file picker replacement, upload flows, previews, and optimizer client integration.
- `src/character-creator/`
  - Wizard flow, GM config, compendium-backed data layer, actor creation engine, portrait integration, and level-up logic.
- `src/window-rotation/`
  - Rotation helpers, ready-time hooks, and macro-facing APIs.

## Server Companion

- `server-companion/src/server.ts`
  - Fastify server composition and route registration.
- `server-companion/src/config.ts`
  - Environment-driven config and safety-sensitive path/auth settings.
- `server-companion/src/middleware/auth.ts`
  - Auth enforcement and token handling.
- `server-companion/src/routes/`
  - File operations, optimization, thumbnail, health, and portrait routes.
- `server-companion/src/processors/`
  - Sharp and FFmpeg-backed optimization helpers.
- `server-companion/systemd/fth-optimizer.service`
  - Service unit for live deployment.

## Tests

- Root tests live alongside source in `src/**/*.test.ts`.
- Companion tests live in `server-companion/test/`.
- The module has broader automated coverage than the companion server; keep expanding tests for risky companion routes and cleanup behavior.

## Canonical Docs And Status Notes

- `README.md`
  - Canonical public doc for shipped features and setup.
- `docs/project-hygiene-findings-and-plan.md`
  - Repo-specific maintenance priorities, documentation drift notes, and release hygiene guidance.
- `docs/character-creator-wizard-redesign-plan.md`
  - Despite the filename, this is now a current-state status note for the character creator and level-up flow.

## Search Shortcuts

Use fast local search before making assumptions:

- `rg -n "Hooks.once|window\\.fth|registerSettings" src`
- `rg -n "character creator|level-up|portrait|compendium" src/character-creator`
- `rg -n "asset|thumbnail|optimi|delete-file|mkdir" src/asset-manager server-companion/src`
- `rg -n "print|renderer|template" src/print-sheet`
- `rg -n "combat|monster preview|party summary|rules" src/combat`
