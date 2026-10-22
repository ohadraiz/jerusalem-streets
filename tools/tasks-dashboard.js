#!/usr/bin/env node
"use strict";

/*
 * tasks-dashboard.js — בונה את internal/tasks.html מתוך docs/TEAMS.md ו-docs/agents/TASKS.md
 *
 * שימוש:
 *   node tools/tasks-dashboard.js
 *
 * ללא תלויות, ללא רשת. כל הנתיבים נגזרים ממיקום הקובץ, כך שאפשר להריץ אותו
 * מכל תיקיית עבודה. הפלט הוא קובץ HTML סטטי יחיד (CSS + JS מוטמעים) שנפתח
 * ב-file:// בלי build ובלי CDN.
 *
 * מקור המספרים: כל ספירה בדשבורד מחושבת בזמן ההצגה מרשימת המשימות שנטענה
 * מהקבצים — אין ספירות כתובות ביד.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TEAMS_PATH = path.join(ROOT, "docs", "TEAMS.md");
const TASKS_PATH = path.join(ROOT, "docs", "agents", "TASKS.md");
const OUT_PATH = path.join(ROOT, "internal", "tasks.html");
const DATA_OUT_PATH = path.join(ROOT, "tasks-data.json");
const AGENT_STATUS_PATH = path.join(ROOT, "agent-status.json");

const UNASSIGNED = "לא משויך";

/* סדר הצוותים בדשבורד (הצוות הנמצא בחופש מופיע אחרון) */
const TEAM_ORDER = ["UI/UX", "DEV", "NET", "נתונים", "Research", "החלטות", "Mobile/Deploy"];

/*
 * חברות צוותים שנוספו מעבר ל-"docs/TEAMS.md" — משמשות כגיבוי אם הצוות חסר
 * מקובץ הצוותים (וכן כמקור האמת כשהוא מוגדר ב-TEAMS.md).
 */
const TEAM_FALLBACKS = {
  "נתונים": {
    icon: "🗺️",
    title: "צוות נתונים ומפות",
    note: "רשימת הרחובות, הגיאומטריה, השבילים, הפוליגונים והמיזוג לנתונים",
    standby: false,
    owners: ["מפי", "המגשר", "הראשי", "קיפי"]
  },
  "החלטות": {
    icon: "⚖️",
    title: "צוות החלטות והקפאות",
    note: "החלטות משתמש פתוחות, פריטים שנדחו ומקפאים — ממתינים להכרעה או לאישור",
    standby: false,
    owners: ["הראשי", "קיפי", "החוקר"]
  }
};

/*
 * שליטת משימות כלליות (מ-"docs/agents/TASKS.md") לצוותים ולסוכנים.
 * כל משימה חייבת להיות משויכת לצוות — אין משימה "ללא צוות".
 * הכלל הראשון שנפגע הוא זה שקודם; אחריו כללי הפרק; ובסוף ברירת מחדל.
 */
const GENERAL_ROUTING = [
  /* סבב 046.1 — ליטוש UX */
  { match: "אימות עצמאי", team: "UI/UX", agents: ["הראשי", "הבודק"] },
  { match: "036", team: "UI/UX", agents: ["הבודק", "הראשי"] },
  { match: "כפתור", team: "UI/UX", agents: ["המעצב", "הראשי"] },

  /* שער "הידעת" */
  { match: "ביקורת שיפו", team: "Research", agents: ["הבודק", "החוקר"] },
  { match: "אפיון מקורות", team: "Research", agents: ["החוקר"] },
  { match: "סכמת נתונים", team: "Research", agents: ["החוקר", "הראשי"] },
  { match: "פיילוט 20", team: "Research", agents: ["החוקר"] },
  { match: "ייצור מידע", team: "Research", agents: ["החוקר", "הראשי"] },

  /* החלטות משתמש ונדחיות */
  { match: "סטטיסטיקת", team: "החלטות", agents: ["הראשי", "המעצב"] },
  { match: "שכבת רשות", team: "החלטות", agents: ["החוקר", "קיפי"] },
  { match: "מקור ללא רישיון", team: "החלטות", agents: ["החוקר", "קיפי"] },
  { match: "מוניציפלית", team: "החלטות", agents: ["החוקר", "קיפי"] },
  { match: "קישורי Google", team: "החלטות", agents: ["הראשי", "המגשר"] },
  { match: "העיר העתיקה", team: "החלטות", agents: ["הראשי", "המעצב"] },

  /* נתונים ומפות */
  { match: "אימות 93", team: "נתונים", agents: ["מפי", "המגשר"] },
  { match: "אימות הדדי", team: "נתונים", agents: ["מפי", "הראשי"] },
  { match: "גבולות שכונה", team: "נתונים", agents: ["החוקר", "קיפי", "מפי"] },

  /* מובייל והפצה */
  { match: "מכשיר אמיתי", team: "Mobile/Deploy", agents: ["מובי", "הראשי"] },
  { match: "Referrer-Policy", team: "Mobile/Deploy", agents: ["פיצי", "מובריליס"] },

  /* החלטות טכניות */
  { match: "Tile probe", team: "DEV", agents: ["המגשר", "הבודק", "הראשי"] },
  { match: "ביצועים", team: "DEV", agents: ["הראשי", "המגשר"] },
  { match: "LOD", team: "DEV", agents: ["הראשי", "המגשר"] },

  /* סבב אריחי OSM */
  { match: "אימות ספקים", team: "NET", agents: ["החוקר"] },
  { match: "שרשרת ספקים", team: "NET", agents: ["המגשר"] },
  { match: "ביקורת המימוש", team: "NET", agents: ["הבודק"] },
  { match: "בדיקת דפדפן חיה", team: "DEV", agents: ["הראשי", "המגשר"] }
];

