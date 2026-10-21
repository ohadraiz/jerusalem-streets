/**
 * בונה את assets/data.js ו-assets/geo.js מתוך סט הרחובות של OSM + גיאומטריה.
 *
 * שימוש:
 *   node tools/build-app-data.js <jlm_streets_v2.json> <jlm_seed_map.json> <osm-paths.json>
 *
 * כללי ברזל:
 *  1. מזהי 75 הרחובות המקוריים חייבים להישמר — הם המפתח ב-localStorage.
 *  2. אין להמציא קואורדינטות או קווים. רחוב בלי גיאומטריה נשאר עם נקודה בלבד.
 *  3. שכונות שסומנו להסרה אינן נכנסות לאפליקציה (ראה EXCLUDED_AREAS).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const streetsPath = process.argv[2];
const seedMapPath = process.argv[3];
const pathsPath = process.argv[4];

if (!streetsPath || !seedMapPath || !pathsPath) {
  console.error("usage: node tools/build-app-data.js <jlm_streets_v2.json> <jlm_seed_map.json> <osm-paths.json>");
  process.exit(1);
}

/* ---------- שכונות מוחרגות ---------- */

const EXCLUDED_AREAS = [
  "א־סוואחרה אל־ע'רביה",
  "אבו תור",
  "א-טור",
  "אום טובא",
  "באב א-זהרה",
  "בית חנינא",
  "בית צפאפא",
  "כפר עקב",
  "מחנה פליטים שועפט"
];

function areaKey(value) {
  return String(value || "")
    .replace(/[\u05BE\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const excluded = new Set(EXCLUDED_AREAS.map(areaKey));

function isExcluded(area) {
  return excluded.has(areaKey(area));
}

/* ---------- שמות גנריים — לא שמות רחובות ---------- */

const GENERIC_PREFIXES = ["כביש שירות", "כביש גישה", "דרך שירות", "דרך גישה", "כביש פנימי"];
const GENERIC_NAMES = new Set(["ללא שם", "unknown", "unnamed"]);

function isGenericName(name) {
  const value = String(name || "").trim();
  if (GENERIC_NAMES.has(value.toLowerCase())) return true;
  return GENERIC_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/* ---------- זרעים שהוצאו מהאפליקציה ---------- */

const retiredSeedIds = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, "retired-seed-ids.json"), "utf8"))
);

/* ---------- נרמול שמות (זהה לחילוץ) ---------- */

