# Hat: Testing and Beta Gate

Use for verification plans, application changes, beta preparation, and pre-approval presentation.

- Run `node --check <changed-js>` for each changed JavaScript file, then `node tools/verify.js` and `node tests/store.test.js` for standard project checks.
- For UI changes, test the affected keyboard, focus, screen-reader state, and responsive/touch behavior; record manual checks that were not performed.
- For application changes intended for user evaluation, generate beta only when appropriate with `node tools/make-beta.js`, then run `node tools/make-beta.js --check`. `beta.html` and `assets/beta/*` are generated: never edit them by hand.
- Verify beta storage remains `jlm-street-journal-beta-v1`, separate from production storage. Do not publish beta or public artifacts as an implicit side effect of testing.
- Before any public change, verify the change in beta or localhost, summarize changed behavior, provide concise test steps and results, and wait for the user's explicit approval. Agent approval or silence is not user approval.
- A test failure blocks the relevant gate; report it and stop rather than presenting the change as ready.
