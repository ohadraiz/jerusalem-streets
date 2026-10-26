const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const batch = require(DIR + '/batch-1100.json');
const UA = 'JLM-Street-Journal/1.0 (local civic research; contact: project owner)';
const API = 'https://he.wikipedia.org/w/api.php';
const OUT = DIR + '/articles-1100.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

async function api(params) {
  const u = new URL(API);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    const body = await r.text();
    if (r.ok && body.startsWith('{')) return JSON.parse(body);
    if (r.status === 429 || r.status >= 500 || body.startsWith('You are ma')) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error('HTTP ' + r.status + ' ' + body.slice(0, 80));
  }
  throw new Error('retries');
}

(async () => {
  let n = 0;
  for (const b of batch) {
    if (store[b.id] && store[b.id].text) continue;
    const data = await api({ action: 'query', redirects: '1', prop: 'extracts', explaintext: '1', exlimit: '1', titles: b.title });
    const page = (data.query && data.query.pages && data.query.pages[0]) || {};
    store[b.id] = { title: page.title || b.title, missing: !!page.missing, text: page.extract || '' };
    n++;
    if (n % 10 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(store));
      console.log('fetched', n, '/', batch.length, 'chars', store[b.id].text.length);
    }
    await sleep(700);
  }
  fs.writeFileSync(OUT, JSON.stringify(store));
  const ok = batch.filter((b) => ((store[b.id] || {}).text || '').length > 200).length;
  console.log('done total', Object.keys(store).length, 'usable', ok, 'of', batch.length);
})().catch((e) => { fs.writeFileSync(OUT, JSON.stringify(store)); console.error(e); process.exit(1); });
