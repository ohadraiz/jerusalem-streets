const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const batch = require(DIR + '/batch-1100.json');
const arts = require(DIR + '/articles-1100.json');
const byId = new Map(batch.map((b) => [b.id, b]));
const files = process.argv.slice(2);
const all = [];
let bad = 0;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

for (const f of files) {
  const arr = require(DIR + '/' + f);
  for (const x of arr) {
    if (!byId.has(x.id)) { console.log('UNKNOWN ID', x.id); bad++; continue; }
    if (x.after.length < 30 || x.after.length > 340) { console.log('LEN', x.id, x.after.length); bad++; }
    if (/\uFFFD/.test(x.after + x.evidence)) { console.log('BADCHAR', x.id); bad++; }
    if (/==|\|/.test(x.after)) { console.log('ARTIFACT', x.id); bad++; }
    const text = norm(arts[x.id].text);
    if (!text.includes(norm(x.evidence))) { console.log('NO EVIDENCE', x.id, JSON.stringify(x.evidence)); bad++; }
    all.push(x);
  }
}
const ids = all.map((x) => x.id);
if (new Set(ids).size !== ids.length) { console.log('DUP IDS'); bad++; }
if (new Set(all.map((x) => x.after)).size !== all.length) { console.log('DUP FACTS'); bad++; }
console.log('entries', all.length, 'bad', bad);
process.exit(bad ? 1 : 0);
