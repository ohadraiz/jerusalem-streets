# Shared selection corpora

Snapshots used to choose which streets to research, kept because they are not reproducible without a fresh crawl.

| File | Contents | State |
| --- | --- | --- |
| `digest.json` | 694 condensed article digests: `id`, `name`, `area`, `title`, `type`, `ex` (article extract). Covers all 200 streets of batch 200 and all 350 of batch 350. | 2026-10-25/26 |
| `uncovered-724.json` | 1,724 streets with coordinates and English names, used as the pool of streets still lacking a card. Of these, 430 now have cards (1294 still uncovered). | 2026-10-26 |
| `unused-good.json` | 326 candidate matches that passed the quality filter but were not used in their batch; 270 have since received cards. | 2026-10-26 |
| `scripts/pick-next-200.js`, `scripts/pick-next-200-v2.js` | Selection of the 200 streets for batch 200 from the candidate pool. |
| `scripts/validate-next.js` | Validation of the batch-200 drafts (length, duplicates, artifacts). |
| `scripts/build-rewrite-src.js` | Built `rewrite-src.json` for batch 350. |
| `scripts/apply-rewrites.js` | Applied the chunked rewrites (`rewrite-*.json`) to the drafted facts. |
| `scripts/validate-facts.js` | General facts validator used during the 200/350 work. |
| `scripts/build-candidates-300.js` | Candidate builder for a 300-street selection round. |
| `scripts/verify-index.js` | Index consistency check. |

The scripts carry absolute paths under the original temp workspace; adjust paths before re-running. They are archived as provenance, not as a supported toolchain.

Note: `uncovered-724.json` and `unused-good.json` are dated snapshots. Counting them against today's `manual-facts.json` gives the numbers above; the live state must be recomputed from `data/didyouknow/index.json`.
