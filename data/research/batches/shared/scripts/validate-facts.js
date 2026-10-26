const fs = require('fs');
const vm = require('vm');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(ROOT + '/assets/data.js', 'utf8'), sb);
const byId = new Map(sb.window.JLM_DATA.streets.map((s) => [s.id, s]));
const covered = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const man = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));
const existingFacts = new Set(Object.values(man.streets).map((v) => v.fact));

const files = fs.readdirSync(DIR).filter((f) => /^facts-batch-\d+\.json$/.test(f)).sort();
let all = [];
let problems = 0;
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8'));
  for (const e of arr) {
    all.push(e);
    const tag = `${f}:${e.id}`;
    if (!byId.has(e.id)) { console.log('BAD ID', tag); problems++; }
    else if (byId.get(e.id).name !== e.name) console.log('NAME MISMATCH', tag, '|', byId.get(e.id).name, '!=', e.name);
    if (covered.has(e.id)) { console.log('COVERED', tag); problems++; }
    if (e.fact.length < 30 || e.fact.length > 340) { console.log('LEN', tag, e.fact.length); problems++; }
    if (!e.fact.includes(' ')) console.log('NOSPACE', tag);
    if (!['high', 'medium', 'low'].includes(e.confidence)) { console.log('CONF', tag); problems++; }
    if (!e.method) { console.log('METHOD', tag); problems++; }
    if (existingFacts.has(e.fact)) { console.log('DUP EXISTING', tag); problems++; }
    if (/[\u0600-\u06FF]/.test(e.fact)) { console.log('ARABIC CHARS', tag); problems++; }
    if (/\b(l|the|and)\b/.test(e.fact)) console.log('LATIN WORD?', tag);
  }
}
const ids = all.map((e) => e.id);
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
const facts = all.map((e) => e.fact);
const dupFacts = facts.filter((f, i) => facts.indexOf(f) !== i);
console.log('files', files.join(','), 'entries', all.length, 'dupIds', JSON.stringify(dupIds), 'dupFacts', dupFacts.length);
const lens = all.map((e) => e.fact.length);
console.log('len min/max/avg', Math.min(...lens), Math.max(...lens), Math.round(lens.reduce((a, b) => a + b, 0) / lens.length));
console.log('problems', problems);