function normalize(text) {
  return String(text || "")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/["'׳״`]/g, "")
    .replace(/[-\u2010-\u2015]/g, " ")
    .replace(/\bסמ\s*\d+\b/g, " ")
    .replace(/^(רחוב|דרך|שדרות|מדרחוב|סמטת|כיכר)\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ---------- קריאה ---------- */

const raw = JSON.parse(fs.readFileSync(streetsPath, "utf8"));
const incoming = Array.isArray(raw) ? raw : raw.streets;
const seedMap = JSON.parse(fs.readFileSync(seedMapPath, "utf8"));
const paths = JSON.parse(fs.readFileSync(pathsPath, "utf8"));

if (!Array.isArray(incoming) || incoming.length === 0) {
  console.error("לא נמצאו רחובות בקלט");
  process.exit(1);
}

/* ---------- מיפוי מזהה OSM → מזהה זרע ---------- */

const seedIdByOsmId = new Map();
for (const seed of seedMap) {
  if (seed.status === "matched" && seed.osmId) seedIdByOsmId.set(seed.osmId, seed.seedId);
}

/* ---------- חיתוך גיאומטריה לסביבת הרחוב ---------- */

// מקור הגיאומטריה ארצי: לאותו שם יכולים להיות מקטעים בערים אחרות.
// חותכים לנקודות שקרובות למרכז הרחוב (שמגיע ממיפוי ירושלים בלבד).
const CLIP_RADIUS_KM = 4;
let clippedStreets = 0;
let removedPoints = 0;

function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function clipToRadius(lines, lat, lng) {
  const out = [];
  let removed = 0;

  for (const line of lines) {
    let run = [];
    for (const point of line) {
      if (distanceKm(lat, lng, point[0], point[1]) <= CLIP_RADIUS_KM) {
        run.push(point);
      } else {
        removed += 1;
        if (run.length >= 2) out.push(run);
        run = [];
      }
    }
    if (run.length >= 2) out.push(run);
  }

  return { lines: out, removed };
}

/* ---------- מיזוג ---------- */

const SEED_ALIASES = { "salah-al-din": "צאלח א דין" };

const byId = new Map();
let streets = [];
let dropped = 0;
let droppedGeneric = 0;
let duplicates = 0;

for (const street of incoming) {
  if (!street || !street.id || !street.name) continue;
  if (isExcluded(street.area)) {
    dropped += 1;
    continue;
  }

  if (isGenericName(street.name)) {
    droppedGeneric += 1;
    continue;
  }

  const id = seedIdByOsmId.get(street.id) || street.id;
  if (byId.has(id)) {
    duplicates += 1;
    console.log("אזהרה: מזהה כפול", id, "—", street.name);
    continue;
  }

  const lat = typeof street.lat === "number" ? Number(street.lat.toFixed(6)) : null;
  const lng = typeof street.lng === "number"
    ? Number(street.lng.toFixed(6))
    : typeof street.lon === "number"
      ? Number(street.lon.toFixed(6))
      : null;

  let geometry = paths[normalize(street.name)] || null;
  if (geometry && lat !== null && lng !== null) {
    const clipped = clipToRadius(geometry, lat, lng);
    if (clipped.removed > 0) {
      clippedStreets += 1;
      removedPoints += clipped.removed;
    }
    geometry = clipped.lines.length > 0 ? clipped.lines : null;
  }

  const entry = {
    id: String(id),
    name: String(street.name),
    area: String(street.area || "אחר"),
    lat,
    lng
  };
  if (street.nameEn) entry.nameEn = String(street.nameEn);
  if (geometry && geometry.length > 0) entry.paths = geometry;

  byId.set(entry.id, entry);
  streets.push(entry);
}

/* ---------- זרעים שלא נמצאו ב-OSM ---------- */

const missingSeeds = [];
for (const seed of seedMap) {
  if (byId.has(seed.seedId)) continue;
  if (isExcluded(seed.seedArea)) continue;

  const entry = {
    id: seed.seedId,
    name: seed.seedName,
    area: seed.seedArea || "אחר",
    lat: null,
    lng: null
  };

  // גם זרע שלא הותאם יכול לקבל גיאומטריה לפי השם המנורמל
  const geometry = paths[normalize(SEED_ALIASES[seed.seedId] || seed.seedName)] || null;
  if (geometry && geometry.length > 0) {
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    for (const line of geometry) {
      for (const point of line) {
        sumLat += point[0];
        sumLng += point[1];
        count += 1;
      }
    }

    if (count > 0) {
      entry.lat = Number((sumLat / count).toFixed(6));
      entry.lng = Number((sumLng / count).toFixed(6));

      // גם כאן: לא לאחד מקטעים ממקומות אחרים בארץ
      const clipped = clipToRadius(geometry, entry.lat, entry.lng);
      if (clipped.removed > 0) {
        clippedStreets += 1;
        removedPoints += clipped.removed;
      }
      entry.paths = clipped.lines.length > 0 ? clipped.lines : geometry;
    } else {
      entry.paths = geometry;
    }
  }

  byId.set(entry.id, entry);
  streets.push(entry);
  missingSeeds.push(entry);
}

/* ---------- מיון ---------- */

streets.sort((a, b) => {
  const areaCompare = a.area.localeCompare(b.area, "he");
  if (areaCompare !== 0) return areaCompare;
  return a.name.localeCompare(b.name, "he");
});

/* ---------- השמטת רחובות בלי גיאומטריה ---------- */

const beforeGeometryFilter = streets.length;
streets = streets.filter((street) => Array.isArray(street.paths) && street.paths.length > 0);
const droppedNoGeometry = beforeGeometryFilter - streets.length;

/* ---------- בדיקות ---------- */

const finalIds = new Set(streets.map((street) => street.id));

const lostSeeds = seedMap
  .filter(
    (seed) =>
      !finalIds.has(seed.seedId) &&
      !isExcluded(seed.seedArea) &&
      !retiredSeedIds.has(seed.seedId)
  )
  .map((seed) => seed.seedId);

if (lostSeeds.length > 0) {
  console.error("נכשלה שמירת מזהי זרע:", lostSeeds);
  process.exit(1);
}

const withCoords = streets.filter((street) => street.lat !== null && street.lng !== null);
const withPaths = streets.filter((street) => Array.isArray(street.paths) && street.paths.length > 0);
const invalid = withCoords.filter(
  (street) =>
    !Number.isFinite(street.lat) ||
    !Number.isFinite(street.lng) ||
    Math.abs(street.lat) > 90 ||
    Math.abs(street.lng) > 180
);

if (invalid.length > 0) {
  console.error("קואורדינטות לא תקינות:", invalid.slice(0, 5));
  process.exit(1);
}

for (const street of withPaths) {
  for (const line of street.paths) {
    if (!Array.isArray(line) || line.length < 2) {
      console.error("פוליליין לא תקין ב-", street.id);
      process.exit(1);
    }
  }
}

/* ---------- כתיבה ---------- */

const meta = {
  version: 3,
  source: "OpenStreetMap — Geofabrik israel-and-palestine extract (2026-10-20)",
  attribution: "© OpenStreetMap contributors (ODbL)",
  updatedAt: new Date().toISOString().slice(0, 10)
};

const listStreets = streets.map((street) => {
  const copy = {
    id: street.id,
    name: street.name,
    area: street.area,
    lat: street.lat,
    lng: street.lng
  };
  if (street.nameEn) copy.nameEn = street.nameEn;
  return copy;
});

const dataJs =
  "/**\n" +
  " * רשימת הרחובות של האפליקציה.\n" +
  " * id — מזהה יציב; הוא המפתח ב-localStorage ואסור שישתנה.\n" +
  " * מקור: " + meta.source + "\n" +
  " * ייחוס: " + meta.attribution + "\n" +
  " */\n" +
  "window.JLM_DATA = " +
  JSON.stringify({ ...meta, streets: listStreets }, null, 0) +
  ";\n";

const geoJs =
  "/**\n" +
  " * גיאומטריית הרחובות לשכבת המפה.\n" +
  " * paths: מערך פוליליינים, כל נקודה [lat, lng] ב-WGS84.\n" +
  " * מקור: " + meta.source + "\n" +
  " * ייחוס: " + meta.attribution + "\n" +
  " */\n" +
  "window.JLM_GEO = " +
  JSON.stringify(
    {
      source: meta.source,
      collectedAt: meta.updatedAt,
      streets: withCoords.map((street) => {
        const copy = {
          id: street.id,
          name: street.name,
          area: street.area,
          lat: street.lat,
          lng: street.lng
        };
        if (street.paths) copy.paths = street.paths;
        return copy;
      })
    },
    null,
    0
  ) +
  ";\n";

fs.writeFileSync(path.join(root, "assets", "data.js"), dataJs);
fs.writeFileSync(path.join(root, "assets", "geo.js"), geoJs);

const areaCount = new Set(streets.map((street) => street.area)).size;
const pointTotal = withPaths.reduce(
  (sum, street) => sum + street.paths.reduce((inner, line) => inner + line.length, 0),
  0
);

const lengthsKm = withPaths
  .map((street) => {
    let km = 0;
    for (const line of street.paths) {
      for (let index = 1; index < line.length; index += 1) {
        km += distanceKm(line[index - 1][0], line[index - 1][1], line[index][0], line[index][1]);
      }
    }
    return { name: street.name, km };
  })
  .sort((a, b) => b.km - a.km);

console.log("סה\"כ רחובות:", streets.length);
console.log("הוסרו (שכונות מוחרגות):", dropped);
console.log("הוסרו (שמות גנריים):", droppedGeneric);
console.log("הוסרו (בלי גיאומטריה):", droppedNoGeometry);
if (duplicates > 0) console.log("מזהים כפולים שדולגו:", duplicates);
console.log("עם קואורדינטות:", withCoords.length);
console.log("עם קו (paths):", withPaths.length);
console.log("נקודות בקווים:", pointTotal.toLocaleString());
console.log("חיתוך סביב המרכז: הוסרו", removedPoints.toLocaleString(), "נקודות ב-" + clippedStreets, "רחובות");
if (lengthsKm.length > 0) {
  console.log("הארוך ביותר:", lengthsKm[0].name, lengthsKm[0].km.toFixed(2), "ק\"מ");
  console.log("מעל 15 ק\"מ:", lengthsKm.filter((item) => item.km > 15).length);
}
console.log("שכונות:", areaCount);
const activeSeeds = seedMap.filter((seed) => !retiredSeedIds.has(seed.seedId));
const keptSeeds = activeSeeds.filter((seed) => finalIds.has(seed.seedId)).length;
console.log("מזהי זרע פעילים:", keptSeeds, "/", activeSeeds.length);
const stillMissing = missingSeeds.filter((street) => finalIds.has(street.id));
if (stillMissing.length > 0) {
  console.log("זרעים ללא OSM (נשארו):", stillMissing.map((street) => street.name).join(" | "));
}
if (retiredSeedIds.size > 0) {
  console.log("זרעים שהוצאו:", [...retiredSeedIds].join(" | "));
}
console.log("data.js:", (fs.statSync(path.join(root, "assets", "data.js")).size / 1024).toFixed(0), "KB");
console.log("geo.js:", (fs.statSync(path.join(root, "assets", "geo.js")).size / 1024).toFixed(0), "KB");