/* כללי משנה לפי פרק ב-TASKS.md */
const SECTION_ROUTING = [
  { match: /046\.1/, team: "UI/UX", agents: ["הראשי", "הבודק"] },
  { match: /הידעת/, team: "Research", agents: ["החוקר", "הראשי"] },
  { match: /שבילים ומדרגות/, team: "נתונים", agents: ["מפי", "המגשר"] },
  { match: /החלטות משתמש/, team: "החלטות", agents: ["הראשי", "קיפי"] },
  { match: /החלטות טכניות/, team: "DEV", agents: ["הראשי", "המגשר"] },
  { match: /נדחה/, team: "החלטות", agents: ["הראשי", "קיפי"] },
  { match: /אריחי OSM/, team: "NET", agents: ["המגשר", "החוקר"] }
];

/* ברירת מחדל — כל משימה שלא מזוהה נכנסת לצוות ההחלטות ומסומנת לתיקון הטבלה */
const ROUTE_FALLBACK = { team: "החלטות", agents: ["הראשי"] };

/*
 * שמות סוכנים שיכולים להופיע כבעלים במשימות כלליות.
 * הרשימה כוללת את השמות העכשיויים ואת השמות הקודמים (ברשומות היסטוריות
 * ב-TASKS.md נשמרים שמות המקור — זה אותו סוכן, רק השם הוחלף).
 */
const KNOWN_OWNERS = [
  /* שמות עכשיויים */
  "הראשי",
  "החוקר",
  "הבודק",
  "המעצב",
  "המגשר",
  "המתעד",
  "הפקח",
  "קיפי",
  "מפי",
  "מובריליס",
  "מובי",
  "פיצי",
  /* שמות קודמים */
  "ראשי",
  "חיקי",
  "שיפו",
  "ציבי",
  "צירי",
  "גולי",
  "טופי",
  "פזי"
];

/* מיפוי שם קודם → שם עכשיוי (רשימת השמות המעודכנת, 2026-10-21) */
const OWNER_ALIASES = {
  "ראשי": "הראשי",
  "חיקי": "החוקר",
  "שיפו": "הבודק",
  "ציבי": "המעצב",
  "צירי": "המגשר",
  "גולי": "המתעד",
  "טופי": "מובריליס",
  "פזי": "פיצי"
};

const STATUS_MARKERS = [
  { marker: "✅", key: "done", label: "הושלם" },
  { marker: "🟡", key: "progress", label: "בביצוע" },
  { marker: "⬜", key: "pending", label: "ממתין" },
  { marker: "⏳", key: "pending", label: "ממתין" },
  { marker: "⏸", key: "blocked", label: "חסום" }
];

const PRIORITY_MARKERS = [
  { marker: "🔴", key: "high", label: "גבוהה" },
  { marker: "🟡", key: "medium", label: "בינונית" },
  { marker: "🟢", key: "low", label: "נמוכה" }
];

/* ---------- helpers ---------- */

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function writeFileAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, "utf8");
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.writeFileSync(file, content, "utf8");
    try {
      fs.unlinkSync(tmp);
    } catch (cleanupErr) {
      /* ignore */
    }
  }
}

