# Repository Architecture

This guide describes the current static application, data ownership, development workflow, and boundaries for future cleanup. It does not authorize a deployment, migration, or deletion.

## Current shape

```text
root                     Stable website routes, hosting metadata, and serve.js
assets/                  Browser code, styles, icons, Leaflet, and generated data
assets/beta/             Generated isolated beta copies; do not edit by hand
data/didyouknow/         Runtime fact index and per-street fact/citation files
data/research/           Fact research inputs, candidates, reviews, and progress
tools/                   Validation, data/fact builders, beta and dashboard tools
tests/                   Read-only automated tests
docs/                    Guides, agent workflow, research, and historical records
.opencode/               Active build, review, and gabbai agent configuration
internal/                Generated internal dashboards and their entry page
backups/                 Local recovery copies; ignored by Git and never auto-cleaned
```

The application is deliberately static and dependency-light. `package.json` has no runtime dependencies or lockfile; Node is used for local tools and tests. Do not introduce a bundler, framework, database, or new package without a concrete need.

## Routes and runtime

- `/` serves `index.html`. Normal visitors go to `welcome.html`; installed standalone PWA launches go to `app.html`. Query strings and fragments are retained.
- `welcome.html` is the public landing page. `app.html` is the interactive journal and remains the installed-app URL.
- `beta.html` is generated from `app.html`; its code copies live under `assets/beta/`, and its storage key is `jlm-street-journal-beta-v1`.
- `versions.html` is a manually maintained history page. `internal/` contains internal dashboards, not application runtime.
- The manifest retains `id` and `scope` `./`, with `start_url` `./app.html`. `sw.js` precaches the application shell and runtime data, handles offline navigation, and keeps facts in a separate cache. Map tiles are network-fetched and are not part of the application cache. Note: `assets/map.js` currently defines OpenStreetMap, OpenStreetMap DE, and OpenTopoMap endpoints, while `AGENTS.md` approves OpenStreetMap as the only tile/data source. Resolve that policy mismatch separately; this audit does not change tile behavior.
- `assets/store.js` owns browser persistence and backup import/export. Production storage is `jlm-street-journal-v1`; do not change its schema, key, or stable street IDs without explicit approval.

## Data ownership

| Data | Authoritative/current role | Generated or derived role |
|---|---|---|
| Street records and stable IDs | `assets/data.js` is the checked-in runtime snapshot | `tools/build-app-data.js` writes it and `assets/geo.js` from three command-line inputs plus seed/retirement rules. Those source inputs are not currently represented by one documented, reproducible in-repository command; do not assume these large outputs can be regenerated from the tracked research folder alone. |
| Street geometry | `assets/geo.js` is the checked-in runtime geometry; preserve `JLM_GEO`, IDs, and LOD behavior | Produced alongside `assets/data.js` by `tools/build-app-data.js`; input paths are supplied externally. |
| Fact display behavior | `assets/dyk-facts.js` is runtime code, not the fact-content database | It fetches the index and street-specific text files. |
| Accepted “Did You Know?” content | `data/didyouknow/<street-id>.txt` carries runtime fact text and citations; `index.json` selects which IDs are displayed | `tools/research-didyouknow.js` creates/reviews candidates and promotes approved material to text files plus an index. Promotion and research can update many files; inspect the exact status/diff and coordinate with active fact research before running it. |
| Research evidence | `data/research/` contains inputs, candidate records, reviews, batches, progress, and logs. These are not browser user data. | Cache files may be reproducible, but candidates, review decisions, and evidence are not automatically disposable. Keep them unless individually assessed and explicitly approved for archival/removal. |
| User journal | Browser `localStorage`, owned by `assets/store.js`; export/import JSON is the user's portable backup | Not generated from repository data. Never copy, migrate, or publish user records as part of data or research work. |

Research flow: source and manual inputs → per-street candidates and reviews → human-approved facts with citations → `data/didyouknow/*.txt` and `index.json` → on-demand browser display and offline cache. Research files and browser visit records have different owners and lifecycles.

## Storage and privacy boundaries

