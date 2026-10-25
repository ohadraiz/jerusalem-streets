#!/usr/bin/env node
"use strict";

/*
 * guli-room.js — בונה את internal/guli.html מתוך docs/agents/guli/state.json
 *
 * שימוש:
 *   node tools/guli-room.js               בנייה חד-פעמית
 *   node tools/guli-room.js --watch       בנייה מחדש בכל שינוי + heartbeat
 *   node tools/guli-room.js --interval=45 קצב בדיקת הקבצים בשניות (10–600)
 *
 * ללא תלויות, ללא רשת. כל הנתיבים נגזרים ממיקום הקובץ.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(ROOT, "docs", "agents", "guli", "state.json");
const HEARTBEAT_PATH = path.join(ROOT, "docs", "agents", "guli", "heartbeat.json");
const TASKS_DATA_PATH = path.join(ROOT, "tasks-data.json");
const AGENT_STATUS_OUT_PATH = path.join(ROOT, "agent-status.json");
const OUT_PATH = path.join(ROOT, "internal", "guli.html");
const CHANNELS_DIR = path.join(ROOT, "docs", "agents", "channels");
const STATIC_SOURCES = [
  path.join(ROOT, "docs", "agents", "BOARD.md"),
  path.join(ROOT, "docs", "agents", "TASKS.md"),
  path.join(ROOT, "docs", "TEAMS.md")
];

/* ---------- צוותים ---------- */

const TEAMS = [
  {
    key: "management",
    name: "הנהלה ובקרה",
    icon: "NAVIGATION",
    hint: "מובילים, מתעדפים ועוקבים אחרי הקפאות",
    agents: ["main", "inspector", "kipi"]
  },
  {
    key: "product",
    name: "מוצר ועיצוב",
    icon: "DESIGN",
    hint: "ממשק, נגישות, RTL ובדיקות איכות",
    agents: ["designer", "reviewer"]
  },
  {
    key: "maps",
    name: "מפות ונתונים",
    icon: "MAP",
    hint: "גיאומטריה, ניווט ורחובות",
    agents: ["mediator", "mappy"]
  },
  {
    key: "research",
    name: "מחקר ותוכן",
    icon: "RESEARCH",
    hint: "עובדות, שמות ומקורות לכל רחוב",
    agents: ["researcher"]
  },
  {
    key: "docs",
    name: "תיעוד",
    icon: "DOCUMENTATION",
    hint: "דף החדר, סטטוסים וסנכרון",
    agents: ["documenter"]
  },
  {
    key: "mobile",
    name: "מובייל והפצה",
    icon: "MOBILE",
    hint: "PWA, התקנה, שחרורים ופריסה",
    agents: ["mobile", "deployer"]
  }
];

const TEAM_OF = {};
for (const team of TEAMS) {
  for (const id of team.agents) TEAM_OF[id] = team;
}

/* שלבי מסלול העבודה — התרשים הוויזואלי */
const FLOW_STAGES = [
  { key: "research", title: "מחקר", hint: "עובדות, שמות ומקורות", agents: ["researcher"] },
  { key: "design", title: "עיצוב", hint: "ממשק, נגישות ו-RTL", agents: ["designer"] },
  { key: "build", title: "פיתוח ומפות", hint: "קוד, נתונים וגיאומטריה", agents: ["main", "mediator"] },
  { key: "review", title: "בדיקה", hint: "באגים, ביצועים ונגישות", agents: ["reviewer"] },
  { key: "ship", title: "תיעוד והפצה", hint: "דוחות, משימות ושחרור", agents: ["documenter", "inspector", "kipi", "mobile", "deployer"] }
];

const STATUS = {
  active: { label: "פעיל", className: "is-active" },
  waiting: { label: "ממתין", className: "is-waiting" },
  unknown: { label: "טרם דווח", className: "is-unknown" },
  done: { label: "סיים", className: "is-done" },
  standby: { label: "בחופשה", className: "is-waiting" }
};

/* שמות ב-state.json מול השמות ב-tasks-data.json */
const STATE_TO_TASKS_NAME = {
  "שיפו": "הבודק",
  "ציבי": "המעצב",
  "צירי": "המגשר",
  "גולי": "המתעד",
  "טופי": "מובריליס",
  "פזי": "פיצי"
};

const MONTHS = [
  "ינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני",
  "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"
];

