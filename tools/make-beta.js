#!/usr/bin/env node
/**
 * יוצר את סביבת הבטא: beta.html + עותק מבודד של קובצי האפליקציה ב-assets/beta/.
 *
 * beta.html נראה כמו app.html אבל טוען את קובצי הבטא (assets/beta/*) במקום את
 * קובצי האתר הציבורי. כך אפשר לבדוק שינוי גדול בלי לגעת באתר החי: האתר הציבורי
 * ממשיך לטעון את assets/* כפי שפורסמו.
 *
 * שימוש:
 *   node tools/make-beta.js                    # בונה מ-app.html ומעותק את קובצי העבודה
 *   node tools/make-beta.js --source=<file>    # בונה HTML מקובץ מקור אחר (העותקים מהעץ)
 *   node tools/make-beta.js --check            # נכשל אם beta.html או העותקים לא מעודכנים
 *
 * אין לערוך את beta.html או את assets/beta/ ביד.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "app.html");
const TARGET = path.join(ROOT, "beta.html");
const ASSETS = path.join(ROOT, "assets");
const BETA_ASSETS = path.join(ASSETS, "beta");

const BETA_TITLE = "סביבת בטא — ירושלים ברגל";
const BETA_HEAD =
  '<meta charset="utf-8" />\n' +
  '    <meta name="robots" content="noindex" />\n' +
  '    <script>window.JLM_BETA = true; document.documentElement.classList.add("is-beta");</script>';
const BETA_SCRIPT = '    <script src="assets/beta-tools.js" defer></script>\n';

/* קובצי האפליקציה שמקבלים עותק מבודד. data.js/geo.js/vendor נשארים משותפים (נתונים, לא קוד). */
const COPIES = [
  "styles.css",
  "pwa.css",
  "store.js",
  "app.js",
  "map.js",
  "ui.js",
  "dyk-facts.js",
  "sw-register.js"
];

/* ב-beta אין התקנת PWA: המניפסט מוסר והסקריפט הזה אינו נטען. */
const PWA_SCRIPT = '<script src="assets/pwa.js" defer></script>';

function fail(message) {
  console.error("make-beta: " + message);
  process.exit(1);
}

function argValue(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

function build(source) {
  let output = source;

  if (!/<title>[\s\S]*?<\/title>/.test(output)) fail("לא נמצא <title> ב-app.html");
  output = output.replace(/<title>[\s\S]*?<\/title>/, "<title>" + BETA_TITLE + "</title>");

  if (!output.includes('<meta charset="utf-8" />')) fail("לא נמצא meta charset ב-app.html");
  output = output.replace('<meta charset="utf-8" />', BETA_HEAD);

  const manifestRemoved = output.replace(/\s*<link rel="manifest"[^>]*\/?>/i, "");
  if (manifestRemoved === output) fail("לא נמצא link rel=manifest ב-app.html");
  output = manifestRemoved;

  const pwaScriptRegex = /<script src="assets\/pwa\.js" defer><\/script>/;
  if (!pwaScriptRegex.test(output)) fail("לא נמצאה שורת pwa.js ב-app.html");
  output = output.replace(pwaScriptRegex, "");

  COPIES.forEach((name) => {
    const from = "assets/" + name;
    if (!output.includes(from)) fail("app.html אינו טוען את " + from);
    output = output.split(from).join("assets/beta/" + name);
  });

  if (!output.includes("</body>")) fail("לא נמצא </body> ב-app.html");
  if (output.includes("assets/beta-tools.js")) fail("app.html כבר טוען את beta-tools.js — בדוק את המקור");
  output = output.replace("</body>", BETA_SCRIPT + "  </body>");

  return output;
}

function copyAssets() {
  fs.mkdirSync(BETA_ASSETS, { recursive: true });
  COPIES.forEach((name) => {
    const from = path.join(ASSETS, name);
    const to = path.join(BETA_ASSETS, name);
    if (!fs.existsSync(from)) fail("קובץ חסר: " + from);
    fs.copyFileSync(from, to);
  });
}

function staleCopies() {
  return COPIES.filter((name) => {
    const from = path.join(ASSETS, name);
    const to = path.join(BETA_ASSETS, name);
    if (!fs.existsSync(to)) return true;
    return !fs.readFileSync(from).equals(fs.readFileSync(to));
  });
}

function main() {
  const sourceArg = argValue("--source=");
  const sourcePath = sourceArg ? path.resolve(ROOT, sourceArg) : SOURCE;
  if (!fs.existsSync(sourcePath)) fail("קובץ המקור לא נמצא: " + sourcePath);

  const built = build(fs.readFileSync(sourcePath, "utf8"));
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (current !== built) {
      console.error("make-beta: beta.html אינו מעודכן — הרץ node tools/make-beta.js");
      process.exit(1);
    }
    const stale = staleCopies();
    if (stale.length) {
      console.error("make-beta: עותקי הבטא לא מעודכנים — " + stale.join(", "));
      process.exit(1);
    }
    console.log("make-beta: beta.html והעותקים מעודכנים");
    return;
  }

  copyAssets();
  fs.writeFileSync(TARGET, built, "utf8");
  console.log(
    "make-beta: נכתב beta.html (" +
      built.split("\n").length +
      " שורות), הועתקו " +
      COPIES.length +
      " קבצים ל-assets/beta/"
  );
}

main();
