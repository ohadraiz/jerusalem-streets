#!/usr/bin/env node
/**
 * research-didyouknow.js — איסוף מקורות ל"הידעת?" לכל רחוב בירושלים.
 *
 * מקורות: Wikipedia (he/en), Wikidata, OSM/Nominatim, רשימת הרחובות הרשמית
 * של ירושלים (data.gov.il, רשות האוכלוסין וההגירה).
 *
 * עקרונות:
 *  - rate limiting לכל host (ברירת מחדל: ויקימדיה 350ms, Nominatim 1.1s).
 *  - caching בדיסק ל-30 יום; --refresh-cache לעקיפה.
 *  - resume: progress.json + דילוג על רחובות שכבר יש להם פלט.
 *  - אין כתיבת .txt אוטומטית; נכתב candidate ל-review, ורק מאומת מקודם.
 *
 * שימוש:
 *   node tools/research-didyouknow.js --init
 *   node tools/research-didyouknow.js --list data/research/pilot-50.json
 *   node tools/research-didyouknow.js --all --limit 100
 *   node tools/research-didyouknow.js --only yafo,ben-yehuda --force
 *   node tools/research-didyouknow.js --report
 *   node tools/research-didyouknow.js --promote yafo
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'assets', 'data.js');
const RESEARCH_DIR = path.join(ROOT, 'data', 'research');
const CACHE_DIR = path.join(RESEARCH_DIR, 'cache');
const OUT_DIR = path.join(ROOT, 'data', 'didyouknow');
const PROGRESS_FILE = path.join(RESEARCH_DIR, 'progress.json');
const MANUAL_FILE = path.join(RESEARCH_DIR, 'manual-facts.json');
const REVIEW_FILE = path.join(RESEARCH_DIR, 'pilot-50-review.json');
const OFFICIAL_FILE = path.join(RESEARCH_DIR, 'official-streets-jerusalem.json');
const LOG_FILE = path.join(RESEARCH_DIR, 'pipeline.log');
const ACCESS_DATE = '2026-10-22';

const CFG = {
  userAgent: 'JLM-Street-Journal-Research/1.0 (local civic project; contact: project owner)',
  cacheTtlDays: 30,
  maxRetries: 3,
  hosts: {
    'he.wikipedia.org': { minIntervalMs: 1000, concurrency: 1 },
    'en.wikipedia.org': { minIntervalMs: 1000, concurrency: 1 },
    'www.wikidata.org': { minIntervalMs: 1200, concurrency: 1 },
    'nominatim.openstreetmap.org': { minIntervalMs: 1500, concurrency: 1 },
    'data.gov.il': { minIntervalMs: 600, concurrency: 1 },
  },
  nominatim: true,
};

// ---------- utils ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const nowIso = () => new Date().toISOString();
const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text, 'utf8');
}

function log(msg) {
  const line = `[${nowIso()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n', 'utf8'); } catch { /* ignore */ }
}

/** נרמול לשם השוואה: ניקוד, גרשיים, מקפים, רווחים. */
function norm(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/["׳״'`´]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** מסיר תחיליות סוג-רחוב וכינויי כבוד לצורך התאמה. */
function coreName(name) {
  return norm(name)
    .replace(/^(רחוב|דרך|שדרות|שדרת|כיכר|סמטת|מבוא|מעלה|מדרגות|שביל|כניסה ל)\s+/, '')
    .replace(/^(הרב|רבי|ר'|הרה"ג)\s+/, '')
    .trim();
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

function clampFact(text, max = 340) {
  let t = String(text || '')
    .replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '')
    .replace(/\u05BE/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf(';'), cut.lastIndexOf(','));
  return (last > 120 ? cut.slice(0, last + 1) : cut.trim()) + '…';
}

// ---------- rate limiting + cache ----------
const gates = new Map();

function gateFor(host) {
  if (!gates.has(host)) {
    const cfg = CFG.hosts[host] || { minIntervalMs: 500, concurrency: 1 };
    gates.set(host, { minIntervalMs: cfg.minIntervalMs, chain: Promise.resolve(), last: 0 });
  }
  return gates.get(host);
}

function schedule(host, fn) {
  const gate = gateFor(host);
  const run = async () => {
    const wait = gate.last + gate.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    gate.last = Date.now();
    return fn();
  };
  const p = gate.chain.then(run, run);
  gate.chain = p.catch(() => {});
  return p;
}

async function fetchWithRetry(url, headers = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= CFG.maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': CFG.userAgent,
          'Accept': 'application/json,text/plain,*/*',
          ...headers,
        },
      });
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * attempt;
        log(`  ! HTTP ${res.status} ${url} — wait ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${body.slice(0, 160)}`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < CFG.maxRetries) await sleep(1500 * attempt);
    }
  }
  throw lastErr || new Error('fetch failed');
}

function cachePath(url) {
  const host = new URL(url).host;
  return path.join(CACHE_DIR, host, sha256(url) + '.json');
}

async function cachedJson(url, opts = {}) {
  const { refresh = false, ttlDays = CFG.cacheTtlDays, headers = {} } = opts;
  const file = cachePath(url);
  if (!refresh) {
    const cached = readJson(file, null);
    if (cached && Date.now() - cached.fetchedAt < ttlDays * 864e5) return cached.body;
  }
  const host = new URL(url).host;
  const res = await schedule(host, () => fetchWithRetry(url, headers));
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { _raw: text }; }
  writeJson(file, { url, fetchedAt: Date.now(), status: res.status, body });
  return body;
}

// ---------- street data ----------
function loadStreets() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(DATA_DIR, 'utf8'), ctx, { filename: 'assets/data.js' });
  return ctx.window.JLM_DATA.streets;
}

