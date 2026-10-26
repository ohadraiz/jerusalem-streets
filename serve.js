/**
 * שרת סטטי קטן לפיתוח מקומי — ללא תלויות.
 * הרצה: node serve.js  (ברירת מחדל: http://localhost:8787)
 *
 * השרת מגיש את קובצי הפרויקט המקומיים בלבד. אין בו API של תיאום או סטטוס תפקידים.
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