- **Public Git repository:** tracked source, documentation, research, and runtime files are publicly readable. Selective website publishing would not make repository content private.
- **GitHub Pages:** the repository contains no checked-in Pages workflow or deployment manifest. With the current root-style Pages setup, files in the published source can be addressed by URL; `robots.txt` and `noindex` are discovery controls, not access controls. Confirm the exact source branch/folder in GitHub settings before changing deployment assumptions.
- **Local development:** the working tree includes ignored local files and uncommitted work. `backups/` is excluded by `.gitignore`; preserve all existing recovery copies.
- **Browser storage:** `localStorage` is device/browser-local. It is not in Git, the website, or the Service Worker cache. Exported journal JSON is user data.
- **Offline/PWA storage:** the Service Worker caches application files and fact content, not the user's visit records. Cache names and lifecycle are runtime contracts; preserve them unless a tested PWA migration is approved.
- **Supermemory:** assistant context storage is separate from the repository, GitHub Pages, local backups, and browser storage. Do not treat it as an application data source or user-data backup.

## Development and verification

```sh
npm start
npm test
npm run verify
node tests/routing.test.js
node tools/make-beta.js --check
```

`serve.js` is the local static development server. `tools/verify.js` checks JavaScript syntax, storage tests, street/geometry invariants, and expected data sizes. The routing regression test covers root routing, PWA identity, beta storage isolation, and offline/503 navigation. Run `node --check <changed-js>` for changed JavaScript files.

After an application-source change, beta is generated only with `node tools/make-beta.js`; then require `node tools/make-beta.js --check` and localhost/beta verification. Never edit `beta.html` or `assets/beta/*` by hand. Do not run fact/data generators during concurrent research or without the exact intended inputs and reviewed output scope.

## Release, deployment, and recovery

The public site is GitHub Pages at the existing project URL. This repository does not declare a GitHub Actions Pages workflow, so the actual Pages source configuration must be confirmed in the repository settings. No deployment, publishing, or hosting change is implied by this guide.

`tools/prepare-publish.js` is a separate static-copy helper documented for manual Netlify Drop. It is not the current Pages configuration and deletes its chosen target directory before copying. Do not use it on an existing or valuable path. Its explicit file list is a useful starting point for evaluating a reproducible minimal deploy artifact, not an approved replacement publishing pipeline.

Before a release: run project checks, check generated beta consistency, verify the exact change locally/in beta, inspect the complete diff and public files, preserve a rollback reference, then obtain explicit user approval for the specific publication. No commit, push, publication, or deployment is authorized by these instructions.

`backups/` contains local recovery snapshots and is intentionally ignored. Keep the current working version and every retained backup, including the user-designated v1.2.1 stable recovery reference. Repository metadata does not identify a snapshot named v1.2.1, so confirm which local snapshot represents it before restoring. Restore by copying the selected snapshot to a separate working location and validating it; never rewrite published Git history. `versions.html` is the sole product release-history source; `package.json` is a private tooling manifest and carries no product version. Do not infer or declare a release version during maintenance.

## Documentation and agent workflow

- Keep concise current guides in `docs/`; keep historical decisions available under `docs/agents/archive/` and its index. Do not load boards, research archives, or histories automatically.
- `AGENTS.md` is the only automatically loaded project instruction file. `opencode.jsonc` points to it and disables unused built-in agents. `docs/agents/HATS.md` is the index for on-demand hats in `docs/agents/hats/`.
- The active OpenCode roles are `build` (implementation/integration), `review` (independent read-only review), and `gabbai` (release operations only after explicit approval). Domain hats live under `docs/agents/hats/`; load only relevant hats on demand.
- `docs/agents/`, research files, internal dashboard sources, and generated status/dashboard files remain publicly accessible in the repository and may also be exposed by root-style Pages. Keep secrets and private diagnostics outside the repository. Whether to stop publishing internal material or move to an allowlisted runtime artifact requires a separately approved deployment change.

## Recommended boundaries (not a migration plan)

Keep the existing static runtime paths and stable URLs. Continue using `assets/` for browser runtime, `data/` for canonical/runtime facts and research, `tools/` and `tests/` for local workflows, `docs/` for guides/history, `.opencode/` for the three active roles, and ignored local storage for backups. Do not relocate runtime assets, research evidence, dashboards, or historical records until dependencies, routes, reproducibility, and user approval are established.
