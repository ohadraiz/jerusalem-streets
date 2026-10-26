/**
 * Service Worker — "רחובות ירושלים".
 *
 * מטרתו: לאפליקציה שעובדת גם בלי חיבור (אחרי ביקור אחד), בלי להפיך את האריחים
 * ל"מטמון אישי" — אריחי OSM לא נשמרים כאן מעבר לכותרי השרת, לפי מדיניות השימוש.
 *
 * אסטרטגיה:
 * - קבצי האפליקציה (HTML/CSS/JS/סמלים): **network-first** — תמיד מבקשים מהשרת,
 *   ורק אם אין רשת משתמשים במטמון. כך עדכון בשרת נראה מיד ואין גרסאות ישנות.
 * - מגני אריחים (tile.openstreetmap.org וכו'): לא נגעים בהם בכלל — דפדפן מטמן לפי
 *   כותרי ה-HTTP של השרת, בדיוק כמו שמדיניות OSM מצפה.
 */
"use strict";

const CACHE_NAME = "jlm-shell-v4";

/* מעטפת האפליקציה + נתוני הרחובות והגיאומטריה — מטמונים כבר בהתקנה,
   כדי שביקור ראשון יספיק לפתיחה מלאה במצב לא מקוון */
const PRECACHE = [
  "./",
  "./index.html",
  "./app.html",
  "./welcome.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/pwa.css",
  "./assets/pwa.js",
  "./assets/data.js",
  "./assets/geo.js",
  "./assets/app.js",
  "./assets/store.js",
  "./assets/map.js",
  "./assets/ui.js",
  "./assets/dyk-facts.js",
  "./assets/sw-register.js",
  "./assets/vendor/leaflet/leaflet.js",
  "./assets/vendor/leaflet/leaflet.css",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  /* מאגר "הידעת?" — אינדקס + קבצי העובדות, כדי שהתגליות יעבדו גם במצב לא מקוון */
  "./data/didyouknow/index.json"
];

/* קבצי העובדות עצמם (data/didyouknow/<id>.txt) — נטענים לפי ביקוש ונשמרים במטמון */
const FACT_CACHE = "jlm-facts-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {
        /* התקנה חלקית — לא מפילים את ההתקנה */
      })
      .then(() => precacheFacts())
      .catch(() => {
        /* מאגר העובדות לא נטען — המשתמש יקבל אותו בביקור הראשון */
      })
      .then(() => self.skipWaiting())
  );
});

/**
 * מטמון קובצי העובדות של "הידעת?" בעת ההתקנה, לפי אינדקס.
 * נקרא באופן דינמי כדי שהרשימה תישאר מעודכנת גם כשמוסיפים רחובות חדשים
 * למאגר — בלי לערוך ידנית את sw.js.
 */
function precacheFacts() {
  return fetch("./data/didyouknow/index.json")
    .then((response) => (response && response.ok ? response.json() : null))
    .then((index) => {
      if (!index || !Array.isArray(index.ids) || !index.ids.length) return null;
      const files = index.ids.map((id) => "./data/didyouknow/" + id + ".txt");
      return caches.open(FACT_CACHE).then((cache) => cache.addAll(files));
    })
    .catch(() => null);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== FACT_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // רק קבצים מאותו מקור — אריחים ו-CDN נשארים לדפדפן
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          const target = isFactRequest(url) ? FACT_CACHE : CACHE_NAME;
          caches.open(target).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        }
        // שגיאת שרת (5xx, כולל 502 מפרוקסי) — מנסים מהמטמון לפני שמחזירים אותה.
        // בניווט מתעלמים משאילתה כדי לשמור על יעד הדף גם ללא רשת.
        if (response && response.status >= 500) {
          return caches.match(request, { ignoreSearch: request.mode === "navigate" }).then((cached) => {
            if (cached) return cached;
            if (request.mode === "navigate") {
              return caches.match("./app.html").then((shell) => shell || response);
            }
            return response;
          });
        }
        return response;
      })
      .catch(() => fromCache(request))
  );
});

/** קובצי העובדות של "הידעת?" — נשמרים במטמון נפרד מהמעטפת */
function isFactRequest(url) {
  return url.pathname.indexOf("/data/didyouknow/") !== -1;
}

/** מהמטמון — לניווט מחזירים את דף האפליקציה השמור */
function fromCache(request) {
  return caches.match(request, { ignoreSearch: request.mode === "navigate" }).then((cached) => {
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./app.html");
    return Response.error();
  });
}
