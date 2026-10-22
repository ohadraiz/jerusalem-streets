/**
 * שרת סטטי קטן לפיתוח מקומי — ללא תלויות.
 * הרצה: node serve.js  (ברירת מחדל: http://localhost:8787)
 *
 * נוסף: /api/agents — מצב הסוכנים (תפקיד, הרשאות, הודעות אחרונות, משימות פתוחות בלוח).
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8787;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp"
};

const AGENT_NAMES = {
  shifu: "שיפו",
  mappy: "מפי",
  tsiri: "צירי",
  chiki: "חיקי"
};

/* ---------- קריאת מצב הסוכנים ---------- */

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    return "";
  }
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, permissions: [] };

  const lines = match[1].split(/\r?\n/);
  const meta = {};
  const permissions = [];
  let inPermissions = false;

  for (const line of lines) {
    if (/^permission:\s*$/.test(line)) {
      inPermissions = true;
      continue;
    }

    if (inPermissions) {
      if (/^\s+/.test(line)) {
        permissions.push(line.trim());
        continue;
      }
      inPermissions = false;
    }

    const pair = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (pair) meta[pair[1]] = pair[2].trim();
  }

  return { meta, permissions };
}

function parseChannel(file, id) {
  const text = readText(file);
  const stat = fs.existsSync(file) ? fs.statSync(file) : null;
  const chunks = text.split(/\r?\n## /).slice(1);

  const messages = chunks.map((chunk) => {
    const lines = chunk.split(/\r?\n/);
    const title = (lines.shift() || "").trim();
    const body = lines.join("\n").trim();
    const dateMatch = title.match(/(\d{4}-\d{2}-\d{2})/);
    return {
      title,
      body,
      date: dateMatch ? dateMatch[1] : null
    };
  });

  return {
    id,
    path: "/docs/agents/channels/" + id + ".md",
    messages,
    count: messages.length,
    updatedAt: stat ? stat.mtime.toISOString() : null
  };
}

function parseBoard(file) {
  const text = readText(file);
  const stat = fs.existsSync(file) ? fs.statSync(file) : null;
  const chunks = text.split(/\r?\n### /).slice(1);
  const entries = [];

  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);
    const title = (lines.shift() || "").trim();
    const body = lines.join("\n").trim();
    const parts = title.split("·").map((part) => part.trim());
    const number = parts[0] || "";
    const status = /פתוח/.test(title) ? "open" : /סגור/.test(title) ? "closed" : "other";
    const route = parts.find((part) => part.includes("→")) || "";
    const rest = parts.filter((part) => part !== number && part !== route && part !== "פתוח" && part !== "סגור");

    entries.push({ number, route, kind: rest[rest.length - 1] || "", status, body });
  }

  return {
    entries,
    open: entries.filter((entry) => entry.status === "open"),
    closedCount: entries.filter((entry) => entry.status === "closed").length,
    updatedAt: stat ? stat.mtime.toISOString() : null
  };
}

function agentsSnapshot() {
  const agentsDir = path.join(ROOT, ".opencode", "agents");
  const channelsDir = path.join(ROOT, "docs", "agents", "channels");
  const boardFile = path.join(ROOT, "docs", "agents", "BOARD.md");

  const ids = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).filter((name) => /^[a-z]+\.md$/.test(name)).map((name) => name.replace(/\.md$/, ""))
    : [];

  const agents = ids.map((id) => {
    const file = path.join(agentsDir, id + ".md");
    const { meta, permissions } = parseFrontmatter(readText(file));
    const channel = parseChannel(path.join(channelsDir, id + ".md"), id);
    const last = channel.messages[channel.messages.length - 1] || null;

    return {
      id,
      name: AGENT_NAMES[id] || id,
      description: meta.description || "",
      model: meta.model || "",
      permissions,
      channel: {
        path: channel.path,
        count: channel.count,
        updatedAt: channel.updatedAt
      },
      recent: channel.messages.slice(-3).map((message) => ({
        title: message.title,
        date: message.date
      })),
      lastMessage: last ? { title: last.title, body: last.body, date: last.date } : null
    };
  });

  const board = parseBoard(boardFile);
  const lastActivity = agents
    .map((agent) => agent.channel.updatedAt)
    .filter(Boolean)
    .sort()
    .pop();

  return {
    generatedAt: new Date().toISOString(),
    primary: {
      name: "ראשי",
      description: "מתזמן, מיישם ומעביר הודעות בין הסוכנים. כותב הלוח היחיד.",
      lastActivity: board.updatedAt || lastActivity || null
    },
    agents,
    board: { open: board.open, closedCount: board.closedCount, updatedAt: board.updatedAt }
  };
}

/* ---------- שרת ---------- */

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    } catch (error) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Bad request");
      return;
    }

    if (urlPath === "/api/agents") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify(agentsSnapshot()));
      return;
    }

    const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.resolve(ROOT, relative);

    // מונע יציאה מתיקיית הפרויקט
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, "index.html")) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(data);
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`http://localhost:${PORT}`);
  });