// ---------- official municipality list ----------
const OFFICIAL_RESOURCE = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';

async function loadOfficialList(refresh = false) {
  const cached = readJson(OFFICIAL_FILE, null);
  if (cached && !refresh) return cached;
  log('שולף רשימת רחובות רשמית של ירושלים (data.gov.il)…');
  const filter = encodeURIComponent(JSON.stringify({ 'שם_ישוב': 'ירושלים' }));
  const rows = [];
  const limit = 5000;
  for (let offset = 0; offset < 20000; offset += limit) {
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${OFFICIAL_RESOURCE}&limit=${limit}&offset=${offset}&filters=${filter}`;
    const body = await cachedJson(url, { refresh, ttlDays: 7, headers: { Referer: 'https://data.gov.il/' } });
    const recs = body?.result?.records || [];
    rows.push(...recs);
    const total = body?.result?.total || rows.length;
    if (rows.length >= total || recs.length === 0) break;
  }
  const result = {
    source: 'https://data.gov.il/dataset/321',
    resource: OFFICIAL_RESOURCE,
    fetchedAt: nowIso(),
    count: rows.length,
    streets: rows.map(r => ({ code: r['סמל_רחוב'], name: r['שם_רחוב'], city: r['שם_יישוב'] })),
  };
  writeJson(OFFICIAL_FILE, result);
  log(`נטענו ${rows.length} שמות רחובות רשמיים בירושלים`);
  return result;
}

function officialMatches(street, official) {
  if (!official?.streets) return [];
  const n = norm(street.name);
  const c = coreName(street.name);
  const out = [];
  for (const rec of official.streets) {
    const rn = norm(rec.name);
    const rc = coreName(rec.name);
    let score = 0;
    if (rn === n) score = 4;
    else if (rc === c) score = 3;
    else if (rn.startsWith(n + ' ') || n.startsWith(rn + ' ')) score = 2;
    if (score > 0) out.push({ ...rec, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ---------- Wikipedia ----------
function wikiUrl(lang, title) {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
}

async function wikiPages(lang, titles) {
  const unique = [...new Set(titles.filter(Boolean))].slice(0, 50);
  if (!unique.length) return [];
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|pageprops|coordinates&exintro=1&explaintext=1&exlimit=max&titles=${encodeURIComponent(unique.join('|'))}`;
  const body = await cachedJson(url);
  return (body?.query?.pages || []).map(p => ({
    lang,
    title: p.title,
    pageid: p.pageid,
    missing: !!p.missing,
    extract: p.extract || '',
    wikibase_item: p.pageprops?.wikibase_item || null,
    coordinates: p.coordinates?.[0] || null,
    url: wikiUrl(lang, p.title),
  }));
}

async function wikiSearch(lang, query, limit = 5) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const body = await cachedJson(url);
  return (body?.query?.search || []).map(x => x.title);
}

