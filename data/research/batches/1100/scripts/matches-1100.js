const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const store = JSON.parse(fs.readFileSync(DIR + '/search-1100.json', 'utf8'));
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));
const used = new Set(Object.keys(manual.streets));

const rows = Object.values(store).filter((x) => x.match && !used.has(x.id));
console.log('matched unused', rows.length);

// heuristic: prefer matches that look like a full personal name or an organisation/topic with a clear title
const rows2 = rows.map((x) => ({
  id: x.id,
  name: x.name,
  area: x.area,
  title: x.match,
  extra: x.match.length - x.name.length,
}));

rows2.sort((a, b) => a.extra - b.extra || a.name.localeCompare(b.name, 'he'));
fs.writeFileSync(DIR + '/matches-1100.json', JSON.stringify(rows2, null, 1), 'utf8');
for (const x of rows2.slice(0, 80)) console.log(x.name + ' [' + x.area + '] -> ' + x.title);
console.log('total', rows2.length);
