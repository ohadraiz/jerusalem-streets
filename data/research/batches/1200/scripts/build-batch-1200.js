const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const keepLines = '2,3,4,6,7,8,9,10,12,16,19,20,23,24,25,27,28,29,31,32,33,37,38,39,40,41,42,43,44,45,47,49,50,51,54,55,58,61,64,65,66,67,69,73,74,76,79,80,81,82,87,88,89,92,93,96,97,98,99,101,102,103,108,109,110,111,112,113,114,116,117,118,119,120,122,125,127,128,129,130,131,132,133,134,136,137,138,139,141,142,143,144,145,146,147,148'
  .split(',')
  .map(Number);
const sel = JSON.parse(fs.readFileSync(DIR + '/selected-1200.json', 'utf8'));
const arts = JSON.parse(fs.readFileSync(DIR + '/articles-1200.json', 'utf8'));
const rows = sel.filter((s) => s.title === s.name || s.title.startsWith('רחוב '));
rows.sort((a, b) => a.area.localeCompare(b.area, 'he') || a.name.localeCompare(b.name, 'he'));
const keep = keepLines.map((n) => rows[n - 1]);
if (keep.some((x) => !x)) throw new Error('bad line number');
const batch = keep.map((s) => ({ id: s.id, name: s.name, area: s.area, title: s.title }));
fs.writeFileSync(DIR + '/batch-1200.json', JSON.stringify(batch, null, 0));
const a = {};
for (const b of batch) a[b.id] = { title: b.title, text: (arts[b.id] || {}).text || '' };
fs.writeFileSync(DIR + '/articles-batch-1200.json', JSON.stringify(a, null, 0));
console.log('batch', batch.length, 'articles', Object.keys(a).length);
console.log(batch.map((b) => b.name).join(' | '));
