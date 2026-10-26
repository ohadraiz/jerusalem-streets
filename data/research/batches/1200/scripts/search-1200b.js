/**
 * Discovery pass 2 for the next expansion: plain-name search for the 803 uncovered streets
 * that the 1,100 pass never searched. Same matching rule as search-1100.js.
 * Output: search-1200b.json (resumable).
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'JLM-Street-Journal/1.0 (local civic research; contact: project owner)';
const API = 'https://he.wikipedia.org/w/api.php';
const OUT = DIR + '/search-1200b.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const manual = new Set(Object.keys(JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets));
const uncovered = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8'));
const prev = JSON.parse(fs.readFileSync(DIR + '/search-1100.json', 'utf8'));
const prevIds = new Set(Object.keys(prev));
const skipName = /^(חניון|כניסה|שביל|מגרש|כביש)/;
const targets = uncovered
  .filter((s) => !manual.has(s.id) && !prevIds.has(s.id) && !skipName.test(s.name))
  .sort((a, b) => a.name.localeCompare(b.name, 'he'));

const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
console.log('targets', targets.length, 'already done', Object.keys(store).length);

async function get(params) {
  const u = new URL(API);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let a = 0; a < 6; a++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      const body = await r.text();
      if (r.ok && body.startsWith('{')) return JSON.parse(body);
      if (body.startsWith('You are ma')) { await sleep(3000 * (a + 1)); continue; }
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (a + 1)); continue; }
      return null;
    } catch (e) { await sleep(1000 * (a + 1)); }
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
  store[s.id] = { id: s.id, name: s.name, area: s.area, hits, match: hits.find((t) => plausible(s.name, t)) || null };
  done++;
  if (done % 25 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(store));
    process.stdout.write('searched ' + done + '/' + (targets.length - (Object.keys(store).length - done)) + ' matched ' + Object.values(store).filter((x) => x.match).length + '\n');
  }
  await sleep(300);
}

(async () => {
  const queue = targets.filter((s) => !store[s.id]);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < queue.length) {
      const s = queue[i++];
      try { await handle(s); } catch (e) { process.stdout.write('ERR ' + s.name + ' ' + e.message + '\n'); }
    }
  }));
  fs.writeFileSync(OUT, JSON.stringify(store));
  console.log('done searched', Object.keys(store).length, 'matched', Object.values(store).filter((x) => x.match).length);
})();
