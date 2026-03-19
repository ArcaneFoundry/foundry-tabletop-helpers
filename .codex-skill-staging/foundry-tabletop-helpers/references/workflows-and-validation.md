# Workflows And Validation

Use this reference when you need commands, build/deploy steps, validation expectations, or release hygiene reminders.

## Local Prerequisites

- Node.js 20+
- npm 10+

## Main Commands

From the repo root:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run ci`
- `npm run build:server`
- `npm run package:server`
- `npm run zip`
- `npm run tarball`

Companion-only commands from `server-companion/`:

- `npm run build`
- `npm run test`
- `npm run package`

## Build Rules

- The module build runs typecheck, Vite build, and manifest generation.
- Use built artifacts from `dist/` for deployment, not raw source files.
- `module.template.json` is the source of truth for release metadata.
- `module.json` and built manifest output should stay aligned with the real GitHub owner and install/download paths.

## Deployment Targets

Primary host:

- `root@foundry.digitalframeworks.org`

Module deploy target:

- `/var/foundrydata/Data/modules/foundry-tabletop-helpers/`

Companion deploy target:

- `/opt/fth-optimizer/dist`

Companion service:

- `fth-optimizer.service`

Foundry service:

- `foundry.service`

## Deployment Workflow

For module changes:

1. Run the relevant local checks.
2. Build the module.
3. Deploy built artifacts from `dist/` to `/var/foundrydata/Data/modules/foundry-tabletop-helpers/`.
4. Verify deployed files when the task includes live deployment.

For companion changes:

1. Build the companion server.
2. Deploy companion artifacts to `/opt/fth-optimizer/dist`.
3. Restart `fth-optimizer.service` if needed.
4. Verify `systemctl status fth-optimizer --no-pager --lines=20`.
5. Verify the health endpoint.

Do not assume `pm2`; the current live deployment uses `systemd`.

## Validation Expectations

After code changes:

- Run the smallest relevant checks first while iterating.
- Before wrapping up substantial work, run the strongest applicable local validation.
- If the task affects root module behavior, prefer at least targeted tests plus `npm run build`.
- If the task affects the companion server, run companion tests and a companion build when possible.
- If you cannot run a needed check, say so explicitly.

## Documentation And Release Hygiene

When user-facing behavior changes:

- Update `README.md` in the same change.
- Keep status docs current if older planning notes have become misleading.
- Keep manifest metadata and URLs accurate.
- Watch for stale comments that still describe implemented features as placeholders.

Recommended lightweight release checklist:

1. `npm run ci`
2. `npm run build:server`
3. Verify manifest URLs and repository ownership
4. Verify README feature list still matches the shipped build
5. Verify companion config examples and service expectations if server behavior changed
