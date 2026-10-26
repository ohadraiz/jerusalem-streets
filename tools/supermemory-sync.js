/**
 * סנכרון זיכרון הפרויקט אל Supermemory (API v5, HTTP ישיר — ללא תלויות).
 *
 * שימוש:
 *   node tools/supermemory-sync.js --decisions                  # BOARD.md + TASKS.md → jlm-street-journal (superrag)
 *   node tools/supermemory-sync.js --profile                   # עקרונות קבועים → user-ohad (memory)
 *   node tools/supermemory-sync.js --facts                     # data/didyouknow/*.txt → jlm-didyouknow (superrag)
 *   node tools/supermemory-sync.js --handoff "טקסט handoff"    # handoff סשן → jlm-handoffs (memory)
 *   node tools/supermemory-sync.js --search "שאילתה" [--ns user-ohad] [--mode chunks|memories|hybrid]
 *
 * כללי ברזל:
 *  - המפתח נקרא EXCLUSIVELY ממשתנה הסביבה SUPERMEMORY_API_KEY — אין להזין מפתח בקוד ואין להדפיסו.
 *  - ה־namespace הוא הפרמטר הראשון תמיד (נתיב ה־URL), פורמט ^[a-zA-Z0-9_:-]+$, בידוד מלא בין namespaces.
 *  - כתיבה ראשונה ל־namespace חדש יוצרת אותו; ריצה חוזרת עם id זהה מעדכנת תוך שימור היסטוריה.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const API = "https://api.supermemory.ai";

// namespaces קבועים לפרויקט — שינויים רק באישור מפורש
const NS = {
  decisions: "jlm-street-journal", // החלטות ולוח משימות (superrag / chunks)
  profile: "user-ohad",            // עקרונות קבועים של אהד (memory / profile)
  facts: "jlm-didyouknow",         // ארכיון תחקירי "הידעת?" (superrag / chunks)
  handoffs: "jlm-handoffs"         // handoffs בין סשנים (memory)
};

function fail(msg) {
  console.error("שגיאה: " + msg);
  process.exitCode = 1;
}

function getKey() {
  const key = process.env.SUPERMEMORY_API_KEY;
  if (!key) {
    fail(
      "‏SUPERMEMORY_API_KEY לא מוגדר בסביבה. הפעל: " +
      "[Environment]::SetEnvironmentVariable('SUPERMEMORY_API_KEY','<מפתח>','User') ואז פתח שרת מחדש."
    );
    process.exit(1);
  }
  return key;
}

async function smFetch(ns, action, body, key) {
  const res = await fetch(`${API}/ns/${encodeURIComponent(ns)}/${action}`, {
    method: action === "search" ? "POST" : "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`‏${action} ב־${ns} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function readDoc(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) throw new Error("קובץ חסר: " + rel);
  return fs.readFileSync(full, "utf8");
}

function slugify(name) {
  const s = path.basename(name, ".txt").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "fact";
}

/* ---------------- משימות ---------------- */

async function syncDecisions(key) {
  const files = [
    { rel: "docs/agents/BOARD.md", id: "board-md", title: "BOARD.md — לוח החלטות" },
    { rel: "docs/agents/TASKS.md", id: "tasks-md", title: "TASKS.md — לוח משימות ולוח handoffs" }
  ];
  const documents = files.map((f) => ({
    content: readDoc(f.rel),
    id: f.id,
    metadata: { source: f.rel, syncedAt: new Date().toISOString() }
  }));
  const out = await smFetch(NS.decisions, "document/batch", { documents, taskType: "superrag" }, key);
  console.log(`‏[decisions] ${NS.decisions}: התקבלו ${out.count ?? "?"}, לא תקינים ${out.failed ?? 0}`);
}

