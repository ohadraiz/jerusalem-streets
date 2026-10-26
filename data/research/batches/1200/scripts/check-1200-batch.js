const fs = require('fs');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const m = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const batch = JSON.parse(fs.readFileSync(ROOT + '/data/research/batch-1200.json', 'utf8')).streets;
let bad = 0;
for (const b of batch) {
  const e = m[b.id];
  if (!e) { console.log('MISSING', b.id); bad++; continue; }
  const txt = fs.readFileSync(ROOT + `/data/didyouknow/${b.id}.txt`, 'utf8').match(/^fact: (.*)$/m)?.[1];
  if (txt !== e.fact) { console.log('TXT', b.id); bad++; }
  const cp = ROOT + `/data/research/candidates/${b.id}.json`;
  if (!fs.existsSync(cp)) { console.log('NOCAND', b.id); bad++; continue; }
  const c = JSON.parse(fs.readFileSync(cp, 'utf8'));
  if (c.fact !== e.fact) { console.log('CAND', b.id); bad++; }
  if (!/^https:\/\/he\.wikipedia\.org\//.test(c.sources?.[0]?.url || '')) { console.log('SRC', b.id); bad++; }
}
const lens = batch.map((b) => m[b.id].fact.length);
console.log('batch', batch.length, 'bad', bad, 'len min/max/avg', Math.min(...lens), Math.max(...lens), Math.round(lens.reduce((a, b) => a + b, 0) / lens.length));
