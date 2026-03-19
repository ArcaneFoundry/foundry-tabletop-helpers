# Live Compendium Inspection

Use this reference when a feature depends on the actual content and pack layout installed on the live Foundry server rather than only on code assumptions.

## When To Inspect Live Content

Inspect the live server modules when the task depends on:

- Character creator source curation
- Compendium-backed class, subclass, species, feat, spell, background, or item behavior
- Import shape differences between upstream source books
- Rules-reference or lookup features that may derive from shipped content
- Debugging mismatches between local assumptions and real server data

## Server Context

Primary host:

- `foundry.digitalframeworks.org`

SSH:

- `ssh root@foundry.digitalframeworks.org`

Module root containing official content:

- `/var/foundrydata/Data/modules/`

Important installed official modules include the SRD content plus the Player's Handbook, Dungeon Master's Guide, and Monster Manual content modules.

## What To Inspect

Look for:

- Which module folders and pack files are actually installed
- Pack names, labels, and directory layout
- JSON or database-backed compendium content shapes
- How classes, subclasses, species, feats, spells, monsters, and items are represented in practice
- Whether a needed data point exists in installed content or must be inferred from rules/system logic

## Practical Inspection Workflow

1. Confirm the relevant content modules exist under `/var/foundrydata/Data/modules/`.
2. Identify the pack files or source JSON relevant to the feature.
3. Sample the actual records involved in the workflow you are changing.
4. Cross-check those findings against:
   - current dnd5e system code
   - local module parsing/indexing logic
   - any private rulebook references if the behavior also depends on written rules
5. Design against the actual installed data shape, not a remembered or assumed shape.

## Notes For Feature Planning

- Official book content may not map one-to-one to how the dnd5e system models the same rule.
- Some behavior belongs in written rules interpretation, while some belongs in installed compendium structure; check both when the task is subtle.
- For character creator and level-up work, inspect live content early rather than after implementation.