function scoreWikiPage(page, street) {
  const ex = page.extract || '';
  if (!ex || page.missing) return { score: 0, reasons: [] };
  const ne = norm(ex);
  const nn = norm(street.name);
  const cn = coreName(street.name);
  const first = ex.slice(0, 350);
  const titleN = norm(page.title);
  const titleHasName = titleN.includes(nn) || (cn.length >= 4 && titleN.includes(cn));
  const nameMatched = ne.includes(nn) || (cn.length >= 4 && ne.includes(cn));
  if (!nameMatched) return { score: 0, reasons: ['אין אזכור לשם הרחוב בערך'] };
  if (/(האם התכוונתם|פירושונים)/.test(ex.slice(0, 500))) return { score: 0, reasons: ['דף פירושונים'] };
  if (/(תל אביב|חיפה|באר שבע|נתניה|רמת גן|פתח תקווה|הרצליה)/.test(first) && !/ירושלים/.test(first)) {
    return { score: 0, reasons: ['ערך על עיר אחרת'] };
  }
  if (/(סרט|אלבום|שיר|סדרת טלוויזיה|משחק וידאו)/.test(first) && !/(רחוב|דרך|שדרות|כיכר)/.test(first)) {
    return { score: 0, reasons: ['ערך תרבותי, לא רחוב'] };
  }
  if (page.coordinates && street.lat && street.lng) {
    const d = haversine(page.coordinates.lat, page.coordinates.lon, street.lat, street.lng);
    if (d > 5000) return { score: 0, reasons: [`קואורדינטה רחוקה ${Math.round(d)}מ׳`] };
  }
  if (!titleHasName && /(בניין|בית|מבנה|וילה|מלון|קולנוע|בית כנסת|מרכז מסחרי)/.test(first)) {
    return { score: 0, reasons: ['ערך על מבנה, לא על הרחוב'] };
  }
  const firstStreet = first.match(/(?:רחוב|דרך|שדרות|כיכר)\s+([^,.;:]{2,40})/);
  const aliasPattern = new RegExp(`(?:או|הקרוי גם|נקרא גם|הידוע גם|המכונה גם)\\s*"?(?:(?:רחוב|דרך|שדרות|כיכר)\\s+)?${escapeRegex(cn)}`);
  const isAlias = aliasPattern.test(first) || aliasPattern.test(ex.slice(0, 600));
  if (firstStreet && !titleHasName && !isAlias && !norm(firstStreet[1]).includes(nn) && !norm(firstStreet[1]).includes(cn) && !nn.includes(norm(firstStreet[1]))) {
    return { score: 0, reasons: ['הערך עוסק ברחוב אחר'] };
  }
  let score = 0;
  const reasons = ['מזכיר את השם'];
  if (/ירושלים/.test(ex)) { score += 3; reasons.push('מזכיר ירושלים'); }
  if (/(רחוב|דרך|שדרות|כיכר|סמטה|מעלה|מדרגות|שביל)/.test(ex)) { score += 2; reasons.push('מילות רחוב'); }
  score += 3;
  if (page.title && (norm(page.title) === nn || norm(page.title) === norm('רחוב ' + street.name) || norm(page.title).startsWith(nn + ' '))) {
    score += 4; reasons.push('כותרת תואמת');
  }
  if (page.wikibase_item) { score += 1; reasons.push('ישות ויקינתונים'); }
  if (page.coordinates && street.lat && street.lng) {
    const d = haversine(page.coordinates.lat, page.coordinates.lon, street.lat, street.lng);
    if (d < 600) { score += 4; reasons.push(`קואורדינטה ${Math.round(d)}מ׳`); }
  }
  return { score, reasons };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function findWikipedia(street, wdPlace) {
  const name = street.name;

  // 1) אם לישות הרחוב בוויקינתונים יש ערך עברי — זה המקור המדויק ביותר.
  const placeTitle = wdPlace?.sitelinks?.hewiki?.title;
  if (placeTitle) {
    const pages = await wikiPages('he', [placeTitle]);
    const p = pages[0];
    if (p && !p.missing) {
      const { score, reasons } = scoreWikiPage(p, street);
      if (score >= 6) return { ...p, score, reasons };
    }
  }

  // 2) חיפוש לפי כותרות אפשריות.
  const candidateTitles = [
    name,
    `רחוב ${name}`,
    `${name} (ירושלים)`,
    `רחוב ${name} (ירושלים)`,
    `דרך ${name}`,
    `שדרות ${name}`,
    `כיכר ${name}`,
  ];
  const pages = await wikiPages('he', candidateTitles);
  let best = null;
  for (const p of pages) {
    const { score, reasons } = scoreWikiPage(p, street);
    if (!best || score > best.score) best = { ...p, score, reasons };
  }
  if (!best || best.score < 6) {
    const queries = [`"${name}" ירושלים רחוב`, `intitle:"${name}" ירושלים`, `${name} ירושלים`];
    const titles = [];
    for (const q of queries) {
      const res = await wikiSearch('he', q, 4);
      titles.push(...res);
      if (titles.length >= 8) break;
    }
    const found = await wikiPages('he', [...new Set(titles)].slice(0, 8));
    for (const p of found) {
      const { score, reasons } = scoreWikiPage(p, street);
      if (!best || score > best.score) best = { ...p, score, reasons };
    }
  }
  return best && best.score >= 6 ? best : null;
}

async function findEnglishWiki(street, hePage) {
  if (!hePage?.title) return null;
  const url = `https://he.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=langlinks&lllang=en&titles=${encodeURIComponent(hePage.title)}`;
  const body = await cachedJson(url);
  const page = (body?.query?.pages || [])[0];
  const title = page?.langlinks?.[0]?.title;
  if (!title) return null;
  const pages = await wikiPages('en', [title]);
  const p = pages[0];
  if (p && !p.missing && p.extract) {
    const s = scoreWikiPage(p, street);
    if (s.score >= 4) return { ...p, score: s.score, reasons: s.reasons };
  }
  return null;
}

// ---------- Wikidata ----------
async function wikidataSearch(term, limit = 7) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=he&uselang=he&type=item&limit=${limit}&search=${encodeURIComponent(term)}`;
  const body = await cachedJson(url);
  return body?.search || [];
}

async function wikidataEntities(ids) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!unique.length) return {};
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${encodeURIComponent(unique.join('|'))}&props=labels|descriptions|claims|sitelinks|aliases&languages=he|en`;
  const body = await cachedJson(url);
  return body?.entities || {};
}

function claimValues(ent, prop) {
  return (ent?.claims?.[prop] || []).map(c => c?.mainsnak?.datavalue?.value).filter(Boolean);
}

function claimIds(ent, prop) {
  return claimValues(ent, prop).map(v => v?.id).filter(Boolean);
}

function coordOf(ent) {
  const v = claimValues(ent, 'P625')[0];
  return v && typeof v.latitude === 'number' ? { lat: v.latitude, lon: v.longitude } : null;
}

function timeYear(ent, prop) {
  const v = claimValues(ent, prop)[0];
  const t = v?.time;
  if (!t) return null;
  const m = String(t).match(/([+-]\d{4})/);
  return m ? Number(m[1]) : null;
}

function personFromEntity(id, ent) {
  const heTitle = ent.sitelinks?.hewiki?.title || null;
  return {
    id,
    label: heTitle || ent.labels?.he?.value || ent.labels?.en?.value || '',
    description: ent.descriptions?.he?.value || '',
    birth: timeYear(ent, 'P569'),
    death: timeYear(ent, 'P570'),
    url: `https://www.wikidata.org/wiki/${id}`,
    sitelinks: ent.sitelinks || {},
  };
}

const STREET_TYPES = new Set([
  'Q79007', // street
  'Q34442', // road
  'Q174782', // square
  'Q1021290', // alley?
  'Q83620', // thoroughfare
  'Q180720', // pedestrian street?
]);

