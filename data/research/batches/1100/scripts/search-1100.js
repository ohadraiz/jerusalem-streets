const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'JLM-Street-Journal/1.0 (local civic research; contact: project owner)';
const API = 'https://he.wikipedia.org/w/api.php';
const OUT = DIR + '/search-1100.json';

const pool = JSON.parse(fs.readFileSync(DIR + '/pool-900.json', 'utf8'));
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));
const used = new Set(Object.keys(manual.streets));
const uncovered = JSON.parse(fs.readFileSync(DIR + '/uncovered-724.json', 'utf8'));

const skipName = /^(חניון|כניסה|שביל|מגרש)/;
const resolveable = new Set(pool.map((p) => p.id));
const targets = uncovered
  .filter((s) => !used.has(s.id) && !resolveable.has(s.id) && !skipName.test(s.name))
  .sort((a, b) => a.name.localeCompare(b.name, 'he'));

console.log('targets', targets.length);
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(params) {
  const u = new URL(API);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    const body = await r.text();
    if (r.ok && body.startsWith('{')) return JSON.parse(body);
    if (r.status === 429 || r.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    if (body.startsWith('You are ma')) { await sleep(2500 * (attempt + 1)); continue; }
    throw new Error('HTTP ' + r.status + ' ' + body.slice(0, 80));
  }
  return null;
}

function plausible(name, title) {
  if (title === name) return false;
  if (title.endsWith(' ' + name) && title.length - name.length <= 18) return true;
  if (title.startsWith(name + ' ') && title.length - name.length <= 12) return true;
  return false;
}

let done = 0;
async function handle(s) {
  const j = await get({ action: 'query', list: 'search', srsearch: s.name, srlimit: '6', srprop: 'snippet' });
  const hits = (j?.query?.search || []).map((x) => x.title);
  const match = hits.find((t) => plausible(s.name, t)) || null;
  store[s.id] = { id: s.id, name: s.name, area: s.area, hits, match };
  done++;
  if (done % 50 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(store));
    console.log('searched', done, '/', targets.length, 'matched', Object.values(store).filter((x) => x.match).length);
  }
  await sleep(250);
}

(async () => {
  const queue = targets.filter((s) => !store[s.id]);
  console.log('to search', queue.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (i < queue.length) {
        const s = queue[i++];
        try { await handle(s); } catch (e) { console.log('ERR', s.name, e.message); }
      }
    })
  );
  fs.writeFileSync(OUT, JSON.stringify(store));
  const matched = Object.values(store).filter((x) => x.match);
  console.log('done searched', Object.keys(store).length, 'matched', matched.length);
})().catch((e) => { fs.writeFileSync(OUT, JSON.stringify(store)); console.error(e); process.exit(1); });
