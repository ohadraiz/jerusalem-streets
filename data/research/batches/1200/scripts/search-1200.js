/**
 * Discovery for the next expansion (base 1,130).
 * Phase 1: for every app street without a card, search he.wikipedia for a street article
 *          titled "רחוב <name>" (or a close variant). Plain-name searches were already
 *          exhausted by the 1,100 batch, which is why this pass targets the "רחוב" namespace.
 * Phase 2: fetch intro extract + coordinates for each candidate title and keep only articles
 *          that are about Jerusalem (coords within 20 km of the city centre, or the text says ירושלים).
 * Output: search-1200.json (raw, resumable) and pool-1200.json (verified candidates).
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'JLM-Street-Journal/1.0 (local civic research; contact: project owner)';
const API = 'https://he.wikipedia.org/w/api.php';
const SEARCH = DIR + '/search-1200.json';
const POOL = DIR + '/pool-1200.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));
const used = new Set(Object.keys(manual.streets));
const uncovered = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8'));
const skipName = /^(חניון|כניסה|שביל|מגרש|כביש)/;
const targets = uncovered.filter((s) => !used.has(s.id) && !skipName.test(s.name));

async function api(params, tries = 5) {
  const u = new URL(API);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      const body = await r.text();
      if (r.ok && body.startsWith('{')) return JSON.parse(body);
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (a + 1)); continue; }
      if (body.startsWith('You are ma')) { await sleep(2500 * (a + 1)); continue; }
    } catch (e) { await sleep(800 * (a + 1)); }
  }
  return null;
}

function pickMatch(name, titles) {
  const exact = ['רחוב ' + name, 'רחוב ' + name + ' (ירושלים)', name + ' (רחוב)', 'רחוב ' + name + ' (ירושלים, '];
  for (const t of titles) if (exact.includes(t)) return t;
  for (const t of titles) {
    if (t.startsWith('רחוב ' + name + ' ') && t.length - name.length <= 30) return t;
    if (t.startsWith('רחוב ' + name + ' (') && t.length - name.length <= 30) return t;
  }
  return null;
}

const store = fs.existsSync(SEARCH) ? JSON.parse(fs.readFileSync(SEARCH, 'utf8')) : {};
console.log('targets', targets.length, 'already searched', Object.keys(store).length);

async function searchOne(s) {
  const j = await api({ action: 'query', list: 'search', srsearch: 'intitle:"רחוב ' + s.name + '"', srlimit: '8', srprop: 'snippet' });
  let titles = (j?.query?.search || []).map((x) => x.title);
  if (!titles.length) {
    const j2 = await api({ action: 'query', list: 'search', srsearch: 'רחוב ' + s.name + ' ירושלים', srlimit: '8', srprop: 'snippet' });
    titles = (j2?.query?.search || []).map((x) => x.title);
  }
  store[s.id] = { id: s.id, name: s.name, area: s.area, hits: titles, match: pickMatch(s.name, titles) };
  await sleep(180);
}

(async () => {
  const queue = targets.filter((s) => !store[s.id]);
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (i < queue.length) {
      const s = queue[i++];
      try { await searchOne(s); } catch (e) { console.log('ERR', s.name, e.message); }
      done++;
      if (done % 50 === 0) {
        fs.writeFileSync(SEARCH, JSON.stringify(store));
        console.log('searched', done, '/', queue.length, 'matched', Object.values(store).filter((x) => x.match).length);
      }
    }
  }));
  fs.writeFileSync(SEARCH, JSON.stringify(store));
  const matched = Object.values(store).filter((x) => x.match);
  console.log('phase1 done: searched', Object.keys(store).length, 'matched', matched.length);
})();
