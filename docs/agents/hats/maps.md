# Hat: Interactive Map

Use for `assets/map.js`, map controls, tile behavior, rendering, or map/data integration.

- Preserve LOD 12 and the existing `window.JLMMap` / `JLM_GEO` contracts unless the user explicitly approves a contract change.
- OpenStreetMap (ODbL) is the only approved tile/data source. Preserve attribution and do not add another tile provider or cache OSM tiles in the service worker.
- Keep map interactions safe on touch: map exploration must not accidentally mark a street visited. Preserve the explicit visit action and distinguish coarse-pointer from mouse behavior.
- Avoid rebuilding all street layers for one visited-state update. Verify empty-state cleanup when no streets remain and initial sizing/resizing when the map is first shown.
- Preserve existing fallback behavior where applicable (including offline/no-tile and map-library fallback) and do not invent a new map API.
- Test tile failure/retry states, zoom/fit behavior, keyboard/touch affordances, and one representative viewport. Keep map rendering changes scoped and profile large data loops when relevant.
