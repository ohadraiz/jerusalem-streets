# Delegation and Hat Decision Framework

Default to `build` working directly. Specialist hats are checklists, not subagents; choose only the relevant hat from `docs/agents/HATS.md` and open at most one or two.

## Route work

| Need | Route |
|---|---|
| Implementation, research, tests, beta preparation, documentation, integration | `build` directly; apply relevant hat(s) only |
| Independent read-only review | `review`, when requested or justified by risk; specify the changed-file scope |
| Commit, push, or public release operations | `gabbai`, only after explicit user approval for that specific action |

Do not delegate implementation, research, routine testing, beta preparation, or coordination. Do not create new project agents for these tasks.

## Release stop points

- A successful test, beta review, agent report, prior approval, or silence does not authorize publication.
- Verify the current diff and scope; do not stage unrelated or ambiguous changes.
- Require successful project checks and beta/localhost verification before public release.
- Git write operations require confirmation; force-push, published-history rewrite, and untested publication are prohibited.

When using `review`, provide the goal, exact files/scope, relevant contracts, and desired report format. `review` must remain read-only and cannot approve a release.
