# Batch 350 research archive

Drafting and rewrite trail for the expansion that took the dataset from **150 to 500 cards** (commit `001a388`, 2026-10-25), including the 260 enrichment edits made in the same release.

## What is here

| File | Contents |
| --- | --- |
| `facts-batch-01.json` … `facts-batch-07.json` | The 350 first drafts: `id`, `name`, `area`, `title`, `fact`, `confidence`, `method`. |
| `rewrite-src.json` | The drafting corpus used for the style rewrite: per street `id`, `name`, `fact` (pre-rewrite), `title`, `intro`, `len`, `area`, `hookScore`, `digits`. |
| `rewritten.json` | The rewrite pass, as an object keyed by street id: `{ fact: { old, new } }` for all 350 streets. |
| `rewrite-01.json` … `rewrite-12.json` | The same rewrites in the 12 chunks that were produced and merged, each entry `{ id, fact }`. |

## Integrity

- `facts-batch` files: 350 entries total, unique ids, exactly the 350 ids of `data/research/batch-350.json`; every id has a card in `manual-facts.json`.
- `rewrite-src.json`: 350 entries, unique ids, same 350 street ids.
- `rewritten.json`: 350 keys, same ids, each holding an `old`/`new` pair.
- **No file here is byte-identical to the published text.** 260 of the 350 first drafts differ from the published card, and all 350 rewrite results received a further editorial pass (for example `תוכננו ב-1928` became `ותוכננו בשנת 1928`). `manual-facts.json` is authoritative; these files document how the text evolved, not its final form.

## Note

No article corpus or evidence quotes were captured for this batch, so claims cannot be re-verified from this folder alone.
