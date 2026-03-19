# Feature Codepaths

Use this reference when you want the most likely code starting points for a feature area before doing wider search.

## App Bootstrap And Shared Infrastructure

- `src/index.ts`
  - Main Foundry lifecycle wiring and feature initialization.
- `src/fth-api.ts`
  - Public `window.fth` API surface.
- `src/settings.ts`
  - Core settings registration and shared accessors.
- `src/settings-menus.ts`
  - Settings menus and UI-facing configuration flows.

## Live Play Character Sheet

- `src/lpcs/lpcs-sheet.ts`
- `src/lpcs/lpcs-sheet-ui.ts`
- `src/lpcs/lpcs-sheet-actions.ts`
- `src/lpcs/lpcs-view-model.ts`
- `src/lpcs/lpcs-view-model-character.ts`
- `src/lpcs/lpcs-view-model-combat.ts`
- `src/lpcs/lpcs-view-model-inventory.ts`
- `src/lpcs/lpcs-auto-open.ts`

Start here when the task involves the touch-first player sheet, auto-open behavior, tab content, or rendered character data.

## Kiosk Mode

- `src/kiosk/kiosk-init.ts`
- `src/kiosk/kiosk-sheet.ts`
- `src/styles.css`
- `src/lpcs/`

Kiosk behavior is tightly coupled to LPCS boot/open flow, fullscreen handling, and hidden Foundry chrome.

## Print And Preview Sheets

- `src/print-sheet/print-sheet.ts`
- `src/print-sheet/renderers/`
- `src/print-sheet/renderers/viewmodels/`
- `src/print-sheet/section-definitions.ts`
- `src/settings-menus.ts`

Start in renderers and viewmodels for output shape changes; start in settings for default paper/layout behavior.

## Combat Helpers

- `src/combat/combat-init.ts`
- `src/combat/combat-settings.ts`
- `src/combat/batch-initiative/`
- `src/combat/damage-workflow/`
- `src/combat/monster-preview/`
- `src/combat/party-summary/`
- `src/combat/token-health/`
- `src/rules-reference/`

This area is split by workflow. Search inside the relevant subfolder first before exploring the rest of combat.

## Asset Vault

- `src/asset-manager/asset-manager-picker.ts`
- `src/asset-manager/asset-manager-picker-*`
- `src/asset-manager/asset-manager-upload*.ts`
- `src/asset-manager/asset-manager-optimizer-client.ts`
- `src/asset-manager/asset-manager-settings.ts`
- `server-companion/src/routes/`
- `server-companion/src/processors/`

Client picker behavior lives in `src/asset-manager/`; server-backed file/media work lives in `server-companion/`.

## Character Creator

- `src/character-creator/character-creator-init.ts`
- `src/character-creator/wizard/`
- `src/character-creator/steps/`
- `src/character-creator/data/`
- `src/character-creator/engine/actor-creation-engine.ts`
- `src/character-creator/gm-config/`
- `src/character-creator/portrait/`

Use `data/` for compendium parsing and content resolution, `steps/` and `wizard/` for UX flow, and `engine/` for actual actor mutation.

## Level-Up Flow

- `src/character-creator/level-up/level-up-init.ts`
- `src/character-creator/level-up/level-up-app.ts`
- `src/character-creator/level-up/level-up-state-machine.ts`
- `src/character-creator/level-up/actor-update-engine.ts`
- `src/character-creator/level-up/steps/`

Level-up is adjacent to character creator but has its own state machine and actor update path.

## Window Rotation

- `src/window-rotation/index.ts`
- `src/window-rotation/window-rotation-ready.ts`
- `src/window-rotation/window-rotation-helpers.ts`

Start here for macro behavior, button visibility, and persisted rotation state.

## Server Companion

- `server-companion/src/server.ts`
- `server-companion/src/config.ts`
- `server-companion/src/middleware/auth.ts`
- `server-companion/src/routes/`
- `server-companion/src/processors/`
- `server-companion/test/`

When route behavior changes, check both config/auth and the matching tests.
