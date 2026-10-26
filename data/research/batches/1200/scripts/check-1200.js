const fs = require('fs');
const cp = require('child_process');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const m = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));
const idx = JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8'));
const batch = JSON.parse(fs.readFileSync(ROOT + '/data/research/batch-1200.json', 'utf8')).streets;
const facts = new Set();
let dup = 0, bad = 0;
for (const [id, e] of Object.entries(m.streets)) {
  if (facts.has(e.fact)) { dup++; }
  facts.add(e.fact);
  const txt = fs.readFileSync(ROOT + `/data/didyouknow/${id}.txt`, 'utf8').match(/^fact: (.*)$/m)?.[1];
  if (txt !== e.fact) { bad++; console.log('TXT SYNC', id); }
  const cp2 = ROOT + `/data/research/candidates/${id}.json`;
  if (fs.existsSync(cp2)) {
    const c = JSON.parse(fs.readFileSync(cp2, 'utf8'));
    if (c.fact !== e.fact) { bad++; console.log('CAND SYNC', id); }
  } else { bad++; console.log('NO CAND', id); }
}
console.log('manual', Object.keys(m.streets).length, 'index', idx.count, idx.ids.length, 'unique', facts.size, 'dup', dup, 'bad', bad);
for (const b of batch) {
  if (!m.streets[b.id]) { console.log('MISSING CARD', b.id); bad++; }
}
const old = JSON.parse(cp.execSync('git show HEAD:data/research/manual-facts.json', { cwd: ROOT, maxBuffer: 60 * 1024 * 1024 }).toString('utf8'));
let changed = 0;
for (const [id, e] of Object.entries(old.streets)) {
  if (JSON.stringify(e) !== JSON.stringify(m.streets[id])) { changed++; console.log('CHANGED', id); }
}
console.log('old facts changed', changed);
const idxOld = JSON.parse(cp.execSync('git show HEAD:data/didyouknow/index.json', { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 }).toString('utf8'));
const beforeSet = new Set(idxOld.ids);
console.log('added', idx.ids.filter((x) => !beforeSet.has(x)).length, 'removed', idxOld.ids.filter((x) => !idx.ids.includes(x)).length);
process.exit(bad ? 1 : 0);