async function findWikidata(street) {
  const hits = await wikidataSearch(street.name, 8);
  if (hits.length < 2) hits.push(...await wikidataSearch(`${street.name} ירושלים`, 5));
  const ids = [...new Set(hits.map(h => h.id))].slice(0, 12);
  if (!ids.length) return { place: null, person: null, entities: {} };
  const ents = await wikidataEntities(ids);
  let place = null, person = null;
  const cn = coreName(street.name);

  for (const id of ids) {
    const ent = ents[id];
    if (!ent) continue;
    const label = ent.labels?.he?.value || ent.labels?.en?.value || '';
    const desc = ent.descriptions?.he?.value || ent.descriptions?.en?.value || '';
    const types = claimIds(ent, 'P31');
    const coord = coordOf(ent);
    const distance = coord && street.lat && street.lng ? haversine(coord.lat, coord.lon, street.lat, street.lng) : null;

    if (types.some(t => STREET_TYPES.has(t)) && distance !== null && distance < 1500) {
      const cand = { id, label, description: desc, coord, distance, type: 'place', url: `https://www.wikidata.org/wiki/${id}`, sitelinks: ent.sitelinks || {} };
      if (!place || distance < place.distance) place = cand;
    }
    const names = [label, ...(ent.aliases?.he || []).map(a => a.value), ...(ent.aliases?.en || []).map(a => a.value)].map(norm).filter(Boolean);
    const nameHit = names.some(n =>
      n === norm(street.name) || n === cn ||
      (n.length >= 4 && norm(street.name).includes(n)) ||
      (cn.length >= 4 && n.includes(cn))
    );
    if (types.includes('Q5') && nameHit) {
      if (!person) person = personFromEntity(id, ent);
    }
  }
  return { place, person, entities: ents };
}

// ---------- OSM / Nominatim ----------
async function findOsm(street) {
  if (!CFG.nominatim) return null;
  const q = `${street.name}, ${street.area || ''}, ירושלים`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4&addressdetails=1&accept-language=he&countrycodes=il&q=${encodeURIComponent(q)}`;
  let rows = [];
  try {
    const body = await cachedJson(url);
    rows = Array.isArray(body) ? body : [];
  } catch (e) {
    return { error: e.message };
  }
  const allowed = new Set(['highway', 'place', 'boundary']);
  const scored = rows.filter(r => allowed.has(r.category) || allowed.has(r.class)).map(r => {
    const lat = Number(r.lat), lon = Number(r.lon);
    const d = street.lat && street.lng ? haversine(lat, lon, street.lat, street.lng) : null;
    const nameOk = norm(r.name || r.display_name || '').includes(coreName(street.name));
    return {
      osm_type: r.osm_type, osm_id: r.osm_id, name: r.name || null,
      display_name: r.display_name, category: r.category || r.class, type: r.type,
      lat, lon, distance: d, nameOk,
      url: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`,
    };
  }).filter(r => r.nameOk || (r.distance !== null && r.distance < 300));
  scored.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
  return scored[0] || null;
}

// ---------- fact composition ----------
function chooseWikiFact(page, street) {
  const sentences = splitSentences(page.extract);
  const nn = norm(street.name);
  const cn = coreName(street.name);
  if (/^כביש\s/.test(norm(page.title))) {
    const first = sentences[0] || '';
    const naming = sentences.find(s => s !== first && (norm(s).includes(nn) || norm(s).includes(cn) || /(הקרוי גם|נקרא גם)/.test(s)));
    return clampFact(naming ? `${first} ${naming}` : first);
  }
  const pool = sentences.filter(s => {
    const ns = norm(s);
    if (/(מתגורר|מתגוררת|כיום|נכון ל|עומד בראש|מכהן|משמש כ)/.test(s)) return false;
    return ns.includes(nn) || (cn.length > 3 && ns.includes(cn)) || /^(הרחוב|הדרך|השדרה|הכיכר)\b/.test(s);
  });
  if (!pool.length) return clampFact(sentences.slice(0, 2).join(' '));
  const first = pool[0];
  const naming = pool.find(s => s !== first && /(קרוי|נקרא|נקראת|על שם|על שמו|על שמה)/.test(s));
  if (naming) return clampFact(`${first} ${naming}`);
  return clampFact(pool.slice(0, 2).join(' '));
}

function classifyWikiPage(page, street, wd) {
  const title = norm(page.title);
  const first = splitSentences(page.extract)[0] || '';
  const head = first.slice(0, 180);
  const streetTitle = /^(רחוב|דרך|שדרות|כיכר|סמטה|סמטת)\s/.test(title);
  const streetLead = /^(רחוב|דרך|שדרות|כיכר|סמטה|סמטת)\s/.test(norm(head)) || /(^|\s)(רחוב|דרך|שדרות|כיכר)\s+\S+.*(הוא|היא)\s+(רחוב|דרך|שדרות|כיכר|ציר)/.test(head);
  const person = !!(wd?.person && (page.wikibase_item === wd.person.id || title === norm(wd.person.label)));
  const areaLead = /(שכונה|שכונת|כפר|מושבה|שכונות|מתחם)/.test(head) && !streetLead;
  const exactName = title === norm(street.name) || title === coreName(street.name) || title.startsWith(norm(street.name) + ' (');
  if (person) return 'person';
  if (/^כביש\s/.test(title) && (norm(page.extract).includes(norm(street.name)) || norm(page.extract).includes(coreName(street.name)))) return 'street';
  if (streetTitle && streetLead) return 'street';
  if (streetLead) return 'street';
  if (areaLead && exactName) return 'name-origin';
  if (areaLead && street.area && title === norm(street.area)) return 'area';
  if (areaLead) return 'related-place';
  if (exactName) return 'name-origin';
  return 'related-place';
}

