# Jerusalem Streets — Visit Journal

**Hebrew version: [README.md](README.md)**

A small browser app (no dependencies, no build step) for marking every street in Jerusalem you've walked, with a date and a note, and seeing your progress per neighborhood.

> Note: the app's UI itself is Hebrew-first (RTL) by design — it is a Hebrew product. This file documents it for English readers.

## Running

**Just open `index.html` in a browser** — the app runs straight from the file, with no install, no build step and no server. Every library is vendored locally (`assets/vendor/leaflet`), and the map also works from `file://` (tiles come from OSM DE, because OSM blocks requests without a Referer).

```bash
npm start          # http://localhost:8787 — local dev server, for development and tests only
npm test           # storage-layer tests
```

The local server is optional: it is convenient for development, for exercising the `http://` path (where OSM is the primary tile provider) and for preparing the online deployment. On `file://` some browsers (Safari) restrict `localStorage` — the app detects that and shows a notice instead of breaking.

## Deploying online

**The site is already live:** `https://ohadraiz.github.io/jerusalem-streets/` (GitHub Pages, `main` branch).

This is a static site: **no build step and no dependencies** — upload the whole folder to any static host with HTTPS and you get a URL, no commands involved.
Full guide (hosting options, required HTTP headers, CSP, PWA and caching): [`docs/agents/teams/online-deployment.md`](docs/agents/teams/online-deployment.md).

Once installed (PWA) the app also opens **with no internet connection** — after one visit the list, the marks and the map are cached locally; only the background tiles need a connection.

## Beta environment (before publishing)

Every change is verified in **beta** first, never directly on the public site: `https://ohadraiz.github.io/jerusalem-streets/beta.html`

- `beta.html` is generated from `index.html`: `node tools/make-beta.js` (`--check` before publishing). Never edit it by hand.
- Beta data is stored under a separate key (`jlm-street-journal-beta-v1`) and never touches the real journal.
- The tool panel offers device sizes (390/430/820), 25 sample visits, reset, and JSON export/import.
- Changes that affect the public site ship behind a flag (`window.JLM_BETA` / `html.is-beta`) until the user explicitly approves them. The process is coordinated by the **Pitchei** agent — [`.opencode/agents/pitchei.md`](.opencode/agents/pitchei.md).

## Features

- 75 seed streets grouped by neighborhood (`assets/data.js`) — a partial list, easy to extend.
- Mark a visit in one click, with a date (default: today) and a free-form note.
- Hebrew search that ignores niqqud and gershayim, filtering by neighborhood and by status.
- Statistics: total, visited, remaining, completion percentage, and a breakdown per neighborhood.
- Adding a street that isn't in the list.
- JSON export/import, and reset.
- Hebrew and RTL, dark/light theme, keyboard navigation, `aria-live` announcements on every action.

## Structure

```
index.html            single screen (RTL)
assets/data.js        seed street list
assets/store.js       storage: load, sanitize, persist, backup, export/import
assets/app.js         filtering, rendering, events, statistics
assets/map.js         map layer (Leaflet) + tile-provider chain + local canvas fallback
assets/styles.css     styling (CSS variables, light/dark)
assets/vendor/leaflet Leaflet 1.9.4, vendored locally (BSD-2-Clause) so the file works without a CDN
serve.js              static dev server (no dependencies)
tests/store.test.js   unit tests for the storage layer
.opencode/agents/     the project's agents (shifu, mappy)
```

## Data model

Stored in `localStorage` under `jlm-street-journal-v1`:

```json
{
  "schema": 1,
  "visited": { "yafo": { "date": "2026-10-21", "note": "coffee" } },
  "custom": [{ "id": "custom-...", "name": "New street", "area": "Neighborhood" }]
}
```

Principles:

- **The ID is the contract.** A street's `id` never changes, because that is what is saved on the user's side. Renaming the display name is safe; changing the `id` loses the visit history.
- Every input (local or imported) goes through `sanitize`: bounded lengths, date in `YYYY-MM-DD` format, duplicate IDs rejected.
- Corrupt data is **not** overwritten: loading returns `corrupt`, a copy is saved under `jlm-street-journal-v1:corrupt:<timestamp>`, and the user sees a warning banner.
- Import rejects files that aren't a valid journal backup (missing `visited`/`custom`, or empty), to avoid accidentally wiping data.

## Agent workflow

| Agent | Role | Boundaries |
|---|---|---|
| **Main** | implements, fixes, forwards questions and follow-up tasks | writes code |
| **Shifu** (`shifu`) | reviews the code at every stage and returns findings by severity | read-only, does not edit |
| **Mappy** (`mappy`) | completes the street list by neighborhood and sets up the map connection | research only, does not edit |
| **Tsiri** (`tsiri`) | plans the interactive map that updates based on visits | planning only, writes only to its own channel |
| **Chiki** (`chiki`) | researches online data sources, APIs and datasets, verifies them in practice | research only, writes only to its own channel |

Agents never talk to each other directly — they correspond through `docs/agents/BOARD.md` and the channels in `docs/agents/channels/`, and the main agent relays between them and decides what gets implemented.

The loop: Shifu reviews → the main agent fixes → Shifu reviews again, until no blocking findings remain. In parallel, Mappy brings data and specs, Tsiri plans the map, and the main agent implements.

## Known limitations

- The street list is partial (75 of thousands). Full completion awaits Mappy's data pipeline.
- No visual map and no per-street Google Maps link — planned.
- All data stays local to a single browser; no sync between devices (but there is export/import).
