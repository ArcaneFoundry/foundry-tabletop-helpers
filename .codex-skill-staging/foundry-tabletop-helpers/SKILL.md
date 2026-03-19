---
name: foundry-tabletop-helpers
description: Use for any feature work, bug fixes, refactors, deployment, planning, or skill maintenance in the Foundry Tabletop Helpers repo. Enforces Foundry VTT v13 and latest Foundry dnd5e 5.3.x compatibility, requires consulting the official Foundry API docs and dnd5e repository before planning new work, and points to bundled references for project structure, workflows, deployment, and repo-specific risks.
---

# Foundry Tabletop Helpers

Use this skill for all work in the `foundry-tabletop-helpers` repository.

## Core Rules

- Always target the latest Foundry VTT v13 API.
- Always target the latest Foundry `dnd5e` system version in the `5.3.x` line.
- Never design against outdated Foundry APIs, deprecated entity shapes, or older dnd5e data models when planning or implementing features.
- Before planning or implementing new feature work, consult both:
  - Foundry API docs: <https://foundryvtt.com/api/>
  - Foundry dnd5e repo: <https://github.com/foundryvtt/dnd5e>
- If a change depends on dnd5e compendium structure or entity data, also inspect the official installed content modules on the server. These include the SRD content and the official Player's Handbook, Dungeon Master's Guide, and Monster Manual modules.

## Project Context

This module is for in-person D&D play using Foundry as a shared table tool. Major feature areas include:

- Live Play Character Sheet and kiosk mode
- Print and preview sheets
- Combat helpers
- Asset Vault plus server companion
- Character creator and level-up manager
- Window rotation

Assume most feature work is dnd5e-specific unless the code clearly shows otherwise.

## Planning Workflow

For new features or substantial changes:

1. Review the relevant local code paths first.
2. Consult the latest Foundry v13 API docs.
3. Consult the latest dnd5e repository for current document shapes, apps, compendium behavior, and system patterns.
4. If compendium-backed behavior is involved, inspect the official content modules on the Foundry server before finalizing the approach.
5. Prefer current v13 and current dnd5e patterns over legacy compatibility shims unless the existing codebase already requires a bridge.

Do not rely on memory for Foundry or dnd5e internals when the answer could have drifted.

When feature planning depends on fine-grained D&D 2024 rules behavior, consult the private rulebook library if configured, then cross-check the actual dnd5e system implementation and installed Foundry content before finalizing behavior.

## Rules Research Workflow

Use the right source in the right order:

1. Start with local code to understand the current module behavior.
2. If the task depends on exact 2024 rules intent, consult the private PDF rulebooks first.
3. If the task depends on actual Foundry content shape, inspect the installed official content modules on the live server next.
4. Cross-check the current Foundry `dnd5e` system implementation for how that rule is modeled in practice.
5. If PDFs are unavailable or unclear for a narrow point, use D&D Beyond manually as a fallback cross-check.

Treat the books as the rules authority, and treat installed Foundry content plus the `dnd5e` system as the implementation authority. When those differ in a way that affects the feature, call out the difference explicitly in planning notes.

## Reference Files

Read these bundled references only when they are relevant:

- `references/project-map.md`
  - Read when you need the repo layout, major entry points, canonical docs, or where a feature area lives.
- `references/feature-codepaths.md`
  - Read when you want the fastest likely starting points for a feature area before doing broader code search.
- `references/live-compendium-inspection.md`
  - Read when planning or debugging features that depend on installed Foundry content modules, compendium packs, or current server-side dnd5e data.
- `references/workflows-and-validation.md`
  - Read when you need local commands, build/test expectations, manifest rules, deployment steps, or release hygiene guidance.
- `references/repo-risks-and-status.md`
  - Read when touching the server companion, character creator, documentation, or any area where prior project notes called out risk, drift, or operational constraints.
- `references/private-rules-library.md`
  - Read when a task depends on detailed 2024 D&D 5e rules from the Player's Handbook, Dungeon Master's Guide, or Monster Manual and private local rulebook paths have been configured.

## Server Access

Primary Foundry host:

- `foundry.digitalframeworks.org`

SSH login:

- `ssh root@foundry.digitalframeworks.org`

Foundry module deploy target:

- `/var/foundrydata/Data/modules/foundry-tabletop-helpers/`

Important server-side content to inspect when needed:

- `/var/foundrydata/Data/modules/`

That modules directory also contains the official SRD, Player's Handbook, Dungeon Master's Guide, and Monster Manual modules. Consult them whenever feature planning or implementation depends on compendium content, item/entity import behavior, or source data used by the character creator and related features.

## Validation Expectations

After code changes:

1. Run the relevant local checks.
2. Build the module.
3. Deploy the built artifacts to the Foundry server when the task includes live verification or deployment.
4. Deploy companion server changes too when applicable.
5. Restart services only when required or explicitly requested.
6. If companion services changed, verify `systemctl status fth-optimizer` and a successful companion health check after deployment.

## Documentation Expectations

When feature behavior changes:

- Keep README and other project docs aligned with the current shipped feature set.
- Treat `module.template.json` as the source of truth for release metadata; built output should derive from it.
- Keep manifest metadata, install paths, and repository ownership accurate.
- Flag stale comments or docs when they no longer match the code.
