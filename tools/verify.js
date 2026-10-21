/**
 * בדיקת שפיות אחת לכל הפרויקט.
 * הרצה: npm run verify
 *
 * בודק: תחביר, בדיקות אחסון, ושלמות הנתונים (מזהים, קואורדינטות, קווים, גודל).
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(name + (detail ? " — " + detail : ""));
}

/* ---------- 1. תחביר ---------- */

const jsFiles = [
  "serve.js",
  "assets/data.js",
  "assets/geo.js",
  "assets/store.js",
  "assets/app.js",
  "assets/map.js",
  ...fs.readdirSync(path.join(root, "tools")).filter((f) => f.endsWith(".js")).map((f) => "tools/" + f)
];

for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "pipe" });
    check("תחביר: " + file, true);
  } catch (error) {
    check("תחביר: " + file, false, String(error.stderr || error.message).split("\n")[0]);
  }
}

/* ---------- 2. בדיקות אחסון ---------- */

try {
  const output = execFileSync(process.execPath, [path.join(root, "tests", "store.test.js")], { encoding: "utf8" });
  check("בדיקות אחסון", /17\/17 עברו/.test(output), output.trim().split("\n").pop());
} catch (error) {
  check("בדיקות אחסון", false, String(error.stdout || error.message).slice(-200));
}

/* ---------- 3. טעינת נתונים ---------- */

function loadWindow(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file, timeout: 20000 });
  return sandbox.window;
}

const data = loadWindow("assets/data.js").JLM_DATA;
const geo = loadWindow("assets/geo.js").JLM_GEO;

check("JLM_DATA קיים", data && Array.isArray(data.streets), data ? data.streets.length + " רחובות" : "חסר");
check("JLM_GEO קיים", geo && Array.isArray(geo.streets), geo ? geo.streets.length + " רחובות" : "חסר");

if (data && geo) {
  const dataIds = new Set(data.streets.map((street) => street.id));
  const geoIds = new Set(geo.streets.map((street) => street.id));
  const seeds = JSON.parse(fs.readFileSync(path.join(root, "tools", "seed-ids.json"), "utf8"));
  const retired = new Set(
    JSON.parse(fs.readFileSync(path.join(root, "tools", "retired-seed-ids.json"), "utf8"))
  );
  const retiredStreets = JSON.parse(
    fs.readFileSync(path.join(root, "tools", "retired-streets.json"), "utf8")
  ).streets;
  const retiredStreetIds = new Set(retiredStreets.map((street) => street.id));
  const presentRetired = [...dataIds].filter((id) => retiredStreetIds.has(id));

  check("כמות רחובות", data.streets.length === 2424, String(data.streets.length));
  check("כמות רחובות ב-geo", geo.streets.length === 2424, String(geo.streets.length));
  check("רחובות שהוצאו אינם פעילים", presentRetired.length === 0, presentRetired.join(", "));
  check("ארכיון ההסרה מלא", retiredStreets.length === 118, String(retiredStreets.length));
  check("מזהים ייחודיים", dataIds.size === data.streets.length, dataIds.size + " מול " + data.streets.length);
  check("geo ⊆ data", [...geoIds].every((id) => dataIds.has(id)));

  const missingSeeds = seeds.filter((id) => !dataIds.has(id) && !retired.has(id));
  check("כל מזהי הזרע קיימים", missingSeeds.length === 0, missingSeeds.join(", "));

  const attribution = data.attribution || "";
  check("ייחוס OSM", /OpenStreetMap/.test(attribution), attribution);

  const excluded = [
    "א־סוואחרה אל־ע'רביה",
    "אבו תור",
    "א-טור",
    "אום טובא",
    "באב א-זהרה",
    "בית חנינא",
    "בית צפאפא",
    "כפר עקב",
    "מחנה פליטים שועפט",
    "אבו טור",
    "בית חולים הדסה עין כרם",
    "סילוואן",
    "קרית אונסדורף",
    "ג'בל מוכאבר",
    "מזרח ירושלים",
    "שרפאת",
    "שועפט",
    "ואדי ג'וז",
    "צור באהר",
    "עיסוויה"
  ];
  const presentExcluded = data.streets.map((street) => street.area).filter((area) => excluded.includes(area));
  check("שכונות מוחרגות נעדרות", presentExcluded.length === 0, presentExcluded.join(", "));

  const areaCounts = new Map();
  for (const street of data.streets) {
    areaCounts.set(street.area, (areaCounts.get(street.area) || 0) + 1);
  }
  check("כמות שכונות", areaCounts.size === 95, String(areaCounts.size));
  const singleStreetAreas = [...areaCounts.entries()]
    .filter(([, count]) => count === 1)
    .map(([area]) => area);
  check("אין שכונות חד-רחוב", singleStreetAreas.length === 0, singleStreetAreas.join(", "));

  const bbox = { minLat: 31.5, maxLat: 31.95, minLng: 35.0, maxLng: 35.4 };
  const badCoords = data.streets.filter(
    (street) =>
      street.lat !== null &&
      (!Number.isFinite(street.lat) ||
        !Number.isFinite(street.lng) ||
        street.lat < bbox.minLat ||
        street.lat > bbox.maxLat ||
        street.lng < bbox.minLng ||
        street.lng > bbox.maxLng)
  );
  check("קואורדינטות בתיחום ירושלים", badCoords.length === 0, badCoords.slice(0, 3).map((s) => s.name).join(", "));

  const withPaths = geo.streets.filter((street) => Array.isArray(street.paths) && street.paths.length > 0);
  check("כל הרחובות עם קו", withPaths.length === geo.streets.length, withPaths.length + "/" + geo.streets.length);
  check("data ו-geo באותו גודל", data.streets.length === geo.streets.length, data.streets.length + " מול " + geo.streets.length);

  const genericLeft = data.streets.filter((street) =>
    /^(כביש שירות|כביש גישה|דרך שירות|דרך גישה|כביש פנימי)/.test(street.name)
  );
  check("אין שמות גנריים", genericLeft.length === 0, genericLeft.slice(0, 3).map((s) => s.name).join(", "));

  let badPaths = 0;
  let points = 0;
  for (const street of withPaths) {
    for (const line of street.paths) {
      if (!Array.isArray(line) || line.length < 2) {
        badPaths += 1;
        continue;
      }
      points += line.length;
      for (const point of line) {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          point[0] < bbox.minLat ||
          point[0] > bbox.maxLat ||
          point[1] < bbox.minLng ||
          point[1] > bbox.maxLng
        ) {
          badPaths += 1;
          break;
        }
      }
    }
  }
  check("קווים תקינים", badPaths === 0, badPaths + " קווים פגומים");
  check("נקודות בקווים", points > 10000, points.toLocaleString());

  const dataSize = fs.statSync(path.join(root, "assets", "data.js")).size;
  const geoSize = fs.statSync(path.join(root, "assets", "geo.js")).size;
  check("data.js עד 1MB", dataSize < 1024 * 1024, Math.round(dataSize / 1024) + "KB");
  check("geo.js עד 3MB", geoSize < 3 * 1024 * 1024, Math.round(geoSize / 1024) + "KB");
}

/* ---------- סיכום ---------- */

const failed = checks.filter((entry) => !entry.ok);
for (const entry of checks) {
  if (!entry.ok) console.log("FAIL  " + entry.name + (entry.detail ? " — " + entry.detail : ""));
}
console.log("\n" + (checks.length - failed.length) + "/" + checks.length + " בדיקות עברו");
process.exit(failed.length === 0 ? 0 : 1);
