const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const manPath = ROOT + '/data/research/manual-facts.json';
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
const logPath = DIR + '/rewritten.json';
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : {};

const files = fs.readdirSync(DIR).filter((f) => /^rewrite-\d+\.json$/.test(f)).sort();
let changed = 0, kept = 0;
const issues = [];
for (const f of files) {
  for (const e of JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8'))) {
    const cur = man.streets[e.id];
    if (!cur) { issues.push('missing id ' + e.id); continue; }
    if (e.fact == null) {
      kept++;
      if (!log[e.id]) log[e.id] = { old: cur.fact, new: cur.fact, kept: true };
      continue;
    }
    const fact = String(e.fact).replace(/\s+/g, ' ').trim();
    if (fact.length < 30 || fact.length > 340) issues.push('len ' + fact.length + ' ' + e.id);
    if (/[\u0600-\u06FF]/.test(fact)) issues.push('arabic ' + e.id);
    if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(fact)) issues.push('emoji ' + e.id);
    if (!/[א-ת]/.test(fact)) issues.push('no hebrew ' + e.id);
    if (log[e.id] && log[e.id].new === fact) continue;
    log[e.id] = { old: log[e.id] ? log[e.id].old : cur.fact, new: fact };
    cur.fact = fact;
    changed++;
  }
}
// duplicate facts across all 500
const seen = new Map();
for (const [id, v] of Object.entries(man.streets)) {
  const k = v.fact.trim();
  if (seen.has(k)) issues.push('dup fact ' + id + ' = ' + seen.get(k));
  else seen.set(k, id);
}
if (!issues.length) {
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n', 'utf8');
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1), 'utf8');
}
console.log('changed', changed, 'kept', kept, 'total rewritten', Object.keys(log).length, 'issues', issues.length);
for (const i of issues.slice(0, 20)) console.log(' !', i);
