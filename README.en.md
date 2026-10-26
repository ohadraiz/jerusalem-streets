# Jerusalem Streets — Walking Journal

**Hebrew version: [README.md](README.md)**

A free Hebrew-first, RTL walking journal for Jerusalem: mark streets you have visited, add a date, note and rating, and track progress by neighborhood — with no account or server.

## Use it

**Live site:** [ohadraiz.github.io/jerusalem-streets](https://ohadraiz.github.io/jerusalem-streets/)

- [Landing page](https://ohadraiz.github.io/jerusalem-streets/welcome.html)
- [Journal](https://ohadraiz.github.io/jerusalem-streets/app.html)

You can also open `app.html` directly in a browser. There is no install, build step or external dependency: Leaflet and the application files are vendored locally. The local server is only needed for development and checks:

```bash
npm start          # http://localhost:8787
npm test           # storage-layer tests
npm run verify     # structure and integrity checks
```

## Features

- **2,424 streets across 95 neighborhoods**, with coordinates and geometry.
- Hebrew search, neighborhood/status filters, and list sorting.
- Visit records with date, note, 1–5 rating, and mood.
- An interactive map showing streets and visit state, with links to Google Maps.
- Statistics, neighborhood progress, achievements, and manual neighborhood completion.
- Random street, custom streets, undoable deletion, and paginated lists.
- JSON export/import for backup or moving the journal to another device.
- Light/dark theme, voice feedback, sound/vibration feedback, keyboard shortcuts, and screen-reader support.
- A “Did you know?” fact-card collection about streets and neighborhoods.
- PWA support: after the first visit, the app and data work offline; map background tiles require a network connection.

## Street data

The dataset is in `assets/data.js` and is updated from OpenStreetMap data under the ODbL license. The current dataset is version 3, updated on October 21, 2026, based on a Geofabrik extract from October 20, 2026. Map tiles use OpenStreetMap, OpenStreetMap DE, or OpenTopoMap depending on availability.

## Privacy and backups

Visits are stored locally in the browser under `jlm-street-journal-v1`; there is no account or cross-device sync. Use JSON export to back up or transfer the journal. Beta data is isolated under `jlm-street-journal-beta-v1`.

## Beta environment

Changes are checked first in the [beta environment](https://ohadraiz.github.io/jerusalem-streets/beta.html), never directly on the public site. `beta.html` is generated from `app.html` and must not be edited by hand:

```bash
node tools/make-beta.js
node tools/make-beta.js --check
```

## Workflow architecture

- `build` is the primary implementation role and handles research, testing, documentation, and integration directly.
- `review` is an independent, read-only reviewer with a defined scope.
- `gabbai` performs release operations only, after explicit approval for the specific action.
- Domain expertise is loaded on demand as hats from `docs/agents/HATS.md`; hats are not additional agents.
- The internal workflow center and task dashboard are generated from source documents by `tools/guli-room.js` and `tools/tasks-dashboard.js`.

Decision and task history remains under `docs/agents/` for lookup, but it is not active routing configuration.

## Project structure

```
welcome.html          landing page and explanation
app.html              the journal
assets/data.js        street dataset
assets/app.js         journal, search, filter, and statistics logic
assets/map.js         map and tile layers
assets/store.js       storage, sanitization, backup, and import/export
assets/geo.js         street geometry
assets/dyk-facts.js   “Did you know?” cards
sw.js                 service worker and offline support
tests/store.test.js   storage-layer tests
tools/verify.js       project checks
```

## License and sources

Street data and geometry: © OpenStreetMap contributors, ODbL. Leaflet 1.9.4 is vendored locally under the BSD-2-Clause license.
