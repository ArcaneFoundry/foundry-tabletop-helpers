# Foundry Tabletop Helpers

Foundry Tabletop Helpers is a Foundry VTT v13 module for in-person D&D play. It is built around a simple idea: keep Foundry useful at a physical table whether your players prefer paper, tablets, phones, a TV table display, or a GM-operated control surface.

The module currently targets Foundry VTT v13 and is primarily designed for the `dnd5e` system. A few utilities are system-agnostic, but the live sheet, print pipeline, combat tools, rules reference, and character workflows are all centered on modern dnd5e play.

## Current Feature Set

### Live Play Character Sheet

A touch-first character sheet for tablets and phones.

- Compact portrait layout tuned for shared-table play
- Large tap targets and mobile-friendly navigation
- HP management, rests, death saves, conditions, inventory, spells, features, and core rolls
- Auto-open support for assigned player characters
- Kiosk mode for dedicated player devices

### Kiosk Mode

A stripped-down player experience for tablets and always-on table devices.

- Hides Foundry chrome for designated players
- Can disable the canvas entirely or force low-performance mode
- Opens the Live Play Character Sheet in a focused, fullscreen-friendly flow
- Adds a fullscreen button for mobile browsers that require a user gesture

### Print And Preview Sheets

Print-ready or PDF-ready output for multiple actor types.

- Character sheets
- NPC stat blocks
- Party summaries
- Encounter sheets
- Per-sheet default section selection and paper settings
- Preview and print actions from supported sheets
- Smart feature summaries that resolve common dnd5e values into table-ready text

### Combat Command Center

GM-facing combat helpers built for fast live play.

- Batch initiative with normal / advantage / disadvantage handling
- Quick damage, healing, save, and condition workflows against selected tokens
- Token health indicators for NPCs
- Monster Preview panel with live refresh and quick actions
- Party Summary panel for player character combat stats
- Quick Rules Reference panel for D&D 2024 lookups

### Asset Vault

A FilePicker replacement for GMs with a companion server for heavier media workflows.

- Thumbnail grid and list views
- Virtual scrolling for large folders
- Search, sorting, selection, and preview workflows
- Upload presets for images, audio, video, portraits, tokens, and maps
- Optional server-backed optimization and thumbnail generation
- Folder creation and file/folder deletion through the companion server

### Character Creator And Level-Up Manager

Wizard-style dnd5e character workflows for onboarding and progression.

- Class-first character creation flow for 2024 rules content
- GM configuration for curated sources and behavior
- Character creation from wizard selections into a real actor
- Level-up flow for existing characters
- Optional portrait generation through the companion server

### Window Rotation

Utilities for rotating Foundry windows on shared displays.

- Rotate windows in 90 degree steps or flip them 180 degrees
- Per-user rotate button visibility controls
- Rotation macros and API helpers for rotating all open windows
- State persistence across reopen cycles

## Settings Overview

The module now exposes settings across several areas:

- Core utilities: log level, rotation mode, animations, legacy V1 window support
- Print: print access, print defaults, print options dialog behavior
- Kiosk: kiosk players and kiosk canvas mode
- Live Play Character Sheet: enable, auto-open, default tab, death save mode
- Combat: initiative dialog, damage workflows, monster preview, party summary, rules reference, token health
- Asset Vault: enable, server URL/token, optimization behavior, preset overrides
- Character Creator: enablement, auto-open, GM config, source selection, rules options

## Public API

The module attaches a small API to `window.fth` for macros and debugging.

```js
window.fth.rotateAll90CW();
window.fth.rotateAll90CCW();
window.fth.rotateAll180();

window.fth.quickDamage();
window.fth.partySummary();
window.fth.rulesReference();
window.fth.batchInitiative();

window.fth.assetManager();
window.fth.characterCreator();
window.fth.characterCreatorConfig();
window.fth.levelUp("ACTOR_ID");
```

You can also adjust logging from the console:

```js
window.fth.setLevel("debug");
```

## Install

Use the stable manifest URL:

[https://raw.githubusercontent.com/JohnGallego/foundry-tabletop-helpers/main/module.json](https://raw.githubusercontent.com/JohnGallego/foundry-tabletop-helpers/main/module.json)

In Foundry:

1. Open Add-on Modules
2. Click Install Module
3. Paste the manifest URL above

## Server Companion

The optional server companion powers media optimization, thumbnail generation, file management helpers, and portrait generation.

Current server capabilities:

- Image optimization via Sharp
- Audio and video optimization via FFmpeg when available
- Thumbnail generation and thumbnail cache inspection
- Folder creation and file/folder deletion scoped to the configured Foundry data path
- Portrait generation through Gemini when configured

Local development setup:

1. Install root dependencies with `npm ci`
2. Install server companion dependencies with `cd server-companion && npm ci`
3. Build the server companion with `npm run build`
4. Copy `server-companion/config/fth-optimizer.example.env` to a local `.env`
5. Configure at least `FTH_AUTH_TOKEN`, `FTH_ALLOWED_ORIGINS`, and any optional `FTH_FOUNDRY_DATA_PATH` or Gemini settings

The packaged Linux installer at `server-companion/scripts/install.sh` is intended for systemd-based deployments.

Current live deployment note for `foundry.digitalframeworks.org`:

- Foundry itself is managed by `systemd` as `foundry.service`
- The companion server is managed by `systemd` as `fth-optimizer.service`
- Companion deploys update `/opt/fth-optimizer/dist` and then restart `fth-optimizer.service`

## Development

### Prerequisites

- Node.js 20+
- npm 10+
- Git

### Setup

1. Clone the repository
2. Run `npm ci`
3. Run `cd server-companion && npm ci`

### Commands

- `npm run typecheck` - Type-check the module
- `npm run test` - Run the Vitest suite
- `npm run build` - Build the module into `dist/`
- `npm run ci` - Type-check, test, and build
- `npm run build:server` - Build the server companion
- `npm run package:server` - Create the server companion package
- `npm run dev` - Rebuild the module on changes
- `npm run zip` - Build a module zip from `dist/`

### Link Into Foundry

- Windows: `npm run link:foundry`
- macOS/Linux: manually symlink `dist/` into your Foundry Data `modules/` directory

Then enable **Foundry Tabletop Helpers** from Manage Modules.

## Troubleshooting

- Set **Log Level** to `debug` in module settings when investigating issues
- Check browser console logs prefixed with `foundry-tabletop-helpers`
- For server companion issues, verify `/health` first and confirm the configured URL, token, and allowed origin list
- If media optimization is unavailable, confirm FFmpeg is installed and reachable by the companion server

## Notes

- Most feature areas assume a dnd5e world
- The server companion is powerful and should only be exposed to trusted clients
- Releases are built from the repository source, and the manifest in `dist/` is generated from `module.template.json`
