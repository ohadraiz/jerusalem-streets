# On-demand Hats

Hats are short, reusable checklists for `build`; they are not agents, approval gates, or a reason to delegate. This index is not automatically loaded. For each task, open only the most relevant one or two files. If no specialized domain is involved, open none.

| Task scope | Hat |
|---|---|
| UI, interaction, RTL, accessibility | `hats/ux-accessibility.md` |
| Interactive map, tiles, map rendering, LOD | `hats/maps.md` |
| Street data, geometry, OSM | `hats/data-osm.md` |
| External research, sources, facts | `hats/research.md` |
| Search visibility, metadata, SEO/GEO | `hats/seo-geo.md` |
| PWA, service worker, offline, mobile | `hats/mobile-pwa.md` |
| Tests, beta isolation, verification | `hats/testing-beta.md` |
| Hosting, deployment, rollback | `hats/deployment.md` |

Selection rules:

1. Use the task scope, not the list of available hats, to select a hat.
2. Combine hats only when a change genuinely crosses domains (for example, a map touch interaction may need UX and maps).
3. A hat does not grant extra permissions or replace user approval, automated checks, beta verification, or `review`/`gabbai` where those apply.
4. Do not copy hat contents into `AGENTS.md`, prompts, or routine handoffs. Report the hat only when it materially affected the work.
