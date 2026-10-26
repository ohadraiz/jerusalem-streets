/**
 * Builds candidates-1200.json from:
 *  1. matches-1200.json (exact title matches from the local dump)
 *  2. pool-900 leftovers that still lack a card
 *  3. unused matches from the 1,100 search pass
 * One row per street: id, name, area, title, source.
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const manual = new Set(Object.keys(JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets));
const rows = new Map();

for (const r of JSON.parse(fs.readFileSync(DIR + '/matches-1200.json', 'utf8'))) {
  if (manual.has(r.id) || !r.cands.length) continue;
  rows.set(r.id, { id: r.id, name: r.name, area: r.area, title: r.cands[0].title, source: 'title-dump' });
}

for (const p of JSON.parse(fs.readFileSync(DIR + '/pool-900.json', 'utf8'))) {
  if (manual.has(p.id) || !p.title || rows.has(p.id)) continue;
  rows.set(p.id, { id: p.id, name: p.name, area: p.area, title: p.title, source: 'pool-900' });
}

for (const x of Object.values(JSON.parse(fs.readFileSync(DIR + '/search-1100.json', 'utf8')))) {
  if (manual.has(x.id) || !x.match || rows.has(x.id)) continue;
  rows.set(x.id, { id: x.id, name: x.name, area: x.area, title: x.match, source: 'search-1100' });
}

if (fs.existsSync(DIR + '/search-1200b.json')) {
  for (const x of Object.values(JSON.parse(fs.readFileSync(DIR + '/search-1200b.json', 'utf8')))) {
    if (manual.has(x.id) || !x.match || rows.has(x.id)) continue;
    rows.set(x.id, { id: x.id, name: x.name, area: x.area, title: x.match, source: 'search-1200' });
  }
}

const list = [...rows.values()];
fs.writeFileSync(DIR + '/candidates-1200.json', JSON.stringify(list, null, 0));
const bySource = {};
for (const r of list) bySource[r.source] = (bySource[r.source] || 0) + 1;
console.log('candidates', list.length, JSON.stringify(bySource));
