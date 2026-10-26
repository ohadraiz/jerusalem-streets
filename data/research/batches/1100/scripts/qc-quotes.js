const m = require('C:/Users/ohadr/Documents/Default Project/data/research/manual-facts.json');
const b = new Set(require('C:/Users/ohadr/Documents/Default Project/data/research/batch-1100.json').streets.map((s) => s.id));
let oldQ = 0, oldG = 0, newQ = 0, newG = 0;
for (const [id, e] of Object.entries(m.streets)) {
  const q = e.fact.includes('"');
  const g = e.fact.includes('\u05F4');
  if (b.has(id)) { if (q) newQ++; if (g) newG++; }
  else { if (q) oldQ++; if (g) oldG++; }
}
console.log('old ascii-quote', oldQ, 'old gershayim', oldG, 'new ascii-quote', newQ, 'new gershayim', newG);