function buildFact(street, wiki, enWiki, wd, osm, official) {
  const sources = [];
  let fact = null, type = 'none', confidence = 'none', notes = [];

  const wikiKind = wiki && wiki.score >= 6 ? classifyWikiPage(wiki, street, wd) : null;

  if (wiki && wikiKind === 'street') {
    fact = chooseWikiFact(wiki, street);
    type = 'street-article';
    confidence = wiki.score >= 10 ? 'high' : 'medium';
    sources.push({ label: 'ויקיפדיה העברית', url: wiki.url, kind: 'content' });
    if (enWiki) sources.push({ label: 'Wikipedia (EN)', url: enWiki.url, kind: 'content' });
    if (wd?.place) sources.push({ label: 'Wikidata', url: wd.place.url, kind: wd.place.label ? 'content' : 'identity' });
    notes.push(...wiki.reasons);
  } else if (wd?.person && (!wiki || wikiKind === 'person')) {
    const p = wd.person;
    const dates = p.birth || p.death ? ` (${p.birth || '?'}–${p.death || '?'})` : '';
    const desc = p.description && !/[A-Za-z]{4,}/.test(p.description) ? `, ${p.description}` : '';
    fact = clampFact(`הרחוב קרוי על שם ${p.label}${dates}${desc}.`);
    type = 'person';
    confidence = 'medium';
    sources.push({ label: 'Wikidata', url: p.url, kind: 'content' });
    const heTitle = p.sitelinks?.hewiki?.title;
    if (heTitle) sources.push({ label: 'ויקיפדיה העברית', url: wikiUrl('he', heTitle), kind: 'content' });
    if (wiki) notes.push(...wiki.reasons);
    notes.push('השם תואם לדמות; נדרש אימות שהרחוב אכן נקרא על שמה.');
  } else if (wiki && wikiKind === 'area') {
    fact = clampFact(`רחוב ${street.name} נמצא בשכונת ${street.area}. ${chooseWikiFact(wiki, street)}`);
    type = 'area-context';
    confidence = 'medium';
    sources.push({ label: 'ויקיפדיה העברית', url: wiki.url, kind: 'content' });
    notes.push(...wiki.reasons);
    notes.push('העובדה עוסקת בשכונה; נדרש ניסוח שמקשר לרחוב.');
  } else if (wiki && wikiKind === 'name-origin') {
    fact = clampFact(`השם "${street.name}" מתייחס ל${wiki.title}: ${chooseWikiFact(wiki, street)}`);
    type = 'name-origin';
    confidence = 'low';
    sources.push({ label: 'ויקיפדיה העברית', url: wiki.url, kind: 'content' });
    notes.push(...wiki.reasons);
    notes.push('נדרש אימות שהרחוב נקרא על שם המושג/המקום.');
  } else if (wiki && wikiKind === 'related-place') {
    fact = null;
    type = 'related-place';
    confidence = 'none';
    notes.push(...wiki.reasons);
    notes.push(`הערך "${wiki.title}" עוסק במקום/נושא ששמו דומה, אך אין ודאות שהוא מקור השם של הרחוב.`);
  } else if (osm) {
    fact = clampFact(`הרחוב מופה ב-OpenStreetMap בשם "${street.name}" בשכונת ${street.area}.`);
    type = 'osm-only';
    confidence = 'low';
    sources.push({ label: 'OpenStreetMap', url: osm.url, kind: 'identity' });
    notes.push('אין מקור תוכן; העובדה עוסקת רק במיקום ובשם.');
  }

  if (official?.length && sources.length) {
    sources.push({ label: 'רשימת הרחובות הרשמית (data.gov.il)', url: 'https://data.gov.il/dataset/321', kind: 'identity' });
  } else if (official?.length) {
    notes.push(`קיים ברשימה הרשמית: סמל רחוב ${official[0].code}`);
  }
  if (osm && !sources.some(s => s.url === osm.url)) {
    sources.push({ label: 'OpenStreetMap', url: osm.url, kind: 'identity' });
  }

  const distinct = [...new Map(sources.map(s => [s.url, s])).values()];
  return { fact, type, confidence, sources: distinct, notes };
}

// ---------- per-street pipeline ----------
async function processStreet(street, opts, official) {
  const result = {
    street_id: street.id,
    street_name: street.name,
    area: street.area,
    lat: street.lat,
    lng: street.lng,
    researched_at: ACCESS_DATE,
    official: officialMatches(street, official),
    wikipedia: null,
    wikipedia_en: null,
    wikidata: null,
    osm: null,
    fact: null,
    fact_type: 'none',
    confidence: 'none',
    sources: [],
    notes: [],
    needs_review: true,
  };

  try {
    const wd = await findWikidata(street);
    const wiki = await findWikipedia(street, wd.place);
    if (wiki) {
      result.wikipedia = {
        title: wiki.title, url: wiki.url, score: wiki.score, reasons: wiki.reasons,
        extract: wiki.extract.slice(0, 2500), wikibase_item: wiki.wikibase_item,
        coordinates: wiki.coordinates,
      };
    }

    // אם הערך שנבחר הוא על אדם — נשלים את פרטי האדם מוויקינתונים.
    if (!wd.person && wiki?.wikibase_item) {
      const ent = (await wikidataEntities([wiki.wikibase_item]))[wiki.wikibase_item];
      if (ent && claimIds(ent, 'P31').includes('Q5')) wd.person = personFromEntity(wiki.wikibase_item, ent);
    }
    // אם קיים ערך על הרחוב עצמו — לא מנחשים "על שם מי" מכותרת דומה.
    if (wd.place && wiki) wd.person = null;

    result.wikidata = {
      place: wd.place,
      person: wd.person ? {
        id: wd.person.id, label: wd.person.label, description: wd.person.description,
        birth: wd.person.birth, death: wd.person.death, url: wd.person.url,
        hewiki: wd.person.sitelinks?.hewiki?.title || null,
        enwiki: wd.person.sitelinks?.enwiki?.title || null,
      } : null,
    };

    const enWiki = wiki ? await findEnglishWiki(street, wiki) : null;
    if (enWiki) {
      result.wikipedia_en = {
        title: enWiki.title, url: enWiki.url, score: enWiki.score,
        extract: enWiki.extract.slice(0, 2000),
      };
    }

    const osm = await findOsm(street);
    result.osm = osm;

    const built = buildFact(street, wiki, enWiki, wd, osm, result.official);
    Object.assign(result, {
      fact: built.fact,
      fact_type: built.type,
      confidence: built.confidence,
      sources: built.sources,
      notes: [...result.notes, ...built.notes],
    });

    // שער איכות: אין עובדה בלי מקור תוכן, אלא אם זו עובדת OSM מוצהרת.
    if (result.fact) {
      const contentSources = result.sources.filter(s => s.kind === 'content');
      if (result.fact_type !== 'osm-only' && contentSources.length === 0) {
        result.fact = null; result.fact_type = 'none'; result.confidence = 'none';
        result.notes.push('נפסל: אין מקור תוכן.');
      }
      if (result.fact && result.fact.length < 30) {
        result.fact = null; result.fact_type = 'none'; result.confidence = 'none';
        result.notes.push('נפסל: עובדה קצרה מדי.');
      }
    }
    result.needs_review = result.fact_type !== 'street-article' || result.confidence !== 'high';
    return result;
  } catch (e) {
    result.error = e.message;
    result.notes.push('שגיאה: ' + e.message);
    return result;
  }
}

