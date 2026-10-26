# Batch 200 research archive

Selection record for the expansion that took the dataset from **500 to 700 cards** (commit `f4ceb46`, 2026-10-26).

## What is here

| File | Contents |
| --- | --- |
| `next-200.json` | The 200 selected streets: `id`, `name`, `area`, `title` (source article) and the drafted `fact` text, plus `confidence` and `method`. |

## Integrity

- 200 entries, unique ids, exactly the 200 ids of `data/research/batch-200.json`.
- All 200 ids exist in `manual-facts.json`, and all 200 `fact` texts equal the published card text (0 drift).
- No `evidence` quotes were captured for this batch, so this folder cannot be used to re-verify individual claims against an article; it preserves the selection and the drafted wording only.

## Note

Cards from this batch were later edited in place in some cases, so `manual-facts.json` remains the authoritative text. There is no article corpus for this batch.