/* ---------- עזרים ---------- */

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
  if (/^(https?:\/\/|#|\.{0,2}\/|\/)/i.test(raw) && !/^javascript:/i.test(raw)) {
    return raw;
  }
  if (/^[\w./-]+\.(md|html|json)$/i.test(raw)) {
    // הדף נוצר בתוך internal/, ולכן נתיב מקור יחסית-לשורש (למשל docs/agents/BOARD.md) מקבל ../ אחד.
    return raw.includes("/") ? "../" + raw : raw;
  }
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

function dateKey(value) {
  const d = parseIso(value);
  if (!d) return "";
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function dateLabel(value) {
  const d = parseIso(value);
  if (!d) return "תאריך לא צוין";
  const today = new Date();
  const key = dateKey(value);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (key === todayKey) return "היום";
  if (key === yesterdayKey) return "אתמול";
  return `${d.day} ${MONTHS[d.month - 1] || ""} ${d.year}`.replace(/\s+/g, " ");
}

function dateTimeLabel(value) {
  const d = parseIso(value);
  if (!d) return "טרם דווח";
  const date = `${d.day} ${MONTHS[d.month - 1] || ""} ${d.year}`;
  if (d.hour == null) return date;
  return `${date}, ${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`;
}

function timeLabel(value) {
  const d = parseIso(value);
  if (!d || d.hour == null) return "";
  return `${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`;
}

function timeMs(value) {
  const d = parseIso(value);
  if (!d) return 0;
  return new Date(d.year, d.month - 1, d.day, d.hour || 0, d.minute || 0).getTime();
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

/* ---------- ניתוח state ---------- */

function validateState(state) {
  const errors = [];
  if (!state || typeof state !== "object") return ["state.json is not an object"];
  if (!state.meta || typeof state.meta !== "object") errors.push("meta is missing");
  if (!state.meta || !isIso(state.meta.updatedAt)) errors.push("meta.updatedAt is not an ISO date");
  if (!Array.isArray(state.agents) || state.agents.length === 0) errors.push("agents must be a non-empty array");
  if (!Array.isArray(state.timeline)) errors.push("timeline must be an array");
  if (!Array.isArray(state.sources)) errors.push("sources must be an array");

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

/* ---------- משימות ---------- */

function getTasksName(stateName) {
  return STATE_TO_TASKS_NAME[stateName] || stateName;
}

function filterAgentTasks(tasks, stateAgentName) {
  const tasksName = getTasksName(stateAgentName);
  const names = [tasksName, stateAgentName];
  return tasks.filter((t) =>
    (t.agents || []).some((a) => names.includes(a)) ||
    names.includes(t.owner)
  );
}

function agentTaskStats(agent, tasksData) {
  const tasks = tasksData && Array.isArray(tasksData.tasks) ? tasksData.tasks : [];
  const list = filterAgentTasks(tasks, agent.name);
  const count = (key) => list.filter((t) => t.status && t.status.key === key).length;
  const teamNames = new Set(list.map((t) => t.team).filter(Boolean));
  return {
    total: list.length,
    high: list.filter((t) => t.priority && t.priority.key === "high").length,
    done: count("done"),
    progress: count("progress"),
    pending: count("pending"),
    blocked: count("blocked"),
    teams: [...teamNames]
  };
}

function workStatus(agent) {
  if (agent.status !== "active") {
    return { working: false, label: "לא פעיל כרגע", reason: STATUS[agent.status] ? STATUS[agent.status].label : "טרם דווח" };
  }
  if (!agent.currentTask || agent.currentTask === "טרם דווח") {
    return { working: false, label: "פעיל, ללא משימה מדווחת", reason: "טרם דווחה משימה נוכחית" };
  }
  return { working: true, label: "בעבודה", reason: "מדווח על משימה נוכחית" };
}

/* ---------- רינדור ---------- */

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

function renderRoom(agents) {
  return agents.map((agent) => {
    const meta = STATUS[agent.status] || STATUS.unknown;
    const team = TEAM_OF[agent.id];
    return `<li class="room__item ${meta.className}">
      <span class="room__dot" aria-hidden="true"></span>
      <span class="room__name">${esc(agent.name)}</span>
      <span class="room__state">${esc(agent.statusLabel || meta.label)}${team ? ` · ${esc(team.name)}` : ""}</span>
    </li>`;
  }).join("");
}

function renderAgent(agent, tasksData) {
  const stats = agentTaskStats(agent, tasksData);
  const status = workStatus(agent);
  const team = TEAM_OF[agent.id];

  const nextTasks = Array.isArray(agent.nextTasks) && agent.nextTasks.length
    ? `<ul class="ticks">${agent.nextTasks.slice(0, 3).map((task) => `<li>${esc(task)}</li>`).join("")}</ul>`
    : `<p class="empty-line">טרם דווחו משימות המשך.</p>`;

  const completed = Array.isArray(agent.completed) && agent.completed.length
    ? agent.completed.slice(0, 3).map((item) => `
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

  const taskSummary = stats.total > 0 ? `
    <div class="agent__task-summary">
      <h4>משימות (${stats.total})</h4>
      <div class="task-counts">
        <span class="task-count" title="עדיפות גבוהה">HIGH ${stats.high} גבוהה</span>
        <span class="task-count" title="הושלמו">PASS ${stats.done} הושלמו</span>
        <span class="task-count" title="בביצוע">IN_PROGRESS ${stats.progress} בביצוע</span>
        <span class="task-count" title="ממתינות">PENDING ${stats.pending} ממתינות</span>
        <span class="task-count" title="חסומות">BLOCKED ${stats.blocked} חסומות</span>
      </div>
      ${stats.teams.length ? `<div class="agent__teams">צוותים: ${stats.teams.map(esc).join(" · ")}</div>` : ""}
    </div>` : "";

  const teamBadge = team
    ? `<a class="agent__team" href="#team-${esc(team.key)}">${team.icon} ${esc(team.name)}</a>`
    : "";

  return `<article class="agent ${STATUS[agent.status] ? STATUS[agent.status].className : "is-unknown"}" id="agent-${esc(agent.id)}">
    <header class="agent__head">
      <span class="agent__initial" aria-hidden="true">${esc(agent.initial || agent.name.slice(0, 1))}</span>
      <div class="agent__id">
        <h3>${esc(agent.name)}</h3>
        <p class="agent__role">${esc(agent.role || "")}</p>
      </div>
      ${renderStatus(agent)}
    </header>

    <div class="agent__meta-row">
      ${teamBadge}
      <span class="agent__work-status ${status.working ? "working" : "on-break"}">
        <span class="work-status__label">${status.working ? "ACTIVE" : "BLOCKED"} ${esc(status.label)}</span>
        <span class="work-status__reason">${esc(status.reason)}</span>
      </span>
    </div>

    <p class="agent__now"><span class="label">מה עושה עכשיו</span>${esc(agent.currentTask || "טרם דווח")}</p>
    ${renderTalk(agent.talkingWith)}

    ${taskSummary}

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

function renderTeamDashboard(agents, tasksData) {
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));
  const assigned = new Set();

  const sections = TEAMS.map((team) => {
    const members = team.agents.filter((id) => agentMap[id]);
    members.forEach((id) => assigned.add(id));
    if (!members.length) return "";
    const activeCount = members.filter((id) => agentMap[id].status === "active").length;
    return `<section class="team-card" id="team-${esc(team.key)}" aria-labelledby="team-${esc(team.key)}-title">
      <header class="team-card__head">
        <span class="team-card__icon" aria-hidden="true">${team.icon}</span>
        <div>
          <h3 id="team-${esc(team.key)}-title">${esc(team.name)}</h3>
          <p class="team-card__hint">${esc(team.hint)}</p>
        </div>
        <span class="team-card__count">${activeCount}/${members.length} פעילים</span>
      </header>
      <ul class="team-card__list">
        ${members.map((id) => {
          const agent = agentMap[id];
          const meta = STATUS[agent.status] || STATUS.unknown;
          const stats = agentTaskStats(agent, tasksData);
          return `<li>
            <a class="team-card__agent" href="#agent-${esc(agent.id)}">
              <span class="team-card__initial" aria-hidden="true">${esc(agent.initial || agent.name.slice(0, 1))}</span>
              <span class="team-card__body">
                <span class="team-card__name">${esc(agent.name)}</span>
                <span class="team-card__role">${esc(agent.role || "")}</span>
              </span>
              <span class="team-card__side">
                <span class="chip ${meta.className}">${esc(meta.label)}</span>
                ${stats.total ? `<span class="team-card__tasks">${stats.total} משימות · ${stats.done} הושלמו</span>` : ""}
              </span>
            </a>
          </li>`;
        }).join("")}
      </ul>
    </section>`;
  }).join("\n");

  const unassigned = agents.filter((agent) => !assigned.has(agent.id));
  const extra = unassigned.length
    ? `<section class="team-card" id="team-other">
        <header class="team-card__head">
      <span class="team-card__icon" aria-hidden="true">TOOLS</span>
          <div><h3>ללא צוות</h3><p class="team-card__hint">סוכנים שטרם שויכו לצוות</p></div>
        </header>
        <ul class="team-card__list">
          ${unassigned.map((agent) => `<li><a class="team-card__agent" href="#agent-${esc(agent.id)}"><span class="team-card__initial" aria-hidden="true">${esc(agent.initial || agent.name.slice(0, 1))}</span><span class="team-card__body"><span class="team-card__name">${esc(agent.name)}</span></span></a></li>`).join("")}
        </ul>
      </section>`
    : "";

  return `<section aria-labelledby="teams-title" id="teams">
    <div class="section__head">
      <h2 id="teams-title">דשבורד צוותים</h2>
      <p class="section__hint">לחצו על סוכן כדי לקפוץ לכרטיס שלו. ${TEAMS.length} צוותים, ${agents.length} סוכנים.</p>
    </div>
    <div class="teams-grid">
      ${sections}
      ${extra}
    </div>
  </section>`;
}

function renderFlow(agents) {
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));
  return `<ol class="flow" aria-label="שלבי העבודה">
    ${FLOW_STAGES.map((stage, index) => {
      const members = stage.agents.filter((id) => agentMap[id]);
      return `<li class="flow__stage">
        <div class="flow__step" aria-hidden="true">${index + 1}</div>
        <div class="flow__card">
          <h3>${esc(stage.title)}</h3>
          <p>${esc(stage.hint)}</p>
          <div class="flow__agents">
            ${members.map((id) => {
              const agent = agentMap[id];
              const meta = STATUS[agent.status] || STATUS.unknown;
              return `<a class="flow__agent ${meta.className}" href="#agent-${esc(agent.id)}">
                <span class="flow__dot" aria-hidden="true"></span>${esc(agent.name)}
              </a>`;
            }).join("")}
          </div>
        </div>
      </li>`;
    }).join("")}
  </ol>
  <p class="flow__legend">
    <span class="chip is-active">פעיל</span>
    <span class="chip is-waiting">ממתין</span>
    <span class="chip is-unknown">טרם דווח</span>
    <span class="flow__legend-text">החצים מסמנים את כיוון הזרימה; כל שם הוא קישור לכרטיס הסוכן.</span>
  </p>`;
}

function renderTimeline(timeline) {
  const items = (Array.isArray(timeline) ? timeline.slice() : [])
    .filter((event) => event && event.time)
    .sort((a, b) => timeMs(b.time) - timeMs(a.time));

  if (!items.length) return `<p class="empty-line">טרם נרשמו אירועים.</p>`;

  const groups = [];
  let current = null;
  for (const event of items) {
    const key = dateKey(event.time);
    if (!current || current.key !== key) {
      current = { key, label: dateLabel(event.time), events: [] };
      groups.push(current);
    }
    current.events.push(event);
  }

  return `<div class="timeline">
    ${groups.map((group) => `<section class="timeline__day">
      <h3 class="timeline__day-title">
        <span>${esc(group.label)}</span>
        <span class="timeline__day-count">${group.events.length} אירועים</span>
      </h3>
      <ol class="timeline__list">
        ${group.events.map((event) => `<li class="timeline__item">
          <div class="timeline__time">
            <time dir="ltr" datetime="${esc(event.time)}">${esc(timeLabel(event.time) || "—")}</time>
            <span class="timeline__relative" data-time="${esc(event.time)}"></span>
          </div>
          <div class="timeline__body">
            <p>${esc(event.text)}</p>
            <span class="timeline__source">מקור: ${esc(event.source || "טרם אומת")}</span>
          </div>
        </li>`).join("")}
      </ol>
    </section>`).join("")}
  </div>`;
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

/* ---------- עמוד ---------- */

function buildHtml(state, tasksData) {
  const meta = state.meta || {};
  const agents = Array.isArray(state.agents) ? state.agents : [];
  const active = agents.filter((agent) => agent.status === "active").length;
  const waiting = agents.filter((agent) => agent.status !== "active").length;
  const updatedAt = meta.updatedAt || new Date().toISOString();
  const generatedAt = localIso(new Date());

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#f6f1e7">
<title>מה קורה בחדר — המתעד</title>
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
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
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
.skip{position:absolute;inset-inline-start:-9999px;top:0;z-index:10;background:var(--card);color:var(--ink);padding:12px 18px;border-radius:0 0 12px 0}
.skip:focus{inset-inline-start:0}
.wrap{width:min(1080px,100% - 32px);margin-inline:auto}
.masthead{padding:clamp(28px,6vw,64px) 0 8px}
.kicker{display:flex;align-items:center;gap:10px;margin:0 0 14px;color:var(--muted);font-size:.86rem;font-weight:600}
.kicker::before{content:"";width:34px;height:2px;background:var(--accent);border-radius:2px}
h1{margin:0;font-size:clamp(2.2rem,7vw,3.8rem);line-height:1.05;font-weight:750;letter-spacing:-.015em}
.lead{max-width:62ch;margin:18px 0 0;font-size:clamp(1.05rem,2.4vw,1.28rem);color:var(--ink-soft);line-height:1.55}
.masthead__bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-top:24px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
.pulse{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border:1px solid var(--line-strong);border-radius:999px;background:var(--card);color:var(--ink-soft);font-weight:600}
.pulse__dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px rgba(29,91,60,.12);animation:breathe 2.8s ease-in-out infinite}
@keyframes breathe{0%,100%{box-shadow:0 0 0 3px rgba(29,91,60,.12)}50%{box-shadow:0 0 0 6px rgba(29,91,60,.05)}}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;border:1px solid var(--line-strong);border-radius:999px;background:var(--card);color:var(--ink);font:inherit;font-size:.92rem;font-weight:650;cursor:pointer;text-decoration:none}
.btn:hover{background:var(--paper-deep);color:var(--ink)}
.btn--primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn--primary:hover{background:#743a13;color:#fff}
.time-note{font-variant-numeric:tabular-nums}
.quicknav{margin-top:18px}
.quicknav ul{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.quicknav a{display:inline-flex;align-items:center;min-height:44px;padding:4px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,253,249,.7);font-size:.86rem;font-weight:600;text-decoration:none}
.quicknav a:hover{background:var(--card);border-color:var(--line-strong)}
main{padding-bottom:24px}
section{margin-top:clamp(32px,6vw,56px);scroll-margin-top:16px}
.section__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 16px;margin-bottom:16px}
h2{margin:0;font-size:clamp(1.35rem,3.4vw,1.75rem);line-height:1.25;font-weight:740}
.section__hint{margin:0;color:var(--muted);font-size:.9rem}
.room{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0;padding:0;list-style:none}
.room__item{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.room__dot{width:9px;height:9px;border-radius:50%;background:var(--gray);flex:none}
.room__item.is-active .room__dot{background:var(--green)}
.room__item.is-waiting .room__dot{background:var(--amber)}
.room__item.is-unknown .room__dot{background:var(--gray)}
.room__name{font-weight:700;font-size:.95rem}
.room__state{width:100%;color:var(--muted);font-size:.78rem;line-height:1.3}

/* דשבורד צוותים */
.teams-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;align-items:start}
.team-card{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow);scroll-margin-top:16px}
.team-card__head{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:10px;padding-bottom:12px;border-bottom:1px dashed var(--line)}
.team-card__icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--accent-soft);font-size:1.25rem;flex:none}
.team-card__head h3{margin:0;font-size:1.08rem;line-height:1.3}
.team-card__hint{margin:2px 0 0;color:var(--muted);font-size:.8rem;line-height:1.4}
.team-card__count{color:var(--green);font-size:.76rem;font-weight:700;white-space:nowrap;background:var(--green-bg);border:1px solid #bcd9c6;border-radius:999px;padding:2px 8px}
.team-card__list{margin:0;padding:0;list-style:none}
.team-card__agent{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;min-height:56px;padding:9px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink)}
.team-card__list li:last-child .team-card__agent{border-bottom:0;padding-bottom:0}
.team-card__agent:hover{background:var(--paper-deep);border-radius:8px}
.team-card__initial{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--paper-deep);border:1px solid var(--line);font-weight:750;font-size:.95rem;color:var(--ink-soft);flex:none}
.team-card__body{min-width:0;display:flex;flex-direction:column}
.team-card__name{font-weight:700;font-size:.95rem}
.team-card__role{color:var(--muted);font-size:.76rem;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.team-card__side{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:0;max-width:100%}
.team-card__side .chip{white-space:normal;text-align:center}
.team-card__tasks{color:var(--muted);font-size:.7rem;white-space:nowrap}

/* תרשים זרימה */
.flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:26px;margin:0;padding:0;list-style:none;counter-reset:flow}
.flow__stage{position:relative;min-width:0}
.flow__stage:not(:last-child)::after{content:"⟵";position:absolute;top:42px;inset-inline-start:-21px;color:var(--accent);font-size:1.25rem;font-weight:700}
.flow__step{display:grid;place-items:center;width:30px;height:30px;margin-bottom:8px;border-radius:50%;background:var(--accent);color:#fff;font-size:.85rem;font-weight:750}
.flow__card{height:100%;padding:14px 12px;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
.flow__card h3{margin:0;font-size:.98rem;line-height:1.3}
.flow__card p{margin:3px 0 10px;color:var(--muted);font-size:.76rem;line-height:1.35}
.flow__agents{display:flex;flex-direction:column;gap:4px}
.flow__agent{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;font-size:.78rem;font-weight:650;text-decoration:none;color:var(--ink);background:var(--paper)}
.flow__agent:hover{border-color:var(--line-strong);background:var(--card)}
.flow__agent.is-active{background:var(--green-bg);border-color:#bcd9c6;color:var(--green)}
.flow__agent.is-waiting{background:var(--amber-bg);border-color:#e7d3a6;color:var(--amber)}
.flow__agent.is-unknown{background:var(--gray-bg);border-color:#d6cbb8;color:var(--gray)}
.flow__dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none}
.flow__legend{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0 0;font-size:.8rem;color:var(--muted)}
.flow__legend-text{margin-inline-start:4px}

/* סוכנים */
.agents{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:16px;align-items:start}
.agent{position:relative;min-width:0;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);scroll-margin-top:16px}
.agent::before{content:"";position:absolute;inset-block:16px;inset-inline-start:0;width:4px;border-radius:4px;background:var(--gray)}
.agent.is-active::before{background:var(--green)}
.agent.is-waiting::before{background:var(--amber)}
.agent.is-unknown::before{background:var(--gray)}
.agent:target{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft),var(--shadow)}
.agent__head{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:12px}
.agent__initial{display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:50%;background:var(--paper-deep);border:1px solid var(--line);font-weight:750;font-size:1.1rem;color:var(--ink-soft)}
.agent__id{min-width:0}
h3{margin:0;font-size:1.22rem;line-height:1.3;font-weight:740}
.agent__role{margin:2px 0 0;color:var(--muted);font-size:.82rem;line-height:1.4}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid transparent;font-size:.76rem;font-weight:700;white-space:nowrap;line-height:1.4}
.chip__dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.chip.is-active{color:var(--green);background:var(--green-bg);border-color:#bcd9c6}
.chip.is-waiting{color:var(--amber);background:var(--amber-bg);border-color:#e7d3a6}
.chip.is-unknown{color:var(--gray);background:var(--gray-bg);border-color:#d6cbb8}
.chip.is-done{color:var(--green);background:var(--green-bg);border-color:#bcd9c6}
.label{display:block;margin-bottom:2px;color:var(--muted);font-size:.72rem;font-weight:700;line-height:1.3}
.agent__meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}
.agent__team{display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:4px 12px;border:1px solid var(--line);border-radius:999px;background:var(--paper);font-size:.78rem;font-weight:650;text-decoration:none}
.agent__work-status{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:4px 10px;border-radius:999px;font-size:.78rem;line-height:1.4}
.agent__work-status.working{background:var(--green-bg);border:1px solid #bcd9c6;color:var(--green)}
.agent__work-status.on-break{background:var(--amber-bg);border:1px solid #e7d3a6;color:var(--amber)}
.work-status__label{font-weight:700}
.work-status__reason{opacity:.8}
.agent__now{margin:14px 0 10px;padding:12px 14px;border-radius:12px;background:var(--accent-soft);color:var(--ink);border:1px solid #e8d3bf;font-size:.97rem;line-height:1.5}
.agent__talk{margin:0 0 4px;color:var(--ink-soft);font-size:.9rem;line-height:1.55}
.agent__talk .label{display:inline-block;margin:0 0 2px}
.agent__talk-body{display:inline}
.talk-state{display:inline-block;margin-inline-start:4px;padding:1px 7px;border-radius:999px;background:var(--gray-bg);color:var(--gray);font-size:.72rem;font-weight:700}
.agent__task-summary{margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--paper)}
.agent__task-summary h4{margin:0 0 6px}
.task-counts{display:flex;flex-wrap:wrap;gap:5px}
.task-count{padding:1px 8px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-size:.74rem;color:var(--ink-soft);white-space:nowrap}
.agent__teams{margin-top:6px;color:var(--muted);font-size:.75rem}
.agent__block{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
h4{margin:0 0 8px;font-size:.82rem;font-weight:750;color:var(--muted)}
.ticks{margin:0;padding:0;list-style:none}
.ticks li{position:relative;padding-inline-start:18px;margin:6px 0;font-size:.9rem;line-height:1.5}
.ticks li::before{content:"";position:absolute;inset-inline-start:2px;top:.58em;width:7px;height:7px;border:1.5px solid var(--accent);border-radius:2px;transform:rotate(45deg)}
.done-list{margin:0;padding:0;list-style:none}
.done{padding:8px 0;border-bottom:1px solid var(--line)}
.done:last-child{border-bottom:0;padding-bottom:0}
.done--empty{padding-top:0}
.done__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:0}
.done__task{font-weight:650;font-size:.9rem}
.done__date{color:var(--muted);font-size:.76rem;white-space:nowrap}
.done__conclusion{margin:4px 0 0;color:var(--ink-soft);font-size:.86rem;line-height:1.5}
.agent__conclusion{margin:16px 0 0;padding:10px 14px;border-inline-start:3px solid var(--accent);background:#fbf4ea;border-radius:0 10px 10px 0}
.agent__conclusion p{margin:0;font-size:.9rem;line-height:1.55}
.agent__foot{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:.76rem;line-height:1.45}
.agent__source a{font-weight:650}
.agent__reported{max-width:100%}

/* ציר זמן */
.timeline{display:grid;gap:22px}
.timeline__day-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:0 0 10px;font-size:1rem;color:var(--ink-soft)}
.timeline__day-title::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--accent);flex:none}
.timeline__day-count{color:var(--muted);font-size:.76rem;font-weight:600}
.timeline__list{position:relative;margin:0;padding:0;list-style:none}
.timeline__list::before{content:"";position:absolute;inset-block:8px 8px;inset-inline-start:7px;width:2px;background:var(--line-strong)}
.timeline__item{position:relative;display:grid;grid-template-columns:1fr;gap:2px;padding:0 0 16px;padding-inline-start:30px}
.timeline__item:last-child{padding-bottom:0}
.timeline__item::before{content:"";position:absolute;inset-inline-start:2px;top:6px;width:12px;height:12px;border-radius:50%;background:var(--card);border:2px solid var(--accent);z-index:1}
.timeline__time{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}
.timeline__time time{font-weight:750;font-size:.92rem;font-variant-numeric:tabular-nums;color:var(--accent)}
.timeline__relative{color:var(--muted);font-size:.74rem}
.timeline__body{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:var(--shadow)}
.timeline__body p{margin:0;font-size:.92rem;line-height:1.55}
.timeline__source{display:block;margin-top:4px;color:var(--muted);font-size:.74rem}
.sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:8px;margin:0;padding:0;list-style:none}
.source{border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}
.source a,.source__plain{display:block;min-height:44px;padding:12px 14px;text-decoration:none;color:var(--ink)}
.source a:hover{background:var(--paper-deep)}
.source__label{display:block;font-weight:650;font-size:.92rem;color:var(--accent);text-decoration:underline;text-underline-offset:3px}
.source a:hover .source__label{color:var(--ink)}
.source__note{display:block;color:var(--muted);font-size:.78rem;margin-top:2px;line-height:1.4}
.source__plain .source__label{color:var(--ink);text-decoration:none}
.empty-line{margin:0;color:var(--muted);font-size:.9rem}
.room-note{margin-top:36px;padding:18px 20px;border:1px solid var(--line);border-radius:var(--radius);background:rgba(255,253,249,.7);color:var(--ink-soft);font-size:.9rem}
.room-note p{margin:0 0 8px}
.room-note p:last-child{margin-bottom:0}
.room-note strong{color:var(--ink)}
footer.page{margin-top:32px;padding:22px 0 40px;border-top:1px solid var(--line);color:var(--muted);font-size:.82rem;line-height:1.6}
footer.page p{margin:0 0 6px}
footer.page a{font-weight:600}
@media (min-width:700px){
  .timeline__item{grid-template-columns:96px 1fr;gap:12px;align-items:start}
  .timeline__time{display:block;padding-top:8px}
  .timeline__relative{display:block}
}
@media (max-width:900px){
  .flow{grid-template-columns:1fr;gap:14px}
  .flow__stage:not(:last-child)::after{content:"↓";top:auto;bottom:-16px;inset-inline-start:8px;font-size:1.05rem}
  .flow__step{position:absolute;inset-inline-start:0;top:0;margin:0;z-index:1}
  .flow__card{padding-inline-start:42px}
}
@media (max-width:420px){
  body{font-size:16px}
  .wrap{width:calc(100% - 24px)}
  .agent{padding:16px}
  .agent__head{grid-template-columns:auto 1fr;gap:10px}
  .agent__head .chip{grid-column:1 / -1;justify-self:start}
  .agent__initial{width:40px;height:40px}
  .team-card__head{grid-template-columns:auto 1fr}
  .team-card__count{grid-column:1 / -1;justify-self:start}
}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
}
@media print{
  body{background:#fff}
  .masthead__bar .btn,.quicknav{display:none}
  .agent,.team-card{break-inside:avoid;box-shadow:none}
}
</style>
</head>
<body>
<a class="skip" href="#main">דלג לתוכן</a>

<header class="masthead">
  <div class="wrap">
    <p class="kicker">חדר הסוכנים · יומן הרחובות ירושלים · <strong>הדף של המתעד</strong></p>
    <h1>מה קורה בחדר</h1>
    <p class="lead">${esc(meta.nowLine || "טרם דווח מה קורה בחדר.")}</p>
    <div class="masthead__bar">
      <span class="pulse"><span class="pulse__dot" aria-hidden="true"></span>${active} פעילים · ${waiting} ממתינים</span>
      <a href="index.html" class="btn">דף הבית הפנימי</a>
      <a href="tasks.html" class="btn btn--primary">דשבורד המשימות (הפקח)</a>
      <a href="../index.html" class="btn">האפליקציה הציבורית</a>
      <span class="time-note">עודכן <time dir="ltr" datetime="${esc(updatedAt)}">${esc(dateTimeLabel(updatedAt))}</time></span>
      <span id="relative-time" class="time-note" data-updated="${esc(updatedAt)}"></span>
      <button class="btn" type="button" id="refresh">רענון הדף</button>
    </div>
    <nav class="quicknav" aria-label="קישורים מהירים">
      <ul>
        <li><a href="#room-title">מי בחדר</a></li>
        <li><a href="#teams">צוותים</a></li>
        <li><a href="#flow-title">מסלול העבודה</a></li>
        <li><a href="#agents-title">הסוכנים</a></li>
        <li><a href="#timeline-title">ציר הזמן</a></li>
        <li><a href="#sources-title">מקורות</a></li>
      </ul>
    </nav>
  </div>
</header>

<main id="main" class="wrap">
  <section aria-labelledby="room-title">
    <div class="section__head">
      <h2 id="room-title">מי בחדר</h2>
      <p class="section__hint">תמונת מצב מהירה של כל הסוכנים והצוותים שלהם.</p>
    </div>
    <ul class="room">${renderRoom(agents)}</ul>
  </section>

  ${renderTeamDashboard(agents, tasksData)}

  <section aria-labelledby="flow-title">
    <div class="section__head">
      <h2 id="flow-title">מסלול העבודה</h2>
      <p class="section__hint">מחקר → עיצוב → פיתוח ומפות → בדיקה → תיעוד והפצה. כל שלב מציג את הסוכנים שפעילים בו.</p>
    </div>
    ${renderFlow(agents)}
  </section>

  <section aria-labelledby="agents-title">
    <div class="section__head">
      <h2 id="agents-title">הסוכנים, אחד אחד</h2>
      <p class="section__hint">מה עושה עכשיו, עם מי מדבר, מה אחר כך ומה כבר נסגר.</p>
    </div>
    <div class="agents">
      ${agents.map((agent) => renderAgent(agent, tasksData)).join("\n")}
    </div>
  </section>

  <section aria-labelledby="timeline-title">
    <div class="section__head">
      <h2 id="timeline-title">ציר הזמן</h2>
      <p class="section__hint">האירועים מסודרים מהחדש לישן, מקובצים לפי יום. כל שורה מציינת מאין היא מגיעה.</p>
    </div>
    ${renderTimeline(state.timeline)}
  </section>

  <section aria-labelledby="sources-title">
    <div class="section__head">
      <h2 id="sources-title">מקורות</h2>
      <p class="section__hint">הקבצים שמהם נבנה הדף. אפשר לפתוח כל אחד מהם.</p>
    </div>
    ${renderSources(state.sources)}
  </section>

  <aside class="room-note">
    <p><strong>איך לקרוא את הדף.</strong> ${esc(meta.truthNote || "כל טענה מגיעה ממקור; מה שלא דווח מסומן בהתאם.")}</p>
    <p>מצב הפרויקט לפי ${esc(meta.projectSource || "BOARD")}: ${esc(meta.projectLine || "טרם דווח")}.</p>
  </aside>
</main>

<footer class="page">
  <div class="wrap">
    <p>הדף נבנה על ידי <strong>המתעד</strong> מתוך <a href="../docs/agents/guli/state.json">state.json</a> בקובץ <code>tools/guli-room.js</code>. אין תלות חיצונית ואין קריאה לרשת.</p>
    <p>נבנה לאחרונה: <time dir="ltr" datetime="${esc(generatedAt)}">${esc(dateTimeLabel(generatedAt))}</time> · <a href="tasks.html">דשבורד המשימות</a> · <a href="../index.html">האפליקציה</a></p>
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

  function relative(then) {
    var minutes = Math.round((Date.now() - then) / 60000);
    if (minutes < 1) return "עכשיו";
    if (minutes === 1) return "לפני דקה";
    if (minutes < 60) return "לפני " + minutes + " דקות";
    var hours = Math.round(minutes / 60);
    if (hours === 1) return "לפני שעה";
    if (hours < 24) return "לפני " + hours + " שעות";
    var days = Math.round(hours / 24);
    if (days === 1) return "לפני יום";
    if (days < 30) return "לפני " + days + " ימים";
    var months = Math.round(days / 30);
    return months === 1 ? "לפני חודש" : "לפני " + months + " חודשים";
  }

  function paintRelative(el) {
    var raw = el.getAttribute(el.tagName === "SPAN" && el.id === "relative-time" ? "data-updated" : "data-time");
    var then = raw ? new Date(raw).getTime() : NaN;
    if (isFinite(then)) el.textContent = relative(then);
  }

  var header = document.getElementById("relative-time");
  if (header) paintRelative(header);

  var stamps = document.querySelectorAll(".timeline__relative");
  for (var i = 0; i < stamps.length; i++) paintRelative(stamps[i]);

  window.setInterval(function () {
    if (header) paintRelative(header);
    for (var j = 0; j < stamps.length; j++) paintRelative(stamps[j]);
  }, 60000);
})();
</script>
</body>
</html>
`;
}

/* ---------- בנייה ו-heartbeat ---------- */

let lastBuildAt = null;

function writeHeartbeat(mode, state, extra) {
  const previous = readJsonSafe(HEARTBEAT_PATH) || {};
  const heartbeat = {
    beatAt: new Date().toISOString(),
    updatedAt: state && state.meta ? state.meta.updatedAt : previous.updatedAt || null,
    mode,
    pid: process.pid,
    lastBuildAt: lastBuildAt || previous.lastBuildAt || null,
    output: "internal/guli.html",
    stateFile: "docs/agents/guli/state.json",
    agents: state && Array.isArray(state.agents) ? state.agents.length : previous.agents || null,
    timeline: state && Array.isArray(state.timeline) ? state.timeline.length : previous.timeline || null
  };
  if (extra) Object.assign(heartbeat, extra);
  writeFileAtomic(HEARTBEAT_PATH, `${JSON.stringify(heartbeat, null, 2)}\n`);
  return heartbeat;
}

function readTasksData() {
  try {
    return JSON.parse(fs.readFileSync(TASKS_DATA_PATH, "utf8"));
  } catch (err) {
    return null;
  }
}

function generateAgentStatus(state) {
  const agents = Array.isArray(state.agents) ? state.agents : [];
  const agentStatus = { generatedAt: new Date().toISOString(), agents: {} };
  for (const agent of agents) {
    let status = "unknown";
    if (agent.status === "active") status = "working";
    else if (agent.status === "waiting") status = "waiting";
    else if (agent.status === "blocked") status = "blocked";
    else if (agent.status === "done") status = "done";
    else if (agent.status === "standby") status = "standby";

    agentStatus.agents[agent.name] = {
      status,
      note: agent.currentTask || agent.conclusion || "",
      updated: agent.reportedAt || (agent.talkingWith && agent.talkingWith.lastChannelUpdate) || null
    };
  }
  return agentStatus;
}

function build(mode) {
  const state = readJson(STATE_PATH);
  const errors = validateState(state);
  if (errors.length) {
    throw new Error(`state.json invalid:\n- ${errors.join("\n- ")}`);
  }

  const tasksData = readTasksData();
  writeFileAtomic(AGENT_STATUS_OUT_PATH, `${JSON.stringify(generateAgentStatus(state), null, 2)}\n`);
  console.log("[guli] wrote agent-status.json");

  const html = buildHtml(state, tasksData);
  writeFileAtomic(OUT_PATH, html);
  lastBuildAt = new Date().toISOString();
  writeHeartbeat(mode || "build", state);

  const bytes = Buffer.byteLength(html, "utf8");
  console.log(`[guli] built internal/guli.html (${(bytes / 1024).toFixed(1)} KiB) | ${state.agents.length} agents, ${(state.timeline || []).length} events | mode=${mode || "build"}`);
  return state;
}

/* ---------- watch ---------- */

function watchPaths() {
  return [STATE_PATH, TASKS_DATA_PATH, ...STATIC_SOURCES, ...channels()];
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
    console.log("Builds internal/guli.html from docs/agents/guli/state.json and writes heartbeat.json.");
    return;
  }

  console.log(`[guli] root: ${ROOT}`);
  build(options.watch ? "watch" : "build");

  if (!options.watch) return;

  console.log(`[guli] watching ${watchPaths().length} files every ${options.interval}s (heartbeat every 60s). Ctrl+C to stop.`);
  let current = snapshot();
  let lastBeat = Date.now();

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
        console.error(`[guli] build failed, keeping previous internal/guli.html: ${err.message}`);
        try {
          const state = readJsonSafe(STATE_PATH);
          writeHeartbeat("watch", state, { lastError: err.message });
        } catch (heartbeatErr) {
          /* ignore */
        }
      }
      return;
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
