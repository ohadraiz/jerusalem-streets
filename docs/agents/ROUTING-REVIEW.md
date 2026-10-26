# Landing routing migration: review handoff

Status: local preparation only; no commit, push, or publication authorized or performed by this task.

## Contract and scope

- `/` and `index.html` redirect to `welcome.html`; query and fragment are preserved.
- Standalone detection remains for older installed apps whose saved launch URL is `/`. New installations launch `app.html` directly. Manifest identity `./`, scope `./`, and production storage key remain unchanged.
- `welcome.html` and `app.html` are self-canonical and listed in the sitemap. The redirect is `noindex,follow`; beta remains `noindex` with no installation manifest or PWA script.
- SW navigation cache lookup ignores the query string before falling back to the journal. This preserves landing/journal routes offline and on HTTP 503, including under a project-path deployment.
- No storage schema, store code, map interfaces, or unrelated functionality changed.

Review files: `index.html`, `app.html`, `welcome.html`, `manifest.webmanifest`, `sw.js`, `sitemap.xml`, both README files, `tools/make-beta.js`, `tools/prepare-publish.js`, `assets/beta-tools.js`, `tools/tasks-dashboard.js`, `tools/guli-room.js`, `beta.html`, `internal/index.html`, `internal/tasks.html`, `internal/guli.html`, `tests/routing.test.js`. `tasks-data.json` is an official tasks-generator output. Existing architecture-documentation edits are concurrent work, not newly implemented here.

## Verification

- Official generators run: `node tools/make-beta.js`, `node tools/tasks-dashboard.js`.
- PASS `node tools/verify.js`: 37/37.
- PASS `node tests/store.test.js`: 24/24.
- PASS `node tests/routing.test.js`: normal/standalone/iOS redirects, query/hash, PWA identity, existing visits, beta storage isolation, offline and 503 navigation using the actual SW fetch handler in a mocked environment.
- PASS `node tools/make-beta.js --check`.
- PASS `node --check` for changed JS sources and the new regression test.
- PASS local file and fragment checks across index, welcome, app, beta and the three existing internal dashboards.
- Git confirms both `index.html` and `app.html` are tracked in the index. Concurrent work has staged changes; this task did not stage, unstage, commit, or publish anything. Review both staged and unstaged diffs, plus the new untracked test and this handoff.

## Targeted browser results

Localhost desktop Chromium: root resolves to welcome; `?pwa=1#faq` is preserved. Journal and beta load without console errors. A synthetic visit survives journal reload; a beta save leaves the production key unchanged (beta test state restored). Active SW cache contains root/index/welcome/app. Manifest has `start_url: ./app.html`, stable identity/scope, standalone display, and all manifest icons return HTTP 200.

Not verified on hardware: Android/iOS installation, legacy installation manifest refresh, real cold offline launch, file-URL behavior, or deployment to GitHub Pages. Offline/503 behavior is covered by regression tests and cache inspection, not a claimed hardware/network-disconnection test.

## Architecture and remaining gates

Only `build.md`, `review.md`, and `gabbai.md` are present in `.opencode/agents`; build is primary and the latter two are scoped subagents. On-demand hats remain checklists. No new internal application pages or obsolete specialist-agent configuration were introduced. Historical dashboards/documents are not a reason to delete concurrent work.

Independent read-only review was attempted but could not run: provider returned `Go usage limit exceeded`. This is a remaining review gate, not an approval. Re-run independent review before release, then complete real-device installation/offline checks as appropriate. Exclude unrelated concurrent research/data changes and the staged PDF deletion when selecting a future release scope; do not stage the whole working tree blindly.