async function syncProfile(key) {
  const content = [
    "# עקרונות קבועים של אהד — פרויקט יומן הרחובות של ירושלים",
    "- שפת הפרויקט עברית בלבד, RTL מלא; נגישות תחילה (WCAG AA, יעדי מגע 44px, פוקוס נראה, aria-live).",
    "- סביבת בטא תחילה: אין שינוי עולה לאתר הציבורי לפני בדיקה ב־beta.html ואישור מפורש של אהד.",
    "- אהד מאשר פרסום במילים מפורשות בלבד (למשל \"מאושר\"). אישור סוכן אחר או שתיקה אינם אישור.",
    "- אין force push, אין שכתוב היסטוריה שפורסמה, ואין commit ללא ריצת בדיקות.",
    "- גבולות קבועים בלי אישור מפורש: חוזי JLMAPI/JLMBus/JLM_GEO, מזהי DOM, LOD 12, סכמת האחסון jlm-street-journal-v1.",
    "- מקור האריחים והנתונים המאושר היחיד: OpenStreetMap (ODbL). אין רשת חיצונית מעבר ל־OSM בקוד האפליקציה.",
    "- עבודה ממוקדת וחסכונית בטוקנים: חיפושים ממוקדים, קריאות מינימליות, handoffs קצרים (100–250 מילים).",
     "- build עובד ישירות; review הוא ביקורת עצמאית לקריאה בלבד; gabbai מבצע release רק לאחר אישור מפורש לפעולה הספציפית.",
     "- מומחיות תחומית נטענת לפי צורך ככובעים מתוך docs/agents/HATS.md; אין סוכנים מומחים נוספים או תיאום בין ערוצים כחלק מהארכיטקטורה הפעילה."
  ].join("\n");
  const out = await smFetch(NS.profile, "document", {
    content,
    id: "ohad-principles",
    taskType: "memory",
    metadata: { source: "AGENTS.md", syncedAt: new Date().toISOString() }
  }, key);
  console.log(`‏[profile] ${NS.profile}: סטטוס ${out.status ?? "queued"} (id: ${out.id ?? "ohad-principles"})`);
}

async function syncFacts(key) {
  const dir = path.join(ROOT, "data", "didyouknow");
  if (!fs.existsSync(dir)) throw new Error("תיקיית data/didyouknow חסרה");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
  const documents = files.map((f) => ({
    content: fs.readFileSync(path.join(dir, f), "utf8"),
    id: `fact-${slugify(f)}`,
    metadata: { source: `data/didyouknow/${f}`, syncedAt: new Date().toISOString() }
  }));
  if (!documents.length) {
    console.log("‏[facts] אין קבצי .txt לסנכרון");
    return;
  }
  const out = await smFetch(NS.facts, "document/batch", { documents, taskType: "superrag" }, key);
  console.log(`‏[facts] ${NS.facts}: ${documents.length} מסמכים נשלחו, התקבלו ${out.count ?? "?"}, לא תקינים ${out.failed ?? 0}`);
}

async function syncHandoff(key, text) {
  if (!text) {
    fail("‏--handoff מחייב טקסט. הפעלה: --handoff \"תקציר הסשן\"");
    process.exit(1);
  }
  const id = `handoff-${new Date().toISOString().slice(0, 10)}`;
  const out = await smFetch(NS.handoffs, "document", {
    content: text,
    id,
    taskType: "memory",
    metadata: { kind: "session-handoff", syncedAt: new Date().toISOString() }
  }, key);
  console.log(`‏[handoff] ${NS.handoffs}: נשמר (id: ${out.id ?? id})`);
}

async function search(key, ns, query, mode) {
  const out = await smFetch(ns, "search", { query, searchMode: mode, limit: 5 }, key);
  const results = (out.results || out.chunks || []);
  console.log(`‏[search] ${ns} (mode=${mode}): ${results.length} תוצאות`);
  for (const r of results.slice(0, 3)) {
    const text = (r.memory || r.chunk || r.text || "").replace(/\s+/g, " ").slice(0, 120);
    console.log(`  ${(r.similarity ?? 0).toFixed ? (r.similarity ?? 0).toFixed(3) : r.similarity} — ${text}`);
  }
}

/* ---------------- מנוע פקודות ---------------- */

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.log(fs.readFileSync(__filename, "utf8").split("שימוש:")[1].split("כללי ברזל")[0].replace(/^:\s*/, "שימוש:\n  ").trimStart());
    return;
  }
  const key = getKey();
  const idx = (flag) => argv.indexOf(flag);
  const val = (flag) => {
    const i = idx(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  if (idx("--decisions") >= 0) await syncDecisions(key);
  if (idx("--profile") >= 0) await syncProfile(key);
  if (idx("--facts") >= 0) await syncFacts(key);
  if (idx("--handoff") >= 0) await syncHandoff(key, val("--handoff"));
  if (idx("--search") >= 0) {
    const query = val("--search");
    const ns = val("--ns") || NS.decisions;
    const mode = val("--mode") || (ns === NS.profile || ns === NS.handoffs ? "memories" : "chunks");
    await search(key, ns, query, mode);
  }
}

main().catch((e) => {
  fail(e.message);
});