// ---------- output ----------
function candidateFile(id) { return path.join(RESEARCH_DIR, 'candidates', `${id}.json`); }

function formatTxt(c) {
  const sources = [...(c.sources || [])]
    .filter(s => s && s.url)
    .sort((a, b) => (a.kind === 'content' ? 0 : 1) - (b.kind === 'content' ? 0 : 1));
  const lines = [
    `street_id: ${c.street_id}`,
    `street_name: ${c.street_name}`,
    `area: ${c.area}`,
    `fact: ${String(c.fact || '').replace(/\s+/g, ' ').trim()}`,
    ...sources.map(s => `source: ${s.url}`),
    `date_researched: ${c.researched_at || ACCESS_DATE}`,
    `researcher: החוקר`,
    `confidence: ${c.confidence}`,
    `method: ${c.fact_type || 'manual'}`,
  ];
  return lines.join('\n') + '\n';
}

function promote(id) {
  const c = readJson(candidateFile(id), null);
  if (!c) throw new Error('אין מועמד עבור ' + id);
  if (!c.fact) throw new Error('אין עובדה מאומתת עבור ' + id);
  const content = c.sources.filter(s => s.kind === 'content');
  if (content.length < 1) throw new Error('אין מקור תוכן עבור ' + id);
  const out = path.join(OUT_DIR, `${id}.txt`);
  writeText(out, formatTxt(c));
  log(`נכתב ${out}`);
  return out;
}

// ---------- manual review / promote-all ----------
function loadManualFacts() {
  const doc = readJson(MANUAL_FILE, null);
  if (!doc || !doc.streets) throw new Error('לא נמצא קובץ עובדות ידניות: ' + MANUAL_FILE);
  return doc;
}

