# Street facts: current state

Status: style upgrade of the 350-fact expansion is COMPLETE and promoted locally. Public commit/push awaits explicit user approval. The separate goal of 1,000 additional facts (1,500 total) has NOT started.

## Completed in this pass

- Reviewed all 350 expansion facts against Hebrew Wikipedia article text.
- Rewrote 260 facts in the approved style: a short factual identification plus a specific, surprising, source-backed detail.
- Kept 90 facts unchanged where the article offered no better detail.
- Re-ran the review gate: 350 approved, 0 rejected.
- Promoted the 350 facts to `data/didyouknow/*.txt` and rebuilt `index.json` as the union of the older 150 and the 350 new IDs (500 total).
- Verified 500 unique IDs, 500 unique facts, all fact files present, no length/duplicate errors.

## Verification at this checkpoint

- `node tools/verify.js`: 38/38.
- `node tests/store.test.js`: 24/24.
- `node tools/make-beta.js --check`: beta copies up to date.
- Localhost browser: index count 500; rewritten facts render in Hebrew/RTL with source; 0 console errors.
- One legacy unindexed txt file remains: `jlm-e6d8607535`; do not remove silently.

## Git state

- All work is local and uncommitted.
- 712 changes under `data/`: 350 new fact files, 350 candidate records, updated `manual-facts.json`, `index.json`, `progress.json`, batch/review metadata.
- `data/research/pilot-50-review.json` was restored to HEAD; the new 350-fact review report is `data/research/batch-350-review.json`.
- Unrelated working-tree changes exist outside `data/`; preserve them. Do not stage `beta.html` or `assets/beta/*`.

## Next steps

1. Obtain explicit user approval, then commit/push only the intended `data/` files.
2. If continuing expansion: target is 1,000 additional facts (1,500 total). About 339 previously fetched candidates remain unused; further work needs new street-name matching and source collection.
3. Temporary research cache: `C:/Users/ohadr/AppData/Local/Temp/opencode/jlm`.
   - `rewritten.json`: per-ID before/after and keep markers.
   - `hooks.json`: 350 articles, but some entries have empty hooks; re-fetch before relying on them.
   - `rewrite-src.json`: facts, titles, intros.
   - `fetch-hooks.js`: supports an optional per-run limit argument; atomic writes.
   - `apply-rewrites.js`, `check-rewrite-years.js`, `show-batch.js`, `show-nohook.js`: QA and application helpers.
4. Research rules remain: no invented facts, no unsupported street-dedication claims, keep Hebrew/RTL, record sources and confidence.
