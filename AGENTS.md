# Project Instructions — Jerusalem Streets Journal

This is the only automatically loaded project instruction file. Other workflow notes and hats are on-demand references; never load them all by default.

## Default operating rules

- One goal per session. Use `docs/agents/PROTOCOL.md` when request classification or approval flow needs clarification.
- Use targeted search and bounded reads. Do not load full boards, channels, research, backups, or generated data automatically.
- For ordinary coding, read only relevant source files; do not read `BOARD.md`, `TASKS.md`, or diagnostics unless the request requires them.
- Reuse unchanged context, batch independent safe operations, and keep tool output concise.
- Historical decisions and agent logs are retained under `docs/agents/` for lookup, not automatic context. Read only a relevant entry when requested or necessary.
- Use no emojis in agent responses, status reports, task descriptions, handoffs, or agent-to-agent communication; use plain text labels such as `PASS`, `WARNING`, `PENDING`, and `BLOCKED`.
- At completion, report changed files, checks/results, untested items, and next step.

## Required verification and release gates

- JavaScript change: `node --check <changed-js>`.
- Standard checks: `node tools/verify.js` and `node tests/store.test.js`.
- After beta generation: `node tools/make-beta.js --check`.
- No public change before beta/localhost verification and explicit user approval. Agent approval or silence is not approval.
- `beta.html` and `assets/beta/*` are generated; never edit them by hand. Beta storage is `jlm-street-journal-beta-v1`, separate from `jlm-street-journal-v1`.

## Fixed project boundaries

- User-facing application language remains Hebrew and RTL.
- UI changes require WCAG AA, 44px touch targets, visible focus, and appropriate `aria-live`.
- Do not change `JLMAPI`, `JLMBus`, `JLM_GEO`, DOM IDs, LOD 12, or storage schema without explicit approval.
- OpenStreetMap (ODbL) is the only approved tile/data source.
- No force push, published-history rewrite, or untested publication.
- One agent owns a file at a time. Never run overlapping edits concurrently.

## Main agent, hats, and the two remaining subagents

- `build` handles work directly and applies only relevant on-demand hats from `docs/agents/HATS.md`; hats are checklists, not agents, and must not be loaded as a bundle.
- Use `review` only when an independent, read-only review adds value or is requested.
- Use `gabbai` only for release operations, and only after explicit user approval for the specific release action.
- Never delegate routine implementation, research, testing, beta preparation, or coordination to removed specialist agents.

## On-demand references

- Hat selection: `docs/agents/HATS.md` (then open only the relevant hat)
- Request workflow: `docs/agents/PROTOCOL.md`
- Historical records: `docs/agents/archive/README.md`
- Public site: https://ohadraiz.github.io/jerusalem-streets/
- Beta: https://ohadraiz.github.io/jerusalem-streets/beta.html
