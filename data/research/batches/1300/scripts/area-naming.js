/**
 * For each area with uncovered streets, fetch the Hebrew Wikipedia article and pull sentences
 * that explain how the streets of that neighborhood were named (theme, committee, namesakes).
 * Output: area-naming.json
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'JLM-Street-Journal/1.0 (local civic research)';
const API = 'https://he.wikipedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8')).filter((s) => !idx.has(s.id));
const areas = {};
for (const s of unc) {
  const a = s.area.replace(/\s*\(.*\)\s*$/, '').trim();
  areas[a] = areas[a] || [];
  areas[a].push(s.name);
}
const list = Object.entries(areas).sort((a, b) => b[1].length - a[1].length).slice(0, 30);

async function extract(title) {
  const u = new URL(API);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  for (const [k, v] of Object.entries({ action: 'query', prop: 'extracts', explaintext: '1', exlimit: '1', redirects: '1', titles: title })) u.searchParams.set(k, v);
  for (let a = 0; a < 4; a++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    const b = await r.text();
    if (r.ok && b.startsWith('{')) {
      const j = JSON.parse(b);
      const p = j.query?.pages?.[0] || {};
      return { title: p.title || title, missing: !!p.missing, text: p.extract || '' };
    }
    await sleep(1200 * (a + 1));
  }
  return { title, missing: true, text: '' };
}

const NAME = /(קרוא|קרויה|קרויים|נקרא|נקראה|נקראו|על שם|על שמם|שמות ה|שמות ה?רחובות|ועדת השמות)/;
const out = [];
(async () => {
  for (const [area, names] of list) {
    const a = await extract(area);
    const sents = (a.text || '').replace(/\r/g, '').split(/\n+/).join(' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 45 && s.length <= 220 && NAME.test(s) && /רחוב|דרך|שכונ/.test(s));
    out.push({ area, names, article: a.title, missing: a.missing, len: a.text.length, sentences: sents.slice(0, 6) });
    console.log(String(names.length).padStart(4), area.padEnd(22), a.missing ? 'MISSING' : a.text.length, 'theme sentences', sents.length);
    await sleep(400);
  }
  fs.writeFileSync(DIR + '/area-naming.json', JSON.stringify(out, null, 0));
})();
