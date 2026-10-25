/**
 * שכבת המפה: מציגה את הרחובות שיש להם קואורדינטות ומתעדכנת לפי הביקורים.
 *
 * צורות גיאומטריה (חוזה 023):
 * - `paths` — מערך של פוליליינים [[[lat,lng],...], ...] → מצויר כקו/קווים.
 * - ללא `paths` אבל עם `lat`/`lng` תקינים → נקודה קטנה. אסור להמציא קו מהנקודה.
 * - `path` (יחיד, legacy) מתקבל כפוליליין אחד לתאימות אחורה.
 * - בלי גיאומטריה כלל → הרחוב לא מצויר; הוא נשאר ברשימה.
 *
 * שני מסלולי רינדור:
 * 1) Leaflet (CDN, עם אריחי OSM) — preferCanvas, עדכון חי, פופאפים בטוחים (DOM),
 *    ולחיצה על קו/נקודה מסמנת/מבטלת ביקור דרך window.JLMAPI.toggle(id).
 * 2) גיבוי מקומי על <canvas> — כש-window.L לא נטען (חסימה/אין רשת): הטלת מרקטור,
 *    פוליליינים ונקודות עם culling, גרירה, זום בכפתורים, במקלדת ובגלגלת העכבר
 *    (זום סביב נקודת הסמן), לחיצה מסמנת דרך JLMAPI.toggle.
 *    בלי אריחים — המפה לא נעלמת.
 *
 * תלוי ב-window.JLM_GEO (geo.js), ב-window.JLMAPI וב-window.JLMBus (app.js).
 * אסור לפונקציות להיכשל כש-window.L חסר — כל הגישה ל-L מקופלת מאחורי בדיקה.
 */
