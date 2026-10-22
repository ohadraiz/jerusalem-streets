#!/usr/bin/env node
/**
 * יוצר את beta.html מ-index.html — עותק מדויק של האפליקציה עם דגל בטא וכלי הבדיקה.
 *
 * שימוש:
 *   node tools/make-beta.js                    # כותב את beta.html מתוך index.html שבעץ העבודה
 *   node tools/make-beta.js --source=HEAD.html # בונה מקובץ מקור אחר (למשל גרסת HEAD)
 *   node tools/make-beta.js --check            # נכשל אם beta.html אינו מעודכן (לשערים)
 *
 * הכלל: אין לערוך את beta.html ביד. כל שינוי ב-index.html מחייב הרצה חוזרת.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "index.html");
const TARGET = path.join(ROOT, "beta.html");

const BETA_TITLE = "סביבת בטא — רחובות ירושלים";
const BETA_HEAD =
  '<meta charset="utf-8" />\n' +
  '    <meta name="robots" content="noindex" />\n' +
  "    <script>window.JLM_BETA = true; document.documentElement.classList.add(\"is-beta\");</script>";
const BETA_SCRIPT = '    <script src="assets/beta-tools.js" defer></script>\n';

function fail(message) {
  console.error("make-beta: " + message);
  process.exit(1);
}

function build(source) {
  let output = source;

  if (!/<title>[\s\S]*?<\/title>/.test(output)) fail("לא נמצא <title> ב-index.html");
  output = output.replace(/<title>[\s\S]*?<\/title>/, "<title>" + BETA_TITLE + "</title>");

  if (!output.includes('<meta charset="utf-8" />')) fail("לא נמצא meta charset ב-index.html");
  output = output.replace('<meta charset="utf-8" />', BETA_HEAD);

  const manifestRemoved = output.replace(/\s*<link rel="manifest"[^>]*\/?>/i, "");
  if (manifestRemoved === output) fail("לא נמצא link rel=manifest ב-index.html");
  output = manifestRemoved;

  if (!output.includes("</body>")) fail("לא נמצא </body> ב-index.html");
  if (output.includes("assets/beta-tools.js")) fail("index.html כבר טוען את beta-tools.js — בדוק את המקור");
  output = output.replace("</body>", BETA_SCRIPT + "  </body>");

  return output;
}

function argValue(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
}

function main() {
  const sourceArg = argValue("--source=");
  const sourcePath = sourceArg ? path.resolve(ROOT, sourceArg) : SOURCE;
  if (!fs.existsSync(sourcePath)) fail("קובץ המקור לא נמצא: " + sourcePath);

  const source = fs.readFileSync(sourcePath, "utf8");
  const built = build(source);
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (current !== built) {
      console.error("make-beta: beta.html אינו מעודכן — הרץ node tools/make-beta.js");
      process.exit(1);
    }
    console.log("make-beta: beta.html מעודכן");
    return;
  }

  fs.writeFileSync(TARGET, built, "utf8");
  console.log(
    "make-beta: נכתב beta.html (" +
      built.split("\n").length +
      " שורות, " +
      Buffer.byteLength(built, "utf8") +
      " בייט)"
  );
}

main();
