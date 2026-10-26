const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'JLM-Street-Journal/1.0 (local civic research)';
const API = 'https://he.wikipedia.org/w/api.php';
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8')).filter((s) => !idx.has(s.id));

(async () => {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', action: 'query', prop: 'extracts', explaintext: '1', exlimit: '1', titles: 'שמות רחובות בירושלים' })) u.searchParams.set(k, v);
  const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
  const text = (j.query?.pages?.[0]?.extract || '').replace(/\r/g, '');
  fs.writeFileSync(DIR + '/naming-article.txt', text, 'utf8');
  const flat = text.replace(/\n+/g, ' ');
  const hits = [];
  for (const s of unc) {
    const name = s.name.replace(/["'׳״]/g, '').trim();
    if (name.length < 3) continue;
    const re = new RegExp('(^|[^\\u05d0-\\u05ea])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\u05d0-\\u05ea]|$)');
    const m = flat.match(re);
    if (m) {
      const i = flat.indexOf(m[0]);
      hits.push({ id: s.id, name: s.name, area: s.area, ctx: flat.slice(Math.max(0, i - 140), i + 160) });
    }
  }
  console.log('article chars', text.length, 'street-name hits', hits.length);
  for (const h of hits.slice(0, 25)) console.log('\n•', h.name, '|', h.area, '\n ', h.ctx.replace(/\s+/g, ' '));
  fs.writeFileSync(DIR + '/naming-hits.json', JSON.stringify(hits, null, 0));
})();
