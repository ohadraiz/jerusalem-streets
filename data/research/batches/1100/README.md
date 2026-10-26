# Batch 1100 research archive

Durable record of the fourth did-you-know expansion: **930 → 1,130 street facts** (200 new cards), researched and published on 2026-10-26.

Published commit: `a6073ba` (`data: expand to 1,130 street facts with source-backed details`).

The cards themselves live in `data/didyouknow/<street-id>.txt`; the canonical records are in `data/research/manual-facts.json`, `data/research/candidates/<street-id>.json` and the approval report `data/research/batch-1100-review.json`. This folder keeps the working evidence that those files were derived from, so any claim can be re-checked without re-crawling.

## What is here

| File | Contents |
| --- | --- |
| `batch-1100.json` | The 200 selected streets (id, name, area, Hebrew Wikipedia article title). |
| `pool-1100.json` | Candidate pool of 258 streets considered for this batch, with match kind. |
| `pool-list.txt` | Pool listing with the opening paragraph of each candidate article. |
| `search-1100.json`, `topics-1100.json`, `matches-1100.json` | Discovery artifacts: search hits, topic/person split, article-to-street matches. |
| `facts-1100-01.json` … `facts-1100-07.json` | The 200 drafts, 33/30/28/28/28/28/25 entries. Each entry has `id`, `after` (the published body text) and `evidence` (a verbatim substring of the source article). |
| `draft-src.txt` | Drafting source lines per street: article intro plus top-ranked sentences. Intros are truncated at 230 characters, so never quote evidence past that point. |
| `draft-extra.txt` | Extra drafting blocks for the two replacement streets (ארץ חפץ, שבת צדק). |
| `rest-01.txt` … `rest-05.txt` | The 137-entry article digest, split into 28/28/28/28/25 blocks for drafting. |
| `articles-1100.json.gz` | Full crawled article text for all 200 selected streets — the source of truth for every `evidence` string. Gzipped: 1,017,689 bytes; uncompressed 3,613,582 bytes; 200 entries. |
| `scripts/` | The pipeline scripts exactly as run (they contain absolute paths under the temp workspace; adjust `DIR` if re-running). |

## Integrity

- `articles-1100.json.gz` uncompressed SHA-256: `f59ac5da203f7400c09b32cf95ab6a5884554bee0967636fe28af27729380121`.
- Draft entries: 200, unique ids, 100% present in `batch-1100.json` and in `manual-facts.json`.
- Every `evidence` string normalizes to a substring of its article text; every published card text equals its draft `after`.
- Card lengths: min 129, max 214, average 174 characters (limit 340).

To re-check:

1. `node -e "require('zlib')"` or any gunzip; decompress `articles-1100.json.gz`.
2. For each entry in `facts-1100-*.json`, collapse whitespace in `evidence` and in `articles-1100.json[id].text` and confirm the evidence occurs in the text.
3. Compare `after` with `data/research/manual-facts.json`.

## Decisions recorded for this batch

- Pool entries אלקנה (`jlm-5716cad357`, Virgilijus Alekna, Lithuanian discus thrower) and באכר (`jlm-ad74eaf6d0`, Otto Henry Bacher, American artist) were wrong name matches and were excluded before drafting. They were replaced by ארץ חפץ (`jlm-5fe156e881`, מעלות דפנה) and שבת צדק (`jlm-e4ba1cea31`, אבו בסל / נחלאות).
- Cards name the namesake in neutral phrasing (`<name>, ...`) and do not assert a street-naming link when it is not documented; the provenance note in each card says the street name is identical to the personality or institution name and that no direct street article was found.
- Sources stay in the `source:` line of each card file so the app renders them; no URL appears in the card body.
- Two wordings were corrected after integration and before publication: רפפורט ("אבי המשפחה" instead of "שאביה") and נווה שאנן (the unsupported naming inference was removed; the Isaiah 33:20 reference added). The drafts here contain the corrected text.
- The ten protected cards (זכרון טוביה, אהל משה, המערבים, מאוריצי גוטליב, פלוגת הכותל, כובשי קטמון, בית דוד, סוכת שלום, עץ חיים, דרך גן החיות) were not touched or duplicated.

## Known noise in the repository, not from this batch

- 15 pre-existing entries have `didyouknow`/`candidate` text that does not match `manual-facts.json` (ids outside this batch, left by an earlier hand edit).
- 25 pre-existing entries have no candidate file.
- A legacy unindexed file `data/didyouknow/jlm-e6d8607535.txt` now has a card (ישעיהו).
