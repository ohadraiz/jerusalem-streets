/**
 * אימות מובייל 390/430 — ציבי, סבב 039 (הרצה סופית).
 * node .measure-039-final.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9384;
const URL_APP = "http://localhost:8787/";
const FILE_APP = "file:///C:/Users/ohadr/Documents/Default%20Project/index.html";
const SHOT_DIR = "C:\\Users\\ohadr\\AppData\\Local\\Temp\\opencode\\shots039";
const OUT = "C:/Users/ohadr/Documents/Default Project/.measure-039-final-out.json";
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
    send(method, params = {}) { const i = id++; return new Promise((res, rej) => { pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); }); },
    close() { try { ws.close(); } catch {} } };
}
async function evaluate(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
async function navigate(cdp, url) { cdp.events.length = 0; await cdp.send("Page.navigate", { url }); for (let i = 0; i < 120; i++) { if (cdp.events.some((e) => e.method === "Page.loadEventFired")) break; await sleep(100); } await sleep(2500); }
async function shot(cdp, name) { const res = await cdp.send("Page.captureScreenshot", { format: "png" }); mkdirSync(SHOT_DIR, { recursive: true }); writeFileSync(join(SHOT_DIR, name + ".png"), Buffer.from(res.data, "base64")); }

const PROBE = `(() => {
  const p = { zoomStreet: [], zoomArea: [], saves: 0, prompts: [], confirms: [], errors: [] };
  window.__probe = p;
  window.addEventListener("error", function (e) { p.errors.push(String(e.message) + " @ " + String(e.filename || "") + ":" + String(e.lineno || "")); });
  const os = window.JLMMap.zoomToStreet;
  window.JLMMap.zoomToStreet = function (id, z) { p.zoomStreet.push([id, z]); return os.apply(this, arguments); };
  const oa = window.JLMMap.zoomToArea;
  window.JLMMap.zoomToArea = function (a) { p.zoomArea.push(a); return oa.apply(this, arguments); };
  const osv = window.JLMStore.save;
  window.JLMStore.save = function (s) { p.saves++; return osv.apply(this, arguments); };
  const op = window.prompt;
  window.prompt = function (m, d) { const v = op ? op.call(window, m, d) : null; p.prompts.push({ m: String(m), v: v }); return v; };
  window.confirm = function (m) { p.confirms.push(String(m)); return true; };
  return true;
})()`;

const BASE = `(() => {
  const doc = document.documentElement;
  const vw = window.innerWidth;
  const out = { vw, vh: window.innerHeight, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth,
    horizontalOverflow: doc.scrollWidth > vw + 1 };
  const over = [];
  document.querySelectorAll("body *").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    if (el.closest(".leaflet-container") && !el.classList.contains("leaflet-container")) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.right > vw + 1 || r.left < -1) {
      over.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 46), text: String(el.textContent || "").trim().slice(0, 18), l: Math.round(r.left), r: Math.round(r.right) });
    }
  });
  out.overflowing = over.slice(0, 12); out.overflowCount = over.length;
  const small = [];
  document.querySelectorAll("button, a, input, select, textarea, summary, [role=button]").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    if (el.closest(".leaflet-control-attribution")) return;
    if (el.classList.contains("skip-link")) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.width < 44 || r.height < 44) {
      small.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 46), text: String(el.textContent || "").trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) });
    }
  });
  out.smallCount = small.length; out.small = small.slice(0, 15);
  const tinyFont = [];
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const fs = parseFloat(cs.fontSize);
    if (fs < 16) tinyFont.push({ id: el.id || "", cls: String(el.className || "").slice(0, 36), fontSize: fs });
  });
  out.tinyFont = tinyFont;
  const mc = document.getElementById("map-canvas");
  const mr = mc ? mc.getBoundingClientRect() : null;
  out.mapHeight = mr ? Math.round(mr.height) : null;
  out.mapRatio = mr ? +(mr.height / window.innerHeight).toFixed(3) : null;
  out.groups = document.querySelectorAll(".area-group").length;
  out.rows = document.querySelectorAll("#street-list li.street").length;
  out.openGroups = document.querySelectorAll(".area-group__name[aria-expanded=true]").length;
  out.listCount = (document.getElementById("list-count") || {}).textContent;
  out.statsSummary = (document.getElementById("stats-summary") || {}).textContent;
  out.mapReady = (window.JLMMap && window.JLMMap.isReady) ? window.JLMMap.isReady() : null;
  out.storageBanner = !document.getElementById("storage-banner").hidden;
  out.storageBannerText = (document.getElementById("storage-banner-text") || {}).textContent;
  return out;
})()`;

const CONTRAST = `(() => {
  function lum(c) { const s = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; }
  function parse(str) { const m = str.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(",").map(parseFloat); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; }
  function bgOf(el) { let n = el; while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.85) return c.rgb; n = n.parentElement; } return [255, 255, 255]; }
  function ratio(el) { const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) return null; const bg = bgOf(el); const l1 = lum(fg.rgb), l2 = lum(bg); const a = Math.max(l1, l2), b = Math.min(l1, l2); return +(((a + 0.05) / (b + 0.05)).toFixed(2)); }
  const sel = [".hero__eyebrow", ".hero__subtitle", ".stat__label", ".stat__value", ".segmented__btn",
    ".field__label", ".field__input", ".map-hint", ".map-legend", ".result-count", ".list-section__title",
    ".list-section__count", ".list-hint", ".area-group__name", ".area-group__count", ".area-group__pct",
    ".area-card__title", ".street__name", ".street__area", ".street__visit", ".street__maps", ".street__delete",
    ".area-group__badge", ".street-more__btn", ".pagination__btn", ".pagination__info", ".chip__name",
    ".chip__count", ".breakdown__area", ".breakdown__value", ".toast__text", ".street__field span"];
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
    out.push({ sel: s, ratio: ratio(el), fontSize: cs.fontSize, weight: cs.fontWeight, large: large,
      min: ratio(el) === null ? null : (large ? 3 : 4.5), text: String(el.textContent || "").trim().slice(0, 18) });
  });
  return out;
})()`;

const SCENARIO = `(async () => {
  const wait = (ms) => new Promise(function (r) { setTimeout(r, ms); });
  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const ls = function () { try { return JSON.parse(localStorage.getItem("jlm-street-journal-v1") || "{}"); } catch (e) { return {}; } };
  const out = {};
  const p = window.__probe;

  /* --- 1. תצוגה שטוחה + עימוד --- */
  $('[data-view="all"]').click();
  await wait(500);
  const names = $$("#street-list li.street .street__name").map(function (n) { return n.textContent.trim(); });
  let sorted = true, firstBad = null;
  for (let i = 1; i < names.length; i += 1) {
    if (names[i - 1].localeCompare(names[i], "he") > 0) { sorted = false; firstBad = [i - 1, names[i - 1], names[i]]; break; }
  }
  out.flat = {
    rows: names.length, groups: $$(".area-group").length,
    count: $("#list-count").textContent.trim(), resultCount: $("#result-count").textContent.trim(),
    sortedAZ: sorted, firstBad: firstBad, firstNames: names.slice(0, 3), lastNames: names.slice(-2),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    paginationBlocks: $$(".pagination").length,
    info: ($(".pagination__info") || {}).textContent
  };
  const errsBefore = p.errors.length;
  const nextBtn = $('[data-action="flat-next"]');
  out.flat.nextBtnExists = !!nextBtn;
  if (nextBtn) nextBtn.click();
  await wait(900);
  out.flat.afterNextClick = {
    info: ($(".pagination__info") || {}).textContent,
    rows: $$("#street-list li.street").length,
    firstName: ($("#street-list li.street .street__name") || {}).textContent,
    count: $("#list-count").textContent.trim(),
    jsErrors: p.errors.slice(errsBefore),
    live: $("#live").textContent.trim()
  };
  out.flat.paginationTargets = $$(".pagination__btn").map(function (b) { const r = b.getBoundingClientRect();
    return { text: b.textContent.trim(), tag: b.tagName, w: Math.round(r.width), h: Math.round(r.height) }; });

  /* --- 2. חיפוש --- */
  const s = $("#search");
  s.focus(); s.value = "יהודה"; s.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(700);
  out.search = {
    resultCount: $("#result-count").textContent.trim(), status: $("#search-status").textContent.trim(),
    rows: $$("#street-list li.street").length, groups: $$(".area-group").length,
    clearHidden: $("#search-clear").hidden, hint: $("#list-hint").textContent.trim(),
    listClearHidden: $("#list-clear").hidden
  };
  const before = p.zoomStreet.length;
  s.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await wait(1500);
  out.search.enter = { zoomCalls: p.zoomStreet.length - before,
    lastId: p.zoomStreet.length ? p.zoomStreet[p.zoomStreet.length - 1][0] : null,
    scrollY: Math.round(window.scrollY), mapTop: Math.round($("#map-section").getBoundingClientRect().top) };
  $("#search-clear").click();
  await wait(600);
  out.search.afterClear = { value: $("#search").value, rows: $$("#street-list li.street").length,
    groups: $$(".area-group").length, clearHidden: $("#search-clear").hidden,
    resultCount: $("#result-count").textContent.trim() };

  /* --- 3. סימון ביקור מהרשימה --- */
  $('[data-view="all"]').click();
  await wait(500);
  const row = $("#street-list li.street");
  const id = row.dataset.id;
  row.querySelector('[data-action="toggle-visit"]').click();
  await wait(600);
  const row2 = $('#street-list li.street[data-id="' + id + '"]');
  const vb = row2 ? row2.querySelector('[data-action="toggle-visit"]') : null;
  out.visit = { id: id, pressed: vb ? vb.getAttribute("aria-pressed") : null,
    label: vb ? vb.textContent.trim() : null,
    hasDate: !!(row2 && row2.querySelector('[data-action="date"]')),
    hasNote: !!(row2 && row2.querySelector('[data-action="note"]')),
    dateValue: row2 && row2.querySelector('[data-action="date"]') ? row2.querySelector('[data-action="date"]').value : null,
    focusAction: document.activeElement ? document.activeElement.getAttribute("data-action") : null,
    stored: ls().visited ? ls().visited[id] : null, statVisited: $("#stat-visited").textContent.trim() };
  const di = row2.querySelector('[data-action="date"]');
  const ni = row2.querySelector('[data-action="note"]');
  di.value = "2024-05-06"; di.dispatchEvent(new Event("change", { bubbles: true }));
  ni.value = "הערה לבדיקת מובייל"; ni.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(1000);
  out.visit.storedAfterNote = ls().visited ? ls().visited[id] : null;
  $("#toast-undo").click();
  await wait(800);
  out.visit.afterUndo = { stored: ls().visited ? ls().visited[id] : null, statVisited: $("#stat-visited").textContent.trim() };

  /* --- 4. אקורדיון --- */
  $('[data-view="areas"]').click();
  await wait(600);
  out.accordion = { groups: $$(".area-group").length, rows: $$("#street-list li.street").length,
    open: $$(".area-group__name[aria-expanded=true]").length, closed: $$(".area-group__name[aria-expanded=false]").length };
  const g0 = $(".area-group");
  const area0 = g0.dataset.group;
  window.scrollTo(0, document.documentElement.scrollHeight);
  await wait(700);
  const zBefore = p.zoomArea.length;
  const scrollBefore = Math.round(window.scrollY);
  const mapTopBefore = Math.round($("#map-section").getBoundingClientRect().top);
  g0.querySelector(".area-group__name").click();
  await wait(1800);
  const g0b = $('.area-group[data-group="' + area0 + '"]');
  out.accordion.clickName = { area: area0, zoomAreaCalls: p.zoomArea.length - zBefore,
    expanded: g0b ? g0b.querySelector(".area-group__name").getAttribute("aria-expanded") : null,
    rows: g0b ? g0b.querySelectorAll("li.street").length : 0,
    scrollBefore: scrollBefore, scrollAfter: Math.round(window.scrollY),
    mapTopBefore: mapTopBefore, mapTopAfter: Math.round($("#map-section").getBoundingClientRect().top),
    mapInView: $("#map-section").getBoundingClientRect().top < window.innerHeight && $("#map-section").getBoundingClientRect().bottom > 0,
    hasMapId: !!document.getElementById("map"), focusAction: document.activeElement ? document.activeElement.getAttribute("data-action") : null };
  const g1 = $$(".area-group")[1];
  const area1 = g1.dataset.group;
  const zBefore2 = p.zoomArea.length;
  g1.querySelector(".area-group__toggle").click();
  await wait(700);
  const g1b = $('.area-group[data-group="' + area1 + '"]');
  out.accordion.clickArrow = { area: area1, zoomAreaCalls: p.zoomArea.length - zBefore2,
    expanded: g1b ? g1b.querySelector(".area-group__name").getAttribute("aria-expanded") : null,
    rows: g1b ? g1b.querySelectorAll("li.street").length : 0,
    toggleExpanded: g1b ? g1b.querySelector(".area-group__toggle").getAttribute("aria-expanded") : null };

  /* --- 5. פעולות גורפות --- */
  const target = $('.area-group[data-group="' + area0 + '"]');
  const firstRow = target.querySelector("li.street");
  const tid = firstRow.dataset.id;
  firstRow.querySelector('[data-action="toggle-visit"]').click();
  await wait(500);
  const tr = $('#street-list li.street[data-id="' + tid + '"]');
  const td = tr.querySelector('[data-action="date"]');
  const tn = tr.querySelector('[data-action="note"]');
  td.value = "2023-01-15"; td.dispatchEvent(new Event("change", { bubbles: true }));
  tn.value = "הערה לפני גורפת"; tn.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(800);
  const savesBefore = p.saves;
  const confBefore = p.confirms.length;
  target.querySelector('[data-action="batch-mark"]').click();
  await wait(1500);
  const t2 = $('.area-group[data-group="' + area0 + '"]');
  out.bulk = { confirms: p.confirms.slice(confBefore), savesDuringBatch: p.saves - savesBefore,
    count: t2.querySelector(".area-group__count").textContent.trim(),
    pct: t2.querySelector(".area-group__pct").textContent.trim(),
    badgeHidden: t2.querySelector(".area-group__badge").hidden,
    toast: $("#toast-text").textContent.trim(), toastUndoVisible: !$("#toast-undo").hidden,
    statVisited: $("#stat-visited").textContent.trim(),
    storedCount: ls().visited ? Object.keys(ls().visited).length : 0,
    storedNote: ls().visited && ls().visited[tid] ? ls().visited[tid].note : null,
    storedDate: ls().visited && ls().visited[tid] ? ls().visited[tid].date : null };
  $("#toast-undo").click();
  await wait(1000);
  const t3 = $('.area-group[data-group="' + area0 + '"]');
  out.bulk.afterUndo = { count: t3.querySelector(".area-group__count").textContent.trim(),
    badgeHidden: t3.querySelector(".area-group__badge").hidden,
    statVisited: $("#stat-visited").textContent.trim(),
    storedCount: ls().visited ? Object.keys(ls().visited).length : 0,
    storedNote: ls().visited && ls().visited[tid] ? ls().visited[tid].note : null,
    storedDate: ls().visited && ls().visited[tid] ? ls().visited[tid].date : null };

  /* --- 6. סיום ידני --- */
  const prBefore = p.prompts.length;
  const svBefore = p.saves;
  const mBtn = t3.querySelector('[data-action="manual-complete"]');
  out.manual = { buttonExists: !!mBtn, buttonText: mBtn ? mBtn.textContent.trim() : null,
    buttonHidden: mBtn ? mBtn.hidden : null, buttonSize: mBtn ? (function () { const r = mBtn.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })() : null };
  if (mBtn) mBtn.click();
  await wait(1000);
  const t4 = $('.area-group[data-group="' + area0 + '"]');
  out.manual.afterClick = { prompts: p.prompts.slice(prBefore), saves: p.saves - svBefore,
    manualCompletions: ls().manualCompletions || null,
    cardTitle: t4.querySelector(".area-card__title") ? t4.querySelector(".area-card__title").textContent.trim() : null,
    badge: t4.querySelector(".area-card__title") ? t4.querySelector(".area-card__title").textContent.indexOf("ידנית") !== -1 : null,
    undoBtnHidden: t4.querySelector('[data-action="manual-undo"]') ? t4.querySelector('[data-action="manual-undo"]').hidden : null,
    toast: $("#toast-text").textContent.trim(), live: $("#live").textContent.trim() };

  /* --- 7. מחיקה ידנית --- */
  const row2b = t4.querySelector("li.street");
  const delId = row2b.dataset.id;
  const delName = row2b.querySelector(".street__name").textContent.trim();
  const zb = p.zoomStreet.length;
  const rowsBefore = t4.querySelectorAll("li.street").length;
  row2b.querySelector('[data-action="delete-street"]').click();
  await wait(1000);
  const t5 = $('.area-group[data-group="' + area0 + '"]');
  out.delete = { name: delName, rowsBefore: rowsBefore, rowsAfter: t5 ? t5.querySelectorAll("li.street").length : null,
    gone: !document.querySelector('#street-list li.street[data-id="' + delId + '"]'),
    deletedCount: (ls().deleted || []).length, zoomCalls: p.zoomStreet.length - zb,
    toast: $("#toast-text").textContent.trim(), statTotal: $("#stat-total").textContent.trim() };
  $("#toast-undo").click();
  await wait(1000);
  const t6 = $('.area-group[data-group="' + area0 + '"]');
  out.delete.afterUndo = { rows: t6 ? t6.querySelectorAll("li.street").length : null,
    back: !!document.querySelector('#street-list li.street[data-id="' + delId + '"]'),
    deletedCount: (ls().deleted || []).length, statTotal: $("#stat-total").textContent.trim(),
    focusAction: document.activeElement ? (document.activeElement.getAttribute("data-action") || document.activeElement.tagName) : null };

  /* --- 8. מפה וסרגל דביק --- */
  out.mapSection = { height: Math.round($("#map-canvas").getBoundingClientRect().height),
    width: Math.round($("#map-canvas").getBoundingClientRect().width), vh: window.innerHeight,
    mapEmptyHidden: document.getElementById("map-empty").hidden,
    mapBannerHidden: document.getElementById("map-banner").hidden };
  window.scrollTo(0, 0);
  await wait(500);
  const bar = $(".searchbar");
  const atTop = bar.getBoundingClientRect();
  $("#map-section").scrollIntoView({ block: "start" });
  await wait(800);
  const atMap = { bar: bar.getBoundingClientRect(), map: $("#map-canvas").getBoundingClientRect() };
  $("#list-title").scrollIntoView({ block: "start" });
  await wait(800);
  const atList = { bar: bar.getBoundingClientRect(), title: $("#list-title").getBoundingClientRect() };
  const overlap = function (a, b) { return !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right); };
  out.sticky = { position: getComputedStyle(bar).position,
    atTop: { top: Math.round(atTop.top), bottom: Math.round(atTop.bottom), h: Math.round(atTop.height) },
    atMap: { barTop: Math.round(atMap.bar.top), barBottom: Math.round(atMap.bar.bottom),
      mapTop: Math.round(atMap.map.top), mapBottom: Math.round(atMap.map.bottom), overlapsMap: overlap(atMap.bar, atMap.map) },
    atList: { barTop: Math.round(atList.bar.top), barBottom: Math.round(atList.bar.bottom),
      titleTop: Math.round(atList.title.top), overlapsTitle: overlap(atList.bar, atList.title) },
    stickyH: getComputedStyle(document.documentElement).getPropertyValue("--sticky-h").trim(),
    searchInputH: Math.round($("#search").getBoundingClientRect().height),
    hiddenClass: bar.classList.contains("is-hidden") };

  out.probe = { zoomStreet: p.zoomStreet.length, zoomArea: p.zoomArea.length, saves: p.saves,
    confirms: p.confirms.length, errors: p.errors.slice(0, 6) };
  return out;
})()`;

const result = { viewports: {}, file: {}, consoleErrors: [] };
let proc = null; let profile = null;
try {
  profile = mkdtempSync(join(tmpdir(), "jlm-039f-"));
  proc = spawn(CHROME, ["--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "--headless=new",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--window-size=430,932", "about:blank"], { stdio: "ignore" });
  await waitForVersion();
  const t = await newTarget("about:blank");
  const cdp = connect(t.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");
  cdp.on((msg) => {
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") result.consoleErrors.push("LOG " + msg.params.entry.text + " @ " + (msg.params.entry.url || ""));
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      result.consoleErrors.push("EXC " + (d.exception && d.exception.description ? d.exception.description.split("\n")[0] : d.text) + " @" + (d.url || "") + ":" + (d.lineNumber + 1));
    }
  });
  cdp.on(async (msg) => {
    if (msg.method === "Page.javascriptDialogOpening") {
      result.dialogs = result.dialogs || [];
      result.dialogs.push(msg.params.type + ": " + msg.params.message);
      try { await cdp.send("Page.handleJavaScriptDialog", { accept: true }); } catch {}
    }
  });
  for (const vp of [{ w: 390, h: 844 }, { w: 430, h: 932 }]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 2, mobile: true });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await navigate(cdp, URL_APP);
    await evaluate(cdp, "localStorage.clear()");
    await navigate(cdp, URL_APP);
    await evaluate(cdp, PROBE);
    const base = await evaluate(cdp, BASE);
    await shot(cdp, "w" + vp.w + "-1-top");
    const contrast = await evaluate(cdp, CONTRAST);
    const scenario = await evaluate(cdp, SCENARIO);
    await shot(cdp, "w" + vp.w + "-2-area-open");
    await evaluate(cdp, "window.scrollTo(0,0)");
    await sleep(400);
    const after = await evaluate(cdp, BASE);
    result.viewports[vp.w] = { base, contrast, scenario, after };
    await evaluate(cdp, `(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const s = document.getElementById("search");
      s.focus(); s.value = "יהודה"; s.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(700);
      document.getElementById("list-title").scrollIntoView({ block: "start" });
      await wait(500);
      return true;
    })()`);
    await shot(cdp, "w" + vp.w + "-3-search");
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await navigate(cdp, FILE_APP);
  result.file.base = await evaluate(cdp, BASE);
  result.file.list = await evaluate(cdp, `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const g = document.querySelector(".area-group");
    const area = g.dataset.group;
    g.querySelector(".area-group__name").click();
    await wait(900);
    const g2 = document.querySelector('.area-group[data-group="' + area + '"]');
    const row = g2.querySelector("li.street");
    const id = row.dataset.id;
    row.querySelector('[data-action="toggle-visit"]').click();
    await wait(700);
    const v = document.querySelector('#street-list li.street[data-id="' + id + '"] [data-action="toggle-visit"]');
    return { area: area, rows: g2.querySelectorAll("li.street").length,
      visited: document.getElementById("stat-visited").textContent.trim(),
      pressed: v ? v.getAttribute("aria-pressed") : null,
      banner: document.getElementById("storage-banner").hidden ? null : document.getElementById("storage-banner-text").textContent.trim(),
      lsWorks: !!localStorage.getItem("jlm-street-journal-v1") };
  })()`);
  await shot(cdp, "file-w390-1");
  writeFileSync(OUT, JSON.stringify(result, null, 2), "utf8");
  cdp.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
} catch (e) { console.error("FAILED", e); process.exitCode = 1; }
finally { try { if (proc) proc.kill(); } catch {} await sleep(200); }