(function () {
  "use strict";

  var GEO = window.JLM_GEO || { streets: [] };
  var API = window.JLMAPI || null;

  var CENTER = [31.7683, 35.2137]; // רק כגיבוי אם bbox לא קיים — לא מקור נתונים

  // שרשרת ספקי אריחים (BOARD 050): OSM (רק http/https) → OSM DE → OpenTopoMap → קווים בלי רקע.
  // OSM דורש Referer; לכן file:// מתחיל מ-OSM DE. Esri/CARTO/OSM FR נפסלו בסבב 050.
  var TILE_PROVIDERS = [
    {
      id: "osm",
      name: "OSM",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxNativeZoom: 19,
      requiresReferer: true, // תיעוד בלבד — ההכרעה תמיד אמפירית ב-probe
      // z18 ולא z12: אריחי מרכז ירושלים ב-z12 נשמרים במטמון ה-CDN ולכן עוברים גם בלי Referer.
      // הבדיקה עצמה היא HEAD (ר' probeTiles) — HEAD לא מוגש ממטמון ה-CDN, ולכן גם אריח
      // שכבר נשמר כ-GET אמיתי מחזיר את חתימת החסימה (6,987B + no-cache) כשאין Referer.
      // אריח המרכז האמיתי (Referer) נמדד 13,317B — מעל סף 8,000 בפער בטוח.
      probe: { z: 18, x: 156713, y: 106653 },
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    {
      id: "osm-de",
      name: "OSM DE",
      url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
      maxNativeZoom: 18,
      requiresReferer: false,
      probe: { z: 16, x: 39178, y: 26664 }, // 29,463B ללא Referer (נמדד)
      // נוסח סגנון OSM DE לא נמדד (wiki 503) — נוסח שמרני; הייחוג הכללי של OSM מחייב תמיד
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://github.com/giggls/openstreetmap-carto-de">OpenStreetMap DE</a> (CC-BY-SA 4.0)'
    },
    {
      id: "opentopomap",
      name: "OpenTopoMap",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      maxNativeZoom: 17,
      subdomains: ["a", "b", "c"],
      requiresReferer: false,
      probe: { z: 16, x: 39178, y: 26664 }, // 35,756B ללא Referer (נמדד)
      attr: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    }
  ];
  var PROBE_MIN_BYTES = 8000; // אריחי הבדיקה הייעודיים נמדדו 13–35KB; חסימה/placeholder ≤7.2KB.
                               // בדיקת הגודל משנית: היא מוגנת ע"י דרישת max-age מפורש (ר' probeTiles).
  var PROBE_TIMEOUT_MS = 8000; // probe תלוי לא יחסום את השרשרת לנצח

  var TILE_ERROR_THRESHOLD = 3;
  var LOD_STREET_LIMIT = 1500; // מעל: בזום נמוך (לפני LOD_ZOOM) מוצגים רק מבוקרים
  var LOD_ZOOM = 12;
  var HIT_TOLERANCE_PX = 22;
  var HIT_TOLERANCE_COARSE_PX = 30;
  var LEAFLET_HIT_WEIGHT = 24;
  var LEAFLET_HIT_WEIGHT_COARSE = 36;
  var LEAFLET_HIT_RADIUS = 15;
  var LEAFLET_HIT_RADIUS_COARSE = 20;

  function coarsePointer() {
    return Boolean(
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches
    );
  }

  function fallbackHitTolerance() {
    return coarsePointer() ? HIT_TOLERANCE_COARSE_PX : HIT_TOLERANCE_PX;
  }

  function leafletHitWeight() {
    return coarsePointer() ? LEAFLET_HIT_WEIGHT_COARSE : LEAFLET_HIT_WEIGHT;
  }

  function leafletHitRadius() {
    return coarsePointer() ? LEAFLET_HIT_RADIUS_COARSE : LEAFLET_HIT_RADIUS;
  }
  var el = {
    canvas: document.getElementById("map-canvas"),
    empty: document.getElementById("map-empty"),
    banner: document.getElementById("map-banner"),
    status: document.getElementById("map-status"),
    toggle: document.getElementById("map-network-toggle")
  };

  if (!el.canvas) return;

  /* ---------- מצב כללי ---------- */

  var mode = null; // "leaflet" | "fallback"
  var networkOff = false;
  var streetsCache = [];

  /* ---------- עזרים ---------- */

  function showBanner(text, kind) {
    bannerKind = kind || "plain";
    el.banner.textContent = text;
    el.banner.hidden = false;
  }

  function hideBanner() {
    bannerKind = "none";
    if (el.banner.hidden) return;
    el.banner.hidden = true;
    el.banner.textContent = "";
  }

  function isVisited(id) {
    return Boolean(API && typeof API.isVisited === "function" && API.isVisited(id));
  }

  /** האם סימון מהמפה אפשרי — אם לא: הודעה, בלי זריקת חריגה */
  function canToggle() {
    return Boolean(API && typeof API.toggle === "function");
  }

  var toggleUnavailableMessage =
    "סימון מהמפה אינו זמין כרגע — סמנו ביקור מהרשימה. ";

  /**
   * מכשיר מגע (אצבע) לעומת עכבר. במגע הקשה על רחוב פותחת כרטיס בלבד,
   * והסימון נעשה בכפתור מפורש בתוכו — הקשה לא מדויקת לא תסמן רחוב שגוי.
   */
  function usesCoarsePointer() {
    try {
      return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    } catch (error) {
      return false;
    }
  }

  /** קריאה בטוחה ל-JLMAPI.toggle. מחזיר true אם הסימון התרחש. אף פעם לא זורק. */
  function toggleStreetSafe(id) {
    if (!canToggle()) {
      showBanner(toggleUnavailableMessage);
      return false;
    }
    try {
      API.toggle(id);
      return true;
    } catch (error) {
      showBanner("סימון הביקור מהמפה נכשל: " + (error && error.message ? error.message : error));
      return false;
    }
  }

  function baseById() {
    var out = Object.create(null);
    var streets = API && typeof API.getStreets === "function" ? API.getStreets() : [];
    streets.forEach(function (street) {
      out[street.id] = street;
    });
    return out;
  }

  /* ---------- ולידציה של גיאומטריה ---------- */

  function isLng(lng) {
    return typeof lng === "number" && isFinite(lng) && lng >= -180 && lng <= 180;
  }

  function isLat(lat) {
    return typeof lat === "number" && isFinite(lat) && lat >= -90 && lat <= 90;
  }

  function isLatLng(point) {
    return Array.isArray(point) && isLat(point[0]) && isLng(point[1]);
  }

  function isPolyline(polyline) {
    return Array.isArray(polyline) && polyline.length >= 2 && polyline.every(isLatLng);
  }

  function isQuadArray(value) {
    // `path` legacy = [[lat,lng],...] (האיבר הראשון הוא [lat,lng]).
    // `paths` חדש = [[[lat,lng],...],...] — אפשר להבחין על-פי המבנה.
    if (!Array.isArray(value) || value.length === 0) return false;
    return Array.isArray(value[0]) && Array.isArray(value[0][0]);
  }

  /** קבלת `path`/`paths` בכל צורה מוכרת והחזרת מערך פוליליינים תקינים בלבד */
  function validPolylines(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return [];

    var candidates = isQuadArray(raw) ? raw : [raw]; // legacy `path` → פוליליין אחד
    var out = [];

    for (var i = 0; i < candidates.length; i += 1) {
      var polyline = candidates[i];
      if (isPolyline(polyline)) out.push(polyline);
      else if (polyline && Array.isArray(polyline.pts) && isPolyline(polyline.pts)) {
        out.push(polyline.pts); // אפשרות עתידית: פוליליין כאובייקט
      }
    }

    return out;
  }

  /** מרכז משוקלל (ממוצע) של כל הנקודות בפוליליינים — לרחוב שיש לו קו ואין lat/lng */
  function polylinesCenter(paths) {
    var latSum = 0;
    var lngSum = 0;
    var count = 0;
    paths.forEach(function (polyline) {
      polyline.forEach(function (point) {
        latSum += point[0];
        lngSum += point[1];
        count += 1;
      });
    });
    if (count === 0) return null;
    return [latSum / count, lngSum / count];
  }

  /** רק רחובות עם קואורדינטות אמיתיות; שם ושכונה נלקחים מהרשימה אם חסרים */
  function geoStreets() {
    var base = baseById();
    var hasActiveIndex = Boolean(API && typeof API.getStreets === "function");
    var out = [];

    (GEO.streets || []).forEach(function (street) {
      // העדפה ל-`paths` החדש; `path` (פוליליין יחיד) נתמך לתאימות אחורה
      var paths = validPolylines(street.paths);
      if (paths.length === 0) paths = validPolylines(street.path);

      var lat = isLat(street.lat) ? street.lat : null;
      var lng = isLng(street.lng) ? street.lng : null;

      if ((!lat || !lng) && paths.length) {
        // יש קו ולפחות רכיב מרכז אחד חסר: המרכז נחשב מהגיאומטריה — לא מומצא, מחושב.
        // הרכיבים התקינים מהמקור נשארים.
        var center = polylinesCenter(paths);
        if (center) {
          if (!lat) lat = center[0];
          if (!lng) lng = center[1];
        }
      }

      if (!lat || !lng) return; // בלי קואורדינטות אמת — לא מצויר, נשאר ברשימה

      var known = base[street.id];

      // רחוב שנמחק ידנית יורד גם מהמפה. הבדיקה מול הרשימה הפעילה מונעת
      // מצב שבו geo.js עדיין מכיל גיאומטריה לרחוב שהוסתר מהמשתמש.
      if (hasActiveIndex && !known) return;

      out.push({
        id: String(street.id),
        name: street.name || (known ? known.name : ""),
        area: street.area || (known ? known.area : "אחר"),
        lat: lat,
        lng: lng,
        paths: paths // מערך (יכול להיות ריק) של פוליליינים [ [lat,lng], ... ]
      });
    });

    return out;
  }

  function visitedCount(streets) {
    var count = 0;
    streets.forEach(function (street) {
      if (isVisited(street.id)) count += 1;
    });
    return count;
  }

  /** סיכום קצר ל-#map-status. לא נכתב בכל שינוי ביקור — הרשימה כבר מכריזה על כל סימון. */
  function refreshStatus() {
    el.status.textContent =
      "המפה מציגה " + streetsCache.length + " רחובות, " + visitedCount(streetsCache) + " מהם מבוקרים.";
  }

  /** מסר ריק מדויק: מחיקה מלאה אינה "אין קואורדינטות" ואינה מצביעה על סינון שלא קיים */
  function updateEmptyMessage() {
    if (!el.empty) return;
    var active = 0;
    var api = window.JLMAPI;
    if (api && typeof api.getStreets === "function") {
      try { active = api.getStreets().length; } catch (error) { active = 0; }
    }
    el.empty.textContent = active === 0
      ? "כל הרחובות הוסרו ידנית מהמפה. אפשר לייבא גיבוי מהכפתור \"ייבוא\" שלמעלה כדי להחזיר אותם."
      : "אין עדיין קואורדינטות לרחובות האלה. המפה תופיע כשיהיו נתוני מיקום — הרשימה למטה עובדת גם בלעדיה.";
  }

  /** הגללה/פוקוס לשורת הרחוב ברשימה (מהפופאפ: "מצא ברשימה").
   * קודם JLMAPI.focusStreet (מאפס סינון ומרחיב עימוד); אם חסר — חיפוש בטוח ב-DOM,
   * ואם גם זה נכשל — הודעה ברורה ב-#map-status במקום שקט מטעה. */
  function scrollToStreet(id) {
    var api = window.JLMAPI;
    if (api && typeof api.focusStreet === "function") {
      try {
        api.focusStreet(id);
        return;
      } catch (error) { /* נופלים לגיבוי ה-DOM מטה */ }
    }

    var row = document.getElementById("street-list");
    if (!row) {
      el.status.textContent = "הרשימה אינה זמינה כרגע — מצאו את הרחוב בחיפוש מעל הרשימה.";
      return;
    }
    var items = row.querySelectorAll("[data-id]");
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].dataset.id === id) {
        items[i].scrollIntoView({ block: "center", behavior: "smooth" });
        var goto = items[i].querySelector('[data-action="goto"]');
        if (goto) goto.focus({ preventScroll: true });
        return;
      }
    }
    // הרחוב לא בין השורות שרנדרו (עדיין מסונן או מחוץ לעימוד) — לא להישאר בשקט
    el.status.textContent = "הרחוב לא בין השורות המוצגות — בדקו את הסינון או השתמשו בחיפוש.";
  }

  /* =========================================================
      שרשרת ספקי אריחים ובדיקת חסימה שקטה (probeTiles)
      חסימת OSM המתוארת ב-026: HTTP 200 עם תמונת "Request blocked"
      (~6,987 בייט, cache-control: no-cache) — `tileerror` לא נורה בדרך כלל.
      כל ספק נבדק ב-HEAD על אריח בדיקה ייעודי; חסימה → מעבר לספק הבא.
      HEAD לא מוגש ממטמון ה-CDN, ולכן לא מסתיר חסימת Referer גם באריח פופולרי.
      כשל רשת/CORS אינו חסימה — לא מחליפים ספק ולא מציגים באנר.
      ========================================================= */

  var tilesBlocked = false; // כל הספקים מוצו: האריחים מוסרים עד "נסה שוב"
  var bannerKind = "none";  // none | plain | tileerror | network | transition | final
  var probeBusy = false;
  var probeSeq = 0;         // מבטל תשובות probe ישנות אחרי אתחול מחדש
  var switchBusy = false;
  var tileChain = null;     // ספקים זמינים לסשן (file:// מסנן את OSM)
  var chainIdx = 0;         // אינדקס הספק הפעיל בתוך tileChain
  var provider = null;      // רשומת הספק הפעיל
  var exhausted = Object.create(null); // מזהי ספקים שנפסלו בסשן
  var chainExhausted = false;

  function isFileProtocol() {
    return Boolean(window.location && window.location.protocol === "file:");
  }

  /** בניית השרשרת לסשן: ב-file:// אין Referer, לכן OSM מדולג */
  function buildTileChain() {
    var chain = [];
    for (var i = 0; i < TILE_PROVIDERS.length; i++) {
      if (TILE_PROVIDERS[i].id === "osm" && isFileProtocol()) continue;
      chain.push(TILE_PROVIDERS[i]);
    }
    return chain;
  }

  function ensureTileChain() {
    if (!tileChain) {
      tileChain = buildTileChain();
      chainIdx = 0;
      exhausted = Object.create(null);
      chainExhausted = false;
    }
    return tileChain;
  }

  /** אתחול מחדש של מצב השרשרת (טעינה ראשונה/ניסיון Leaflet חוזר) */
  function resetTileChainState() {
    chainIdx = 0;
    provider = null;
    exhausted = Object.create(null);
    chainExhausted = false;
    tilesBlocked = false;
    probeBusy = false;
    probeSeq += 1;
    switchBusy = false;
    tileErrors = 0;
    tileBannerShown = false;
  }

  /** כתובת אריח לספק מסוים (עבור ה-probe; Leaflet מחליף {s} לבד בשכבה) */
  function tileUrlFor(p, z, x, y) {
    var url = p.url;
    if (url.indexOf("{s}") !== -1) {
      var subs = p.subdomains && p.subdomains.length ? p.subdomains : ["a"];
      url = url.replace("{s}", subs[0]);
    }
    return url.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  }

  /** אריח בדיקה קבוע לכל ספק — לא לפי התצוגה הנוכחית */
  function tileProbeUrl(p) {
    var q = p.probe;
    return tileUrlFor(p, q.z, q.x, q.y);
  }

  /** באנר חסימה: טקסט + כפתור "נסה שוב". באנר אחד בכל רגע — הקיים נעלם קודם. */
  function showBlockedBanner(message) {
    hideBanner();
    el.banner.textContent = "";

    var text = document.createElement("span");
    text.textContent = message;

    var retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn map-banner__retry";
    retry.textContent = "נסה שוב";
    retry.addEventListener("click", retryTilesProbe);

    el.banner.appendChild(text);
    el.banner.appendChild(retry);
    el.banner.hidden = false;
    bannerKind = "final";
  }

  function finalBlockedMessage() {
    var names = [];
    for (var i = 0; i < tileChain.length; i++) names.push(tileChain[i].name);
    var message =
      "כל ספקי האריחים אינם זמינים כרגע מהדפדפן הזה (" + names.join(", ") + "). " +
      "מוצגים קווי הרחובות בלי רקע — המפה והרשימה ממשיכות לעבוד; \"נסה שוב\" מנסה מחדש מהתחלה.";
    if (isFileProtocol()) {
      message += " המפה נפתחה כקובץ מקומי (file://) — הרשימה והקווים עובדים תמיד; אריחי הרקע דורשים חיבור לאינטרנט.";
    }
    return message;
  }

  /** מצב סופי: מוריד את האריחים (הקווים שלנו נשארים) ומציג באנר עם "נסה שוב" */
  function markTilesBlocked(message) {
    tilesBlocked = true;
    if (map && tiles && map.hasLayer(tiles)) map.removeLayer(tiles);
    showBlockedBanner(message);
  }

  /** החלפת שכבה לספק הבא — remove-then-add כדי שהייחוג יתעדכן ולא יוכפל */
  function switchProvider(index, options) {
    if (switchBusy || probeBusy || !window.L || !map) return;
    var next = tileChain[index];
    if (!next) return;

    switchBusy = true;
    try {
      if (tiles) {
        if (typeof tiles.off === "function") tiles.off("tileerror", onTileError);
        if (map.hasLayer(tiles)) map.removeLayer(tiles);
      }

      var layerOptions = {
        maxZoom: 19,
        maxNativeZoom: next.maxNativeZoom,
        attribution: next.attr
      };
      if (next.subdomains) layerOptions.subdomains = next.subdomains;

      tiles = window.L.tileLayer(next.url, layerOptions);
      tiles.on("tileerror", onTileError);

      provider = next;
      chainIdx = index;
      tileErrors = 0;
      tileBannerShown = false;
      tilesBlocked = false;

      if (!networkOff) tiles.addTo(map);

      if (options && options.reason) {
        var fromName = options.from ? options.from.name : "הקודם";
        showBanner(
          "אריחי המפה מהספק " + fromName + " חסומים מהדפדפן הזה (" + options.reason +
          ") — נבדק ספק חלופי: " + next.name + "…",
          "transition"
        );
      }
    } catch (error) {
      switchBusy = false;
      exhausted[next.id] = true;
      advanceProvider("שגיאה בהחלפת ספק");
      return;
    }

    switchBusy = false;
    probeTiles();
  }

  /** הספק הנוכחי נחשב חסום: מסמנים כמוצה ועוברים לבא בתור; אין → באנר סופי */
  function advanceProvider(reason) {
    if (switchBusy || chainExhausted) return;
    if (provider) exhausted[provider.id] = true;

    var nextIndex = -1;
    for (var i = 0; i < tileChain.length; i++) {
      if (!exhausted[tileChain[i].id]) { nextIndex = i; break; }
    }

    if (nextIndex === -1) {
      chainExhausted = true;
      markTilesBlocked(finalBlockedMessage());
      return;
    }

    switchProvider(nextIndex, { reason: reason, from: provider });
  }

  /** "נסה שוב": לפני מוצה — probe לספק הנוכחי; אחרי מוצה — מחזור מלא מהתחלה */
  function retryTilesProbe() {
    if (probeBusy || switchBusy) return;
    if (mode !== "leaflet" || networkOff || !map) return;

    if (chainExhausted) {
      exhausted = Object.create(null);
      chainExhausted = false;
      chainIdx = 0;
      tilesBlocked = false;
      tileErrors = 0;
      tileBannerShown = false;
      hideBanner();
      switchProvider(0, null);
      return;
    }

    tilesBlocked = false;
    tileErrors = 0;
    tileBannerShown = false;
    hideBanner();
    if (!tiles) {
      switchProvider(chainIdx, null);
      return;
    }
    if (!map.hasLayer(tiles)) tiles.addTo(map);
    probeTiles();
  }

  /** probe אחרי אתחול/החלפה, ושוב אחרי 3 tileerror */
  function probeTiles(method) {
    if (mode !== "leaflet" || !map || networkOff || tilesBlocked || probeBusy || switchBusy) return;
    if (!tiles || !map.hasLayer(tiles)) return;
    if (!provider) return;
    if (typeof window.fetch !== "function") return; // בלי fetch — נשארים במסלול tileerror

    var probeMethod = method || "HEAD";

    var probeUrl;
    try {
      probeUrl = tileProbeUrl(provider);
    } catch (error) {
      return; // אם חישוב האריח נכשל — ממשיכים כרגיל, שום דבר לא נשבר
    }

    var seq = probeSeq + 1;
    probeSeq = seq;
    probeBusy = true;
    var probeProvider = provider;
    var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    var timer = null;
    if (controller) {
      timer = window.setTimeout(function () {
        try { controller.abort(); } catch (error) { /* לא קריטי */ }
      }, PROBE_TIMEOUT_MS);
    }
    function finishProbe() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (seq === probeSeq) probeBusy = false;
    }

    // HEAD: כותרות בלבד, בלי הורדת תמונה; HEAD גם לא מוגש ממטמון ה-CDN ולכן לא מסתיר חסימה.
    var fetchOptions = { method: probeMethod, mode: "cors" };
    if (controller) fetchOptions.signal = controller.signal;

    window.fetch(probeUrl, fetchOptions).then(function (res) {
      finishProbe();
      if (seq !== probeSeq) return;
      if (tilesBlocked || networkOff || provider !== probeProvider) return;
      if (!res || !res.ok) {
        // שרת שלא תומך ב-HEAD (405/501) — זו אינה חסימה: בודקים עם GET (אותן כותרות)
        if (res && (res.status === 405 || res.status === 501) && probeMethod === "HEAD") {
          probeTiles("GET");
          return;
        }
        advanceProvider("התשובה היא HTTP " + (res && res.status ? res.status : "שגיאה"));
        return;
      }

      var blockedReason = "";
      try {
        var headers = res.headers || null;
        var getHeader = headers && typeof headers.get === "function"
          ? function (name) { return headers.get(name); }
          : null;
        var cc = getHeader ? getHeader("cache-control") || "" : "";
        var ct = getHeader ? getHeader("content-type") || "" : "";
        var clRaw = getHeader ? getHeader("content-length") : null;
        var cl = clRaw === null || clRaw === "" ? null : Number(clRaw);

        if (ct && !/^image\//i.test(ct)) {
          blockedReason = "התשובה אינה תמונה";
        } else if (/no-cache/i.test(cc)) {
          // אות החסימה החזק של OSM: 200 + no-cache (לא לפי גודל בלבד)
          blockedReason = "\"no-cache\"";
        } else if (cl !== null && isFinite(cl) && cl < PROBE_MIN_BYTES && !/max-age/i.test(cc)) {
          // אות משני: תמונת placeholder קטנה. אריח תקין מגיע עם max-age — לא ייפל מזה
          blockedReason = "תמונת שגיאה של " + cl + " בייט";
        }
      } catch (error) { /* כותרות לא זמינות — לא מפילים ספק */ }

      if (blockedReason) {
        advanceProvider(blockedReason);
      } else {
        hideBanner();
      }
    }, function () {
      // כשל רשת/CORS: לא חסימה — אין החלפה ואין סימון exhausted.
      // אם הוצגה הודעת-מעבר, מסירים אותה כדי לא להשאיר "בודק ספק חלופי" תקוע.
      finishProbe();
      if (seq !== probeSeq) return;
      if (bannerKind === "transition") hideBanner();
    });
  }

  function setNetwork(off) {
    networkOff = off;
    el.toggle.setAttribute("aria-pressed", off ? "true" : "false");

    if (mode === "leaflet") {
      if (off) {
        if (tiles && map && map.hasLayer(tiles)) map.removeLayer(tiles);
        showBanner("מצב ללא רשת: מוצגים רק קווי הרחובות, בלי אריחי רקע.", "network");
      } else {
        tileErrors = 0;
        tileBannerShown = false;
        if (chainExhausted) {
          // אין החזרה שקטה: הבאנר הסופי והאריחים הכבויים נשארים עד "נסה שוב"
          markTilesBlocked(finalBlockedMessage());
        } else if (tilesBlocked) {
          showBlockedBanner(finalBlockedMessage());
        } else if (!tiles) {
          switchProvider(chainIdx, null);
        } else {
          if (!map.hasLayer(tiles)) tiles.addTo(map);
          hideBanner();
          probeTiles(); // לוודא שהחסימה מזוהה גם אחרי הדלקה בזמן אמת
        }
      }
      return;
    }

    // מסלול גיבוי: אין אריחים מלכתחילה; המתג רק מודיע, לשמירה על עקביות ממשק
    if (off) {
      showBanner("מצב ללא רשת: מוצג רינדור גיבוי מקומי, בלי אריחי רקע.");
    } else {
      hideBanner();
    }
  }

  /* =========================================================
      מסלול 1: Leaflet
      ========================================================= */

  var map = null;
  var tiles = null;
  var group = null;
  var layerById = Object.create(null);
  var hitById = Object.create(null);
  var metaById = Object.create(null);
  var openPopupContext = null;
  var tileErrors = 0;
  var tileBannerShown = false;
  var lodAllMode = true;
  var retries = 0; // ניסיונות אתחול חוזרים של Leaflet לפני מעבר לגיבוי

  var palette = null;
  function paletteColors() {
    if (!palette) {
      palette = {
        visited: cssColor("--good", "#2f7d5c"),
        pending: cssColor("--accent", "#a98a5f")
      };
    }
    return palette;
  }

  function styleFor(visited, hasPaths) {
    var colors = paletteColors();
    if (hasPaths) {
      return visited
        ? { color: colors.visited, weight: 6, opacity: 0.9 }
        : { color: colors.pending, weight: 3, opacity: 0.6 };
    }
    return visited
      ? {
          color: colors.visited, weight: 2, radius: 7,
          fillColor: colors.visited, fillOpacity: 0.95, opacity: 1
        }
      : {
          color: colors.pending, weight: 2, radius: 5,
          fillColor: colors.pending, fillOpacity: 0.5, opacity: 0.7
        };
  }

  /** פופאפ נבנה ב-DOM ישירות (textContent) — אין innerHTML, אין הזרקת משתמשים */
  function popupContent(street) {
    var wrap = document.createElement("div");
    wrap.className = "map-popup";
    wrap.dir = "rtl";

    var title = document.createElement("strong");
    title.className = "map-popup__title";
    title.textContent = street.name;

    var area = document.createElement("span");
    area.className = "map-popup__area";
    area.textContent = street.area;

    var state = document.createElement("span");
    state.className = "map-popup__state";
    state.textContent = "";

    wrap.appendChild(title);
    wrap.appendChild(area);
    wrap.appendChild(state);

    if (canToggle()) {
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn map-popup__toggle";

      function syncPopupUI() {
        var visited = isVisited(street.id);
        state.className = "map-popup__state" + (visited ? " is-visited" : "");
        state.textContent = visited ? "ביקרתם כאן ✓" : "עוד לא ביקרתם";
        toggle.textContent = visited ? "בטל סימון ביקור" : "סמן שביקרתי";
      }

      toggle.addEventListener("click", function () {
        if (toggleStreetSafe(street.id)) syncPopupUI();
      });

      syncPopupUI();
      wrap.appendChild(toggle);
    } else {
      var note = document.createElement("span");
      note.className = "map-popup__note";
      note.textContent = "סימון מהמפה אינו זמין כרגע — סמנו ביקור מהרשימה.";
      state.textContent = isVisited(street.id) ? "ביקרתם כאן ✓" : "עוד לא ביקרתם";
      wrap.appendChild(note);
    }

    var find = document.createElement("button");
    find.type = "button";
    find.className = "btn map-popup__find";
    find.textContent = "מצא ברשימה";
    find.addEventListener("click", function () {
      scrollToStreet(street.id);
    });

    wrap.appendChild(find);

    /* קישור קטן ל"הידעת?" — תמיד ב-DOM אך מוסתר אם לרחוב אין עובדה מאומתת.
       החלון הצף נפתח ע"י JLMFacts (assets/dyk-facts.js). */
    if (window.JLMFacts) {
      var dyk = document.createElement("button");
      dyk.type = "button";
      dyk.className = "btn map-popup__dyk";
      dyk.textContent = "הידעת?";
      dyk.setAttribute("aria-label", "תגלית על רחוב " + street.name);
      dyk.setAttribute("aria-haspopup", "dialog");
      dyk.hidden = !window.JLMFacts.has(street.id);
      dyk.addEventListener("click", function () {
        window.JLMFacts.open(street.id, dyk);
      });
      wrap.appendChild(dyk);
    }

    return wrap;
  }

  /** פופאפ נשאר נגיש, אך מצטמצם כשהרחוב יוצא מהמרכז או כשהזום מתרחק. */
  function compactPopupIfContextLost() {
    if (!map || !openPopupContext || !map.getSize || !map.latLngToContainerPoint) return;

    var street = cachedStreetById(openPopupContext.id);
    var center = street && streetCenter(street);
    var size = map.getSize();
    if (!center || !size || !isFinite(size.x) || !isFinite(size.y)) return;

    var point = map.latLngToContainerPoint(center);
    var centerPoint = { x: size.x / 2, y: size.y / 2 };
    var distance = Math.sqrt(
      Math.pow(point.x - centerPoint.x, 2) + Math.pow(point.y - centerPoint.y, 2)
    );
    var movedAway = distance > Math.min(size.x, size.y) * 0.48;
    var zoomedOut = map.getZoom() <= openPopupContext.zoom - 2;

    if (!(movedAway || zoomedOut) || openPopupContext.compact) return;

    var popup = openPopupContext.popup;
    var popupElement = popup && typeof popup.getElement === "function" ? popup.getElement() : null;
    var popupContent = popupElement && popupElement.querySelector
      ? popupElement.querySelector(".map-popup")
      : null;
    if (popupContent) {
      popupContent.classList.add("map-popup--compact");
      openPopupContext.compact = true;
    }
  }

  /** בזום נמוך וברשימות גדולות מוצגים רק מבוקרים — חיסכון ציור משמעותי */
  function shouldShowAll() {
    if (!map) return true;
    if (streetsCache.length <= LOD_STREET_LIMIT) return true;
    return map.getZoom() >= LOD_ZOOM;
  }

  /**
   * בניית שכבות לרחוב אחד והוספתן לקבוצה (מוגן מפני שכפול).
   * לכל קו נוצרות שתי שכבות: קו נראה + "שכבת פגיעה" שקופה ורחבה.
   * שכבת הפגיעה היא היחידה שמקשיבה ללחיצה, כך שאפשר ללחוץ ליד הקו בלי לפגוע בניווט.
   */
  function mountLeafletStreet(street, visited) {
    if (layerById[street.id]) return; // כבר על המפה

    var layers = [];
    var hits = [];
    var hitStyle = {
      color: "#000000",
      weight: leafletHitWeight(),
      /* אפס שקיפות לחלוטין: שכבת הפגיעה לא מצטברת לצל כהה כש-2,154 קווים חופפים.
         Leaflet בודק את אזור הפגיעה לפי הגיאומטריה, לא לפי צבע שנראה על המסך. */
      opacity: 0,
      fillColor: "#000000",
      fillOpacity: 0,
      lineCap: "round",
      lineJoin: "round",
      interactive: true,
      bubblingMouseEvents: false
    };

    if (street.paths.length) {
      street.paths.forEach(function (polyline) {
        layers.push(window.L.polyline(polyline, styleFor(visited, true)));
        hits.push(window.L.polyline(polyline, hitStyle));
      });
    } else {
      layers.push(window.L.circleMarker([street.lat, street.lng], styleFor(visited, false)));
      hits.push(
        window.L.circleMarker([street.lat, street.lng], {
          radius: leafletHitRadius(),
          stroke: false,
          fill: true,
          fillColor: "#000000",
          fillOpacity: 0,
          opacity: 0,
          interactive: true,
          bubblingMouseEvents: false
        })
      );
    }

    // הקווים הנראים לא מקבלים אירועים — שכבת הפגיעה שמעליהם היא היעד.
    layers.forEach(function (layer) {
      layer.options.interactive = false;
      layer.addTo(group);
    });

    // ה-click נרשם לפני bindPopup. במחשב הסימון מתרחש קודם והפופאפ נבנה עם המצב החדש;
    // במכשיר מגע הסימון לא מתבצע כאן — ההקשה רק פותחת את הכרטיס, והמשתמש מסמן בו במפורש.
    hits.forEach(function (layer) {
      layer.on("click", function () {
        if (!usesCoarsePointer()) toggleStreetSafe(street.id);
      });
      layer.on("popupopen", function (event) {
        var popup = event && event.popup ? event.popup : null;
        var popupElement = popup && typeof popup.getElement === "function" ? popup.getElement() : null;
        var popupContent = popupElement && popupElement.querySelector
          ? popupElement.querySelector(".map-popup")
          : null;
        if (popupContent) popupContent.classList.remove("map-popup--compact");
        openPopupContext = { id: street.id, zoom: map ? map.getZoom() : 0, popup: popup, compact: false };
      });
      layer.on("popupclose", function () {
        if (openPopupContext && openPopupContext.id === street.id) openPopupContext = null;
      });
      layer.bindPopup(function () {
        return popupContent(street);
      }, {
        maxWidth: 280,
        minWidth: 0,
        autoPanPadding: [18, 18]
      });
      layer.addTo(group);
    });

    layerById[street.id] = layers;
    hitById[street.id] = hits;
    metaById[street.id] = { hasPaths: Boolean(street.paths.length) };
  }

  /** טווח גיאומטרי בגרדיאנטים — לצורך סדר ציור בלבד, לא למדידה מדויקת */
  function geometrySpan(street) {
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    (street.paths || []).forEach(function (line) {
      line.forEach(function (point) {
        if (point[0] < minLat) minLat = point[0];
        if (point[0] > maxLat) maxLat = point[0];
        if (point[1] < minLng) minLng = point[1];
        if (point[1] > maxLng) maxLng = point[1];
      });
    });
    if (minLat === Infinity) return 0;
    return maxLat - minLat + maxLng - minLng;
  }

  function drawLeaflet() {
    if (!map || !group || !window.L) return;

    if (map.closePopup) {
      try { map.closePopup(); } catch (e) { /* לא קריטי */ }
    }
    group.clearLayers();
    layerById = Object.create(null);
    hitById = Object.create(null);
    metaById = Object.create(null);
    lodAllMode = shouldShowAll();

    // ציור צירים ארוכים קודם: שכבת הפגיעה של רחוב צר וקרוב (למשל סמטה
    // סמוכה לרחוב יפו) נשארת מעליהם, ולכן לחיצה ליד הסמטה בוחרת אותה ולא את הציר.
    var drawOrder = streetsCache.slice().sort(function (a, b) {
      return geometrySpan(b) - geometrySpan(a);
    });

    drawOrder.forEach(function (street) {
      // LOD: בזום נמוך — לדלג על רחובות שלא ביקרנו בהם
      if (!lodAllMode && !isVisited(street.id)) return;

      mountLeafletStreet(street, isVisited(street.id));
    });
  }

  /** רחוב מ-streetsCache לפי מזהה (מעט קריאות — סיבוב ליניארי מקובל) */
  function cachedStreetById(id) {
    for (var i = 0; i < streetsCache.length; i += 1) {
      if (streetsCache[i].id === id) return streetsCache[i];
    }
    return null;
  }

  /* ---------- מיקוד רחוב מהרשימה או מהחיפוש ---------- */

  var highlightTimer = null;

  /** מרכז הרחוב: הקואורדינטה השמורה, ואם חסרה — ממוצע הנקודות בקווים */
  function streetCenter(street) {
    if (isFinite(street.lat) && isFinite(street.lng)) return [street.lat, street.lng];

    var sumLat = 0;
    var sumLng = 0;
    var count = 0;
    (street.paths || []).forEach(function (line) {
      line.forEach(function (point) {
        if (isFinite(point[0]) && isFinite(point[1])) {
          sumLat += point[0];
          sumLng += point[1];
          count += 1;
        }
      });
    });
    if (!count) return null;
    return [sumLat / count, sumLng / count];
  }

  function paintHighlight(id, active) {
    var layers = layerById[id];
    if (!layers) return;
    var meta = metaById[id] || { hasPaths: true };
    layers.forEach(function (layer) {
      if (!layer.setStyle) return;
      layer.setStyle(active ? { weight: 9, opacity: 1 } : styleFor(isVisited(id), meta.hasPaths));
    });
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  var areaHighlightTimer = null;
  var areaHighlightIds = [];

  /** הדגשת שכונה עדינה: קווי השכונה ל-weight 7/opacity 1, והחזרה אחרי ~3 שניות */
  function paintAreaHighlight(ids, active) {
    ids.forEach(function (id) {
      var layers = layerById[id];
      if (!layers) return;
      var meta = metaById[id];
      if (!meta) return;
      layers.forEach(function (layer) {
        if (!layer.setStyle) return;
        layer.setStyle(active ? { weight: 7, opacity: 1 } : styleFor(isVisited(id), meta.hasPaths));
      });
    });
  }

  /** השתקת הדגשת שכונה פעילה (מעבר לרחוב/לשכונה אחרת צריך לנצח) */
  function cancelAreaHighlight() {
    if (areaHighlightTimer) {
      window.clearTimeout(areaHighlightTimer);
      areaHighlightTimer = null;
    }
    if (areaHighlightIds.length) {
      paintAreaHighlight(areaHighlightIds, false);
      areaHighlightIds = [];
    }
  }

  /**
   * מפת השכונה: מרכז התצוגה על גיאומטריית כל הרחובות שבשכונה.
   * maxZoom: 16 — שכונה גדולה לא מתקרבת מדי, שכונה קטנה לא מגיעה לזום 17.
   * מחזיר false אם אין רחובות לשכונה או שהמפה עדיין לא ב-Leaflet — אין הזזת מפה.
   */
  function zoomToArea(area) {
    if (mode !== "leaflet" || !map) return false;

    var target = typeof area === "string" && area ? area : "אחר";
    var ids = [];
    var points = [];

    streetsCache.forEach(function (street) {
      if ((street.area || "אחר") !== target) return;
      ids.push(street.id);
      (street.paths || []).forEach(function (polyline) {
        polyline.forEach(function (point) {
          if (isFinite(point[0]) && isFinite(point[1])) points.push([point[0], point[1]]);
        });
      });
      var center = streetCenter(street);
      if (center) points.push(center);
    });

    if (ids.length === 0 || points.length === 0) return false;

    var bounds = window.L.latLngBounds(points);
    if (!bounds || typeof bounds.isValid !== "function" || !bounds.isValid()) return false;

    var reduce = prefersReducedMotion();
    map.fitBounds(bounds.pad(0.08), { maxZoom: 16, animate: !reduce });

    cancelAreaHighlight();
    areaHighlightIds = ids;
    areaHighlightTimer = window.setTimeout(function () {
      paintAreaHighlight(ids, true);
      areaHighlightTimer = window.setTimeout(function () {
        paintAreaHighlight(ids, false);
        if (areaHighlightTimer) {
          window.clearTimeout(areaHighlightTimer);
          areaHighlightTimer = null;
        }
      }, 3000);
    }, reduce ? 0 : 700);

    return true;
  }

  /** מקפיץ את המפה לרחוב ומדגיש אותו לכמה שניות. מחזיר false במסלול גיבוי. */
  function zoomToStreet(id, zoom) {
    if (mode !== "leaflet" || !map) return false;

    var street = cachedStreetById(id);
    if (!street) return false;

    var center = streetCenter(street);
    if (!center) return false;

    if (!layerById[id]) mountLeafletStreet(street, isVisited(id));

    var targetZoom = Math.max(2, Math.min(19, Number(zoom) || 16));
    var reduce = prefersReducedMotion();

    map.flyTo(center, targetZoom, { animate: !reduce, duration: 0.75 });

    // ניווט לרחוב גובר על הדגשת שכונה שטרם הוחזרה
    cancelAreaHighlight();

    if (highlightTimer) window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(function () {
      paintHighlight(id, true);
      highlightTimer = window.setTimeout(function () {
        paintHighlight(id, false);
        highlightTimer = null;
      }, 2600);
    }, reduce ? 0 : 700);

    return true;
  }

  function updateLeafletStreet(id, visited) {
    var layers = layerById[id];
    var meta = metaById[id];

    if (!layers || !meta) {
      // LOD: בזום נמוך השכבות לא נבנו; רחוב שסומן כעת צריך לעלות על המפה מיד,
      // בלי drawLeaflet() מלא — רק הרחוב שהשתנה.
      if (visited) {
        var street = cachedStreetById(id);
        if (street) mountLeafletStreet(street, true);
      }
      return;
    }

    var style = styleFor(visited, meta.hasPaths);
    layers.forEach(function (layer) {
      layer.setStyle(style);
      if (typeof layer.setRadius === "function") layer.setRadius(style.radius);
    });
  }

  function onLeafletZoomEnd() {
    var showAll = shouldShowAll();
    if (showAll !== lodAllMode) drawLeaflet();
    compactPopupIfContextLost();
  }

  function onLeafletMoveEnd() {
    compactPopupIfContextLost();
  }

  function onTileError() {
    if (networkOff || tilesBlocked || switchBusy) return;
    tileErrors += 1;
    if (tileErrors >= TILE_ERROR_THRESHOLD && !tileBannerShown) {
      tileBannerShown = true;
      showBanner("אריחי המפה לא נטענו לאחרונה — מוצגים רק קווי הרחובות שלנו, על רקע ריק.", "tileerror");
      // אולי זו דווקא החסימה השקטה (HTTP 200 עם תמונת שגיאה) — probe מרכב ומשדרג
      probeTiles();
    }
  }

  function initLeaflet() {
    ensureTileChain();
    resetTileChainState();

    map = window.L.map(el.canvas, {
      preferCanvas: true,
      scrollWheelZoom: true, // גלגלת מעל המפה מקרבת; Leaflet עושה preventDefault — העמוד לא נגלל
      // Leaflet 1.9: ה-tap המדומה הישן גורם התנגשויות לחיצה במובייל מודרני — אירועי מגע אמתיים בלבד;
      // גרירה ו-pinch-zoom (touchZoom, ברירת מחדל) נשארים כרגיל.
      tap: false,
      worldCopyJump: true
    });

    // מובייל: המיכל מוקדש למחוות המפה — touch-action מונע לדפדפן לגלול העמוד בזמן
    // גרירה בתוך המפה (Leaflet מטופל בעצמו את ה-events); גלילת העמוד מחוץ למפה לא מושפעת.
    if (el.canvas.style && typeof el.canvas.style.setProperty === "function") {
      try { el.canvas.style.setProperty("touch-action", "none"); } catch (e) { /* לא קריטי */ }
    }

    // השכבה הראשונה נבחרת לפי השרשרת (file:// מדלג על OSM) ונבדקת ב-probe
    switchProvider(chainIdx, null);

    group = window.L.layerGroup().addTo(map);

    // תחום התצוגה: נקודות המרכז + כל נקודות הקווים — כולל הגיאומטריה האמתית
    var points = [];
    streetsCache.forEach(function (street) {
      points.push([street.lat, street.lng]);
      street.paths.forEach(function (polyline) {
        polyline.forEach(function (point) {
          points.push([point[0], point[1]]);
        });
      });
    });

    var bounds = window.L.latLngBounds(points);

    if (bounds && bounds.isValid()) {
      // תצוגת פתיחה עירונית: כל ירושלים בזום 12
      map.setView(bounds.getCenter(), 12, { animate: false });
    } else {
      map.setView(CENTER, 12, { animate: false });
    }

    drawLeaflet();
    map.on("zoomend", onLeafletZoomEnd);
    map.on("moveend", onLeafletMoveEnd);

    // ה-canvas נוצר לפני שהמכל קיבל מידות סופיות. invalidateSize לבדו לא מרענן
    // את שכבת ה-canvas; panBy(0,0) מאלץ רינדור מלא אחרי שהמידות התייצבו.
    window.setTimeout(function () {
      if (!map) return;
      map.invalidateSize({ animate: false });
      map.panBy([0, 0], { animate: false });
    }, 0);

    // שינוי גודל מאוחר (פריסה/מובייל): ליישר את הקנבס בלי לאבד את המיקום
    if (window.ResizeObserver && el.canvas) {
      var resizeObserver = new window.ResizeObserver(function () {
        if (!map) return;
        map.invalidateSize({ animate: false });
        map.panBy([0, 0], { animate: false });
      });
      resizeObserver.observe(el.canvas);
    }

    // ה-probe הראשון כבר הופעל ב-switchProvider (לפני setView — הוא קבוע על z12)
  }

  /* =========================================================
      מסלול 2: גיבוי מקומי על canvas (בלי Leaflet, בלי אריחים)
      ========================================================= */

  var F = {
    canvas: null,
    ctx: null,
    w: 0,
    h: 0,
    dpr: 1,
    view: { x: 0.5, y: 0.5, scale: 1024 }, // מרכז במרקטור נורמלי + פיקסלים ליחידת עולם
    proj: [],   // לכל רחוב: { id, name, area, hasPaths, lines:[{pts,bbox}], center:[x,y], bbox }
    minScale: 256,
    maxScale: 1048576,
    raf: 0,
    drag: null
  };

  // הטלת Web Mercator נורמלית לריבוע [0,1]×[0,1]
  function mercX(lng) {
    return (lng + 180) / 360;
  }

  function mercY(lat) {
    var rad = (lat * Math.PI) / 180;
    var clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
    if (clamped !== lat) rad = (clamped * Math.PI) / 180;
    return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  }

  function cssColor(prop, fallback) {
    var value = "";
    if (window.getComputedStyle) {
      value = window.getComputedStyle(el.canvas).getPropertyValue(prop).trim();
    }
    return value || fallback;
  }

  function fallbackColors() {
    return {
      bg: cssColor("--stone-100", "#f5f5f4"),
      visited: cssColor("--good", "#2f7d5c"),
      pending: cssColor("--accent", "#a98a5f"),
      ink: cssColor("--ink", "#1c1917"),
      border: cssColor("--stone-300", "#d6d3d1")
    };
  }

  function mergeBbox(target, source) {
    if (source.minX < target.minX) target.minX = source.minX;
    if (source.minY < target.minY) target.minY = source.minY;
    if (source.maxX > target.maxX) target.maxX = source.maxX;
    if (source.maxY > target.maxY) target.maxY = source.maxY;
    return target;
  }

  function buildFallbackStreets() {
    F.proj = streetsCache.map(function (street) {
      var center = [mercX(street.lng), mercY(street.lat)];
      var lines = street.paths.map(function (polyline) {
        var pts = polyline.map(function (p) {
          return [mercX(p[1]), mercY(p[0])]; // path הוא [lat,lng]
        });
        return { pts: pts, bbox: bboxOf(pts) };
      });

      var bbox = { minX: center[0], minY: center[1], maxX: center[0], maxY: center[1] };
      lines.forEach(function (line) {
        mergeBbox(bbox, line.bbox);
      });

      return {
        id: street.id,
        name: street.name,
        area: street.area,
        hasPaths: lines.length > 0,
        lines: lines,
        center: center,
        bbox: bbox
      };
    });

    var acc = bboxOfAll(F.proj);
    if (acc) fitFallbackView(acc);
  }

  function bboxOf(pts) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function bboxOfAll(streets) {
    if (streets.length === 0) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    streets.forEach(function (street) {
      if (street.bbox.minX < minX) minX = street.bbox.minX;
      if (street.bbox.maxX > maxX) maxX = street.bbox.maxX;
      if (street.bbox.minY < minY) minY = street.bbox.minY;
      if (street.bbox.maxY > maxY) maxY = street.bbox.maxY;
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function fitFallbackView(bbox) {
    var dx = Math.max(bbox.maxX - bbox.minX, 0.0004);
    var dy = Math.max(bbox.maxY - bbox.minY, 0.0004);
    var margin = 1.25;
    var scale = Math.min(F.w / (dx * margin), F.h / (dy * margin));
    F.view.x = (bbox.minX + bbox.maxX) / 2;
    F.view.y = (bbox.minY + bbox.maxY) / 2;
    setFallbackScale(scale);
  }

  function clampView() {
    if (F.view.x < 0) F.view.x = 0;
    if (F.view.x > 1) F.view.x = 1;
    if (F.view.y < 0) F.view.y = 0;
    if (F.view.y > 1) F.view.y = 1;
  }

  function setFallbackScale(scale) {
    F.view.scale = Math.max(F.minScale, Math.min(F.maxScale, scale));
  }

  /** זום סביב נקודה על המסך: נקודת העולם מתחת לסמן נשארת קבועה */
  function zoomAtFallback(px, py, factor) {
    var wx = F.view.x + (px - F.w / 2) / F.view.scale;
    var wy = F.view.y + (py - F.h / 2) / F.view.scale;
    setFallbackScale(F.view.scale * factor);
    F.view.x = wx - (px - F.w / 2) / F.view.scale;
    F.view.y = wy - (py - F.h / 2) / F.view.scale;
    clampView();
  }

  function worldToScreen(p) {
    return [
      (p[0] - F.view.x) * F.view.scale + F.w / 2,
      (p[1] - F.view.y) * F.view.scale + F.h / 2
    ];
  }

  function fallbackVisible(bbox, pad) {
    pad = pad || 0.06;
    var halfW = F.w / 2 / F.view.scale + pad;
    var halfH = F.h / 2 / F.view.scale + pad;
    return (
      bbox.maxX >= F.view.x - halfW &&
      bbox.minX <= F.view.x + halfW &&
      bbox.maxY >= F.view.y - halfH &&
      bbox.minY <= F.view.y + halfH
    );
  }

  function requestFallbackDraw() {
    if (F.raf) return;
    F.raf = window.requestAnimationFrame(function () {
      F.raf = 0;
      drawFallback();
    });
  }

  function drawFallback() {
    var ctx = F.ctx;
    if (!ctx) return;
    var colors = fallbackColors();
    var streets = F.proj;
    var any = false;

    // LOD: בזום התחלתי מרוחק וברשימות גדולות — רק מבוקרים (מחושב פעם אחת לכל ציור)
    var showAll = streets.length <= LOD_STREET_LIMIT || F.view.scale >= 32768;

    ctx.clearRect(0, 0, F.w, F.h);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, F.w, F.h);

    // קו מסגרת עדין סביב "העולם" כדי שיהיה ברור שאין אריחים — רק ריבוע ההטלה
    var tl = worldToScreen([0, 0]);
    var br = worldToScreen([1, 1]);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);

    streets.forEach(function (street) {
      var visited = isVisited(street.id);
      if (!showAll && !visited) return;
      if (!fallbackVisible(street.bbox)) return;
      any = true;

      if (street.hasPaths) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        street.lines.forEach(function (line) {
          ctx.beginPath();
          var first = worldToScreen(line.pts[0]);
          ctx.moveTo(first[0], first[1]);
          for (var i = 1; i < line.pts.length; i += 1) {
            var p = worldToScreen(line.pts[i]);
            ctx.lineTo(p[0], p[1]);
          }
          // לא על צבע לבד: מבוקר = קו עבה; לא מבוקר = קו דק שקוף
          ctx.strokeStyle = visited ? colors.visited : colors.pending;
          ctx.lineWidth = visited ? 6 : 3;
          ctx.globalAlpha = visited ? 0.9 : 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
        // אינדיקטור ✓ בקצה הקו האחרון — לא תלוי בצבע
        if (visited) {
          var lastLine = street.lines[street.lines.length - 1];
          var end = worldToScreen(lastLine.pts[lastLine.pts.length - 1]);
          drawCheck(ctx, end[0], end[1], colors.visited, 9);
        }
      } else {
        var pt = worldToScreen(street.center);
        var radius = visited ? 9 : 6;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], radius, 0, Math.PI * 2);
        ctx.fillStyle = visited ? colors.visited : colors.pending;
        ctx.globalAlpha = visited ? 0.95 : 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        // מבוקר: תו ✓ בתוך העיגול; לא מבוקר: נקודה מסומנת
        if (visited) {
          drawCheck(ctx, pt[0], pt[1], colors.bg, 7);
        } else {
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 2, 0, Math.PI * 2);
          ctx.fillStyle = colors.ink;
          ctx.fill();
        }
      }
    });

    if (!any) {
      // כל הרחובות מחוץ למסך — אינדיקציה שהשכבה קיימת ועובדת
      ctx.fillStyle = colors.ink;
      ctx.globalAlpha = 0.35;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("המפה מציגה קווי רחובות בלי אריחים — גררו או התקרבו", F.w / 2, 20);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }
  }

  /** תו ✓ כציור על הקנבס — אינדיקטור שלא תלוי בצבע בלבד */
  function drawCheck(ctx, x, y, color, size) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = "bold " + size + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✓", x, y);
    ctx.restore();
    ctx.textAlign = "start";
  }

  function resizeFallback() {
    if (!F.canvas) return;
    F.dpr = window.devicePixelRatio || 1;
    var rect = el.canvas.getBoundingClientRect();
    F.w = Math.max(rect.width, 1);
    F.h = Math.max(el.canvas.clientHeight, 1);
    F.canvas.width = Math.round(F.w * F.dpr);
    F.canvas.height = Math.round(F.h * F.dpr);
    F.canvas.style.width = F.w + "px";
    F.canvas.style.height = F.h + "px";
    if (F.ctx) F.ctx.setTransform(F.dpr, 0, 0, F.dpr, 0, 0);
    requestFallbackDraw();
  }

  function squaredSegmentDistance(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var lengthSq = dx * dx + dy * dy;
    var t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    var cx = ax + t * dx;
    var cy = ay + t * dy;
    var ex = px - cx;
    var ey = py - cy;
    return ex * ex + ey * ey;
  }

  function squaredDistanceToStreet(street, px, py) {
    var best = Infinity;

    if (street.hasPaths) {
      street.lines.forEach(function (line) {
        for (var i = 0; i + 1 < line.pts.length; i += 1) {
          var a = worldToScreen(line.pts[i]);
          var b = worldToScreen(line.pts[i + 1]);
          var d = squaredSegmentDistance(px, py, a[0], a[1], b[0], b[1]);
          if (d < best) best = d;
        }
      });
    } else {
      var c = worldToScreen(street.center);
      var dx = c[0] - px;
      var dy = c[1] - py;
      best = dx * dx + dy * dy;
    }

    return best;
  }

  function fallbackHitTest(px, py) {
    var best = null;
    var tolerance = fallbackHitTolerance();
    var bestDistSq = tolerance * tolerance;
    F.proj.forEach(function (street) {
      if (!fallbackVisible(street.bbox, 0)) return;
      var distSq = squaredDistanceToStreet(street, px, py);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = street;
      }
    });
    return best;
  }

  function initFallback() {
    var cv = document.createElement("canvas");
    cv.className = "map-fallback__canvas";
    cv.setAttribute("tabindex", "0");
    cv.setAttribute("aria-label", "רינדור מפה מקומי בלי אריחים. החצים להזזה, פלוס ומינוס לזום, לחיצה על קו או נקודה מסמנת ביקור.");
    cv.style.position = "absolute";
    cv.style.inset = "0";
    cv.style.touchAction = "none";
    el.canvas.appendChild(cv);

    var controls = document.createElement("div");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "בקרי זום של המפה");
    var zoomIn = fallbackButton("התקרבות", "+");
    var zoomOut = fallbackButton("התרחקות", "−");
    var fit = fallbackButton("התאמת התצוגה לכל הרחובות", "התאם");
    controls.appendChild(zoomIn);
    controls.appendChild(zoomOut);
    controls.appendChild(fit);
    el.canvas.appendChild(controls);

    F.canvas = cv;
    F.ctx = cv.getContext("2d");

    // קודם מידות — כדי ש-fitFallbackView יחשב זום עם רוחב/גובה אמתיים, ולא עם F.w=F.h=0
    resizeFallback();
    buildFallbackStreets();
    requestFallbackDraw(); // אתחול הסדר: ציור ראשון אחרי שהפרויקציות קיימות

    // בקרי זום / התאמה
    zoomIn.addEventListener("click", function () {
      setFallbackScale(F.view.scale * 1.4);
      clampView();
      requestFallbackDraw();
    });
    zoomOut.addEventListener("click", function () {
      setFallbackScale(F.view.scale / 1.4);
      clampView();
      requestFallbackDraw();
    });
    fit.addEventListener("click", function () {
      var bbox = bboxOfAll(F.proj);
      if (bbox) fitFallbackView(bbox);
      requestFallbackDraw();
    });

    // גרירה (עכבר/מגע) — פאן במרחב ההטלה
    cv.addEventListener("pointerdown", function (event) {
      F.drag = { x: event.clientX, y: event.clientY };
      if (cv.setPointerCapture) {
        try { cv.setPointerCapture(event.pointerId); } catch (e) { /* לא קריטי */ }
      }
    });
    cv.addEventListener("pointermove", function (event) {
      if (!F.drag) return;
      var dx = event.clientX - F.drag.x;
      var dy = event.clientY - F.drag.y;
      if (dx === 0 && dy === 0) return;
      F.drag.x = event.clientX;
      F.drag.y = event.clientY;
      F.view.x -= dx / F.view.scale;
      F.view.y -= dy / F.view.scale;
      clampView();
      requestFallbackDraw();
    });
    cv.addEventListener("pointerup", function (event) {
      var dragged = F.drag && (event.clientX !== F.drag.x || event.clientY !== F.drag.y);
      F.drag = null;
      if (dragged) return;

      var rect = cv.getBoundingClientRect();
      var hit = fallbackHitTest(event.clientX - rect.left, event.clientY - rect.top);
      if (!hit) return;

      // לחיצה על קו/נקודה = סימון/ביטול ביקור דרך JLMAPI, ואז הכרזה טקסטואלית
      toggleStreetSafe(hit.id);
      var visited = isVisited(hit.id);
      el.status.textContent =
        hit.name + (hit.area ? ", " + hit.area : "") + " — " +
        (visited ? "הביקור סומן ✓" : "הביקור בוטל, טרם ביקרתם.");
    });
    cv.addEventListener("pointercancel", function () {
      F.drag = null;
    });

    // גלגלת העכבר: זום סביב נקודת הסמן — האותה קפיצה (×1.4) כמו הכפתורים.
    // מוצמד ל-#map-canvas עצמו (לא רק לקנבס הפנימי) — כדי שגלגלת מעל כל שטח המפה תזוז.
    // passive:false כדי ש-preventDefault יעבוד והעמוד לא יגלול; גלגלת מחוץ למפה לא נוגעים בה.
    el.canvas.addEventListener("wheel", function (event) {
      event.preventDefault();

      var deltaY = event.deltaY || 0;
      if (event.deltaMode === 1) deltaY *= 16; // שורות → פיקסלים (Firefox)
      else if (event.deltaMode === 2) deltaY *= F.h; // עמודים → פיקסלים
      deltaY = Math.max(-400, Math.min(400, deltaY)); // הגבלת קפיצה בגלגלת חדה

      var factor = Math.pow(1.4, -deltaY / 100); // למעלה (deltaY<0) = קירוב, אותה קפיצה כמו הכפתורים
      var rect = el.canvas.getBoundingClientRect();
      zoomAtFallback(event.clientX - rect.left, event.clientY - rect.top, factor);
      requestFallbackDraw();
    }, { passive: false });

    // מקלדת: החצים = פאן, +/- = זום (תואם ל-aria-label של המיכל)
    cv.addEventListener("keydown", function (event) {
      var step = 50;
      var dx = 0;
      var dy = 0;
      if (event.key === "ArrowUp") dy = -step;
      else if (event.key === "ArrowDown") dy = step;
      else if (event.key === "ArrowLeft") dx = -step;
      else if (event.key === "ArrowRight") dx = step;
      else if (event.key === "+" || event.key === "=") {
        setFallbackScale(F.view.scale * 1.4);
        event.preventDefault();
        requestFallbackDraw();
        return;
      } else if (event.key === "-" || event.key === "_") {
        setFallbackScale(F.view.scale / 1.4);
        event.preventDefault();
        requestFallbackDraw();
        return;
      } else {
        return;
      }
      event.preventDefault();
      F.view.x -= dx / F.view.scale;
      F.view.y -= dy / F.view.scale;
      clampView();
      requestFallbackDraw();
    });

    window.addEventListener("resize", resizeFallback);
    if (typeof window.ResizeObserver === "function") {
      new window.ResizeObserver(resizeFallback).observe(el.canvas);
    }
  }

  function fallbackButton(ariaLabel, text) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn map-fallback__btn";
    button.setAttribute("aria-label", ariaLabel);
    button.textContent = text;
    // כפתורים קטנים מעל הקנבס — מרוכזים לפינה הפנימית של מיכל LTR
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.minWidth = "2.2rem";
    button.style.padding = "0.2rem 0.45rem";
    button.style.fontSize = "0.85rem";
    return button;
  }

  /* =========================================================
      קישור ל-JLMBus ולמתג הרשת
      ========================================================= */

  function handleVisitedChange(event) {
    var detail = event.detail || {};
    var visited = Boolean(detail.visited);
    // עדכון ממוקד במופע אחד — בלי בנייה מחדש ובלי הכרזה (הרשימה כבר מכריזה)
    if (mode === "leaflet") {
      updateLeafletStreet(detail.id, visited);
    } else if (mode === "fallback") {
      requestFallbackDraw();
    }
  }

  function handleVisitedReplace() {
    // ייבוא/איפוס/מחיקה משנים את כל המצב — בנייה מחדש של הגיאומטריה ושל השכבות
    streetsCache = geoStreets();

    if (streetsCache.length === 0) {
      if (mode === "leaflet" && group) {
        if (map && map.closePopup) {
          try { map.closePopup(); } catch (error) { /* לא קריטי */ }
        }
        group.clearLayers();
        layerById = Object.create(null);
        hitById = Object.create(null);
        metaById = Object.create(null);
      } else if (mode === "fallback") {
        F.proj = [];
        requestFallbackDraw();
      }
      updateEmptyMessage();
      el.empty.hidden = false;
      refreshStatus();
      return;
    }

    el.empty.hidden = true;
    if (mode === "leaflet") {
      drawLeaflet();
      refreshStatus();
    } else if (mode === "fallback") {
      buildFallbackStreets();
      requestFallbackDraw();
      refreshStatus();
    } else {
      // הטעינה הראשונה הייתה ריקה (אין רחובות), ולכן המפה מעולם לא אותחלה.
      // ייבוא/הוספה החזירו רחובות — מאתחלים עכשיו במקום להשאיר מפה מתה.
      init();
    }
  }

  if (window.JLMBus) {
    window.JLMBus.addEventListener("visited-change", handleVisitedChange);
    window.JLMBus.addEventListener("visited-replace", handleVisitedReplace);
    window.JLMBus.addEventListener("streets-change", handleVisitedReplace);
  }

  el.toggle.addEventListener("click", function () {
    setNetwork(!networkOff);
  });

  /* ---------- אתחול ---------- */

  function init() {
    streetsCache = geoStreets();

    if (streetsCache.length === 0) {
      updateEmptyMessage();
      el.empty.hidden = false;
      refreshStatus();
      return;
    }

    el.empty.hidden = true;

    if (window.L && typeof window.L.map === "function") {
      mode = "leaflet";
      try {
        initLeaflet();
      } catch (error) {
        mode = null;
        map = null;
        fallbackAfterLeafletFailure(error);
        return;
      }
      refreshStatus();
      return;
    }

    mode = "fallback";
    try {
      initFallback();
    } catch (error) {
      mode = null;
      // כשל גיבוי עצמו: אין לנו לאן לנסות פחות — מבקשים מהמשתמש לא להיתקע
      el.empty.hidden = false;
      el.empty.textContent =
        "לא ניתן להפעיל את המפה כרגע (ספריית המפה לא נטענה וגם הרינדור המקומי נכשל). " +
        "הרשימה למטה ממשיכה לעבד כרגיל, עם כל הסימונים והנתונים שלכם.";
      return;
    }
    showBanner(
      "ספריית המפה לא נטענה (אין חיבור ל-CDN או שהוא נחסם). מוצג רינדור מקומי בלי אריחי רקע."
    );
    refreshStatus();
  }

  /**
   * כש-Leaflet קיים אבל האתחול נפל (למשל קונטיינר קטן מדי בזמן טעינה) —
   * מנסים פעם אחת נוספת, ואם לא — עוברים למסלול הגיבוי.
   */
  function fallbackAfterLeafletFailure(error) {
    if (map && typeof map.remove === "function") {
      try { map.remove(); } catch (e) { /* אין משמעות אם זה נכשל */ }
      map = null;
      tiles = null;
      group = null;
    }
    if (retries < 2) {
      retries += 1;
      window.setTimeout(function () {
        mode = "leaflet";
        try {
          initLeaflet();
        } catch (e) {
          retries = 2; // לא לעלות רקורסיה אינסופית
          fallbackAfterLeafletFailure(e);
          return;
        }
        refreshStatus();
      }, 300);
      return;
    }
    mode = "fallback";
    try {
      initFallback();
      showBanner("מפת Leaflet לא הופעלה (" + (error && error.message ? error.message : "שגיאה") + "). מוצג רינדור מקומי בלי אריחים.");
      refreshStatus();
    } catch (e2) {
      mode = null;
      el.empty.hidden = false;
      el.empty.textContent =
        "לא ניתן להפעיל את המפה כרגע. הרשימה למטה ממשיכה לעבוד כרגיל.";
    }
  }

  /* ===== מופע JLMMap שנחשף לדפדפן / לסביבת בדיקות ===== */

  window.JLMMap = {
    refresh: function () {
      if (mode === "leaflet") {
        streetsCache = geoStreets();
        drawLeaflet();
        refreshStatus();
      } else if (mode === "fallback") {
        streetsCache = geoStreets();
        buildFallbackStreets();
        requestFallbackDraw();
        refreshStatus();
      }
    },
    setNetwork: setNetwork,
    zoomToStreet: zoomToStreet,
    zoomToArea: zoomToArea,
    isReady: function () {
      return mode !== null;
    },
    // חשיפה לקורא בלבד (בדיקות/אבחון) — לא משנה התנהגות
    tileProviderState: function () {
      return {
        provider: provider ? provider.id : null,
        chain: tileChain ? tileChain.map(function (p) { return p.id; }) : [],
        exhausted: Object.keys(exhausted),
        chainExhausted: chainExhausted,
        blocked: tilesBlocked,
        banner: bannerKind,
        networkOff: networkOff
      };
    }
  };

  init();
})();
