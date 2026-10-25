# Project Work Protocol

This on-demand workflow reference supplements `AGENTS.md`; it is not automatically loaded. Keep requests scoped and preserve project safety gates.

## Request card

For non-trivial work, summarize:

```text
- Goal: <one line>
- Scope: <files or paths allowed to change>
- Out of bounds: <contracts, generated files, publication, etc.>
- Verification: <checks appropriate to the change>
- Status: <result, untested items, next step>
```

An explicit `micro:`, `small:`, `medium:`, or `large:` prefix self-classifies the request. Do not extend scope without a new approval when the request requires a stop point.

## Default workflow

1. Use `build` directly for implementation, research, testing, beta preparation, documentation, and integration.
2. Consult `docs/agents/HATS.md` only when domain-specific expertise is relevant; open only one or two applicable hats. Hats are checklists, not separate agents or permissions.
3. Read targeted context; do not load full boards, channels, research collections, or generated data by default.
4. Run `node --check <changed-js>` for changed JavaScript and the standard project checks `node tools/verify.js` and `node tests/store.test.js` when applicable.
5. Use `review` only for an independent read-only review requested or justified by risk. Keep the scope specific.
6. For user-facing changes, preserve the beta gate and verify in beta or localhost before requesting explicit user approval. Never edit generated beta files by hand.
7. Use `gabbai` only for release operations after explicit user approval for the specific commit, push, or publication action.

## Stop points

- User approval is required before public changes, commit, push, or publication. Agent approval, test success, prior approval, or silence is not approval.
- Do not force-push, rewrite published history, or publish untested changes.
- Keep beta storage (`jlm-street-journal-beta-v1`) separate from production storage (`jlm-street-journal-v1`).
- Do not change protected APIs, DOM IDs, LOD 12, storage schema, or approved data-source/license boundaries without explicit approval.
- Preserve user-facing Hebrew/RTL, accessibility requirements, security controls, and OSM/ODbL attribution.

## History and documentation

Historical decisions and agent work logs are retained under `docs/agents/`; see `docs/agents/archive/README.md`. They are not live routing instructions. Avoid creating per-agent channels, duplicate handoffs, or new coordination records unless specifically requested.