function validateManualFact(id, entry, seenFacts) {
  const errors = [];
  if (!entry) return ['אין רשומה בקובץ העובדות הידניות'];
  const fact = String(entry.fact || '').replace(/\s+/g, ' ').trim();
  if (fact.length < 30) errors.push('העובדה קצרה מדי');
  if (fact.length > 340) errors.push('העובדה ארוכה מדי');
  if (/^(none|null|missing)$/i.test(fact)) errors.push('עובדה חסרה');
  if (!['high', 'medium', 'low'].includes(entry.confidence)) errors.push('דירוג ביטחון לא תקין');
  if (!entry.method || !String(entry.method).trim()) errors.push('חסר method');
  if (!Array.isArray(entry.sources) || !entry.sources.length) {
    errors.push('אין מקורות');
  } else {
    for (const s of entry.sources) {
      if (!s || !s.url || !/^https?:\/\//.test(s.url)) errors.push('כתובת מקור לא תקינה');
      if (!s.label || !String(s.label).trim()) errors.push('חסר תיאור מקור');
      if (!['content', 'identity'].includes(s.kind)) errors.push('סוג מקור לא תקין');
    }
    if (!entry.sources.some(s => s && s.kind === 'content' && /^https?:\/\//.test(s.url))) {
      errors.push('אין מקור תוכן');
    }
  }
  const key = norm(fact);
  if (key && seenFacts.has(key)) errors.push('עובדה כפולה עם ' + seenFacts.get(key));
  return errors;
}

function mergeSources(manualSources, existingSources) {
  const out = [];
  const seen = new Set();
  for (const s of [...(manualSources || []), ...(existingSources || [])]) {
    if (!s || !s.url) continue;
    const key = String(s.url).replace(/\/+$/, '');
    if (seen.has(key)) {
      if (s.kind === 'content') {
        const hit = out.find(x => String(x.url).replace(/\/+$/, '') === key);
        if (hit) hit.kind = 'content';
      }
      continue;
    }
    seen.add(key);
    out.push({ ...s });
  }
  return out;
}

function reviewManual(listArg) {
  const list = readJson(path.resolve(ROOT, listArg || 'data/research/pilot-50.json'), null);
  if (!list) throw new Error('לא נמצאה רשימת רחובות: ' + (listArg || 'data/research/pilot-50.json'));
  const manual = loadManualFacts();
  const progress = loadProgress();
  const streets = list.streets || list;
  const results = [];
  const seenFacts = new Map();
  let approved = 0, rejected = 0;

  for (const street of streets) {
    const id = street.id || street;
    const name = street.name || '';
    const entry = manual.streets[id];
    const errors = validateManualFact(id, entry, seenFacts);

    if (errors.length) {
      rejected++;
      results.push({
        street_id: id,
        street_name: name,
        status: 'rejected',
        reasons: [...new Set(errors)],
      });
      log(`   ✗ ${name} (${id}): ${[...new Set(errors)].join('; ')}`);
      continue;
    }

    const fact = String(entry.fact).replace(/\s+/g, ' ').trim();
    seenFacts.set(norm(fact), id);
    const existing = readJson(candidateFile(id), null) || {
      street_id: id,
      street_name: name,
      area: street.area || '',
      researched_at: ACCESS_DATE,
      official: [],
      wikipedia: null,
      wikipedia_en: null,
      wikidata: null,
      osm: null,
      notes: [],
    };
    // מקורות התוכן הידניים מחליפים את מקורות התוכן האוטומטיים;
    // מקורות הזהות (data.gov.il, OSM, Wikidata) נשמרים כפרובננס.
    const sources = mergeSources(entry.sources, (existing.sources || []).filter(s => s.kind !== 'content'));
    const candidate = {
      ...existing,
      street_id: id,
      street_name: name || existing.street_name,
      area: street.area || existing.area || '',
      researched_at: ACCESS_DATE,
      fact,
      fact_type: entry.method,
      confidence: entry.confidence,
      sources,
      notes: [...new Set([...(existing.notes || []), ...(entry.notes ? [entry.notes] : [])])],
      needs_review: false,
      review_status: 'approved',
      reviewed_at: ACCESS_DATE,
      reviewed_by: 'החוקר',
    };
    writeJson(candidateFile(id), candidate);

    const prev = progress.streets[id];
    progress.streets[id] = {
      id,
      name: name || prev?.name || '',
      area: street.area || prev?.area || '',
      status: 'ok',
      fact_type: entry.method,
      confidence: entry.confidence,
      content_sources: sources.filter(s => s.kind === 'content').length,
      sources: sources.map(s => s.url),
      candidate: path.relative(ROOT, candidateFile(id)).replace(/\\/g, '/'),
      lastRun: prev?.lastRun || nowIso(),
      reviewedAt: nowIso(),
      attempts: prev?.attempts || 0,
      lastError: null,
      review_status: 'approved',
    };
    approved++;
    results.push({
      street_id: id,
      street_name: name,
      status: 'approved',
      fact,
      confidence: entry.confidence,
      method: entry.method,
      content_sources: sources.filter(s => s.kind === 'content').length,
      sources: entry.sources.map(s => s.url),
      notes: entry.notes || null,
    });
    log(`   ✓ ${name} (${id}): אושר (${entry.confidence}/${entry.method})`);
  }

  saveProgress(progress);
  const report = {
    version: 1,
    generatedAt: nowIso(),
    accessDate: ACCESS_DATE,
    list: listArg || 'data/research/pilot-50.json',
    summary: {
      total: streets.length,
      approved,
      rejected,
      high: results.filter(r => r.status === 'approved' && r.confidence === 'high').length,
      medium: results.filter(r => r.status === 'approved' && r.confidence === 'medium').length,
      low: results.filter(r => r.status === 'approved' && r.confidence === 'low').length,
      contentSources: results.filter(r => r.status === 'approved').reduce((n, r) => n + r.content_sources, 0),
    },
    streets: results,
  };
  writeJson(REVIEW_FILE, report);
  log(`סקירה: ${approved} אושרו, ${rejected} נדחו · דוח: ${path.relative(ROOT, REVIEW_FILE)}`);
  return report;
}

function promoteAll(listArg) {
  const list = readJson(path.resolve(ROOT, listArg || 'data/research/pilot-50.json'), null);
  if (!list) throw new Error('לא נמצאה רשימת רחובות: ' + (listArg || 'data/research/pilot-50.json'));
  const streets = list.streets || list;
  let promoted = 0, skipped = 0, failed = 0;
  const written = [];
  for (const street of streets) {
    const id = street.id || street;
    const c = readJson(candidateFile(id), null);
    if (!c || c.review_status !== 'approved' || !c.fact) {
      skipped++;
      log(`   · ${id}: לא אושר — לא נכתב`);
      continue;
    }
    const content = (c.sources || []).filter(s => s.kind === 'content' && /^https?:\/\//.test(s.url));
    if (!content.length) {
      failed++;
      log(`   ✗ ${id}: אין מקור תוכן — לא נכתב`);
      continue;
    }
    const out = path.join(OUT_DIR, `${id}.txt`);
    writeText(out, formatTxt(c));
    promoted++;
    written.push(id);
    log(`   ✓ ${id}: ${path.relative(ROOT, out)}`);
  }
  writeIndex(written);
  log(`קידום: ${promoted} נכתבו, ${skipped} דולגו, ${failed} נכשלו`);
  return { promoted, skipped, failed };
}

/** אינדקס קבצי העובדות — האפליקציה טוענת אותו כדי לדעת לאילו רחובות יש עובדה. */
function writeIndex(ids) {
  const index = {
    version: 1,
    updatedAt: ACCESS_DATE,
    count: ids.length,
    ids: [...ids].sort(),
  };
  writeJson(path.join(OUT_DIR, 'index.json'), index);
  log(`נכתב אינדקס: ${path.relative(ROOT, path.join(OUT_DIR, 'index.json'))} (${ids.length} רחובות)`);
  return index;
}

// ---------- progress ----------
function loadProgress() {
  return readJson(PROGRESS_FILE, { version: 1, updatedAt: nowIso(), streets: {} });
}

function saveProgress(p) {
  p.updatedAt = nowIso();
  writeJson(PROGRESS_FILE, p);
}

// ---------- CLI ----------
function parseArgs(argv) {
  const a = { list: null, all: false, limit: 0, only: null, force: false, refresh: false, dryRun: false, report: false, promote: null, promoteAll: false, review: false, init: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--list') a.list = argv[++i];
    else if (x === '--all') a.all = true;
    else if (x === '--limit') a.limit = Number(argv[++i]) || 0;
    else if (x === '--only') a.only = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (x === '--force') a.force = true;
    else if (x === '--refresh-cache') a.refresh = true;
    else if (x === '--dry-run') a.dryRun = true;
    else if (x === '--report') a.report = true;
    else if (x === '--promote') a.promote = argv[++i];
    else if (x === '--promote-all') a.promoteAll = true;
    else if (x === '--review') a.review = true;
    else if (x === '--init') a.init = true;
    else if (x === '--no-nominatim') CFG.nominatim = false;
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

function printReport(progress, official) {
  const vals = Object.values(progress.streets || {});
  const by = {};
  for (const v of vals) by[v.status] = (by[v.status] || 0) + 1;
  console.log('\n=== דוח Pipeline "הידעת?" ===');
  console.log('סה"כ רשומות ב-progress:', vals.length);
  console.log('סטטוסים:', by);
  console.log('עם מועמד לעובדה:', vals.filter(v => v.fact_type && v.fact_type !== 'none').length);
  console.log('עם מקור תוכן:', vals.filter(v => v.content_sources > 0).length);
  console.log('פלט סופי:', fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.txt')).length : 0);
  console.log('רשמיים (data.gov.il):', official?.count || 0);
  console.log('עודכן:', progress.updatedAt);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`שימוש:
  node tools/research-didyouknow.js --init
  node tools/research-didyouknow.js --list data/research/pilot-50.json
  node tools/research-didyouknow.js --all [--limit N]
  node tools/research-didyouknow.js --only yafo,ben-yehuda --force
  node tools/research-didyouknow.js --report
  node tools/research-didyouknow.js --promote yafo
  node tools/research-didyouknow.js --review --list data/research/pilot-50.json
  node tools/research-didyouknow.js --promote-all --list data/research/pilot-50.json`);
    return;
  }

  ensureDir(RESEARCH_DIR);
  ensureDir(CACHE_DIR);
  ensureDir(OUT_DIR);
  ensureDir(path.join(RESEARCH_DIR, 'candidates'));

  if (args.review) { reviewManual(args.list); return; }
  if (args.promoteAll) { promoteAll(args.list); return; }
  if (args.promote) { promote(args.promote); return; }

  const progress = loadProgress();
  const official = await loadOfficialList(args.init || args.refresh);

  if (args.report) { printReport(progress, official); return; }

  const all = loadStreets();
  let targets = [];
  if (args.only) {
    targets = args.only.map(id => all.find(s => s.id === id)).filter(Boolean);
  } else if (args.list) {
    const list = readJson(path.resolve(ROOT, args.list), null);
    if (!list) throw new Error('לא נמצא קובץ רשימה: ' + args.list);
    const ids = (list.streets || list).map(s => s.id || s);
    targets = ids.map(id => all.find(s => s.id === id)).filter(Boolean);
  } else if (args.all) {
    targets = all;
  } else {
    console.log('לא נבחר יעד. אפשר --list, --all או --only. (--help)');
    return;
  }
  if (args.limit) targets = targets.slice(0, args.limit);

  log(`מתחיל: ${targets.length} רחובות · nominatim=${CFG.nominatim} · force=${args.force}`);
  let stopping = false;
  process.on('SIGINT', () => {
    log('SIGINT — מסיים אחרי הרחוב הנוכחי ושומר progress…');
    stopping = true;
  });

  let done = 0, skipped = 0, failed = 0, noFact = 0;
  for (const street of targets) {
    if (stopping) break;
    const prev = progress.streets[street.id];
    if (!args.force && prev?.status === 'ok' && fs.existsSync(candidateFile(street.id))) {
      skipped++;
      continue;
    }
    log(`[${done + skipped + failed + noFact + 1}/${targets.length}] ${street.name} (${street.id})`);
    const result = await processStreet(street, args, official);
    const status = result.error ? 'error' : (result.fact && result.fact_type !== 'osm-only' ? 'ok' : 'no-fact');

    if (!args.dryRun) {
      writeJson(candidateFile(street.id), result);
      progress.streets[street.id] = {
        id: street.id,
        name: street.name,
        area: street.area,
        status,
        fact_type: result.fact_type,
        confidence: result.confidence,
        content_sources: result.sources.filter(s => s.kind === 'content').length,
        sources: result.sources.map(s => s.url),
        candidate: path.relative(ROOT, candidateFile(street.id)).replace(/\\/g, '/'),
        lastRun: nowIso(),
        attempts: (prev?.attempts || 0) + 1,
        lastError: result.error || null,
      };
      saveProgress(progress);
    }

    if (status === 'error') failed++;
    else if (status === 'no-fact') noFact++;
    else done++;
    if (result.fact) log(`   ✓ ${result.fact_type}/${result.confidence}: ${result.fact.slice(0, 110)}…`);
    else log(`   · ללא עובדה (${result.error || 'אין מקור מתאים'})`);
  }

  saveProgress(progress);
  log(`סיום: ok=${done}, no-fact=${noFact}, error=${failed}, skipped=${skipped}`);
  printReport(progress, official);
}

main().catch(e => { console.error('FATAL', e); process.exitCode = 1; });
