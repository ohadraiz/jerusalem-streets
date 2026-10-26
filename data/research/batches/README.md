# Research batch archives

Working evidence for each did-you-know expansion, kept so published cards can be re-checked without re-crawling. Cards live in `data/didyouknow/`; canonical records in `data/research/manual-facts.json`; per-street provenance in `data/research/candidates/`; approval reports in `data/research/batch-*-review.json`.

| Folder | Expansion | Commit | Contents | Evidence quotes | Article corpus |
| --- | --- | --- | --- | --- | --- |
| `200/` | 500 → 700 | `f4ceb46` | Selection + drafted fact text (200) | No | No |
| `350/` | 150 → 500 | `001a388` | First drafts (350), drafting corpus, rewrite pass | No | No |
| `900/` | 700 → 900 | `0916f71` | Drafts with evidence (200), article corpus, candidate pool, digest, scripts | Yes | `articles-900.json.gz` |
| `1100/` | 900 → 1,130 | `a6073ba` | Selection, pool, discovery, drafts with evidence (200), drafting sources, article corpus, scripts | Yes | `articles-1100.json.gz` |
| `shared/` | — | — | Digest of 694 articles, uncovered-street snapshot (1,724), unused candidates (326), selection scripts | — | — |

Only the 900 and 1100 folders support claim-level re-verification: each holds a verbatim `evidence` string per card plus the full article text it came from (gzipped, with SHA-256 recorded in that folder's README).

`manual-facts.json` is always authoritative for the published wording. The archives document how it was produced, and for batches 200 and 350 they intentionally contain earlier text that was later edited.
