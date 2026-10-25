# Context and Token Efficiency — Operating Notes

This is an operational reference, not an application change.

## Current loading policy

- Only `AGENTS.md` is listed as an automatically loaded project instruction.
- Hats, protocol, and history are on-demand references. Open only the relevant hat or targeted history section.
- `BOARD.md` and `TASKS.md` are history/state stores, not permanent prompt context.
- Keep handoffs short; use `/compact` only within the same goal and `/new` for a new goal.

## Proven baseline measurements

- Local OpenCode baseline: `v2.1.1`; `opencode stats --help` supports `--days`, `--project`, `--cost`, and `--json`.
- A previous isolated instruction-only experiment compared 20 workflow documents against `AGENTS.md` alone.
- Reported per-request metrics:

| Metric | Full glob | `AGENTS.md` only |
|---|---:|---:|
| Input tokens | 309,840 | 6,349 |
| Cache-read tokens | 0 | 1,408 |
| Input + cache-read | 309,840 | 7,757 |
| Output tokens | 7 | 7 |
| Reported cost | $0.0464855 | $0.00101559 |

- This was a short isolated experiment, not a monthly forecast. Do not infer savings for another task without a matched rerun.
- `input` and `cache.read` are separate metrics; report both when measuring cost/context.

## Standard session lifecycle

1. Create one request card: goal, scope, out-of-bounds, verification, status.
2. Check `git status --short`; locate files with targeted search.
3. Read only the required sections.
4. Execute the smallest valid change or investigation.
5. Run checks appropriate to the change.
6. Summarize changed files, results, untested items, and next step.
7. If work remains, write a 100–250-word handoff in `TASKS.md`.

## Loading map

| Topic | Read first |
|---|---|
| Previous decision/task state | Targeted section of `BOARD.md` / `TASKS.md` |
| UI, RTL, accessibility | `docs/agents/hats/ux-accessibility.md` |
| Map, tiles, LOD | `docs/agents/hats/maps.md` |
| Data and geometry | `docs/agents/hats/data-osm.md`, `docs/DATA-PIPELINE.md` |
| Research and sources | `docs/agents/hats/research.md` |
| Beta and testing | `AGENTS.md`, `docs/agents/hats/testing-beta.md` |
| PWA/mobile | `docs/agents/hats/mobile-pwa.md` |
| Deployment | `docs/agents/hats/deployment.md` |
| Delegation | `SUBAGENT_DECISION_FRAMEWORK.md`; only `review` and `gabbai` remain subagents |

## Non-negotiable rule

Token savings never justify omitting beta separation, explicit approval, storage separation, fixed contracts, LOD 12, or OSM licensing rules. Delegate only when genuine expertise or isolation adds value; request a concise report, not full files.
