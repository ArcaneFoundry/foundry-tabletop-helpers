# Project Hygiene Findings And Improvement Plan

## Findings

### What Is In Good Shape

- The main module currently type-checks, tests, and builds successfully
- Feature coverage is strongest in print sheets, combat helpers, live play sheets, and character creation
- The project has a meaningful automated test suite for the main module

### Main Hygiene Gaps

- Documentation had drifted behind the code, especially the README and the older character creator redesign note
- Root `module.json` metadata had stale GitHub ownership and download URLs
- Some source comments still describe implemented features as placeholders
- The server companion started without automated tests even though it performs the riskiest operations
- The server companion uses deprecated `fluent-ffmpeg`
- Dependency audit noise exists in the root package and should be reviewed intentionally

### Operational Risks

- The server companion can delete files and create folders, so correctness and configuration safety matter more there than in most other feature areas
- Query-string token fallback is convenient for image requests, but it increases the chance of token leakage if the companion is exposed carelessly
- Feature descriptions are spread across README text, module metadata, inline comments, and release notes, which makes drift likely

## Improvement Plan

### Phase 1: Documentation And Metadata

1. Keep the README focused on shipped features only
2. Treat `module.template.json` as the source of truth for release metadata
3. Make sure checked-in `module.json` always matches the current public install path and repository owner
4. Convert outdated plan docs into status docs once work is shipped

### Phase 2: Comment And Naming Cleanup

1. Remove or update stale "placeholder" comments in implemented combat and character-creator files
2. Audit settings labels, hints, and menu names so they match the current UX
3. Standardize feature naming across README, settings, API docs, and release notes

### Phase 3: Server Companion Hardening

1. Expand the existing automated coverage beyond route parsing into processor behavior and failure cleanup
2. Keep adding route-level validation tests for path scoping and error cases as new endpoints are added
3. Review whether query-string auth should remain enabled for all routes or only thumbnail/image use cases
4. Document deployment expectations more clearly, especially trusted-network assumptions and the live `systemd` service model
5. Evaluate replacing deprecated `fluent-ffmpeg` usage

### Phase 4: Dependency And Release Discipline

1. Review and triage the root `npm audit` findings instead of leaving them as ambient debt
2. Add a lightweight release checklist that verifies:
   - `npm run ci`
   - `server-companion` build
   - manifest URLs
   - README feature list
   - server companion config examples
3. Consider a CI check that fails if `module.json` and `module.template.json` drift in incompatible ways

### Phase 5: Documentation Maintenance Workflow

1. Update docs in the same pull request as user-facing feature changes
2. Prefer small status docs over long speculative plans once implementation is underway
3. Add a short maintainer note describing which files are the canonical public docs

## Suggested Priority Order

1. Server companion tests and hardening
2. Stale comments and naming cleanup
3. Dependency review
4. Release checklist and drift checks

## Definition Of Better Hygiene For This Project

Project hygiene here should mean:

- the README matches the shipped feature set
- install metadata points at the real repository
- comments describe current behavior
- risky server-side routes are tested
- releases follow a repeatable checklist
