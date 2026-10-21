/** ניגודיות במצב בהיר (390) */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9386;
const SHOT_DIR = "C:\\Users\\ohadr\\AppData\\Local\\Temp\\opencode\\shots039";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForVersion() { for (let i = 0; i < 80; i++) { try { const r = await fetch("http://127.0.0.1:" + PORT + "/json/version"); if (r.ok) return await r.json(); } catch {} await sleep(250); } throw new Error("no chrome"); }
async function newTarget(u) { const r = await fetch("http://127.0.0.1:" + PORT + "/json/new?" + encodeURIComponent(u), { method: "PUT" }); return r.json(); }
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 1; const pending = new Map(); const events = []; const handlers = [];
  ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result); }
    else if (m.method) { events.push(m); for (const h of handlers) h(m); } });
  const ready = new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  return { events, ready, on: (f) => handlers.push(f),
    send(method, params = {}) { const i = id++; return new Promise((res, rej) => { pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); }); } };
}
async function evaluate(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
async function navigate(cdp, url) { cdp.events.length = 0; await cdp.send("Page.navigate", { url }); for (let i = 0; i < 120; i++) { if (cdp.events.some((e) => e.method === "Page.loadEventFired")) break; await sleep(100); } await sleep(2500); }
async function shot(cdp, name) { const res = await cdp.send("Page.captureScreenshot", { format: "png" }); mkdirSync(SHOT_DIR, { recursive: true }); writeFileSync(join(SHOT_DIR, name + ".png"), Buffer.from(res.data, "base64")); }
const SCEN = `(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  function lum(c) { const s = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; }
  function parse(str) { const m = str.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(",").map(parseFloat); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; }
  function bgOf(el) { let n = el; while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.85) return c.rgb; n = n.parentElement; } return [255, 255, 255]; }
  function ratio(el) { const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) return null; const bg = bgOf(el); const l1 = lum(fg.rgb), l2 = lum(bg); const a = Math.max(l1, l2), b = Math.min(l1, l2); return +(((a + 0.05) / (b + 0.05)).toFixed(2)); }
  const baseSel = [".hero__eyebrow", ".hero__subtitle", ".stat__label", ".stat__value", ".segmented__btn",
    ".field__label", ".field__input", ".map-hint", ".map-legend", ".result-count", ".list-section__title",
    ".list-section__count", ".list-hint", ".area-group__name", ".area-group__count", ".area-group__pct",
    ".chip__name", ".chip__count", ".breakdown__area", ".breakdown__value", ".street-more__btn"];
  function measure(sel) {
    const out = [];
    sel.forEach(function (s) {
      const el = document.querySelector(s);
      if (!el) { out.push({ sel: s, missing: true }); return; }
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const fs = parseFloat(cs.fontSize);
      const large = fs >= 18 || (fs >= 14 && parseInt(cs.fontWeight, 10) >= 700);
      out.push({ sel: s, ratio: ratio(el), fontSize: cs.fontSize, large: large, need: large ? 3 : 4.5, text: String(el.textContent || "").trim().slice(0, 18) });
    });
    return out;
  }
  const base = measure(baseSel);
  const g = $(".area-group");
  g.querySelector(".area-group__name").click();
  await wait(900);
  const row = document.querySelector("#street-list li.street");
  row.querySelector('[data-action="toggle-visit"]').click();
  await wait(700);
  const rows = measure([".area-card__title", ".street__name", ".street__area", ".street__visit", ".street__maps",
    ".street__delete", ".street__field span", ".area-group__badge"]);
  return { base: base, rows: rows, scheme: getComputedStyle(document.body).backgroundColor };
})()`;
const result = {};
let proc = null; let profile = null;
try {
  profile = mkdtempSync(join(tmpdir(), "jlm-039i-"));
  proc = spawn(CHROME, ["--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "--headless=new", "--no-first-run", "--disable-extensions", "--window-size=390,844", "about:blank"], { stdio: "ignore" });
  await waitForVersion();
  const t = await newTarget("about:blank");
  const cdp = connect(t.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await navigate(cdp, "http://localhost:8787/");
  result.light = await evaluate(cdp, SCEN);
  await shot(cdp, "w390-light-1-top");
  writeFileSync("C:/Users/ohadr/Documents/Default Project/.measure-039i-out.json", JSON.stringify(result, null, 2), "utf8");
  console.log("WROTE");
} catch (e) { console.error("FAILED", e); process.exitCode = 1; }
finally { try { if (proc) proc.kill(); } catch {} await sleep(200); }