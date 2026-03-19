# Private Rules Library

Use this reference when a task depends on detailed 2024 D&D 5e rules text from the Player's Handbook, Dungeon Master's Guide, or Monster Manual.

Do not copy full copyrighted book text into this skill. Instead, store private source locations and consult the smallest relevant excerpts when needed.

## Recommended Source Priority

1. Local PDF copies of the 2024 core books
2. D&D Beyond, used manually as a fallback or cross-check
3. Installed Foundry content modules, for actual implementation data shape
4. Current dnd5e system source code, for how rules are modeled in practice

## Best Practice

- Prefer local PDFs as the primary deep rules reference because they are stable, searchable, and available without a live website session.
- Use D&D Beyond as a manual lookup fallback, not as an automated integration target.
- Treat the books as rules authority and Foundry/dnd5e content as implementation authority.
- When the rules text and the system behavior differ, note the difference explicitly during planning.

## Suggested Private Setup

Add absolute file paths for your private rulebooks here once they are available on disk:

- `PLAYER_HANDBOOK_2024_PDF=/Volumes/Cloud/D&D/pdf/core-books/players-handbook.pdf`
- `DUNGEON_MASTERS_GUIDE_2024_PDF=/Volumes/Cloud/D&D/pdf/core-books/dungeon-masters-guide.pdf`
- `MONSTER_MANUAL_2024_PDF=/Volumes/Cloud/D&D/pdf/core-books/monster-manual.pdf`

Optional notes:

- preferred section naming conventions
- whether OCR is good enough for text search
- any duplicate or alternate editions to ignore

## Workflow When A Task Needs Deep Rules Knowledge

1. Find the narrow rules question first.
2. Open the smallest relevant section from the local PDF.
3. Summarize the rule in working notes instead of copying long text.
4. Cross-check how the current dnd5e system and installed Foundry content express that rule.
5. Implement or plan against both the written rule intent and the actual data shape the module must consume.

## D&D Beyond Guidance

- Keep D&D Beyond as a human-accessed backup source.
- Avoid building scraping or automation around it unless you later decide to maintain a dedicated private ingestion workflow and have verified the legal and operational tradeoffs.
- If a rule lookup comes from D&D Beyond rather than the local PDFs, say so in planning notes because site presentation and navigation can change.
