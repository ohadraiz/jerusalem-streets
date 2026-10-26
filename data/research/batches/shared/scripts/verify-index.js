const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const idx = JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8'));
const man = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));
const ids = idx.ids;
console.log('index count', idx.count, 'ids', ids.length, 'unique', new Set(ids).size, 'sorted', JSON.stringify(ids) === JSON.stringify([...ids].sort((a, b) => a.localeCompare(b, 'en'))));
console.log('manual streets', Object.keys(man.streets).length);
const notIndexed = Object.keys(man.streets).filter((k) => !ids.includes(k));
const notManual = ids.filter((k) => !man.streets[k]);
console.log('manual-not-indexed', notIndexed.length, notIndexed.slice(0, 5).join(','));
console.log('indexed-not-manual', notManual.length, notManual.slice(0, 5).join(','));
const files = new Set(fs.readdirSync(ROOT + '/data/didyouknow').filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)));
const orphans = [...files].filter((f) => !ids.includes(f));
console.log('txt files', files.size, 'orphans', orphans.length, orphans.join(','));
// spot read sanitization: ensure no fact has control chars / html tags
let bad = 0;
for (const id of ids) {
  const raw = fs.readFileSync(ROOT + '/data/didyouknow/' + id + '.txt', 'utf8');
  const m = raw.match(/^fact: (.*)$/m);
  if (!m || m[1].length < 30 || m[1].length > 340) { console.log('BAD FACT', id); bad++; }
  if (/<[a-z/]/.test(m ? m[1] : '')) { console.log('HTML', id); bad++; }
}
console.log('facts checked', ids.length, 'bad', bad);
