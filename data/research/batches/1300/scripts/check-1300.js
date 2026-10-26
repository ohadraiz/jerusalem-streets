const fs = require('fs');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const m = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const idx = JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8'));
const b = JSON.parse(fs.readFileSync(ROOT + '/data/research/batch-1300.json', 'utf8')).streets;
let bad = 0;
for (const s of b) {
  const e = m[s.id];
  const txt = fs.readFileSync(ROOT + `/data/didyouknow/${s.id}.txt`, 'utf8').match(/^fact: (.*)$/m)?.[1];
  const c = JSON.parse(fs.readFileSync(ROOT + `/data/research/candidates/${s.id}.json`, 'utf8'));
  if (!e || txt !== e.fact || c.fact !== e.fact) { console.log('SYNC', s.id); bad++; }
  if (!/^https:\/\/he\.wikipedia\.org\//.test(e.sources[0].url)) { console.log('SRC', s.id); bad++; }
}
const facts = new Set();
for (const [id, e] of Object.entries(m)) {
  if (facts.has(e.fact)) { console.log('DUP FACT', id); bad++; }
  facts.add(e.fact);
}
console.log('cards', Object.keys(m).length, 'index', idx.count, 'unique', facts.size, 'batch', b.length, 'bad', bad);
