# Repo Risks And Status

Use this reference when the task touches areas with known drift risk, operational sensitivity, or important status context.

## Current Shipped Feature Shape

The current shipped module centers on:

- Live Play Character Sheet and kiosk mode
- Print and preview sheets
- Combat helpers
- Asset Vault with optional server companion
- Character creator and level-up manager
- Window rotation

Keep new docs and implementation notes aligned with that shipped feature set.

## Character Creator Status

The class-first character creator redesign has largely landed. Current implemented areas include:

- Wizard flow with class, origin, ability, feat, spell, equipment, portrait, and review steps
- Actor creation engine
- Level-up detection and level-up application flow
- GM configuration and source curation
- Portrait generation integration through the companion server

Important cautions:

- Character creation depends heavily on dnd5e compendium structure and upstream system data shape.
- The old redesign filename in `docs/character-creator-wizard-redesign-plan.md` is misleading; the document is now a status note, not an active plan.
- Some stale code comments may still describe earlier placeholder behavior.

## Server Companion Risk Areas

The companion server deserves extra scrutiny because it can:

- Delete files
- Create folders
- Process user-supplied media
- Expose authenticated routes over the network

Pay extra attention to:

- Path scoping and traversal safety
- Auth behavior, including query-string token fallback
- Cleanup behavior after processor failures
- Trusted-network assumptions in docs and deployment notes

The project notes also call out deprecated `fluent-ffmpeg` usage as a future maintenance item.

## Documentation Drift Risks

The repo has already seen drift between:

- `README.md`
- manifest metadata
- status/planning docs
- inline comments
- release-facing install information

When changing shipped behavior, update docs in the same task whenever practical.

## Practical Priorities

If you are choosing where to be extra careful, bias toward:

1. Server companion tests and hardening
2. Stale comments and naming cleanup
3. Documentation and manifest alignment
4. Release discipline around build outputs and install metadata
