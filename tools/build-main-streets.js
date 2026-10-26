/**
 * בונה assets/main-streets.js מקובץ Overpass JSON (OpenStreetMap, ODbL).
 *
 * שימוש:
 *   node tools/build-main-streets.js <osm-ways.json>
 *
 * הקלט: `way["highway"~"^(trunk|primary|secondary|tertiary)$"](bbox); out tags geom;`
 * הדירוג: 1 = trunk/primary, 2 = secondary, 3 = tertiary.
 *
 * השיטה: דגימת נקודות לאורך כל רחוב מ-assets/geo.js, ואיתור הקטע המקביל הקרוב
 * ביותר ב-OSM (עד 12 מ', סטייה זוויתית עד 25°) כדי לא "לתפוס" רחוב חוצה בצומת.
 * רחוב מסווג רק אם יש לפחות 6 דגימות מסווגות והכיתה הדומיננטית היא 50% ומעלה
 * מהן. קטעים שאינם מכוסים ע"י אחת מארבע הכיתות (למשל מדרחוב) פשוט אינם מצביעים.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const waysPath = process.argv[2];

if (!waysPath) {
  console.error("usage: node tools/build-main-streets.js <osm-ways.json>");
  process.exit(1);
}

const TIER = { trunk: 1, primary: 1, secondary: 2, tertiary: 3 };
const METERS_PER_DEG_LAT = 111320;
const CELL_DEG = 0.001; // ~110 מ'
const MAX_DISTANCE_M = 12;
const MIN_PARALLEL = 0.9; // cos 25°
const SAMPLE_M = 20;
const MIN_CLASSIFIED_SAMPLES = 6;
const MIN_SHARE = 0.5;

const data = JSON.parse(fs.readFileSync(waysPath, "utf8"));
const ways = data.elements.filter(
  (way) => way.geometry && way.geometry.length > 1 && TIER[way.tags && way.tags.highway]
);

/* ---------- אינדקס מרחבי על קטעי OSM ---------- */
const grid = new Map();

function cellKey(lat, lng) {
  return Math.floor(lat / CELL_DEG) + ":" + Math.floor(lng / CELL_DEG);
}

ways.forEach((way) => {
  const tier = TIER[way.tags.highway];
  for (let i = 1; i < way.geometry.length; i += 1) {
    const a = way.geometry[i - 1];
    const b = way.geometry[i];
    const key = cellKey((a.lat + b.lat) / 2, (a.lon + b.lon) / 2);
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push({ lat1: a.lat, lng1: a.lon, lat2: b.lat, lng2: b.lon, tier });
  }
});

/* ---------- התאמת דגימה לקטע OSM מקביל וקרוב ---------- */
function parallelTierAt(lat, lng, directionX, directionY) {
  const kx = METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const cellLat = Math.floor(lat / CELL_DEG);
  const cellLng = Math.floor(lng / CELL_DEG);
  let bestTier = 0;
  let bestDistance = MAX_DISTANCE_M;

  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      const bucket = grid.get(cellLat + dLat + ":" + (cellLng + dLng));
      if (!bucket) continue;

      for (const segment of bucket) {
        const bx = (segment.lng2 - segment.lng1) * kx;
        const by = (segment.lat2 - segment.lat1) * METERS_PER_DEG_LAT;
        const length = Math.sqrt(bx * bx + by * by);
        if (length === 0) continue;

        // מקבילות: כיוון הרחוב שלנו מול כיוון הקטע
        const dot = Math.abs((bx / length) * directionX + (by / length) * directionY);
        if (dot < MIN_PARALLEL) continue;

        const px = (lng - segment.lng1) * kx;
        const py = (lat - segment.lat1) * METERS_PER_DEG_LAT;
        const t = Math.max(0, Math.min(1, (px * bx + py * by) / (length * length)));
        const dx = px - bx * t;
        const dy = py - by * t;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < bestDistance - 0.01) {
          bestDistance = distance;
          bestTier = segment.tier;
        }
      }
    }
  }

  return bestTier;
}

/* ---------- דגימת רחובות מתוך JLM_GEO ---------- */
global.window = {};
require(path.join(root, "assets", "geo.js"));
const streets = global.window.JLM_GEO.streets;

function samplesOf(street) {
  const points = [];
  (street.paths || []).forEach((line) => {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1];
      const b = line[i];
      const kx = METERS_PER_DEG_LAT * Math.cos((a[0] * Math.PI) / 180);
      const dLat = (b[0] - a[0]) * METERS_PER_DEG_LAT;
      const dLng = (b[1] - a[1]) * kx;
      const length = Math.sqrt(dLat * dLat + dLng * dLng);
      const directionX = length > 0 ? dLng / length : 1;
      const directionY = length > 0 ? dLat / length : 0;
      const steps = Math.max(1, Math.ceil(length / SAMPLE_M));
      for (let s = 0; s < steps; s += 1) {
        const t = (s + 0.5) / steps;
        points.push({
          lat: a[0] + (b[0] - a[0]) * t,
          lng: a[1] + (b[1] - a[1]) * t,
          directionX: directionX,
          directionY: directionY
        });
      }
    }
  });
  if (points.length === 0) {
    points.push({ lat: street.lat, lng: street.lng, directionX: 1, directionY: 0 });
  }
  return points;
}

function tierOf(street) {
  const votes = { 1: 0, 2: 0, 3: 0 };
  samplesOf(street).forEach((point) => {
    const tier = parallelTierAt(point.lat, point.lng, point.directionX, point.directionY);
    if (tier) votes[tier] += 1;
  });

  const classified = votes[1] + votes[2] + votes[3];
  if (classified < MIN_CLASSIFIED_SAMPLES) return 0;

  let bestTier = 0;
  let bestVotes = 0;
  [1, 2, 3].forEach((tier) => {
    if (votes[tier] > bestVotes) {
      bestVotes = votes[tier];
      bestTier = tier;
    }
  });

  return bestVotes / classified >= MIN_SHARE ? bestTier : 0;
}

const tiers = Object.create(null);
const stats = { 1: 0, 2: 0, 3: 0, 0: 0 };

streets.forEach((street) => {
  const tier = tierOf(street);
  stats[tier] += 1;
  if (tier) tiers[street.id] = tier;
});

const output =
  "/* נוצר אוטומטית ע\"י tools/build-main-streets.js — אין לערוך ידנית.\n" +
  "   מקור: OpenStreetMap (ODbL), תגיות highway=trunk/primary/secondary/tertiary.\n" +
  "   דירוג: 1 = trunk/primary, 2 = secondary, 3 = tertiary. */\n" +
  "window.JLM_MAIN_STREETS = " + JSON.stringify({
    source: "OpenStreetMap",
    license: "ODbL",
    fetched: new Date().toISOString().slice(0, 10),
    tiers: tiers
  }) + ";\n";

fs.writeFileSync(path.join(root, "assets", "main-streets.js"), output, "utf8");

console.log(
  "make-main-streets: " + streets.length + " רחובות, מסווגים " +
  (stats[1] + stats[2] + stats[3]) + " (1=" + stats[1] + ", 2=" + stats[2] + ", 3=" + stats[3] + ")"
);
console.log("make-main-streets: נכתב assets/main-streets.js (" + output.length + " בתים)");
