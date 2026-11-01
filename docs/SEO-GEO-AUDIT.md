# SEO, AI search, and browser-agent audit

Audit date: 2026-10-30 (Jerusalem). Scope: repository working tree and
`https://ohadraiz.github.io/jerusalem-streets/`. Changes are local only.
No staging, commit, push, publication, or new public URL is authorized. The owner
subsequently approved only the local root canonical/noindex change recorded below.

## Assessment and priorities

The landing page already provides substantial Hebrew HTML without JavaScript:
purpose, features, registration, local storage, offline limitations, starting links,
OSM attribution, FAQs, and one attributed historical example. It is not an empty SPA.
The app has semantic regions, labels, skip links, status announcements, keyboard
shortcuts, a street-list alternative to the map, and source-bearing fact dialogs.
Titles, social metadata, branding, Hebrew language, and RTL agree. Self-canonicals
distinguish the explanatory landing page from the interactive journal.

| Priority | Finding | Impact / effort | Disposition |
| --- | --- | --- | --- |
| 1 | Host-level robots.txt is 404; project file does not govern crawling | High / medium, separate host ownership | Approval proposal below |
| 2 | Live root is a 200 noindex JavaScript router, not an HTTP redirect | High potential discovery friction / medium | Local canonical/noindex fix approved and implemented; actual index impact unmeasured |
| 3 | Landing said 150 facts; runtime index contains 1,305 cards | High factual clarity / low | Corrected, with count regression check |
| 4 | Privacy/offline copy overpromised no network requests and automatic PWA installation | High trust/accuracy / low | Narrowed to implemented behavior |
| 5 | Historical facts lack crawlable HTML entry points and stable reader-facing citations | High content opportunity / medium | Small editorial index proposed, not generated |
| 6 | Leaflet zoom names were English; map alternative not directly linked in map instructions | Medium agent usability / low | Localized names and added links |
| 7 | Source links, desktop controls, and attribution/beta links had small targets | Medium accessibility / low to medium | Landing and follow-up control/attribution fixes implemented |
| 8 | Large app data and eager fact precaching deserve measured mobile performance work | Medium / medium | Measure first; no PWA/data loading changes |

No ranking, indexing, or AI-citation improvement has been measured. There was no
authenticated access to Search Console, Bing Webmaster Tools, crawler logs, or
field Core Web Vitals. HTTP access with a bot User-Agent is not evidence that the
real vendor has crawled or indexed the site.

## Live HTTP observations

Observed using direct HTTP fetches without JavaScript, plus isolated headless Chrome.

| URL/path | Response and relevant behavior |
| --- | --- |
| `https://ohadraiz.github.io/robots.txt` | 404, GitHub Pages HTML error |
| `/jerusalem-streets/` and `index.html` | 200; `noindex,follow`; no HTTP Location; short static purpose and two real links |
| `welcome.html` | 200; `index,follow`; self-canonical; complete static landing content |
| `app.html` | 200; self-canonical; no noindex; static shell/FAQ, runtime streets require JS |
| `robots.txt` under project path | 200 text/plain; ineffective as host crawler policy |
| `sitemap.xml` | 200 XML; only welcome and app URLs |
| `beta.html` | 200; noindex; canonical to app |
| `internal/index.html`, `tasks.html` | 200; noindex,nofollow |
| HTTP project root | 301 to HTTPS |
| HTTPS project path without trailing slash | 301 to slash version |
| Fact index, sampled Ben Yehuda text, styles, map script, social screenshot | 200, appropriate content types |

Googlebot, bingbot, OAI-SearchBot and PerplexityBot User-Agent requests for the
landing page all returned the same 200 and 27,355 bytes before local changes.
No authentication/challenge was encountered. These requests did not originate
from verified crawler IPs and do not prove access from those networks.

The project robots file has root paths such as `/beta.html`, not
`/jerusalem-streets/beta.html`. Copying it unchanged to the host root would also be
wrong. Merely changing the subdirectory file cannot fix the effective policy.
Existing noindex tags remain the actual observed HTML exclusion mechanism.
Robots/noindex are not access controls: research/internal files may still be public.