function cleanNote(value) {
  return String(value == null ? "" : value)
    .replace(/^[\s:—–\-·]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStatus(text) {
  const raw = String(text == null ? "" : text);
  let best = null;
  for (const entry of STATUS_MARKERS) {
    const index = raw.indexOf(entry.marker);
    if (index !== -1 && (best === null || index < best.index)) {
      best = { entry, index };
    }
  }
  if (!best) {
    return { key: "pending", label: "ממתין", note: "", marker: "⬜" };
  }
  return {
    key: best.entry.key,
    label: best.entry.label,
    marker: best.entry.marker,
    note: cleanNote(raw.slice(best.index + best.entry.marker.length))
  };
}

function parsePriority(text) {
  const raw = String(text == null ? "" : text);
  for (const entry of PRIORITY_MARKERS) {
    const index = raw.indexOf(entry.marker);
    if (index !== -1) {
      return {
        key: entry.key,
        label: entry.label,
        marker: entry.marker,
        note: cleanNote(raw.slice(index + entry.marker.length))
      };
    }
  }
  return { key: "none", label: "לא צוין", marker: "—", note: "" };
}

function matchOwner(text) {
  const value = String(text == null ? "" : text).trim();
  if (!value) return null;
  const sorted = KNOWN_OWNERS.slice().sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (value === name) return name;
    if (value.indexOf(name + " ") === 0 || value.indexOf(name + "-") === 0) return name;
  }
  return null;
}

/* מחזיר { name, alias } — השם העכשיוי לסינון, והשם הקודם לתצוגה ולחיפוש */
function canonicalOwner(name) {
  const value = String(name == null ? "" : name).trim();
  if (!value) return { name: UNASSIGNED, alias: "" };
  const current = OWNER_ALIASES[value];
  if (current) return { name: current, alias: value };
  return { name: value, alias: "" };
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/* ---------- TEAMS.md ---------- */

function teamKeyForTitle(title) {
  if (/מובייל\s+והפצה/.test(title)) return "Mobile/Deploy";
  if (/UI\/UX/.test(title)) return "UI/UX";
  if (/פיתוח/.test(title)) return "DEV";
  if (/חיבור\s+לרשת/.test(title)) return "NET";
  if (/מחקר\s+ותוכן/.test(title)) return "Research";
  return null;
}

function parseTeamHeading(line) {
  const rest = line.replace(/^##\s*/, "");
  const bold = rest.match(/\*\*(.+?)\*\*/);
  const title = bold ? bold[1].trim() : rest.trim();
  const key = teamKeyForTitle(title);
  if (!key) return null;
  const icon = (rest.split("**")[0] || "").trim();
  const noteMatch = rest.match(/(\([^()]*\))\s*$/);
  const note = noteMatch ? noteMatch[1].replace(/^\(|\)$/g, "").trim() : "";
  const standby = /בחופש/.test(rest) || /standby/i.test(rest);
  return { key, icon, title, note, standby };
}

function parseOwnerList(line) {
  const after = line.split("**סוכנים אחראיים:**")[1] || "";
  return after
    .split(/[,،]/)
    .map((part) => {
      const cleaned = part.replace(/\*\*/g, "").trim();
      const match = cleaned.match(/^([֐-׿A-Za-z]+)/);
      return match ? match[1] : "";
    })
    .filter(Boolean);
}

function mapHeader(cells) {
  const map = { id: -1, title: -1, description: -1, priority: -1, status: -1 };
  cells.forEach((cell, index) => {
    const value = cell.replace(/[*#]/g, "").trim();
    if (value === "משימה") map.title = index;
    else if (value === "תיאור") map.description = index;
    else if (value === "עדיפות") map.priority = index;
    else if (value === "סטטוס") map.status = index;
    else if (value === "#") map.id = index;
  });
  return map;
}

function parseTeams(md) {
  const lines = md.split(/\r?\n/);
  const teams = {};
  const tasks = [];
  let current = null;
  let header = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/^##\s/.test(line)) {
      current = parseTeamHeading(line);
      header = null;
      if (current && !teams[current.key]) {
        teams[current.key] = {
          key: current.key,
          icon: current.icon,
          title: current.title,
          note: current.note,
          standby: current.standby,
          owners: []
        };
      }
      continue;
    }

    if (!current) continue;

    if (/^\*\*סוכנים אחראיים:\*\*/.test(line)) {
      const owners = parseOwnerList(line);
      if (teams[current.key]) teams[current.key].owners = owners;
      continue;
    }

    if (!line.trim().startsWith("|")) continue;

    const cells = splitRow(line);
    if (isSeparatorRow(cells)) continue;
    if (cells.length > 2 && cells[1].replace(/\*/g, "").trim() === "משימה") {
      header = mapHeader(cells);
      continue;
    }
    if (!header || header.title < 0) continue;

    const id = (cells[header.id >= 0 ? header.id : 0] || "").replace(/\*/g, "").trim();
    if (!/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(id)) continue;

    const title = cells[header.title] || "";
    const description = header.description >= 0 ? cells[header.description] || "" : "";
    const priority = parsePriority(header.priority >= 0 ? cells[header.priority] || "" : "");
    const status =
      header.status >= 0
        ? parseStatus(cells[header.status] || "")
        : {
            key: "pending",
            label: "ממתין",
            marker: "⬜",
            note: "ברירת מחדל — אין עמודת סטטוס בטבלה"
          };

    const team = teams[current.key];
    const owner = canonicalOwner(team.owners.length ? team.owners[0] : "");
    tasks.push({
      id,
      title,
      description,
      team: current.key,
      agents: team.owners.slice(),
      priority,
      status,
      owner: owner.name,
      ownerAlias: owner.alias,
      source: "docs/TEAMS.md",
      line: lineNo,
      context: team.title
    });
  }

  return { teams, tasks };
}

/* ---------- TASKS.md ---------- */

function routeGeneralTask(text, section) {
  const lower = text.toLowerCase();

  for (const rule of GENERAL_ROUTING) {
    if (lower.indexOf(rule.match.toLowerCase()) !== -1) {
      return { team: rule.team, agents: rule.agents.slice() };
    }
  }
  for (const rule of SECTION_ROUTING) {
    if (rule.match.test(section)) {
      return { team: rule.team, agents: rule.agents.slice() };
    }
  }
  return { team: ROUTE_FALLBACK.team, agents: ROUTE_FALLBACK.agents.slice() };
}

function parseGeneralTasks(md) {
  const lines = md.split(/\r?\n/);
  const tasks = [];
  let section = "";
  let counter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    const heading = line.match(/^#{2,4}\s+(.*)$/);
    if (heading) {
      section = cleanNote(heading[1]);
      continue;
    }

    const item = line.match(/^\s*[-*]\s+\[\s\]\s+(.*)$/);
    if (!item) continue;

    const raw = item[1].trim();
    const status = parseStatus(raw);
    const markerIndex = raw.indexOf(status.marker);
    let text = markerIndex >= 0 ? raw.slice(markerIndex + status.marker.length).trim() : raw;

    let title = text;
    const bold = text.match(/^\*\*([^*]+)\*\*\s*:?\s*/);
    if (bold) {
      const boldText = bold[1].replace(/:\s*$/, "").trim();
      const matched = matchOwner(boldText);
      if (matched) {
        if (boldText === matched) {
          title = text.slice(bold[0].length).trim();
        }
      }
    }

    const routed = routeGeneralTask(text, section);
    counter += 1;
    tasks.push({
      id: `GEN-${counter}`,
      title,
      description: "",
      team: routed.team,
      agents: routed.agents,
      priority: { key: "none", label: "לא צוין", marker: "—", note: "" },
      status: { key: status.key, label: status.label, marker: status.marker, note: "" },
      owner: UNASSIGNED,
      source: "docs/agents/TASKS.md",
      line: lineNo,
      context: section
    });
  }

  return tasks;
}

/* ---------- data ---------- */

function buildTeamMeta(teams) {
  return TEAM_ORDER.map((key) => {
    const team = teams[key] || TEAM_FALLBACKS[key] || { icon: "•", title: key, note: "", standby: false, owners: [] };
    return {
      key,
      label: key,
      icon: team.icon,
      sourceTitle: team.title,
      note: team.note,
      standby: !!team.standby,
      owner: team.owners.length ? team.owners[0] : UNASSIGNED,
      owners: team.owners.slice()
    };
  });
}

function loadAgentStatus() {
  try {
    const content = fs.readFileSync(AGENT_STATUS_PATH, "utf8");
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

function enrichTasksWithAgentStatus(tasks, agentStatus) {
  if (!agentStatus || !agentStatus.agents) return tasks;
  const statusMap = {};
  for (const [agentName, info] of Object.entries(agentStatus.agents)) {
    statusMap[agentName] = info;
  }
  return tasks.map(task => {
    const enrichedAgents = (task.agents || []).map(agentName => {
      const info = statusMap[agentName];
      if (info) {
        return { name: agentName, status: info.status, note: info.note, updated: info.updated };
      }
      return { name: agentName, status: "unknown", note: "", updated: null };
    });
    return { ...task, agentsEnriched: enrichedAgents };
  });
}

function collectData() {
  const teamsMd = fs.readFileSync(TEAMS_PATH, "utf8");
  const tasksMd = fs.readFileSync(TASKS_PATH, "utf8");
  const parsedTeams = parseTeams(teamsMd);
  const general = parseGeneralTasks(tasksMd);
  const tasks = parsedTeams.tasks.concat(general);
  const teamsMeta = buildTeamMeta(parsedTeams.teams);
  
  // Load agent status from Guli
  const agentStatus = loadAgentStatus();
  const enrichedTasks = enrichTasksWithAgentStatus(tasks, agentStatus);
  
  const data = {
    generatedAt: new Date().toISOString(),
    teams: teamsMeta,
    tasks: enrichedTasks,
    sources: [
      { path: "docs/TEAMS.md", label: "משימות צוותים" },
      { path: "docs/agents/TASKS.md", label: "משימות כלליות פתוחות" }
    ],
    agentStatusSource: agentStatus ? agentStatus.generatedAt : null
  };
  
  // Write tasks-data.json for Guli to consume
  writeFileAtomic(DATA_OUT_PATH, JSON.stringify(data, null, 2));
  console.log(`[inspector] wrote tasks-data.json`);
  
  return data;
}

/* ---------- HTML ---------- */

function buildHtml(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="דשבורד משימות ליומן הרחובות של ירושלים — כל משימות הצוותים מסודרות לפי צוות, עדיפות וסטטוס, עם סינון, חיפוש חופשי והדפסה.">
<title>דשבורד משימות — יומן הרחובות של ירושלים</title>
<style>
  :root {
    --bg: #f4f2ec;
    --panel: #ffffff;
    --ink: #1e2a24;
    --muted: #5d6b63;
    --line: #ded9cd;
    --accent: #1d5b3c;
    --accent-soft: #e9f1ea;
    --radius: 12px;
    --shadow: 0 1px 2px rgba(20, 30, 25, .06), 0 8px 20px rgba(20, 30, 25, .06);
  }

  * { box-sizing: border-box; }

  html, body { margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: "Segoe UI", "Arial Hebrew", Arial, system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.55;
    -webkit-text-size-adjust: 100%;
  }

  code {
    font-family: "Consolas", "Courier New", monospace;
    font-size: .92em;
    background: #efede6;
    border-radius: 4px;
    padding: 0 4px;
  }

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .skip-link {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    background: var(--accent);
    color: #fff;
    z-index: 10;
  }
  .skip-link:focus {
    position: fixed;
    top: 8px;
    inset-inline-start: 8px;
    width: auto; height: auto;
    margin: 0;
    clip: auto;
    padding: 10px 16px;
    border-radius: 8px;
  }

  .wrap {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 16px 48px;
  }

  /* ---------- header ---------- */
  .page-head {
    background: var(--accent);
    color: #fff;
    padding: 20px 0 18px;
    border-bottom: 4px solid #123c27;
  }
  .page-head__inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    align-items: center;
    justify-content: space-between;
  }
  .page-head h1 {
    margin: 0;
    font-size: 1.45rem;
    letter-spacing: .2px;
  }
  .page-head__sub { margin: 2px 0 0; font-size: .92rem; opacity: .92; }
  .page-head__src { margin: 2px 0 0; font-size: .82rem; color: #dfe9e2; }
  .page-head__src code { background: #123c27; color: #ffffff; }
  .page-head__role { display: inline-block; margin-right: 8px; font-size: .85rem; font-weight: 700; color: #ffd54f; background: #123c27; padding: 2px 8px; border-radius: 999px; vertical-align: middle; }
  .page-head__mandate { margin: 6px 0 0; font-size: .78rem; color: #b8d4c4; line-height: 1.4; }
  .page-head__actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

  /* ---------- buttons ---------- */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    font-size: .95rem;
    min-height: 44px;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    cursor: pointer;
    text-decoration: none;
  }
  .btn:hover { border-color: var(--accent); }
  .btn:focus-visible { outline: 3px solid #b58900; outline-offset: 2px; }
  .btn--primary {
    background: #fff;
    border-color: #fff;
    color: var(--accent);
    font-weight: 700;
  }

  /* ---------- summary ---------- */
  .summary {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 16px;
    margin: 16px 0;
  }
  .summary h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .summary__totals {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }
  .stat {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 8px 14px;
    background: var(--accent-soft);
    min-width: 132px;
  }
  .stat__value { display: block; font-size: 1.5rem; font-weight: 700; line-height: 1.2; }
  .stat__label { display: block; font-size: .82rem; color: var(--muted); }
  .summary__groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
  }
  .summary__box h3 { margin: 0 0 8px; font-size: .95rem; color: var(--muted); font-weight: 700; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    font: inherit;
    font-size: .86rem;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: #fbfaf6;
    color: var(--ink);
    cursor: pointer;
    text-align: start;
  }
  .chip:hover { border-color: var(--accent); }
  .chip:focus-visible { outline: 3px solid #b58900; outline-offset: 2px; }
  .chip[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }
  .chip__count { font-variant-numeric: tabular-nums; opacity: .8; }
  .chip--static { cursor: default; }
  .chip--static:hover { border-color: var(--line); }

  /* ---------- toolbar ---------- */
  .toolbar {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 14px 16px;
    margin: 0 0 16px;
  }
  .toolbar__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;
    align-items: end;
  }
  .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .field label { font-size: .82rem; color: var(--muted); font-weight: 700; }
  .field select,
  .field input {
    font: inherit;
    font-size: 16px;
    min-height: 44px;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #fff;
    color: var(--ink);
  }
  .field select:focus-visible,
  .field input:focus-visible { outline: 3px solid #b58900; outline-offset: 1px; }
  .field--actions { justify-content: flex-end; }
  .results-count {
    margin: 12px 0 0;
    font-size: .92rem;
    color: var(--muted);
    font-weight: 700;
  }

  /* ---------- groups ---------- */
  .team-group { margin: 0 0 22px; }
  .team-group__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 12px;
    border-bottom: 2px solid var(--line);
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .team-group__head h3 {
    margin: 0;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .team-group__icon { font-size: 1.15rem; }
  .team-group__count { font-size: .9rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .team-group__meta { margin: 0; font-size: .84rem; color: var(--muted); flex-basis: 100%; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: .8rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px dashed #8a6d1f;
    background: #fdf6e3;
    color: #6b5310;
  }
  .team-group.is-standby .team-group__head { border-bottom-color: #b9b2a0; }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px 14px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .card__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    min-width: 0;
  }
  .card__id {
    font-family: "Consolas", "Courier New", monospace;
    font-size: .8rem;
    font-weight: 700;
    color: var(--muted);
    background: #efede6;
    border-radius: 6px;
    padding: 2px 8px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: .78rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .tag--p-high { color: #8c1d18; border-color: #d7a3a0; background: #fdeceb; }
  .tag--p-medium { color: #6b5310; border-color: #d9c285; background: #fdf6e3; }
  .tag--p-low { color: #1d5b3c; border-color: #a6c9b3; background: #e9f1ea; }
  .tag--p-none { color: #4a4a4a; border-color: #cfcfc8; background: #f4f3ef; }
  .tag--s-done { color: #1d5b3c; border-color: #a6c9b3; background: #e9f1ea; }
  .tag--s-progress { color: #6b5310; border-color: #d9c285; background: #fdf6e3; }
  .tag--s-pending { color: #3f4a45; border-color: #c8cdc9; background: #f1f3f2; }
  .tag--s-blocked { color: #6a3d8f; border-color: #c6a9dd; background: #f5edfb; }

  /* Agent status badges (from agent-status.json via Guli) */
  .agent-status { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: .75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid; white-space: normal; max-width: 100%; overflow-wrap: anywhere; }
  .agent-status strong { font-weight: 700; }
  .agent-status__note { font-weight: 400; }
  .agent-status--active { color: #1d5b3c; border-color: #a6c9b3; background: #e9f1ea; }
  .agent-status--waiting { color: #6b5310; border-color: #d9c285; background: #fdf6e3; }
  .agent-status--blocked { color: #6a3d8f; border-color: #c6a9dd; background: #f5edfb; }
  .agent-status--done { color: #1d5b3c; border-color: #a6c9b3; background: #e9f1ea; }
  .agent-status--unknown { color: #5d6b63; border-color: #ded9cd; background: #f4f2ec; }

  .card__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .card__desc {
    margin: 0;
    font-size: .88rem;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .card__meta {
    margin: auto 0 0;
    padding-top: 6px;
    border-top: 1px dashed var(--line);
    font-size: .8rem;
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
  }
  .card__meta strong { color: var(--ink); }

  .empty-state {
    background: var(--panel);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    padding: 28px 16px;
    text-align: center;
    color: var(--muted);
  }

  .page-foot {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: .82rem;
    color: var(--muted);
  }

  .print-only { display: none; }

  @media (max-width: 520px) {
    .wrap { padding: 0 12px 36px; }
    .page-head__inner { padding: 0 12px; }
    .page-head h1 { font-size: 1.2rem; }
    .cards { grid-template-columns: 1fr; }
    .toolbar__grid { grid-template-columns: 1fr; }
    .summary__groups { grid-template-columns: 1fr; }
    .stat { min-width: 0; flex: 1 1 120px; }
  }

  @media print {
    @page { margin: 14mm; }
    body { background: #fff; font-size: 11pt; color: #000; }
    .no-print, .toolbar, .skip-link { display: none !important; }
    .print-only { display: block !important; }
    .page-head { background: #fff; color: #000; border-bottom: 2px solid #000; padding: 0 0 8px; }
    .page-head h1 { font-size: 15pt; }
    .page-head__inner { padding: 0; }
    .page-head__src code { background: none; color: #000; }
    .summary, .card, .toolbar { box-shadow: none; }
    .summary { border-color: #999; }
    .card { border-color: #999; background: #fff; break-inside: avoid; page-break-inside: avoid; }
    .tag, .chip, .badge, .stat { background: none !important; border-color: #777; color: #000 !important; }
    .team-group__head { break-after: avoid; page-break-after: avoid; }
    .team-group { break-inside: auto; }
    .cards { display: block; }
    .card { margin-bottom: 8px; }
    .page-foot { border-color: #999; }
  }
</style>
</head>
<body>
<a class="skip-link" href="#main">דלג לתוכן המשימות</a>

<header class="page-head no-print">
  <div class="page-head__inner">
    <div>
      <h1>דשבורד משימות <span class="page-head__role" aria-label="הפקח">— הפקח</span></h1>
      <p class="page-head__sub">יומן הרחובות של ירושלים · נבנה ב־<time id="generated-at"></time></p>
      <p class="page-head__src">מקור יחיד: <code>docs/TEAMS.md</code> (משימות צוותים) + <code>docs/agents/TASKS.md</code> (משימות כלליות פתוחות)</p>
      <p class="page-head__mandate">מארגן המשימות — בקשר עם הראשי והמתעד (גולי), מקבל עדכונים מכל הסוכנים</p>
    </div>
    <div class="page-head__actions">
      <a class="btn" href="index.html">🏠 דף בית פנימי</a>
      <a class="btn" href="guli.html">📢 חדר הסוכנים</a>
      <a class="btn" href="project-map.html">🗺️ מפת הפרויקט</a>
      <a class="btn" href="agents-dashboard.html">👥 לוח הסוכנים</a>
      <a class="btn" href="agent-vs-subagent.html">🎩 ראשי מול סאב</a>
      <a class="btn" href="../index.html">🌐 לאפליקציה הציבורית</a>
      <button type="button" id="print-btn" class="btn btn--primary">הדפסה / PDF</button>
    </div>
  </div>
</header>

<div class="wrap">

  <section class="summary" aria-labelledby="summary-title">
    <h2 id="summary-title">סיכום</h2>
    <div class="summary__totals" id="summary-totals"></div>
    <div class="summary__groups">
      <div class="summary__box">
        <h3 id="sum-teams-title">לפי צוות</h3>
        <ul class="chips" id="summary-teams" aria-labelledby="sum-teams-title"></ul>
      </div>
      <div class="summary__box">
        <h3 id="sum-status-title">לפי סטטוס</h3>
        <ul class="chips" id="summary-status" aria-labelledby="sum-status-title"></ul>
      </div>
    </div>
  </section>

  <section class="toolbar no-print" aria-labelledby="toolbar-title">
    <h2 id="toolbar-title" class="sr-only">סינון, חיפוש ומיון</h2>
    <div class="toolbar__grid">
      <div class="field">
        <label for="f-team">צוות</label>
        <select id="f-team"><option value="">הכל</option></select>
      </div>
      <div class="field">
        <label for="f-priority">עדיפות</label>
        <select id="f-priority"><option value="">הכל</option></select>
      </div>
      <div class="field">
        <label for="f-status">סטטוס</label>
        <select id="f-status"><option value="">הכל</option></select>
      </div>
      <div class="field">
        <label for="f-owner">סוכן אחראי</label>
        <select id="f-owner"><option value="">הכל</option></select>
      </div>
      <div class="field">
        <label for="f-search">חיפוש חופשי</label>
        <input type="search" id="f-search" placeholder="מזהה, שם, תיאור או אחראי" autocomplete="off">
      </div>
      <div class="field">
        <label for="f-sort">מיון</label>
        <select id="f-sort"></select>
      </div>
      <div class="field field--actions">
        <button type="button" id="clear-btn" class="btn">ניקוי פילטרים</button>
      </div>
    </div>
    <p class="results-count" id="results-count" aria-live="polite"></p>
  </section>

  <main id="main">
    <div id="groups"></div>
    <p class="empty-state" id="empty-state" hidden>לא נמצאו משימות לפי הסינון הנוכחי. אפשר לנקות את הפילטרים או לשנות את מילות החיפוש.</p>
  </main>

  <footer class="page-foot">
    <p>נבנה אוטומטית מתוך <code>docs/TEAMS.md</code> ו־<code>docs/agents/TASKS.md</code> בכלי <code>tools/tasks-dashboard.js</code> · הפקח</p>
    <p class="print-only" id="print-meta"></p>
  </footer>

</div>

<noscript>
  <p class="wrap">הדשבורד דורש JavaScript כדי לסנן, לחפש ולמיין את המשימות. הפעל את JavaScript ורענן את הדף.</p>
</noscript>

<script type="application/json" id="tasks-data">${json}</script>
<script>
(function () {
  "use strict";

  var DATA = JSON.parse(document.getElementById("tasks-data").textContent);
  var TASKS = DATA.tasks || [];
  var TEAMS = DATA.teams || [];

  var TEAM_RANK = { "UI/UX": 0, "DEV": 1, "NET": 2, "Research": 3, "Mobile/Deploy": 4, "כללי": 5 };
  var PRIORITY_RANK = { high: 0, medium: 1, low: 2, none: 3 };
  var STATUS_RANK = { progress: 0, pending: 1, blocked: 2, done: 3 };
  var STATUS_ORDER = ["progress", "pending", "blocked", "done"];
  var PRIORITY_ORDER = ["high", "medium", "low", "none"];

  var SORTS = [
    { id: "team-priority-status", label: "צוות → עדיפות → סטטוס", keys: ["team", "priority", "status"] },
    { id: "team-status-priority", label: "צוות → סטטוס → עדיפות", keys: ["team", "status", "priority"] },
    { id: "priority-team-status", label: "עדיפות → צוות → סטטוס", keys: ["priority", "team", "status"] },
    { id: "priority-status-team", label: "עדיפות → סטטוס → צוות", keys: ["priority", "status", "team"] },
    { id: "status-priority-team", label: "סטטוס → עדיפות → צוות", keys: ["status", "priority", "team"] },
    { id: "owner-team-priority", label: "אחראי → צוות → עדיפות", keys: ["owner", "team", "priority"] },
    { id: "id", label: "מזהה (סדר אלפביתי)", keys: ["id"] }
  ];

  var el = {
    generatedAt: document.getElementById("generated-at"),
    totals: document.getElementById("summary-totals"),
    teams: document.getElementById("summary-teams"),
    status: document.getElementById("summary-status"),
    team: document.getElementById("f-team"),
    priority: document.getElementById("f-priority"),
    statusSel: document.getElementById("f-status"),
    owner: document.getElementById("f-owner"),
    search: document.getElementById("f-search"),
    sort: document.getElementById("f-sort"),
    clear: document.getElementById("clear-btn"),
    print: document.getElementById("print-btn"),
    groups: document.getElementById("groups"),
    empty: document.getElementById("empty-state"),
    count: document.getElementById("results-count"),
    printMeta: document.getElementById("print-meta")
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* מרקדוק קל: קוד והדגשה בלבד */
  function md(value) {
    return esc(value)
      .replace(/\\x60([^\\x60]+)\\x60/g, "<code>$1</code>")
      .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>");
  }

  function teamMeta(key) {
    for (var i = 0; i < TEAMS.length; i++) {
      if (TEAMS[i].key === key) return TEAMS[i];
    }
    return { key: key, label: key, icon: "•", sourceTitle: key, note: "", standby: false, owner: "" };
  }

  function heSort(a, b) {
    try {
      return String(a).localeCompare(String(b), "he");
    } catch (err) {
      return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
    }
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .replace(/[֑-ׇ]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0x5F0);
      });
  }

  function searchable(task) {
    return normalize(
      [task.id, task.title, task.description, task.owner, task.context, task.team].join(" ")
    );
  }

  /* ---------- אפשרויות הפילטרים ---------- */

  function fillSelect(select, values, current) {
    values.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
    select.value = current || "";
  }

  function countBy(list, keyOf) {
    var map = {};
    list.forEach(function (task) {
      var key = keyOf(task);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }

  function buildFilterOptions() {
    var teamCounts = countBy(TASKS, function (t) { return t.team; });
    var teamValues = TEAMS
      .filter(function (team) { return teamCounts[team.key]; })
      .map(function (team) {
        return {
          value: team.key,
          label: team.icon + " " + team.label + " (" + teamCounts[team.key] + ")"
        };
      });
    fillSelect(el.team, teamValues, el.team.value);

    var priCounts = countBy(TASKS, function (t) { return t.priority.key; });
    var priValues = PRIORITY_ORDER
      .filter(function (key) { return priCounts[key]; })
      .map(function (key) {
        var meta = PRIORITY_META(key);
        return { value: key, label: meta.marker + " " + meta.label + " (" + priCounts[key] + ")" };
      });
    fillSelect(el.priority, priValues, el.priority.value);

    var statusCounts = countBy(TASKS, function (t) { return t.status.key; });
    var statusValues = STATUS_ORDER
      .filter(function (key) { return statusCounts[key]; })
      .map(function (key) {
        var meta = STATUS_META(key);
        return { value: key, label: meta.marker + " " + meta.label + " (" + statusCounts[key] + ")" };
      });
    fillSelect(el.statusSel, statusValues, el.statusSel.value);

    var ownerCounts = countBy(TASKS, function (t) { return t.owner; });
    var ownerValues = Object.keys(ownerCounts)
      .sort(heSort)
      .map(function (name) {
        return { value: name, label: name + " (" + ownerCounts[name] + ")" };
      });
    fillSelect(el.owner, ownerValues, el.owner.value);

    SORTS.forEach(function (sort) {
      var option = document.createElement("option");
      option.value = sort.id;
      option.textContent = sort.label;
      el.sort.appendChild(option);
    });
    el.sort.value = SORTS[0].id;
  }

  function PRIORITY_META(key) {
    for (var i = 0; i < TASKS.length; i++) {
      if (TASKS[i].priority.key === key) return TASKS[i].priority;
    }
    return { key: key, label: key, marker: "—", note: "" };
  }

  function STATUS_META(key) {
    for (var i = 0; i < TASKS.length; i++) {
      if (TASKS[i].status.key === key) return TASKS[i].status;
    }
    return { key: key, label: key, marker: "•", note: "" };
  }

  /* ---------- סינון ומיון ---------- */

  function currentFilters() {
    return {
      team: el.team.value,
      priority: el.priority.value,
      status: el.statusSel.value,
      owner: el.owner.value,
      q: normalize(el.search.value.trim()),
      sort: el.sort.value || SORTS[0].id
    };
  }

  function matches(task, filters) {
    if (filters.team && task.team !== filters.team) return false;
    if (filters.priority && task.priority.key !== filters.priority) return false;
    if (filters.status && task.status.key !== filters.status) return false;
    if (filters.owner && task.owner !== filters.owner) return false;
    if (filters.q && searchable(task).indexOf(filters.q) === -1) return false;
    return true;
  }

  function compareTasks(a, b, keys) {
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var result = 0;
      if (key === "team") {
        var ta = TEAM_RANK[a.team], tb = TEAM_RANK[b.team];
        result = (ta === undefined ? 99 : ta) - (tb === undefined ? 99 : tb);
      } else if (key === "priority") {
        result = PRIORITY_RANK[a.priority.key] - PRIORITY_RANK[b.priority.key];
      } else if (key === "status") {
        result = STATUS_RANK[a.status.key] - STATUS_RANK[b.status.key];
      } else if (key === "owner") {
        result = heSort(a.owner, b.owner);
      } else {
        result = heSort(a.id, b.id);
      }
      if (result !== 0) return result;
    }
    return heSort(a.id, b.id);
  }

  function sortedTasks(list, sortId) {
    var sort = SORTS.filter(function (s) { return s.id === sortId; })[0] || SORTS[0];
    return list.slice().sort(function (a, b) { return compareTasks(a, b, sort.keys); });
  }

  function groupTasks(list) {
    var groups = [];
    var index = {};
    list.forEach(function (task) {
      if (!index[task.team]) {
        index[task.team] = { team: teamMeta(task.team), tasks: [] };
        groups.push(index[task.team]);
      }
      index[task.team].tasks.push(task);
    });
    return groups;
  }

  /* ---------- ציור ---------- */

  function detailText(base, note) {
    if (!note) return base;
    if (note === base) return base;
    if (note.indexOf("(") >= 0 || note.indexOf(")") >= 0) return base + " — " + note;
    return base + " (" + note + ")";
  }

  function cardHtml(task) {
    var priority = task.priority;
    var status = task.status;
    var priorityText = detailText(priority.label, priority.note);
    var statusText = detailText(status.label, status.note);
    var context = task.context ? task.context : task.source;
    
    // Build agents display with status badges from agent-status.json
    var agentsHtml = "";
    if (task.agentsEnriched && task.agentsEnriched.length) {
      var agentSpans = task.agentsEnriched.map(function(a) {
        var statusClass = "agent-status--unknown";
        var statusLabel = "❓";
        if (a.status === "active" || a.status === "working") { statusClass = "agent-status--active"; statusLabel = "🟢"; }
        else if (a.status === "blocked") { statusClass = "agent-status--blocked"; statusLabel = "🔴"; }
        else if (a.status === "waiting") { statusClass = "agent-status--waiting"; statusLabel = "🟡"; }
        else if (a.status === "done") { statusClass = "agent-status--done"; statusLabel = "✅"; }
        var noteHtml = a.note ? ' <span class="agent-status__note">' + esc(a.note) + '</span>' : "";
        return '<span class="agent-status ' + statusClass + '" title="' + esc(a.name + ": " + (a.note || a.status)) + '">' +
          '<strong>' + esc(a.name) + '</strong> ' + statusLabel + noteHtml +
        '</span>';
      });
      agentsHtml = '<span>סוכנים: ' + agentSpans.join(" · ") + '</span>';
    } else if (task.agents && task.agents.length) {
      agentsHtml = '<span>סוכנים: <strong>' + esc(task.agents.join(" · ")) + '</strong></span>';
    }
    
    return '<li class="card" data-id="' + esc(task.id) + '">' +
      '<div class="card__head">' +
        '<span class="card__id">' + esc(task.id) + '</span>' +
        '<span class="tag tag--p-' + esc(priority.key) + '">' + esc(priority.marker) + " " + esc(priorityText) + '</span>' +
        '<span class="tag tag--s-' + esc(status.key) + '">' + esc(status.marker) + " " + esc(statusText) + '</span>' +
      '</div>' +
      '<h4 class="card__title">' + md(task.title) + '</h4>' +
      (task.description ? '<p class="card__desc">' + md(task.description) + '</p>' : '') +
      '<p class="card__meta">' +
        '<span>אחראי: <strong>' + esc(task.owner) + '</strong></span>' +
        (agentsHtml ? " " + agentsHtml : "") +
        '<span>צוות: <strong>' + esc(teamMeta(task.team).label) + '</strong></span>' +
        '<span>מקור: ' + esc(task.source) + (context ? " · " + esc(context) : "") + '</span>' +
      '</p>' +
    '</li>';
  }

  function groupHtml(group) {
    var meta = group.team;
    var head = '<header class="team-group__head">' +
      '<h3><span class="team-group__icon" aria-hidden="true">' + esc(meta.icon) + '</span> ' + esc(meta.label) + '</h3>';
    if (meta.standby) head += '<span class="badge">🏖️ בחופש</span>';
    head += '<span class="team-group__count">' + group.tasks.length + ' משימות</span>';
    head += '<p class="team-group__meta">' +
      esc(meta.sourceTitle) + (meta.note ? " — " + esc(meta.note) : "") +
      " · אחראי: " + esc(meta.owner) +
      '</p></header>';
    var cards = group.tasks.map(cardHtml).join("");
    return '<section class="team-group' + (meta.standby ? " is-standby" : "") + '" aria-label="' + esc(meta.label) + '">' +
      head + '<ul class="cards">' + cards + '</ul></section>';
  }

  function renderSummary() {
    var teamCounts = countBy(TASKS, function (t) { return t.team; });
    var statusCounts = countBy(TASKS, function (t) { return t.status.key; });
    var priorityCounts = countBy(TASKS, function (t) { return t.priority.key; });
    var done = statusCounts.done || 0;

    var stats = [
      { value: TASKS.length, label: "סה״כ משימות" },
      { value: done, label: "הושלמו ואומתו" },
      { value: (statusCounts.progress || 0) + (statusCounts.pending || 0) + (statusCounts.blocked || 0), label: "פתוחות" },
      { value: TEAMS.filter(function (t) { return t.key !== "כללי"; }).length, label: "צוותים" }
    ];
    el.totals.innerHTML = stats.map(function (stat) {
      return '<div class="stat"><span class="stat__value">' + stat.value + '</span><span class="stat__label">' + esc(stat.label) + '</span></div>';
    }).join("");

    el.teams.innerHTML = TEAMS.filter(function (team) { return teamCounts[team.key]; }).map(function (team) {
      var pressed = el.team.value === team.key ? "true" : "false";
      return '<li><button type="button" class="chip" data-filter="team" data-value="' + esc(team.key) + '" aria-pressed="' + pressed + '">' +
        '<span aria-hidden="true">' + esc(team.icon) + '</span>' + esc(team.label) +
        '<span class="chip__count">' + teamCounts[team.key] + '</span></button></li>';
    }).join("");

    el.status.innerHTML = STATUS_ORDER.filter(function (key) { return statusCounts[key]; }).map(function (key) {
      var meta = STATUS_META(key);
      var pressed = el.statusSel.value === key ? "true" : "false";
      return '<li><button type="button" class="chip" data-filter="status" data-value="' + esc(key) + '" aria-pressed="' + pressed + '">' +
        '<span aria-hidden="true">' + esc(meta.marker) + '</span>' + esc(meta.label) +
        '<span class="chip__count">' + statusCounts[key] + '</span></button></li>';
    }).join("");

    el.printMeta.textContent = "הדפסה: " + (priorityCounts.high || 0) + " משימות בעדיפות גבוהה · " + done + " משימות הושלמו.";
  }

  function render() {
    var filters = currentFilters();
    var filtered = TASKS.filter(function (task) { return matches(task, filters); });
    var ordered = sortedTasks(filtered, filters.sort);
    var groups = groupTasks(ordered);

    el.groups.innerHTML = groups.map(groupHtml).join("");
    el.empty.hidden = ordered.length !== 0;

    var text = ordered.length === TASKS.length
      ? "מוצגות כל " + TASKS.length + " המשימות"
      : "מוצגות " + ordered.length + " מתוך " + TASKS.length + " משימות";
    el.count.textContent = text;
    el.printMeta.textContent = text + " · נבנה ב־" + formattedDate(DATA.generatedAt);
  }

  function formattedDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      var pad = function (n) { return String(n).padStart(2, "0"); };
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    } catch (err) {
      return String(iso);
    }
  }

  function resetFilters() {
    el.team.value = "";
    el.priority.value = "";
    el.statusSel.value = "";
    el.owner.value = "";
    el.search.value = "";
    el.sort.value = SORTS[0].id;
  }

  /* ---------- אירועים ---------- */

  [el.team, el.priority, el.statusSel, el.owner, el.sort].forEach(function (control) {
    control.addEventListener("change", function () { renderSummary(); render(); });
  });

  el.search.addEventListener("input", function () { render(); });

  el.clear.addEventListener("click", function () {
    resetFilters();
    renderSummary();
    render();
    el.search.focus();
  });

  el.print.addEventListener("click", function () { window.print(); });

  el.teams.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest("button[data-filter]") : null;
    if (!button) return;
    var value = button.getAttribute("data-value");
    el.team.value = el.team.value === value ? "" : value;
    renderSummary();
    render();
  });

  el.status.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest("button[data-filter]") : null;
    if (!button) return;
    var value = button.getAttribute("data-value");
    el.statusSel.value = el.statusSel.value === value ? "" : value;
    renderSummary();
    render();
  });

  /* ---------- הפעלה ---------- */

  el.generatedAt.textContent = formattedDate(DATA.generatedAt);
  el.generatedAt.setAttribute("datetime", DATA.generatedAt);
  buildFilterOptions();
  renderSummary();
  render();
})();
</script>
</body>
</html>
`;
}

function main() {
  const data = collectData();
  const html = buildHtml(data);
  writeFileAtomic(OUT_PATH, html);
  const bytes = Buffer.byteLength(html, "utf8");
  const teams = data.teams.map((t) => t.key).join(", ");
  console.log(
    `[inspector] built internal/tasks.html (${(bytes / 1024).toFixed(1)} KiB) | ${data.tasks.length} tasks | teams: ${teams}`
  );
}

try {
  main();
} catch (err) {
  console.error(`[inspector] build failed: ${err.message}`);
  process.exitCode = 1;
}
