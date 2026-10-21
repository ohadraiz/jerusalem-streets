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

const CACHE_NAME = "jlm-shell-v1";

/* הקבצים הקטנים שנטענים בכל פעם — מטמונים מיד בהתקנה */
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/store.js",
  "./assets/map.js",
  "./assets/ui.js",
  "./assets/sw-register.js",
  "./assets/vendor/leaflet/leaflet.js",
  "./assets/vendor/leaflet/leaflet.css",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {
        /* התקנה חלקית — לא מפילים את ההתקנה */
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
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
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        }
        // שגיאת שרת (5xx, כולל 502 מפרוקסי) — מנסים מהמטמון לפני שמחזירים אותה
        if (response && response.status >= 500) {
          return caches.match(request).then((cached) => cached || response);
        }
        return response;
      })
      .catch(() => fromCache(request))
  );
});

/** מהמטמון — לניווט מחזירים את דף הבית השמור */
function fromCache(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./index.html");
    return Response.error();
  });
}