## Root routing: initial proposal and approved local implementation

The current root script selects welcome for normal browsers and app for installed
standalone launches, retaining query and fragment. A noscript meta refresh selects
welcome; static anchors also exist. Non-JS HTTP crawlers do not receive an HTTP
redirect. Google documents that initial noindex can prevent rendering, so do not
assume the script consolidates root signals onto welcome. Long-term following of
links on a noindex page is not a reliable discovery strategy.

Keep direct welcome/app links and the existing sitemap. The owner explicitly
approved removing root noindex and adding a canonical to welcome while retaining
the exact standalone/query/fragment router. This is now implemented locally, not
published; Google can ignore canonical hints. This canonical/indexing-policy change
requires root raw-HTML review, old-install standalone tests, offline/503 routing,
and URL Inspection before/after. A larger alternative is serving full landing HTML
at root and consolidating welcome, but that is a separately designed routing change.
Do not pretend GitHub Pages project files provide configurable server redirects,
and do not serve different SEO content based on a crawler User-Agent.

## Search, training, and user-initiated fetches

Official documentation consulted during this audit:

- [Google robots introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google generative AI optimization](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Bing crawler reference](https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0)
- [Bing robots configuration](https://www.bing.com/webmasters/help/how-to-create-a-robots-txt-file-cb7c31ec)
- [OpenAI crawler reference](https://platform.openai.com/docs/bots)
- [Perplexity crawler reference](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

| Agent | Documented purpose | Implication |
| --- | --- | --- |
| Googlebot | Google Search crawl/render/index | Needed for Search; normal SEO applies to Google's AI features |
| bingbot | Standard Bing search crawling | Keep public pages/resources available; use Bing tools to verify coverage |
| OAI-SearchBot | ChatGPT search discovery | Independent of GPTBot training permission |
| GPTBot | Content potentially used for foundation-model training | Owner must decide, separately from search visibility |
| ChatGPT-User | User-triggered retrieval, not search indexing | OpenAI says robots rules may not apply |
| PerplexityBot | Search discovery, not foundation-model training | Keep approved public search content crawlable |
| Perplexity-User | User-triggered retrieval | Vendor says generally ignores robots rules |

No bot rules were changed. Absence of effective host robots restrictions is not
an affirmative owner decision to permit training. Proposed next step: establish
who controls the account-level Pages root (or choose an owned host) and approve a
project-scoped policy. This must not accidentally govern other account projects.
Keep beta/internal noindex readable; blocking their crawling can prevent reading
noindex, and a blocked URL may still appear without indexed content. Any crawl
exclusions and optional training opt-out must be reviewed together. When defining
specific bot groups, repeat applicable exclusions instead of assuming wildcard
groups merge into them. Submit the existing sitemap directly in webmaster tools
even without a host-level Sitemap directive.

No llms.txt, special AI schema, fabricated reviews, or automatic training opt-in
was added. Google says special AI text files/schema are not required for its AI
Search features. There is no demonstrated maintenance-backed use case here for a
second machine-readable summary duplicating the existing HTML.

## Historical-story discoverability: approval proposal

The authoritative runtime index contains 1,305 unique street IDs matching active
streets. The landing's 2,424 streets and 95 neighborhoods match runtime data.
Fact text and citations are fetched through buttons and shown in a dialog. The
JSON index is an API-shaped ID list, not an HTML link directory. Raw text is public,
but is difficult to discover through normal page links, and the dialog has no
reader-facing permalink. The landing already has one attributed historical example;
do not duplicate it unnecessarily or rewrite its history during this audit.

Recommended approval scope: one lightweight Hebrew public HTML story index, with
10–20 editor-selected, genuinely useful entries, each with street/neighborhood,
unchanged accepted text, source anchors, provenance dates labeled correctly, and
an honest route into the journal. Use existing stable IDs as anchors only after
the URL design is approved. Generate from accepted runtime files, never research
candidates; escape text and validate sources; provide a deterministic `--check`.
Do not invent deep links that the current app cannot resolve. Decide ownership,
refresh trigger, canonical, inclusion in sitemap, and correction/removal behavior
before publication. No generation or research-pipeline edits happened here.

Only consider a handful of standalone story pages after this pilot demonstrates
reader value and there is enough unique sourced material. One short fact per page
across thousands of streets would be thin, costly, and unnecessary. Expansion
requires separate approval for permanent URLs and maintenance.

## Implemented local changes

- `welcome.html`: fact count corrected; historical-source discovery instructions;
  accurate storage/network/offline limitations; truthful content-update date.
- `app.html`: prominent direct search link, linked list alternative to map,
  accurate privacy/offline text, removal of unverified full-accessibility/testing
  claims, JSON-LD modification date aligned with actual edits.
- `assets/map.js`: standard Leaflet zoom control with Hebrew accessible titles;
  no tile policy, map geometry, LOD, or public API change.
- `assets/app.js`: browser visit/undo testing revealed a null details-panel access
  when clicking Undo after the visited row was rerendered as unvisited. Guarded
  the lookup; persistence and undo semantics are unchanged.
- `assets/landing.css`: source links have 44px targets and bounded wrapping.
- `assets/styles.css`: linked map alternative has a 44px target and accent color.
- `sitemap.xml`: only the two existing lastmod values changed to the actual content
  edit date, not a data/research date. URLs and indexing decisions are unchanged.
- `tests/seo.test.js`: metadata, local links/fragments, JSON-LD syntax/basic values,
  visible data counts, existing exclusions, sitemap allowlist and date checks.
- Beta regenerated with `tools/make-beta.js`, never hand-edited.

Existing uncommitted historical facts/candidates/manual research changes were
identified first and left untouched. No historical fact, citation, street ID,
research pipeline, manifest identity, storage schema, or service worker changed.

## Verification and limitations

Required commands:

```sh
node tools/verify.js
node tests/store.test.js
node tests/routing.test.js
node tests/seo.test.js
node tools/make-beta.js --check
node --check assets/app.js
node --check assets/map.js
node --check assets/beta/app.js
node --check assets/beta/map.js
node --check tests/seo.test.js
```

Project verify: 39/39; store: 24/24; routing: PASS; SEO: PASS; generated beta: PASS.
XML is additionally parsed locally, JSON-LD is JSON-parsed and checked against
visible implemented app features. This is not schema.org's remote validator or a
Google rich-result eligibility certification. No ratings/pricing/reviews were
invented to satisfy a rich-result validator. Existing WebApplication describes
the actual free browser app; a landing FAQ does not require FAQPage markup.

Browser checks use isolated headless Chrome via CDP, not the user's real profile.
Live checks are read-only; visit/undo is tested only in local beta storage.
At 360/390/430 widths the landing and app have no horizontal overflow. The local
landing source targets meet 44px. Search finds Ben Yehuda with a live result
announcement; the fact dialog exposes four source links, Escape closes it and
returns focus to its trigger. AX tree exposes purpose headings, search/searchbox,
named regions, and street-specific visit/fact actions. Local map zoom controls
have Hebrew names and 44×44 targets. Visit updates progress and live text; Undo
restores progress, with beta storage isolated from production. Live landing
content is available with script execution disabled.

The final repeat of this browser flow completed with no JavaScript exceptions;
the first run exposed the Undo null-panel issue described above. The complete
machine-local report and CDP harness are under the approved temporary directory,
not published application files. They are point-in-time evidence, not a permanent
cross-browser test suite.

Follow-up accessibility fixes increase the measured desktop controls, app footer/map
attribution links, and beta-tool controls to 44px targets. Do not claim full WCAG
conformance from this sampled flow. Real NVDA/VoiceOver,
exhaustive contrast, all dialogs/focus traps, complete keyboard form flows, and
real mobile devices were not exhaustively tested. Changes retain existing visible
focus rules and do not modify control colors except the existing accent-text token.

App data is about 453KB and geometry 2.56MB uncompressed. Live CSS/JS/text responses
are gzip-compressed. `sw.js` attempts to precache every fact at installation, not
only facts opened by the user; shell/fact caching can fail. Landing CSS is not in
the install precache list (although runtime fetching may cache it). These explain
why offline claims must be conditional. No network/cache strategy was altered.
One warm headless run observed app load around 609ms live and 302ms local beta;
these are not comparable field performance results, Lighthouse scores, LCP/INP,
or an optimization benefit. Use throttled cold mobile tests and field data before
approving loading/cache changes.

Independent read-only review was requested with exact changed-file scope. It was
blocked by the review agent's usage limit; no independent approval was obtained.
Re-request focused review before release. The local server used port 8789 because
8787 was already occupied; the existing server was not stopped.

## Next approval decisions

1. Host-root robots ownership and project-scoped search/training policy.
2. Root canonical/indexing change is approved locally only; release approval and
   subsequent Search Console verification remain pending.
3. Small editorial story-index pilot and permanent URL design.
4. Separately resolve the documented tile-provider policy mismatch; this audit
   did not approve OpenTopoMap or change fallback providers.
5. Re-run independent review, review local/beta changes, then request explicit
   approval for the precise commit/push/publication. No publication is implied.

## Continuation: touch targets and keyboard verification

On owner request to continue, the independent review was retried once and failed
again with the same usage limit. No independent review result or release approval
is claimed. Policy/routing/story URL proposals remain unapproved and unchanged.

- `assets/styles.css`: minimum 44px targets for core desktop buttons, search result
  count, street/neighborhood names, neighborhood breakdown rows, and expandable
  summary controls. App footer and Leaflet attribution links now have larger
  targets; footer links use the existing contrast-oriented accent-text token.
- `assets/beta-tools.js`: beta badge, close button, device/data action buttons, and
  links have 44px targets; explicit visible focus covers badge/close/toggle too.
  This source file is not a hand-edited generated beta asset.
- Generated beta CSS refreshed using the existing generator.
- Chrome checked 360/390/430 widths with touch emulation: no horizontal overflow
  or visible sub-44px targets in the sampled initial beta view. The fact dialog
  retained keyboard focus through 12 native Tab presses, showed a solid 2px focus
  outline, and Escape returned focus to the street fact trigger. Visit/Undo still
  restored progress without browser exceptions or production storage writes.

These are local presentation changes, not crawler-policy or public-content URL
changes. Exhaustive dialog/form states and assistive technologies still require
their own accessibility review.

## Approved continuation: root canonical

The owner selected explicit local approval to remove `index.html` noindex and add
a canonical pointing to the existing `welcome.html` URL, preserving all redirect
code, standalone/iOS detection, query strings, and fragments. The router script,
noscript fallback, manifest, service worker, and sitemap URL list are unchanged.
This is a canonical hint, not a server redirect or a guarantee of consolidation.
Beta/internal noindex remains unchanged. Search/training policies and story URLs
are not included in this approval; no publication is authorized.

Changed files: `index.html`, `tests/routing.test.js`, `tests/seo.test.js`, this audit.
Routing regression expectations now reflect the approved canonical instead of the
old root noindex. Added missing-matchMedia/iOS fallback cases, encoded multi-value
query retention, fragment retention, and project-path resolution checks. Existing
PWA identity, storage isolation, and offline/503 route cases remain in place.

Verification after the root edit: project verify 39/39, store 24/24, routing, SEO,
beta consistency and changed-test syntax all pass. Extracted root inline JavaScript
passes `node --check` and is byte-for-byte identical to the HEAD router script.
Local Chrome navigation confirms ordinary root visits reach welcome with query and
fragment retained; simulated standalone and iOS standalone reach app with both
retained. Script-disabled root navigation reaches welcome through the unchanged
noscript refresh (which does not retain query/fragment, as before). Installed PWA
hardware testing was not performed. Live root still has the old noindex because
the approved change is local only; independent review remains blocked.
