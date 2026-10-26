const fs = require('fs');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8')).filter((s) => !idx.has(s.id));
const names = new Set(unc.map((s) => s.name.trim()));
const text = fs.readFileSync(DIR + '/naming-article.txt', 'utf8').replace(/\r/g, '').replace(/\n+/g, ' ');
const sents = text.split(/(?<=[.!?])\s+/).map((s) => s.trim());
const found = new Map();
for (const s of sents) {
  if (!/קרויים|קרואים|נקראו|על שם|על שמו|על שמה/.test(s)) continue;
  for (const n of names) {
    if (n.length < 3) continue;
    const re = new RegExp('(^|[^\\u05d0-\\u05ea])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\u05d0-\\u05ea]|$)');
    if (re.test(s) && !found.has(n)) found.set(n, s);
  }
}
console.log('uncovered streets still supported by unused sentences:', found.size);
const list = [...found.keys()];
console.log(list.join(' | '));
fs.writeFileSync(DIR + '/remaining-themed.json', JSON.stringify([...found.entries()], null, 0));
