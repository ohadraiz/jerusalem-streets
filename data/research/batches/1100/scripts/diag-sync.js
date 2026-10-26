const fs = require('fs');
const root = 'C:/Users/ohadr/Documents/Default Project/';
const m = require(root + 'data/research/manual-facts.json');
const batch = new Set(require(root + 'data/research/batch-1100.json').streets.map((s) => s.id));
const out = [];
for (const [id, e] of Object.entries(m.streets)) {
  const txt = fs.readFileSync(root + 'data/didyouknow/' + id + '.txt', 'utf8').match(/^fact: (.*)$/m)?.[1];
  let why = [];
  if (txt !== e.fact) why.push('txt');
  const cp = root + 'data/research/candidates/' + id + '.json';
  if (fs.existsSync(cp)) {
    const c = JSON.parse(fs.readFileSync(cp, 'utf8'));
    if (c.fact !== e.fact) why.push('cand');
  } else why.push('nocand');
  if (why.length) out.push({ id, why: why.join('+'), inBatch: batch.has(id) });
}
console.log('total issues', out.length);
console.log('in batch-1100', out.filter((o) => o.inBatch).length);
for (const o of out) console.log(o.inBatch ? 'NEW ' : 'OLD ', o.id, o.why);
