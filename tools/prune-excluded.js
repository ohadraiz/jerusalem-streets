/**
 * מוציא מהנתונים הפעילים כבישים, מנהרות, "מנחם בגין"
 * ואת ארבע השכונות שבהן נותר רחוב אחד בלבד.
 *
 * הרצה: node tools/prune-excluded.js
 * בדיקה בלי לכתוב: node tools/prune-excluded.js --dry-run
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

function loadWindow(file) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  return ctx.window;
}

const data = loadWindow("assets/data.js").JLM_DATA;
const geo = loadWindow("assets/geo.js").JLM_GEO;

const explicit = new Map([
  ["jlm-d36cf7b051", "highway"],
  ["jlm-4100513d69", "highway"],
  ["jlm-d4b06e73c4", "highway"],
  ["jlm-1593dd6e4d", "highway"],
  ["jlm-6048621c58", "highway"],
  ["jlm-7759f70285", "highway"],
  ["jlm-65f3203532", "tunnel"],
  ["jlm-d678b1207a", "tunnel"],
  ["jlm-57ecb9f4d0", "tunnel"],
  ["jlm-d1a9ebab89", "tunnel"],
  ["jlm-ac3ade9539", "tunnel"],
  ["jlm-58f1b82906", "tunnel"],
  ["jlm-87b797f5dc", "explicit-request-menachem-begin"]
]);

// שכונות שבהן יש רחוב אחד בלבד — הוסרו כיחידה שלמה, כבקשת המשתמש.
const oneStreetAreas = new Set([
  "אבו טור",
  "בית חולים הדסה עין כרם",
  "סילוואן",
  "קרית אונסדורף"
]);

function reasonFor(street) {
  if (explicit.has(street.id)) return explicit.get(street.id);
  if (oneStreetAreas.has(street.area)) return "one-street-neighborhood";
  return null;
}

const removed = data.streets
  .map((street) => ({ street, reason: reasonFor(street) }))
  .filter((item) => item.reason);

if (removed.length === 0) {
  console.log("הנתונים כבר נקיים — אין מה להסיר.");
  process.exit(0);
}

const removedIds = new Set(removed.map((item) => item.street.id));
const remainingData = data.streets.filter((street) => !removedIds.has(street.id));
const remainingGeo = geo.streets.filter((street) => !removedIds.has(street.id));

const counts = new Map();
for (const street of remainingData) {
  counts.set(street.area, (counts.get(street.area) || 0) + 1);
}
const single = [...counts.entries()].filter(([, count]) => count === 1).map(([area]) => area);
const missingGeo = remainingData.filter((street) => !remainingGeo.some((item) => item.id === street.id));

const expected = {
  removed: 17,
  remaining: 2239,
  areasRemaining: 101
};

console.log(JSON.stringify({
  dryRun,
  removed: removed.length,
  remainingData: remainingData.length,
  remainingGeo: remainingGeo.length,
  areasRemaining: counts.size,
  removedByReason: removed.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] || 0) + 1;
    return acc;
  }, {}),
  removedList: removed.map((item) => ({
    id: item.street.id,
    name: item.street.name,
    area: item.street.area,
    reason: item.reason
  })),
  singleStreetAreasLeft: single,
  missingGeo: missingGeo.map((street) => street.id),
  expected
}, null, 2));

if (dryRun) process.exit(0);

if (removed.length !== expected.removed || remainingData.length !== expected.remaining) {
  throw new Error("ספירת ההסרה אינה כצפוי — לא נכתבו קבצים");
}
if (single.length > 0) {
  throw new Error("נשארו שכונות עם רחוב אחד — לא נכתבו קבצים: " + single.join(" | "));
}
if (missingGeo.length > 0) {
  throw new Error("חסרה גיאומטריה לרחובות שנשארו — לא נכתבו קבצים");
}

const retiredAt = "2026-10-21";
const archive = {
  retiredAt,
  note: "הוסרו מהנתונים הפעילים לפי בקשת המשתמש; הגיבוי המקורי נמצא ב-backups/.",
  streets: removed.map(({ street, reason }) => {
    const geometry = geo.streets.find((item) => item.id === street.id);
    return {
      id: street.id,
      name: street.name,
      area: street.area,
      reason,
      data: street,
      paths: geometry ? geometry.paths : []
    };
  })
};

const dataHeader = `/**
 * רשימת הרחובות של האפליקציה.
 * id — מזהה יציב; הוא המפתח ב-localStorage ואסור שישתנה.
 * מקור: ${data.source}
 * ייחוס: ${data.attribution}
 * עודכן: ${retiredAt} — הוסרו כבישים, מנהרות, מנחם בגין ושכונות חד-רחוב.
 */

`;
const geoHeader = `/**
 * גיאומטריית הרחובות לשכבת המפה.
 * paths: מערך פוליליינים, כל נקודה [lat, lng] ב-WGS84.
 * מקור: ${geo.source}
 * ייחוס: ${data.attribution}
 * עודכן: ${retiredAt} — הוסרו כבישים, מנהרות, מנחם בגין ושכונות חד-רחוב.
 */

`;

const nextData = { ...data, updatedAt: retiredAt, streets: remainingData };
const nextGeo = { ...geo, streets: remainingGeo };

fs.writeFileSync(path.join(root, "assets", "data.js"), dataHeader + "window.JLM_DATA = " + JSON.stringify(nextData) + ";\n", "utf8");
fs.writeFileSync(path.join(root, "assets", "geo.js"), geoHeader + "window.JLM_GEO = " + JSON.stringify(nextGeo) + ";\n", "utf8");
fs.writeFileSync(path.join(root, "tools", "retired-streets.json"), JSON.stringify(archive, null, 2) + "\n", "utf8");

console.log("נכתבו assets/data.js, assets/geo.js, tools/retired-streets.json");
