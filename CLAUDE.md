# Foundry Tabletop Helpers (LEGACY)

Legacy Foundry VTT **v13** monolith for in-person D&D play. Treat this repo as a behavior reference and porting source for the newer v14 repos (media-vault, character-forge, combat-dashboard, lorekeeper, companion-server), not a target for new features — except the in-flight Character Creator React migration.

**Load the `foundry-vtt-workspace` Claude Code skill before any work in this repo.** It owns every workflow rule (cymbal-first navigation, Sonnet subagent delegation, TDD, code review, mockup-first UI, deploy-then-live-check, CLI-over-MCP) and the subsystem inventory of what has been ported out vs. what is still canonical here. Per-repo detail: `~/.claude/skills/foundry-vtt-workspace/references/repos/foundry-tabletop-helpers.md`.

Repo-specific rule: this repo targets Foundry **v13** (the rest of the workspace is v14) — never casually copy v14 patterns in or out. ApplicationV1 sheets, older FilePicker shape, older Hooks, older dnd5e data model.

Still-canonical-here subsystems (no v14 successor yet): Live Play Character Sheet, Kiosk Mode, Print Sheets, Reactive Soundscapes, Window Rotation. See the skill's per-repo reference for the full inventory.

This file is intentionally minimal. Everything else lives in the skill.
