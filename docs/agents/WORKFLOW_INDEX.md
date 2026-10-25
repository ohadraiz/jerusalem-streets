# Workflow Documentation Index

This on-demand index is not automatically loaded. `AGENTS.md` is the only automatically loaded project instruction; open only the reference required for the current task.

| Need | Read |
|---|---|
| Choose domain checklists | `docs/agents/HATS.md`, then only the relevant hat file(s) |
| Request and approval workflow | `docs/agents/PROTOCOL.md` |
| Independent review | `.opencode/agents/review.md` |
| Release operations | `.opencode/agents/gabbai.md` |
| UI, RTL, accessibility | `docs/agents/hats/ux-accessibility.md` |
| Maps, tiles, LOD | `docs/agents/hats/maps.md` |
| Street data, geometry, OSM | `docs/agents/hats/data-osm.md` |
| Research, APIs, sources | `docs/agents/hats/research.md` |
| SEO/GEO | `docs/agents/hats/seo-geo.md` |
| Mobile/PWA/offline | `docs/agents/hats/mobile-pwa.md` |
| Testing and beta | `docs/agents/hats/testing-beta.md` |
| Hosting/deployment | `docs/agents/hats/deployment.md` |
| Historical decisions and role logs | `docs/agents/archive/README.md` (look up only when needed) |

## Routing

- `build` handles work directly and applies relevant hats as checklists.
- `review` is optional, independent, read-only, and scoped to the requested review.
- `gabbai` is only for release operations after explicit user approval for the specific action.
- No other specialist or coordination agents are part of the active architecture.

Workflow documentation is maintained in English; user-facing application content remains Hebrew and RTL.
