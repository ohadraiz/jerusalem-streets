/**
 * מדידת מובייל לסבב 034 — ציבי.
 * node .measure-034.mjs [--shot]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9344;
const URL_APP = "http://localhost:8787/";
const SHOT_DIR = "C:\\Users\\ohadr\\AppData\\Local\\Temp\\opencode\\shots034";
const profile = mkdtempSync(join(tmpdir(), "jlm-034-"));
const WANT_SHOTS = process.argv.includes("--shot");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForVersion() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch("http://127.0.0.1:" + PORT + "/json/version");
      if (res.ok) return await res.json();
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome CDP did not start");
}
async function newTarget(url) {
  const res = await fetch("http://127.0.0.1:" + PORT + "/json/new?" + encodeURIComponent(url), { method: "PUT" });
  if (!res.ok) throw new Error("new target failed: " + res.status);
  return await res.json();
}
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];
  const handlers = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
    } else if (msg.method) { events.push(msg); for (const h of handlers) h(msg); }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return { ws, events, ready, on: (fn) => handlers.push(fn),
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    },
    close() { try { ws.close(); } catch {} } };
}
async function evaluate(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}

const MEASURE = `(() => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const out = { vw, innerWidth: window.innerWidth, scrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth, clientWidth: doc.clientWidth,
    horizontalOverflow: doc.scrollWidth > vw + 1 };
  const over = [];
  document.querySelectorAll("body *").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    if (el.closest(".leaflet-container") && !el.classList.contains("leaflet-container")) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.right > vw + 1 || r.left < -1) {
      over.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60),
        text: String(el.textContent || "").trim().slice(0, 24),
        l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) });
    }
  });
  out.overflowing = over.slice(0, 20); out.overflowCount = over.length;
  const small = [];
  document.querySelectorAll("button, a, input, select, textarea, summary, [role=button]").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    if (el.closest(".leaflet-control-attribution")) return;
    if (el.classList.contains("skip-link")) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.width < 44 || r.height < 44) {
      small.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 55),
        text: String(el.textContent || "").trim().slice(0, 28),
        w: Math.round(r.width), h: Math.round(r.height) });
    }
  });
  out.smallCount = small.length; out.small = small.slice(0, 25);
  const tinyFont = [];
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const fs = parseFloat(cs.fontSize);
    if (fs < 16) tinyFont.push({ id: el.id || "", cls: String(el.className || "").slice(0, 40), type: el.type || el.tagName.toLowerCase(), fontSize: fs });
  });
  out.tinyFont = tinyFont;
  const mc = document.getElementById("map-canvas");
  out.mapHeight = mc ? Math.round(mc.getBoundingClientRect().height) : null;
  out.mapWidth = mc ? Math.round(mc.getBoundingClientRect().width) : null;
  const cards = Array.from(document.querySelectorAll(".stat"));
  out.statCards = cards.length;
  out.statCardRects = cards.map((c) => { const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) }; });
  out.statOverflow = cards.filter((c) => c.scrollWidth > c.clientWidth + 1).length;
  const head = document.querySelector(".area-group__head");
  if (head) {
    const r = head.getBoundingClientRect();
    out.areaHead = { w: Math.round(r.width), h: Math.round(r.height) };
    const nm = head.querySelector(".area-group__name");
    out.areaName = nm ? { text: nm.textContent.trim().slice(0, 20), w: Math.round(nm.getBoundingClientRect().width),
      h: Math.round(nm.getBoundingClientRect().height), clipped: nm.scrollWidth > nm.clientWidth + 1 } : null;
    const tg = head.querySelector(".area-group__toggle");
    out.areaToggle = tg ? { w: Math.round(tg.getBoundingClientRect().width), h: Math.round(tg.getBoundingClientRect().height) } : null;
    const pct = head.querySelector(".area-group__pct");
    out.areaPct = pct ? { text: pct.textContent.trim(), w: Math.round(pct.getBoundingClientRect().width) } : null;
    const cnt = head.querySelector(".area-group__count");
    out.areaCount = cnt ? { text: cnt.textContent.trim(), w: Math.round(cnt.getBoundingClientRect().width) } : null;
  }
  const sb = document.querySelector(".searchbar");
  out.searchbar = sb ? { position: getComputedStyle(sb).position, hidden: sb.classList.contains("is-hidden"),
    h: Math.round(sb.getBoundingClientRect().height), top: Math.round(sb.getBoundingClientRect().top) } : null;
  out.mapReady = typeof JLMMap !== "undefined" && JLMMap.isReady ? JLMMap.isReady() : null;
  out.groups = document.querySelectorAll(".area-group").length;
  out.rows = document.querySelectorAll("#street-list li.street").length;
  out.listCount = (document.getElementById("list-count") || {}).textContent;
  out.resultCount = (document.getElementById("result-count") || {}).textContent;
  return out;
})()`;

async function navigate(cdp, url) {
  cdp.events.length = 0;
  await cdp.send("Page.navigate", { url });
  for (let i = 0; i < 100; i += 1) {
    if (cdp.events.some((e) => e.method === "Page.loadEventFired")) break;
    await sleep(100);
  }
  await sleep(2200);
}
async function shot(cdp, name) {
  const res = await cdp.send("Page.captureScreenshot", { format: "png" });
  mkdirSync(SHOT_DIR, { recursive: true });
  writeFileSync(join(SHOT_DIR, name + ".png"), Buffer.from(res.data, "base64"));
}
const result = { chrome: null, viewports: {}, functional: {}, sticky: {} };
try {
  const version = await waitForVersion();
  result.chrome = version.Browser;
  const target = await newTarget("about:blank");
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");
  const consoleErrors = [];
  cdp.on((msg) => {
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") consoleErrors.push(msg.params.entry.text + " @ " + (msg.params.entry.url || ""));
    if (msg.method === "Runtime.exceptionThrown") consoleErrors.push("EXC " + JSON.stringify(msg.params.exceptionDetails.text || ""));
  });
  cdp.on(async (msg) => {
    if (msg.method === "Page.javascriptDialogOpening") { try { await cdp.send("Page.handleJavaScriptDialog", { accept: true }); } catch {} }
  });
  for (const vp of [{ w: 360, h: 800, mobile: true }, { w: 390, h: 844, mobile: true }, { w: 430, h: 932, mobile: true }, { w: 1280, h: 900, mobile: false }]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: vp.mobile, maxTouchPoints: vp.mobile ? 5 : 0 });
    await navigate(cdp, URL_APP);
    result.viewports[vp.w] = { base: await evaluate(cdp, MEASURE) };
    if (WANT_SHOTS) await shot(cdp, "w" + vp.w + "-top");
    const opened = await evaluate(cdp, `(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const g = document.querySelector(".area-group");
      if (!g) return { error: "no group" };
      const name = g.dataset.group;
      g.querySelector(".area-group__name").click();
      await wait(600);
      const sel = '.area-group[data-group="' + name.replace(/"/g, '\\\\"') + '"]';
      const g2 = document.querySelector(sel);
      const card = g2 && g2.querySelector(".area-card");
      const btns = card ? Array.from(card.querySelectorAll(".area-card__actions .btn")).map(b => { const r = b.getBoundingClientRect();
        return { text: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), hidden: b.hidden }; }) : [];
      const title = card ? card.querySelector(".area-card__title") : null;
      return { area: name, expanded: g2 ? g2.querySelector(".area-group__name").getAttribute("aria-expanded") : null,
        rows: g2 ? g2.querySelectorAll("li.street").length : 0,
        cardTitle: title ? title.textContent.trim() : null,
        cardTitleClipped: title ? title.scrollWidth > title.clientWidth + 1 : null,
        buttons: btns, scrollY: Math.round(window.scrollY),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
    })()`);
    result.viewports[vp.w].opened = opened;
    const rowMeasure = await evaluate(cdp, `(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const row = document.querySelector("#street-list li.street");
      if (!row) return { error: "no row" };
      const id = row.dataset.id;
      window.JLMAPI.toggle(id);
      await wait(400);
      const row2 = document.querySelector('#street-list li.street[data-id="' + id + '"]') || document.querySelector("#street-list li.street");
      const parts = {};
      ["street__name", "street__area", "street__maps"].forEach((c) => {
        const el = row2.querySelector("." + c);
        if (!el) { parts[c] = null; return; }
        const r = el.getBoundingClientRect();
        parts[c] = { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top),
          clipped: el.scrollWidth > el.clientWidth + 1, text: el.textContent.trim().slice(0, 24) };
      });
      const inputs = Array.from(row2.querySelectorAll("input")).map((i) => { const r = i.getBoundingClientRect();
        return { type: i.type, w: Math.round(r.width), h: Math.round(r.height), fontSize: parseFloat(getComputedStyle(i).fontSize) }; });
      const fields = Array.from(row2.querySelectorAll(".street__field")).map((f) => { const r = f.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) }; });
      return { parts, inputs, fields, rowW: Math.round(row2.getBoundingClientRect().width) };
    })()`);
    result.viewports[vp.w].streetRow = rowMeasure;
    result.viewports[vp.w].afterOpen = await evaluate(cdp, MEASURE);
    if (WANT_SHOTS) await shot(cdp, "w" + vp.w + "-list");
    await evaluate(cdp, "(() => { const b = document.getElementById('toast-undo'); if (b && !b.hidden) b.click(); return true; })()");
    await sleep(400);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await navigate(cdp, URL_APP);
  result.functional.search = await evaluate(cdp, `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const s = document.getElementById("search");
    s.focus(); s.value = "יהודה"; s.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(500);
    return { resultCount: document.getElementById("result-count").textContent.trim(),
      status: document.getElementById("search-status").textContent.trim(),
      rows: document.querySelectorAll("#street-list li.street").length,
      groups: document.querySelectorAll(".area-group").length,
      listClearHidden: document.getElementById("list-clear").hidden };
  })()`);
  result.functional.listClear = await evaluate(cdp, `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    document.getElementById("list-clear").click();
    await wait(400);
    return { resultCount: document.getElementById("result-count").textContent.trim(),
      rows: document.querySelectorAll("#street-list li.street").length,
      groups: document.querySelectorAll(".area-group").length,
      listClearHidden: document.getElementById("list-clear").hidden,
      searchValue: document.getElementById("search").value };
  })()`);
  result.functional.batch = await evaluate(cdp, `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const g = document.querySelector(".area-group");
    const area = g.dataset.group;
    g.querySelector(".area-group__name").click();
    await wait(500);
    const sel = '.area-group[data-group="' + area.replace(/"/g, '\\\\"') + '"]';
    const g2 = document.querySelector(sel);
    const mark = g2.querySelector('[data-action="batch-mark"]');
    const total = g2.querySelector(".area-group__count").textContent.trim();
    mark.click();
    await wait(900);
    const ls = JSON.parse(localStorage.getItem("jlm-street-journal-v1") || "{}");
    const after = { toast: (document.getElementById("toast-text") || {}).textContent,
      count: (document.querySelector(sel + " .area-group__count") || {}).textContent,
      pct: (document.querySelector(sel + " .area-group__pct") || {}).textContent,
      badgeHidden: (document.querySelector(sel + " .area-group__badge") || {}).hidden,
      visited: ls.visited ? Object.keys(ls.visited).length : 0,
      statVisited: document.getElementById("stat-visited").textContent.trim(),
      focus: document.activeElement ? document.activeElement.getAttribute("data-action") : null };
    document.getElementById("toast-undo").click();
    await wait(700);
    const ls2 = JSON.parse(localStorage.getItem("jlm-street-journal-v1") || "{}");
    const undone = { count: (document.querySelector(sel + " .area-group__count") || {}).textContent,
      badgeHidden: (document.querySelector(sel + " .area-group__badge") || {}).hidden,
      visited: ls2.visited ? Object.keys(ls2.visited).length : 0,
      statVisited: document.getElementById("stat-visited").textContent.trim(),
      focus: document.activeElement ? (document.activeElement.getAttribute("data-action") || document.activeElement.id || document.activeElement.tagName) : null };
    return { area, totalBefore: total, after, undone };
  })()`);
  await navigate(cdp, URL_APP);
  result.sticky = await evaluate(cdp, `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const bar = document.querySelector(".searchbar");
    const map = document.getElementById("map-section");
    const listTitle = document.getElementById("list-title");
    const listClear = document.getElementById("list-clear");
    const mapCanvas = document.getElementById("map-canvas");
    const rects = () => ({ bar: bar.getBoundingClientRect(), barHidden: bar.classList.contains("is-hidden"),
      map: map.getBoundingClientRect(), listTitle: listTitle ? listTitle.getBoundingClientRect() : null,
      listClear: listClear ? listClear.getBoundingClientRect() : null, mapCanvas: mapCanvas.getBoundingClientRect() });
    const overlap = (a, b) => a && b && !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
    window.scrollTo(0, 0); await wait(300);
    const atTop = rects();
    map.scrollIntoView({ block: "start" }); await wait(700);
    const atMap = rects();
    listTitle.scrollIntoView({ block: "start" }); await wait(700);
    const atList = rects();
    window.scrollTo(0, 0); await wait(700);
    const backTop = rects();
    return {
      atTop: { hidden: atTop.barHidden, barTop: Math.round(atTop.bar.top), barBottom: Math.round(atTop.bar.bottom) },
      atMap: { hidden: atMap.barHidden, barTop: Math.round(atMap.bar.top), barBottom: Math.round(atMap.bar.bottom),
        mapTop: Math.round(atMap.map.top), mapBottom: Math.round(atMap.map.bottom),
        barOverlapsMap: overlap(atMap.bar, atMap.mapCanvas) },
      atList: { hidden: atList.barHidden, barTop: Math.round(atList.bar.top), barBottom: Math.round(atList.bar.bottom),
        listTitleTop: Math.round(atList.listTitle.top), barOverlapsListTitle: overlap(atList.bar, atList.listTitle) },
      backTop: { hidden: backTop.barHidden, barTop: Math.round(backTop.bar.top) },
      scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop,
      listClearHidden: listClear ? listClear.hidden : null };
  })()`);
  result.sticky.scrollOverMap = await evaluate(cdp, `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const map = document.getElementById("map-section");
    map.scrollIntoView({ block: "start" }); await wait(600);
    const before = window.scrollY;
    const canvas = document.getElementById("map-canvas");
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
    await wait(400);
    return { before, after: window.scrollY, moved: window.scrollY !== before, mapReady: JLMMap.isReady() };
  })()`);
  result.consoleErrors = consoleErrors;
  console.log(JSON.stringify(result, null, 2));
  cdp.close();
} catch (error) {
  console.error("FAILED", error);
  process.exitCode = 1;
} finally {
  try { chrome.kill(); } catch {}
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}