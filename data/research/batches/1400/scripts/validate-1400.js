const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const batch = require(DIR + '/batch-1400.json');
const arts = require(DIR + '/articles-batch-1400.json');
const byId = new Map(batch.map((b) => [b.id, b]));
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const arr = JSON.parse(fs.readFileSync(DIR + '/facts-1400-01.json', 'utf8'));
let bad = 0;
for (const x of arr) {
  if (!byId.has(x.id)) { console.log('ID', x.id); bad++; continue; }
  if (x.after.length < 30 || x.after.length > 340) { console.log('LEN', x.id, x.after.length); bad++; }
  if (/==|\||\uFFFD/.test(x.after)) { console.log('ART', x.id); bad++; }
  const latin = x.after.replace(/[\u05F3\u05F4"']/g, '').match(/[A-Za-z]{2,}/);
  if (latin) { console.log('LATIN', x.id, latin[0]); bad++; }
  if (!norm(arts[x.id].text).includes(norm(x.evidence))) { console.log('EVI', x.id, JSON.stringify(x.evidence)); bad++; }
}
const ids = arr.map((x) => x.id);
if (new Set(ids).size !== ids.length) { console.log('DUP'); bad++; }
const lens = arr.map((x) => x.after.length);
console.log('entries', arr.length, 'bad', bad, 'len min/max', Math.min(...lens), Math.max(...lens));
process.exit(bad ? 1 : 0);
