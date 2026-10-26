const fs = require('fs');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const m = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const b = JSON.parse(fs.readFileSync(ROOT + '/data/research/batch-1500.json', 'utf8')).streets;
const facts = new Set();
let bad = 0;
for (const [id, e] of Object.entries(m)) {
  if (facts.has(e.fact)) { console.log('DUP', id); bad++; }
  facts.add(e.fact);
}
for (const s of b) {
  const line = fs.readFileSync(ROOT + `/data/didyouknow/${s.id}.txt`, 'utf8').split('\n').find((l) => l.startsWith('fact: '));
  const txt = line ? line.slice(6) : null;
  const c = JSON.parse(fs.readFileSync(ROOT + `/data/research/candidates/${s.id}.json`, 'utf8'));
  if (txt !== m[s.id].fact || c.fact !== m[s.id].fact) { console.log('SYNC', s.id, JSON.stringify(txt && txt.slice(0, 30)), JSON.stringify(m[s.id].fact.slice(0, 30))); bad++; }
}
console.log('cards', Object.keys(m).length, 'unique', facts.size, 'batch', b.length, 'bad', bad);
