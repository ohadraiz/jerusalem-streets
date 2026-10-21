#!/usr/bin/env node
"use strict";

/*
 * guli-room.js — בונה את guli.html מתוך docs/agents/guli/state.json
 *
 * שימוש:
 *   node tools/guli-room.js               בנייה חד-פעמית
 *   node tools/guli-room.js --watch       בנייה מחדש בכל שינוי + heartbeat
 *   node tools/guli-room.js --interval=45 קצב בדיקת הקבצים בשניות (30–60)
 *
 * ללא תלויות, ללא רשת. כל הנתיבים נגזרים ממיקום הקובץ, כך שאפשר
 * להריץ אותו מכל תיקיית עבודה.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(ROOT, "docs", "agents", "guli", "state.json");
const HEARTBEAT_PATH = path.join(ROOT, "docs", "agents", "guli", "heartbeat.json");
const OUT_PATH = path.join(ROOT, "guli.html");
const CHANNELS_DIR = path.join(ROOT, "docs", "agents", "channels");
const STATIC_SOURCES = [
  path.join(ROOT, "docs", "agents", "BOARD.md"),
  path.join(ROOT, "docs", "agents", "TASKS.md")
];

// Polling interval: 5 minutes = 300 seconds
const POLL_INTERVAL_MS = 5 * 60 * 1000;
let lastPoll = 0;

// Dependency graph: who each agent is waiting for / blocked by
const AGENT_DEPENDENCIES = {
  main: ["mappy", "chiki"],
  mappy: ["chiki"],
  chiki: [],
  tsiri: ["mappy"],
  tsibi: ["main", "chiki"],
  shifu: ["main", "tsiri", "tsibi"],
  guli: ["main", "mappy", "chiki", "tsiri", "tsibi", "shifu", "tsibi"]
};

function readAgentChannel(agentId) {
  const channelPath = path.join(CHANNELS_DIR, `${agentId}.md`);
  try {
    const content = fs.readFileSync(channelPath, "utf8");
    const lines = content.split("\n");
    const lastUpdate = lines.find(l => l.startsWith("## ") && l.includes("·"));
    return { channelPath, content, lastUpdate: lastUpdate || "אין עדכון" };
  } catch (err) {
    return { channelPath, content: null, lastUpdate: "קובץ לא נמצא" };
  }
}

function pollAllAgents() {
  const updates = {};
  for (const agentId of Object.keys(AGENT_DEPENDENCIES)) {
    if (agentId === "guli") continue;
    updates[agentId] = readAgentChannel(agentId);
  }
  return updates;
}

const MONTHS = [
  "ינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני",
  "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"
];

const STATUS = {
  active: { label: "פעיל", className: "is-active" },
  waiting: { label: "ממתין לדיווח", className: "is-waiting" },
  unknown: { label: "טרם דווח", className: "is-unknown" },
  done: { label: "סיים", className: "is-done" }
};

const BLOCKER_SEVERITY = {
  blocker: { label: "חוסם", className: "is-blocker", order: 0 },
  decision: { label: "החלטה פתוחה", className: "is-decision", order: 1 },
  process: { label: "תהליך", className: "is-process", order: 2 },
  warning: { label: "אזהרה", className: "is-warning", order: 3 }
};

const BLOCKER_STATUS = {
  open: { label: "פתוח", className: "is-open" },
  "in-progress": { label: "בטיפול", className: "is-in-progress" },
  waiting: { label: "ממתין", className: "is-waiting" },
  resolved: { label: "נפתר", className: "is-resolved" }
};

/* ---------- helpers ---------- */

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(href) {
  const raw = String(href || "").trim();
  if (/^(https?:\/\/|#|\.{0,2}\/)/i.test(raw) && !/^javascript:/i.test(raw)) {
    return raw;
  }
  if (/^[\w./-]+\.(md|html|json)$/i.test(raw)) return raw;
  return null;
}

function parseIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value || ""));
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] == null ? null : Number(m[4]),
    minute: m[5] == null ? null : Number(m[5])
  };
}

function dateLabel(value) {
  const d = parseIso(value);
  if (!d) return "תאריך לא צוין";
  return `${d.day} ${MONTHS[d.month - 1] || ""} ${d.year}`.replace(/\s+/g, " ");
}

function dateTimeLabel(value) {
  const d = parseIso(value);
  if (!d) return "טרם דווח";
  const date = `${d.day} ${MONTHS[d.month - 1] || ""} ${d.year}`;
  if (d.hour == null) return date;
  const hh = String(d.hour).padStart(2, "0");
  const mm = String(d.minute).padStart(2, "0");
  return `${date}, ${hh}:${mm}`;
}

function timeLabel(value) {
  const d = parseIso(value);
  if (!d || d.hour == null) return "";
  return `${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`;
}

