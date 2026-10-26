# Batch 1200 research archive

Evidence for the fourth expansion after the archive was introduced: **1,130 → 1,226 street facts** (96 new cards), researched on 2026-10-26. Publication commit is recorded in the repository log (`data: expand to 1,226 ...`).

This batch is smaller than its predecessors on purpose. After the 1,100 batch the pool of obvious namesake articles was exhausted: a plain-name search over the remaining streets had already been done for 491 of them, and a street-article search (`intitle:"רחוב X"`) yielded 1 match in 101 attempts. The 96 cards here are the subset of 373 candidates whose article subject is a real namesake (person, place, settlement, historical site, or Jewish topic) rather than a false friend such as a surname page, a film, a song, or a company.

## What is here

| File | Contents |
| --- | --- |
| `batch-1200.json` | The 96 selected streets (id, name, area, Hebrew Wikipedia title). |
| `candidates-1200.json` | All 373 candidates considered, with the matched article title and discovery source. |
| `selected-1200.json`, `rejected-1200.json` | 199 articles that parsed as real articles, and 174 rejected as empty/disambiguation/short. |
| `matches-1200.json` | Local title matching against the full Hebrew Wikipedia title dump (665,549 titles). |
| `search-1200.json`, `search-1200b.json` | Search-pass results for street-article queries and for the never-searched streets; kept for provenance even though the title dump superseded them. |
| `review-1200.txt` | The editorial review list (index, name, area, article title, length, first 105 characters) used to accept or reject each candidate. |
| `facts-1200-01.json` … `facts-1200-04.json` | The 96 drafts (24 each) with `id`, `after` and `evidence`. |
| `draft-src-1200.txt` | Per-street drafting source: intro plus the ten highest-signal sentences. |
| `articles-1200.json.gz` | Full article text for all 373 candidates (656,415 bytes gzipped; 2,243,264 bytes; 373 entries). |
| `scripts/` | Discovery, triage, validation, integration and checking scripts as run. |

## Integrity

- `articles-1200.json.gz` uncompressed SHA-256: `a1c2a88b96c749d620c4d5c61c7c0c91dcaca1d0aeb742bbcfc1885cca0d6e97`.
- Drafts: 96 entries, unique ids, exactly the 96 ids of `batch-1200.json`.
- Every `evidence` string normalizes to a substring of its article text; every published card equals its draft.
- Card lengths: 101–182 characters, average 140.
- Review gate: 96 approved, 0 rejected (`data/research/batch-1200-review.json`).

## Decisions recorded for this batch

- Accepted only articles whose subject can plausibly be the street's namesake. Rejected examples: `אלמוג` (corals), `ברק` (lightning), `דלתון` (kite), `הבושם` (novel), `האומן` (nightclub), `השקמה` (newspaper chain), `מעגל` (geometry), `עסיס` (juice company), `אמרי קלמן` (living person).
- Cards describe the namesake and never assert that the street was named after it; the provenance note in each card says the street name is identical to the personality, place or institution and that no direct street article was found.
- Sources stay in the `source:` line; no URL in the card body.
- The ten protected cards were not touched.

## Known gaps

- A further ~1,198 app streets still have no card. Most have no Hebrew Wikipedia article at all; the remaining realistic route is non-Wikipedia sources (municipal naming lists, neighborhood histories), which the current pipeline does not ingest.
