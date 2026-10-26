/**
 * Fetches full plaintext article extracts for candidates-1200.json.
 * Output: articles-1200.json  { <streetId>: { title, text, missing } }
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const UA = 'JLM-Street-Journal/1.0 (local civic research; contact: project owner)';
const API = 'https://he.wikipedia.org/w/api.php';
const OUT = DIR + '/articles-1200.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cands = JSON.parse(fs.readFileSync(DIR + '/candidates-1200.json', 'utf8'));
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

async function api(params) {
  const u = new URL(API);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let a = 0; a < 6; a++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      const body = await r.text();
      if (r.ok && body.startsWith('{')) return JSON.parse(body);
      if (r.status === 429 || r.status >= 500 || body.startsWith('You are ma')) { await sleep(3000 * (a + 1)); continue; }
      throw new Error('HTTP ' + r.status + ' ' + body.slice(0, 60));
    } catch (e) {
      if (a === 5) throw e;
      await sleep(1500 * (a + 1));
    }
  }
  throw new Error('retries');
}

(async () => {
  let n = 0;
  for (const c of cands) {
    if (store[c.id] && (store[c.id].text || '').length > 0) continue;
    try {
      const data = await api({ action: 'query', redirects: '1', prop: 'extracts', explaintext: '1', exlimit: '1', titles: c.title });
      const page = (data.query && data.query.pages && data.query.pages[0]) || {};
      store[c.id] = { title: page.title || c.title, missing: !!page.missing, text: page.extract || '' };
    } catch (e) {
      store[c.id] = { title: c.title, missing: false, text: '', error: e.message };
    }
    n++;
    if (n % 10 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(store));
      const ok = Object.values(store).filter((x) => (x.text || '').length > 400).length;
      console.log('fetched', n, '/', cands.length, 'usable', ok);
    }
    await sleep(900);
  }
  fs.writeFileSync(OUT, JSON.stringify(store));
  const ok = Object.values(store).filter((x) => (x.text || '').length > 400).length;
  console.log('done total', Object.keys(store).length, 'usable', ok, 'of', cands.length);
})();