function isIso(value) {
  return Boolean(parseIso(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonSafe(file) {
  try {
    return readJson(file);
  } catch (err) {
    return null;
  }
}

function localIso(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  ].join("");
}

function channels() {
  try {
    return fs
      .readdirSync(CHANNELS_DIR)
      .filter((name) => name.toLowerCase().endsWith(".md"))
      .sort()
      .map((name) => path.join(CHANNELS_DIR, name));
  } catch (err) {
    return [];
  }
}

function validateState(state) {
  const errors = [];
  if (!state || typeof state !== "object") {
    return ["state.json is not an object"];
  }
  if (!state.meta || typeof state.meta !== "object") errors.push("meta is missing");
  if (!state.meta || !isIso(state.meta.updatedAt)) errors.push("meta.updatedAt is not an ISO date");
  if (!Array.isArray(state.agents) || state.agents.length === 0) errors.push("agents must be a non-empty array");
  if (!Array.isArray(state.timeline)) errors.push("timeline must be an array");
  if (!Array.isArray(state.sources)) errors.push("sources must be an array");

  if (state.blockers != null) {
    if (!Array.isArray(state.blockers)) {
      errors.push("blockers must be an array when present");
    } else {
      const seenBlockers = new Set();
      state.blockers.forEach((blocker, index) => {
        const where = `blockers[${index}]`;
        if (!blocker || typeof blocker !== "object") {
          errors.push(`${where} is not an object`);
          return;
        }
        ["id", "title", "severity", "status", "owner", "impact", "nextStep", "source", "updatedAt"].forEach((key) => {
          if (!(key in blocker)) errors.push(`${where}.${key} is missing`);
        });
        if (blocker.id && seenBlockers.has(blocker.id)) errors.push(`${where}.id is duplicated (${blocker.id})`);
        if (blocker.id) seenBlockers.add(blocker.id);
        if (!BLOCKER_SEVERITY[blocker.severity]) errors.push(`${where}.severity is unknown (${blocker.severity})`);
        if (!BLOCKER_STATUS[blocker.status]) errors.push(`${where}.status is unknown (${blocker.status})`);
        if (blocker.updatedAt && !isIso(blocker.updatedAt)) errors.push(`${where}.updatedAt is not an ISO date`);
      });
    }
  }

  if (Array.isArray(state.agents)) {
    const seen = new Set();
    state.agents.forEach((agent, index) => {
      const where = `agents[${index}]`;
      if (!agent || typeof agent !== "object") {
        errors.push(`${where} is not an object`);
        return;
      }
      ["id", "name", "status", "currentTask", "talkingWith", "nextTasks", "completed", "conclusion", "source"].forEach((key) => {
        if (!(key in agent)) errors.push(`${where}.${key} is missing`);
      });
      if (agent.id && seen.has(agent.id)) errors.push(`${where}.id is duplicated (${agent.id})`);
      if (agent.id) seen.add(agent.id);
      if (agent.talkingWith && typeof agent.talkingWith !== "object") errors.push(`${where}.talkingWith must be an object`);
      if (!Array.isArray(agent.nextTasks)) errors.push(`${where}.nextTasks must be an array`);
      if (!Array.isArray(agent.completed)) errors.push(`${where}.completed must be an array`);
      if (agent.source && typeof agent.source !== "object") errors.push(`${where}.source must be an object`);
      if (!STATUS[agent.status]) errors.push(`${where}.status is unknown (${agent.status})`);
    });
  }
  return errors;
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

/* ---------- render ---------- */

function renderStatus(agent) {
  const meta = STATUS[agent.status] || STATUS.unknown;
  const label = agent.statusLabel || meta.label;
  return `<span class="chip ${meta.className}"><span class="chip__dot" aria-hidden="true"></span>${esc(label)}</span>`;
}

function renderTalk(talk) {
  if (!talk || typeof talk !== "object") {
    return `<p class="agent__talk"><span class="label">עם מי</span> טרם דווח</p>`;
  }
  const who = talk.with ? esc(talk.with) : "טרם דווח";
  const topic = talk.topic ? esc(talk.topic) : "";
  const state = talk.state ? `<span class="talk-state">${esc(talk.state)}</span>` : "";
  return `<p class="agent__talk">
      <span class="label">עם מי</span>
      <span class="agent__talk-body"><strong>${who}</strong>${topic ? ` · ${topic}` : ""} ${state}</span>
    </p>`;
}

function renderAgent(agent) {
  const nextTasks = Array.isArray(agent.nextTasks) && agent.nextTasks.length
    ? `<ul class="ticks">${agent.nextTasks.slice(0, 3).map((task) => `<li>${esc(task)}</li>`).join("")}</ul>`
    : `<p class="empty-line">טרם דווחו משימות המשך.</p>`;

  const completed = Array.isArray(agent.completed) && agent.completed.length
    ? agent.completed.map((item) => `
        <li class="done">
          <p class="done__head">
            <span class="done__task">${esc(item.task)}</span>
            <time class="done__date" datetime="${esc(item.date)}">${esc(dateLabel(item.date))}</time>
          </p>
          <p class="done__conclusion">${esc(item.conclusion)}</p>
        </li>`).join("")
    : `<li class="done done--empty"><p class="done__conclusion">טרם דווח על משימה שהושלמה.</p></li>`;

  const source = agent.source && agent.source.label
    ? (() => {
        const href = safeHref(agent.source.href);
        const label = esc(agent.source.label);
        return href ? `<a href="${esc(href)}">${label}</a>` : label;
      })()
    : "טרם אומת";

  const reported = agent.reportedAt
    ? `<span class="agent__reported">דיווח אחרון: <time dir="ltr" datetime="${esc(agent.reportedAt)}">${esc(dateTimeLabel(agent.reportedAt))}</time>${agent.reportedAtNote ? ` · ${esc(agent.reportedAtNote)}` : ""}</span>`
    : `<span class="agent__reported">דיווח אחרון: טרם דווח</span>`;

  return `<article class="agent ${STATUS[agent.status] ? STATUS[agent.status].className : "is-unknown"}" id="agent-${esc(agent.id)}">
    <header class="agent__head">
      <span class="agent__initial" aria-hidden="true">${esc(agent.initial || agent.name.slice(0, 1))}</span>
      <div class="agent__id">
        <h3>${esc(agent.name)}</h3>
        <p class="agent__role">${esc(agent.role || "")}</p>
      </div>
      ${renderStatus(agent)}
    </header>

    <p class="agent__now"><span class="label">מה עושה עכשיו</span>${esc(agent.currentTask || "טרם דווח")}</p>
    ${renderTalk(agent.talkingWith)}

    <div class="agent__block">
      <h4>המשימות הבאות</h4>
      ${nextTasks}
    </div>

    <div class="agent__block">
      <h4>מה הסתיים לאחרונה</h4>
      <ul class="done-list">${completed}</ul>
    </div>

    <blockquote class="agent__conclusion">
      <span class="label">מסקנה</span>
      <p>${esc(agent.conclusion || "טרם דווח")}</p>
    </blockquote>

    <footer class="agent__foot">
      <span class="agent__source">מקור: ${source}</span>
      ${reported}
    </footer>
  </article>`;
}

function renderRoom(agents) {
  return agents.map((agent) => {
    const meta = STATUS[agent.status] || STATUS.unknown;
    return `<li class="room__item ${meta.className}">
      <span class="room__dot" aria-hidden="true"></span>
      <span class="room__name">${esc(agent.name)}</span>
      <span class="room__state">${esc(agent.statusLabel || meta.label)}</span>
    </li>`;
  }).join("");
}

function renderBlockers(blockers) {
  if (!Array.isArray(blockers) || !blockers.length) {
    return `<p class="empty-line">טרם דווחו תקלות או חסמים.</p>`;
  }

  const sorted = blockers.slice().sort((a, b) => {
    const aResolved = a.status === "resolved" ? 1 : 0;
    const bResolved = b.status === "resolved" ? 1 : 0;
    if (aResolved !== bResolved) return aResolved - bResolved;
    const aSeverity = (BLOCKER_SEVERITY[a.severity] || { order: 9 }).order;
    const bSeverity = (BLOCKER_SEVERITY[b.severity] || { order: 9 }).order;
    return aSeverity - bSeverity;
  });

  return `<div class="blockers">
    ${sorted.map((blocker) => {
      const severity = BLOCKER_SEVERITY[blocker.severity] || { label: blocker.severity, className: "is-warning" };
      const status = BLOCKER_STATUS[blocker.status] || { label: blocker.status, className: "is-open" };
      const resolvedClass = blocker.status === "resolved" ? " is-resolved" : "";
      return `<article class="blocker ${severity.className}${resolvedClass}" id="blocker-${esc(blocker.id)}">
        <header class="blocker__head">
          <h3>${esc(blocker.title)}</h3>
          <div class="blocker__chips">
            <span class="chip ${severity.className}">${esc(severity.label)}</span>
            <span class="chip ${status.className}">${esc(status.label)}</span>
          </div>
        </header>
        <p class="blocker__impact">${esc(blocker.impact)}</p>
        <p class="blocker__next"><span class="label">הצעד הבא</span>${esc(blocker.nextStep)}</p>
        <footer class="blocker__foot">
          <span>אחראי: <strong>${esc(blocker.owner)}</strong></span>
          <span>מקור: ${esc(blocker.source)}</span>
          <span>עודכן: ${esc(dateTimeLabel(blocker.updatedAt))}</span>
        </footer>
      </article>`;
    }).join("")}
  </div>`;
}

function renderFlow(agents, deps) {
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));
  const activeAgents = agents.filter(a => a.status === "active").map(a => a.id);
  const waitingAgents = agents.filter(a => a.status !== "active").map(a => a.id);

  // Build nodes for mermaid
  const nodes = [];
  const edges = [];

  for (const [agentId, agent] of Object.entries(agentMap)) {
    const status = agent.status || "unknown";
    const label = agent.name || agentId;
    nodes.push(`  ${agentId}["${esc(label)}"]:::status-${status}`);
  }

  for (const [agentId, waitingFor] of Object.entries(deps)) {
    for (const depId of waitingFor) {
      if (agentMap[depId]) {
        edges.push(`  ${agentId} --> ${depId}`);
      }
    }
  }

  // Also add edges based on talkingWith state
  for (const agent of agents) {
    if (agent.talkingWith && agent.talkingWith.with) {
      const withText = String(agent.talkingWith.with);
      for (const depId of Object.keys(agentMap)) {
        if (depId !== agent.id && withText.includes(agentMap[depId].name)) {
          edges.push(`  ${agent.id} -.-> ${depId}`);
        }
      }
    }
  }

  return `<div class="flow-diagram">
    <pre class="mermaid">
graph TD
${nodes.join("\n")}
${edges.join("\n")}
    classDef status-active fill:#e2f0e6,stroke:#1d5b3c,color:#1d5b3c;
    classDef status-waiting fill:#faeed3,stroke:#6d4a0e,color:#6d4a0e;
    classDef status-unknown fill:#ece6da,stroke:#4b4438,color:#4b4438;
    classDef status-done fill:#e2f0e6,stroke:#1d5b3c,color:#1d5b3c;
  </pre>
  <p class="flow-legend">
    <span class="chip is-active">פעיל</span>
    <span class="chip is-waiting">ממתין</span>
    <span class="chip is-unknown">טרם דווח</span>
    <span style="margin-inline-start:16px">קו מלא = תלות; קו מקווקו = תקשורת נוכחית</span>
  </p>
</div>`;
}

function renderTimeline(timeline) {
  const items = Array.isArray(timeline) ? timeline.slice() : [];
  if (!items.length) return `<p class="empty-line">טרם נרשמו אירועים.</p>`;
  return `<ol class="timeline">
    ${items.map((event) => {
      const time = timeLabel(event.time);
      return `<li class="timeline__item">
        <div class="timeline__time">
          <time dir="ltr" datetime="${esc(event.time)}">${esc(time || dateLabel(event.time))}</time>
          <span class="timeline__date">${esc(dateLabel(event.time))}</span>
        </div>
        <div class="timeline__body">
          <p>${esc(event.text)}</p>
          <span class="timeline__source">${esc(event.source || "טרם אומת")}</span>
        </div>
      </li>`;
    }).join("")}
  </ol>`;
}

function renderSources(sources) {
  if (!Array.isArray(sources) || !sources.length) {
    return `<p class="empty-line">טרם נרשמו מקורות.</p>`;
  }
  return `<ul class="sources">
    ${sources.map((source) => {
      const href = safeHref(source.href);
      const label = esc(source.label || source.href || "מקור");
      const note = source.note ? `<span class="source__note">${esc(source.note)}</span>` : "";
      const body = `<span class="source__label">${label}</span>${note}`;
      return `<li class="source">
        ${href ? `<a href="${esc(href)}">${body}</a>` : `<span class="source__plain">${body}</span>`}
      </li>`;
    }).join("")}
  </ul>`;
}

function renderUnsolved(problems) {
  if (!Array.isArray(problems) || !problems.length) {
    return `<p class="empty-line">אין בעיות לא-פתורות מדווחות.</p>`;
  }
  return `<div class="unsolved">
    ${problems.map((p) => {
      const statusLabel = p.status === "stuck" ? "תקוע" : p.status === "partially-fixed" ? "תוקן חלקית" : p.status === "pending" ? "ממתין" : p.status === "frozen" ? "מוקפא" : p.status === "blocked" ? "חסום" : p.status;
      const statusClass = p.status === "stuck" ? "is-stuck" : p.status === "partially-fixed" ? "is-partial" : p.status === "pending" ? "is-pending" : p.status === "frozen" ? "is-frozen" : p.status === "blocked" ? "is-blocked" : "";
      return `<article class="unsolved-item ${statusClass}" id="unsolved-${esc(p.id)}">
        <header class="unsolved__head">
          <h3>${esc(p.title)}</h3>
          <span class="chip ${statusClass}">${esc(statusLabel)}</span>
        </header>
        <p class="unsolved__desc">${esc(p.description)}</p>
        <div class="unsolved__meta">
          <span><strong>אחראי:</strong> ${esc(p.owner)}</span>
          ${p.blockedBy ? `<span><strong>חוסם:</strong> ${esc(p.blockedBy)}</span>` : ""}
          ${p.impact ? `<span><strong>השפעה:</strong> ${esc(p.impact)}</span>` : ""}
        </div>
        ${p.attempted && p.attempted.length ? `
        <details class="unsolved__attempted">
          <summary>מה נוסה (${p.attempted.length})</summary>
          <ul>${p.attempted.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
        </details>` : ""}
        ${p.needs ? `<p class="unsolved__needs"><strong>מה נדרש:</strong> ${esc(p.needs)}</p>` : ""}
      </article>`;
    }).join("")}
  </div>`;
}

function renderAIPrompt(prompt) {
  if (!prompt) return `<p class="empty-line">אין פרומפט זמין.</p>`;
  return `<div class="ai-prompt">
    <p class="ai-prompt__hint">לחץ על הכפתור להעתקה, או סמן והעתק ידנית.</p>
    <button class="btn ai-prompt__copy" type="button" data-prompt="${esc(prompt)}">העתק פרומפט</button>
    <pre class="ai-prompt__text" aria-label="פרומפט להעתקה">${esc(prompt)}</pre>
  </div>`;
}

function buildHtml(state) {
  const meta = state.meta || {};
  const agents = Array.isArray(state.agents) ? state.agents : [];
  const active = agents.filter((agent) => agent.status === "active").length;
  const waiting = agents.filter((agent) => agent.status !== "active").length;
  const blockers = Array.isArray(state.blockers) ? state.blockers : [];
  const openBlockers = blockers.filter((blocker) => blocker.status !== "resolved").length;
  const updatedAt = meta.updatedAt || new Date().toISOString();
  const generatedAt = localIso(new Date());

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#f6f1e7">
<title>מה קורה בחדר — גולי</title>
<meta name="description" content="חדר הסוכנים של יומן הרחובות ירושלים: מי עושה מה עכשיו, עם מי מדבר, מה הסתיים ומה נשאר.">
<style>
:root{
  --paper:#f6f1e7;
  --paper-deep:#ece2d1;
  --card:#fffdf9;
  --ink:#221d16;
  --ink-soft:#4c4236;
  --muted:#655a4b;
  --line:#ddd2bf;
  --line-strong:#c6b69d;
  --accent:#8a4517;
  --accent-soft:#f3e3d4;
  --green:#1d5b3c;
  --green-bg:#e2f0e6;
  --amber:#6d4a0e;
  --amber-bg:#faeed3;
  --gray:#4b4438;
  --gray-bg:#ece6da;
  --focus:#165c8a;
  --radius:18px;
  --shadow:0 1px 0 rgba(34,29,22,.04), 0 10px 30px -22px rgba(34,29,22,.45);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;
  color:var(--ink);
  background:
    radial-gradient(1100px 520px at 88% -12%, #efe0c8 0%, rgba(239,224,200,0) 62%),
    radial-gradient(900px 420px at -5% 4%, #fbf6ec 0%, rgba(251,246,236,0) 58%),
    var(--paper);
  font-family:"Segoe UI","Arial Hebrew","Noto Sans Hebrew","Helvetica Neue",Arial,sans-serif;
  font-size:17px;
  line-height:1.65;
  overflow-wrap:break-word;
}
img,svg{max-width:100%}
a{color:var(--accent);text-underline-offset:3px;text-decoration-thickness:1px}
a:hover{color:var(--ink)}
:focus-visible{outline:3px solid var(--focus);outline-offset:3px;border-radius:6px}
.skip{
  position:absolute;inset-inline-start:-9999px;top:0;z-index:10;
  background:var(--card);color:var(--ink);padding:12px 18px;border-radius:0 0 12px 0;
}
.skip:focus{inset-inline-start:0}
.wrap{width:min(1080px,100% - 32px);margin-inline:auto}
.masthead{padding:clamp(28px,6vw,64px) 0 8px}
.kicker{
  display:flex;align-items:center;gap:10px;
  margin:0 0 14px;color:var(--muted);font-size:.86rem;font-weight:600;
}
.kicker::before{content:"";width:34px;height:2px;background:var(--accent);border-radius:2px}
h1{
  margin:0;font-size:clamp(2.2rem,7vw,3.8rem);line-height:1.05;
  font-weight:750;letter-spacing:-.015em;
}
.lead{
  max-width:62ch;margin:18px 0 0;font-size:clamp(1.05rem,2.4vw,1.28rem);
  color:var(--ink-soft);line-height:1.55;
}
.masthead__bar{
  display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;
  margin-top:24px;padding-top:16px;border-top:1px solid var(--line);
  color:var(--muted);font-size:.9rem;
}
.pulse{
  display:inline-flex;align-items:center;gap:8px;padding:5px 12px;
  border:1px solid var(--line-strong);border-radius:999px;background:var(--card);
  color:var(--ink-soft);font-weight:600;
}
.pulse__dot{
  width:8px;height:8px;border-radius:50%;background:var(--green);
  box-shadow:0 0 0 4px rgba(29,91,60,.12);
  animation:breathe 2.8s ease-in-out infinite;
}
@keyframes breathe{0%,100%{box-shadow:0 0 0 3px rgba(29,91,60,.12)}50%{box-shadow:0 0 0 6px rgba(29,91,60,.05)}}
.btn{
  min-height:44px;padding:10px 18px;border:1px solid var(--line-strong);
  border-radius:999px;background:var(--card);color:var(--ink);
  font:inherit;font-size:.92rem;font-weight:650;cursor:pointer;
}
.btn:hover{background:var(--paper-deep)}
.btn:active{transform:translateY(1px)}
.time-note{font-variant-numeric:tabular-nums}
main{padding-bottom:24px}
section{margin-top:clamp(32px,6vw,56px)}
.section__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 16px;margin-bottom:16px}
h2{margin:0;font-size:clamp(1.35rem,3.4vw,1.75rem);line-height:1.25;font-weight:740}
.section__hint{margin:0;color:var(--muted);font-size:.9rem}
.room{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  gap:8px;margin:0;padding:0;list-style:none;
}
.room__item{
  display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;
  min-width:0;padding:10px 12px;border:1px solid var(--line);
  border-radius:12px;background:var(--card);
}
.room__dot{width:9px;height:9px;border-radius:50%;background:var(--gray);flex:none}
.room__item.is-active .room__dot{background:var(--green)}
.room__item.is-waiting .room__dot{background:var(--amber)}
.room__item.is-unknown .room__dot{background:var(--gray)}
.room__name{font-weight:700;font-size:.95rem}
.room__state{width:100%;color:var(--muted);font-size:.78rem;line-height:1.3}
.agents{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));
  gap:16px;align-items:start;
}
.agent{
  position:relative;min-width:0;background:var(--card);
  border:1px solid var(--line);border-radius:var(--radius);
  padding:20px;box-shadow:var(--shadow);
}
.agent::before{
  content:"";position:absolute;inset-block:16px;inset-inline-start:0;
  width:4px;border-radius:4px;background:var(--gray);
}
.agent.is-active::before{background:var(--green)}
.agent.is-waiting::before{background:var(--amber)}
.agent.is-unknown::before{background:var(--gray)}
.agent__head{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:12px}
.agent__initial{
  display:grid;place-items:center;width:44px;height:44px;flex:none;
  border-radius:50%;background:var(--paper-deep);border:1px solid var(--line);
  font-weight:750;font-size:1.1rem;color:var(--ink-soft);
}
.agent__id{min-width:0}
h3{margin:0;font-size:1.22rem;line-height:1.3;font-weight:740}
.agent__role{margin:2px 0 0;color:var(--muted);font-size:.82rem;line-height:1.4}
.chip{
  display:inline-flex;align-items:center;gap:6px;padding:3px 9px;
  border-radius:999px;border:1px solid transparent;font-size:.76rem;
  font-weight:700;white-space:nowrap;line-height:1.4;
}
.chip__dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.chip.is-active{color:var(--green);background:var(--green-bg);border-color:#bcd9c6}
.chip.is-waiting{color:var(--amber);background:var(--amber-bg);border-color:#e7d3a6}
.chip.is-unknown{color:var(--gray);background:var(--gray-bg);border-color:#d6cbb8}
.chip.is-done{color:var(--green);background:var(--green-bg);border-color:#bcd9c6}
.label{
  display:block;margin-bottom:2px;color:var(--muted);
  font-size:.72rem;font-weight:700;line-height:1.3;
}
.agent__now{
  margin:16px 0 10px;padding:12px 14px;border-radius:12px;
  background:var(--accent-soft);color:var(--ink);
  border:1px solid #e8d3bf;font-size:.97rem;line-height:1.5;
}
.agent__talk{
  margin:0 0 4px;color:var(--ink-soft);font-size:.9rem;line-height:1.55;
}
.agent__talk .label{display:inline-block;margin:0 0 2px}
.agent__talk-body{display:inline}
.talk-state{
  display:inline-block;margin-inline-start:4px;padding:1px 7px;
  border-radius:999px;background:var(--gray-bg);color:var(--gray);
  font-size:.72rem;font-weight:700;
}
.agent__block{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
h4{margin:0 0 8px;font-size:.82rem;font-weight:750;color:var(--muted)}
.ticks{margin:0;padding:0;list-style:none}
.ticks li{position:relative;padding-inline-start:18px;margin:6px 0;font-size:.9rem;line-height:1.5}
.ticks li::before{
  content:"";position:absolute;inset-inline-start:2px;top:.58em;
  width:7px;height:7px;border:1.5px solid var(--accent);border-radius:2px;
  transform:rotate(45deg);
}
.done-list{margin:0;padding:0;list-style:none}
.done{padding:8px 0;border-bottom:1px solid var(--line)}
.done:last-child{border-bottom:0;padding-bottom:0}
.done--empty{padding-top:0}
.done__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:0}
.done__task{font-weight:650;font-size:.9rem}
.done__date{color:var(--muted);font-size:.76rem;white-space:nowrap}
.done__conclusion{margin:4px 0 0;color:var(--ink-soft);font-size:.86rem;line-height:1.5}
.agent__conclusion{
  margin:16px 0 0;padding:10px 14px;border-inline-start:3px solid var(--accent);
  background:#fbf4ea;border-radius:0 10px 10px 0;
}
.agent__conclusion p{margin:0;font-size:.9rem;line-height:1.55}
.agent__foot{
  display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:space-between;
  margin-top:16px;padding-top:12px;border-top:1px solid var(--line);
  color:var(--muted);font-size:.76rem;line-height:1.45;
}
.agent__source a{font-weight:650}
.agent__reported{max-width:100%}
.timeline{margin:0;padding:0;list-style:none;position:relative}
.timeline::before{
  content:"";position:absolute;inset-block:6px 6px;inset-inline-start:9px;
  width:2px;background:var(--line-strong);
}
.timeline__item{
  position:relative;display:grid;grid-template-columns:1fr;gap:2px;
  padding:0 0 22px 0;padding-inline-start:32px;
}
.timeline__item::before{
  content:"";position:absolute;inset-inline-start:4px;top:7px;
  width:12px;height:12px;border-radius:50%;background:var(--card);
  border:2px solid var(--accent);
}
.timeline__time{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
.timeline__time time{font-weight:750;font-size:.95rem;font-variant-numeric:tabular-nums}
.timeline__date{color:var(--muted);font-size:.76rem}
.timeline__body p{margin:0;font-size:.94rem;line-height:1.55}
.timeline__source{color:var(--muted);font-size:.76rem}
.sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:8px;margin:0;padding:0;list-style:none}
.source{border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}
.source a,.source__plain{display:block;min-height:44px;padding:12px 14px;text-decoration:none;color:var(--ink)}
.source a:hover{background:var(--paper-deep)}
.source__label{display:block;font-weight:650;font-size:.92rem;color:var(--accent);text-decoration:underline;text-underline-offset:3px}
.source a:hover .source__label{color:var(--ink)}
.source__note{display:block;color:var(--muted);font-size:.78rem;margin-top:2px;line-height:1.4}
.source__plain .source__label{color:var(--ink);text-decoration:none}
.empty-line{margin:0;color:var(--muted);font-size:.9rem}
.unsolved{display:grid;gap:12px}
.unsolved-item{border:1px solid var(--line);border-radius:var(--radius);background:var(--card);padding:16px;box-shadow:var(--shadow)}
.unsolved-item.is-stuck{border-color:#e07a5f}
.unsolved-item.is-partial{border-color:#81b29a}
.unsolved-item.is-pending{border-color:#f2cc8f}
.unsolved-item.is-frozen{border-color:#9cc0d1}
.unsolved-item.is-blocked{border-color:#e07a5f}
.unsolved__head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}
.unsolved__head h3{margin:0;font-size:1.05rem;font-weight:700}
.unsolved__desc{margin:0 0 10px;color:var(--ink-soft);line-height:1.55}
.unsolved__meta{display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem;color:var(--muted);margin-bottom:10px}
.unsolved__attempted{margin-top:10px;border-top:1px dashed var(--line);padding-top:10px}
.unsolved__attempted summary{cursor:pointer;font-weight:600;color:var(--ink-soft);font-size:.85rem}
.unsolved__attempted ul{margin:8px 0 0;padding-inline-start:20px;font-size:.85rem;color:var(--ink-soft)}
.unsolved__attempted li{margin:4px 0}
.unsolved__needs{margin-top:10px;padding:10px 12px;background:var(--accent-soft);border:1px solid #e8d3bf;border-radius:8px;color:var(--ink);font-size:.88rem;line-height:1.5}
.ai-prompt{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px}
.ai-prompt__hint{margin:0 0 10px;color:var(--muted);font-size:.85rem}
.ai-prompt__copy{margin-bottom:10px}
.ai-prompt__text{margin:0;padding:12px;background:var(--paper-deep);border:1px solid var(--line);border-radius:8px;overflow-x:auto;font-size:.75rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;max-height:400px}
@media (max-width:420px){
  .ai-prompt__text{font-size:.7rem}
}
.room-note{
  margin-top:36px;padding:18px 20px;border:1px solid var(--line);
  border-radius:var(--radius);background:rgba(255,253,249,.7);
  color:var(--ink-soft);font-size:.9rem;
}
.room-note strong{color:var(--ink)}
footer.page{
  margin-top:32px;padding:22px 0 40px;border-top:1px solid var(--line);
  color:var(--muted);font-size:.82rem;line-height:1.6;
}
footer.page a{font-weight:600}
.sr-only{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;
}
@media (min-width:700px){
  .timeline__item{grid-template-columns:112px 1fr;gap:12px;padding-bottom:20px}
  .timeline__time{display:block}
  .timeline__date{display:block}
}
@media (max-width:420px){
  body{font-size:16px}
  .wrap{width:calc(100% - 24px)}
  .agent{padding:16px}
  .agent__head{grid-template-columns:auto 1fr;gap:10px}
  .agent__head .chip{grid-column:1 / -1;justify-self:start}
  .agent__initial{width:40px;height:40px}
}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
}
@media print{
  body{background:#fff}
  .masthead__bar .btn{display:none}
  .agent{break-inside:avoid;box-shadow:none}
}
.flow-diagram{overflow-x:auto;margin:16px 0;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius)}
.flow-diagram pre.mermaid{margin:0;font-size:.8rem;line-height:1.6;font-family:inherit}
.flow-legend{margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
</style>
</head>
<body>
<a class="skip" href="#main">דלג לתוכן</a>

<header class="masthead">
  <div class="wrap">
    <p class="kicker">חדר הסוכנים · יומן הרחובות ירושלים</p>
    <h1>מה קורה בחדר</h1>
    <p class="lead">${esc(meta.nowLine || "טרם דווח מה קורה בחדר.")}</p>
    <div class="masthead__bar">
      <span class="pulse"><span class="pulse__dot" aria-hidden="true"></span>${active} פעילים · ${waiting} ממתינים</span>
      ${openBlockers ? `<span class="pulse pulse--alert"><span class="pulse__dot" aria-hidden="true"></span>${openBlockers} חסמים פתוחים</span>` : ""}
      <span class="time-note">עודכן <time dir="ltr" datetime="${esc(updatedAt)}">${esc(dateTimeLabel(updatedAt))}</time></span>
      <span id="relative-time" class="time-note" data-updated="${esc(updatedAt)}"></span>
      <button class="btn" type="button" id="refresh">רענון הדף</button>
    </div>
  </div>
</header>

<main id="main" class="wrap">
  <section aria-labelledby="room-title">
    <div class="section__head">
      <h2 id="room-title">מי בחדר</h2>
      <p class="section__hint">סטטוסים נגזרים מזמן הדיווח האחרון: מעל 15 דקות בלי עדכון — ממתין.</p>
    </div>
    <ul class="room">${renderRoom(agents)}</ul>
  </section>

  <section aria-labelledby="agents-title">
    <div class="section__head">
      <h2 id="agents-title">הסוכנים, אחד אחד</h2>
      <p class="section__hint">מה עושה עכשיו, עם מי מדבר, מה אחר כך ומה כבר נסגר.</p>
    </div>
    <div class="agents">
      ${agents.map(renderAgent).join("\n")}
    </div>
  </section>

  <section aria-labelledby="timeline-title">
    <div class="section__head">
      <h2 id="timeline-title">ציר הזמן</h2>
      <p class="section__hint">האירועים החדשים למעלה. כל שורה מציינת מאין היא מגיעה.</p>
    </div>
    ${renderTimeline(state.timeline)}
  </section>

  <section aria-labelledby="blockers-title">
    <div class="section__head">
      <h2 id="blockers-title">חסמים ותקלות</h2>
      <p class="section__hint">מה עוצר את העבודה עכשיו. חוסם = לא אפשרי להתקדם בלי לפתור; החלטה פתוחה = ממתינה להכרעה.</p>
    </div>
    ${renderBlockers(blockers)}
  </section>

  <section aria-labelledby="flow-title">
    <div class="section__head">
      <h2 id="flow-title">תרשים זרימה — מי מחכה למי</h2>
      <p class="section__hint">חץ מלא = תלות עבודה; חץ מקווקו = תקשורת נוכחית. ירוק = פעיל, כתום = ממתין, אפור = טרם דווח.</p>
    </div>
    ${renderFlow(agents, AGENT_DEPENDENCIES)}
  </section>

  <section aria-labelledby="sources-title">
    <div class="section__head">
      <h2 id="sources-title">מקורות</h2>
      <p class="section__hint">הקבצים שמהם נבנה הדף. אפשר לפתוח כל אחד מהם.</p>
    </div>
    ${renderSources(state.sources)}
  </section>

  <section aria-labelledby="unsolved-title">
    <div class="section__head">
      <h2 id="unsolved-title">בעיות לא פתורות — מה הסוכנים לא הצליחו לפתור</h2>
      <p class="section__hint">רשימה מרוכזת של חסמים טכניים/בירוקרטיים שדורשים עזרה חיצונית או החלטה.</p>
    </div>
    ${renderUnsolved(state.unsolvedProblems)}
  </section>

  <section aria-labelledby="ai-prompt-title">
    <div class="section__head">
      <h2 id="ai-prompt-title">פרומפט למנוע AI חיצוני — העתק והדבק</h2>
      <p class="section__hint">פרומפט מפורט באנגלית למנוע AI (Claude, GPT, Gemini, וכד') שיחפש פתרונות לבעיות הלא-פתורות.</p>
    </div>
    ${renderAIPrompt(meta.aiPrompt)}
  </section>

  <aside class="room-note">
    <strong>איך לקרוא את הדף.</strong> ${esc(meta.truthNote || "כל טענה מגיעה ממקור; מה שלא דווח מסומן בהתאם.")}
    מצב הפרויקט לפי ${esc(meta.projectSource || "BOARD")}: ${esc(meta.projectLine || "טרם דווח")}.
  </aside>
</main>

<footer class="page">
  <div class="wrap">
    <p>הדף נבנה על ידי <strong>גולי</strong> מתוך <a href="docs/agents/guli/state.json">state.json</a> בקובץ <code>tools/guli-room.js</code>. אין תלות חיצונית ואין קריאה לרשת.</p>
    <p>נבנה לאחרונה: <time dir="ltr" datetime="${esc(generatedAt)}">${esc(dateTimeLabel(generatedAt))}</time> · <a href="agents.html">ללוח הסוכנים הכללי</a></p>
  </div>
</footer>

<script>
(function () {
  "use strict";
  var refresh = document.getElementById("refresh");
  if (refresh) {
    refresh.addEventListener("click", function () {
      refresh.disabled = true;
      refresh.textContent = "מרענן…";
      window.location.reload();
    });
  }

  // AI prompt copy button
  var copyBtn = document.querySelector(".ai-prompt__copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var prompt = this.getAttribute("data-prompt");
      if (prompt && navigator.clipboard) {
        navigator.clipboard.writeText(prompt).then(function () {
          var old = copyBtn.textContent;
          copyBtn.textContent = "הועתק!";
          setTimeout(function () { copyBtn.textContent = old; }, 1500);
        }).catch(function () {
          fallbackCopy(prompt);
        });
      } else {
        fallbackCopy(prompt);
      }
    });
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    var btn = document.querySelector(".ai-prompt__copy");
    if (btn) {
      var old = btn.textContent;
      btn.textContent = "הועתק!";
      setTimeout(function () { btn.textContent = old; }, 1500);
    }
  }

  var target = document.getElementById("relative-time");
  if (!target) return;
  var raw = target.getAttribute("data-updated");
  var then = raw ? new Date(raw).getTime() : NaN;
  if (!isFinite(then)) return;

  function label() {
    var minutes = Math.round((Date.now() - then) / 60000);
    if (minutes < 1) return "עכשיו";
    if (minutes === 1) return "לפני דקה";
    if (minutes < 60) return "לפני " + minutes + " דקות";
    var hours = Math.round(minutes / 60);
    if (hours === 1) return "לפני שעה";
    if (hours < 24) return "לפני " + hours + " שעות";
    var days = Math.round(hours / 24);
    return days === 1 ? "לפני יום" : "לפני " + days + " ימים";
  }

  function paint() {
    target.textContent = label();
  }
  paint();
  window.setInterval(paint, 60000);
})();
</script>
</body>
</html>
`;
}

/* ---------- build / heartbeat ---------- */

let lastBuildAt = null;

function writeHeartbeat(mode, state, extra) {
  const now = new Date().toISOString();
  const previous = readJsonSafe(HEARTBEAT_PATH) || {};
  const heartbeat = {
    beatAt: now,
    updatedAt: state && state.meta ? state.meta.updatedAt : previous.updatedAt || null,
    mode,
    pid: process.pid,
    lastBuildAt: lastBuildAt || previous.lastBuildAt || null,
    output: "guli.html",
    stateFile: "docs/agents/guli/state.json",
    agents: state && Array.isArray(state.agents) ? state.agents.length : previous.agents || null,
    timeline: state && Array.isArray(state.timeline) ? state.timeline.length : previous.timeline || null
  };
  if (extra) Object.assign(heartbeat, extra);
  writeFileAtomic(HEARTBEAT_PATH, `${JSON.stringify(heartbeat, null, 2)}\n`);
  return heartbeat;
}

function build(mode) {
  const state = readJson(STATE_PATH);
  const errors = validateState(state);
  if (errors.length) {
    throw new Error(`state.json invalid:\n- ${errors.join("\n- ")}`);
  }

  const html = buildHtml(state);
  writeFileAtomic(OUT_PATH, html);
  lastBuildAt = new Date().toISOString();
  writeHeartbeat(mode || "build", state);

  const bytes = Buffer.byteLength(html, "utf8");
  console.log(`[guli] built guli.html (${(bytes / 1024).toFixed(1)} KiB) | ${state.agents.length} agents, ${(state.timeline || []).length} events | mode=${mode || "build"}`);
  return state;
}

/* ---------- watch ---------- */

function watchPaths() {
  return [STATE_PATH, ...STATIC_SOURCES, ...channels()];
}

function snapshot() {
  return watchPaths()
    .map((file) => {
      try {
        const stat = fs.statSync(file);
        return `${file}:${stat.mtimeMs}:${stat.size}`;
      } catch (err) {
        return `${file}:missing`;
      }
    })
    .join("|");
}

function parseArgs(argv) {
  const options = { watch: false, interval: 30, help: false };
  argv.forEach((arg) => {
    if (arg === "--watch" || arg === "-w") options.watch = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--interval=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value >= 10) options.interval = Math.min(Math.round(value), 600);
    }
  });
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node tools/guli-room.js [--watch] [--interval=30]");
    console.log("Builds guli.html from docs/agents/guli/state.json and writes heartbeat.json.");
    return;
  }

  console.log(`[guli] root: ${ROOT}`);
  build(options.watch ? "watch" : "build");

  if (!options.watch) return;

  console.log(`[guli] watching ${watchPaths().length} files every ${options.interval}s (heartbeat every 60s, agent poll every 300s). Ctrl+C to stop.`);
  let current = snapshot();
  let lastBeat = Date.now();
  lastPoll = Date.now();

  const timer = setInterval(() => {
    let next;
    try {
      next = snapshot();
    } catch (err) {
      console.error(`[guli] snapshot failed: ${err.message}`);
      return;
    }

    if (next !== current) {
      current = next;
      try {
        build("watch");
        lastBeat = Date.now();
      } catch (err) {
        console.error(`[guli] build failed, keeping previous guli.html: ${err.message}`);
        try {
          const state = readJsonSafe(STATE_PATH);
          writeHeartbeat("watch", state, { lastError: err.message });
        } catch (heartbeatErr) {
          /* ignore */
        }
      }
      return;
    }

    // Poll agents every 5 minutes
    if (Date.now() - lastPoll >= POLL_INTERVAL_MS) {
      lastPoll = Date.now();
      console.log("[guli] polling agent channels...");
      try {
        const agentUpdates = pollAllAgents();
        const state = readJsonSafe(STATE_PATH);
        if (state && state.agents) {
          // Update each agent's talkingWith with latest channel info
          for (const agent of state.agents) {
            const upd = agentUpdates[agent.id];
            if (upd && upd.lastUpdate !== "אין עדכון" && upd.lastUpdate !== "קובץ לא נמצא") {
              agent.talkingWith = agent.talkingWith || {};
              agent.talkingWith.lastChannelUpdate = upd.lastUpdate;
            }
          }
          writeJsonSafe(STATE_PATH, state);
          build("poll");
        }
      } catch (err) {
        console.error(`[guli] agent poll failed: ${err.message}`);
      }
    }

    if (Date.now() - lastBeat >= 60000) {
      lastBeat = Date.now();
      try {
        const state = readJsonSafe(STATE_PATH);
        writeHeartbeat("watch", state);
      } catch (err) {
        console.error(`[guli] heartbeat failed: ${err.message}`);
      }
    }
  }, options.interval * 1000);

  function shutdown(signal) {
    clearInterval(timer);
    try {
      const state = readJsonSafe(STATE_PATH);
      writeHeartbeat("stopped", state, { stoppedAt: new Date().toISOString(), signal });
    } catch (err) {
      /* ignore */
    }
    console.log(`[guli] stopped (${signal})`);
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

try {
  main();
} catch (err) {
  console.error(`[guli] ${err.message}`);
  process.exitCode = 1;
}
