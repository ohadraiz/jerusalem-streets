# Batch 900 research archive

Evidence for the third did-you-know expansion: **700 → 900 street facts** (200 new cards), researched and published on 2026-10-26 in commit `0916f71`.

Cards are in `data/didyouknow/<street-id>.txt`; canonical records in `data/research/manual-facts.json` and `data/research/candidates/<street-id>.json`; the approval report is `data/research/batch-900-review.json`.

## What is here

| File | Contents |
| --- | --- |
| `evidence/facts-900-01.json` … `facts-900-07.json` | The 200 drafts (30/30/…/30 blocks) with `id`, `after` (drafted body) and `evidence` (verbatim substring of the source article). |
| `articles-900.json.gz` | Full crawled article text for the batch, gzipped. 815,063 bytes; 2,886,242 bytes uncompressed; 201 entries (one article fetched but unused). |
| `scripts/` | `validate-900.js`, `integrate-900.js`, `fetch-articles-900.js`, `build-digest-900.js`, `build-batch-900.js` as run. They use absolute paths under the original temp workspace. |

`data/research/batch-900.json` (the selected 200 streets) is already tracked in the repository root of `data/research/`, so it is not duplicated here.

## Integrity

- `articles-900.json.gz` uncompressed SHA-256: `3756e56d578a3e74424999ea2cd59df1990255397cc905bd37858e9c873be500`.
- Drafts: 200 entries, unique ids, exactly the 200 ids of `batch-900.json`.
- Every draft `evidence` string occurs in its article text.
- **195 of 200 drafts equal the published card text.** Five were replaced during review, so their draft text and evidence do not describe the published card; for those the published text in `manual-facts.json` is authoritative:
  `jlm-b659f6e066` (מוג׳יר א־דין), `jlm-903ba36a63` (עזרת תורה), `jlm-9bd94ecbc6` (עמנואל זיסמן), `jlm-849a01f0d6` (רבי חייא), `jlm-6834e9c4b5` (רחבת גטו ורשה).

## Not preserved for this batch

The candidate pool, article digests and drafting source files for batch 900 were not archived (only the drafts and the article corpus). Batches 200 and 350 likewise have no archived evidence files; their published texts are preserved in `manual-facts.json` and the per-street candidate files.
