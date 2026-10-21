/**
 * הכנת תיקיית פריסה להעלאה לרשת — "רחובות ירושלים".
 *
 * מה הבעיה שזה פותר: ב-`file://` אפשר לפתוח את `index.html` ישירות, אבל כשמעלים
 * למארח סטטי מעלים את **כל התיקייה** — כולל `docs/agents/`, `tools/`, `.opencode/`
 * והדשבורדים הפנימיים. הקבצים האלה אינם חלק מהאפליקציה שהמשתמש רוצה לראות.
 *
 * הסקריפט מאסף **רק את קבצי האפליקציה** לתיקיית יעד נקייה, מוכנה לגרירה
 * ל-`app.netlify.com/drop` (או לכל מארח סטטי).
 *
 * הרצה:  node tools/prepare-publish.js [תיקיית-יעד]
 * דוגמה: node tools/prepare-publish.js C:\Users\me\Desktop\publish
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const target = path.resolve(process.argv[2] || path.join(ROOT, "publish"));

/* מה נכנס לפריסה: רק מה שהדפדפן צריך כדי להריץ את האפליקציה */
const FILES = ["index.html", "manifest.webmanifest", "sw.js"];
const DIRS = ["assets"];

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  const size = fs.statSync(to).size;
  console.log(`  ${path.relative(target, to)} — ${size} בייט`);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (entry.isFile()) copyFile(src, dst);
  }
}

if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

console.log(`מכינים תיקיית פריסה ב: ${target}`);
for (const file of FILES) {
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) {
    console.error(`  חסר: ${file}`);
    continue;
  }
  copyFile(src, path.join(target, file));
}
for (const dir of DIRS) {
  const src = path.join(ROOT, dir);
  if (!fs.existsSync(src)) {
    console.error(`  חסר: ${dir}/`);
    continue;
  }
  copyDir(src, path.join(target, dir));
}
console.log("מוכן. גרור את התיקייה ל-app.netlify.com/drop");
