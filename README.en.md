# Jerusalem Streets — Visit Journal

**Hebrew version: [README.md](README.md)**

A small browser app (no dependencies, no build step) for marking every street in Jerusalem you've walked, with a date and a note, and seeing your progress per neighborhood.

> Note: the app's UI itself is Hebrew-first (RTL) by design — it is a Hebrew product. This file documents it for English readers.

## Running

```bash
npm start          # http://localhost:8787
npm test           # storage-layer tests
```

You can also open `index.html` straight from disk — but a local server is recommended, since some browsers restrict `localStorage` on `file://`.

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
assets/styles.css     styling (CSS variables, light/dark)
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
