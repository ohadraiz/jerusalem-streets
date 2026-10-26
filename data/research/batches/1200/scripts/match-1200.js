/**
 * Local title matching against the hewiki title dump (no API calls).
 * For every uncovered street proposes candidate article titles:
 *   rank 1  exact title == street name
 *   rank 2  "רחוב <name>…"        (street article)
 *   rank 3  "<name> (…)"          (qualified article)
 *   rank 4  "<name> <short tail>" (e.g. "דוד המלך")
 *   rank 5  "… <name>"            (e.g. "משפחת אבולעפיה")
 * Output: matches-1200.json
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const titles = fs.readFileSync(DIR + '/hewiki-titles.txt', 'utf8').split('\n').filter(Boolean);
const manual = new Set(Object.keys(JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets));
const uncovered = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8'));
const skipName = /^(חניון|כניסה|שביל|מגרש|כביש|ללא)/;
const targets = uncovered.filter((s) => !manual.has(s.id) && !skipName.test(s.name));
const nameSet = new Map();
for (const s of targets) nameSet.set(s.name.trim(), s);

const bad = /(פירושונים|^קטגוריה:|^תבנית:|^ויקיפדיה:|^קובץ:|^פורטל:|^מיוחד:|^שיחת )/;
const found = new Map(); /* name -> [{title, rank}] */
const add = (name, title, rank) => {
  if (!found.has(name)) found.set(name, []);
  const arr = found.get(name);
  if (!arr.some((x) => x.title === title)) arr.push({ title, rank });
};

for (const t of titles) {
  if (bad.test(t)) continue;
  if (nameSet.has(t)) add(t, t, 1);
  if (t.startsWith('רחוב ')) {
    const rest = t.slice(6);
    const base = rest.split(' (')[0];
    if (nameSet.has(base)) add(base, t, 2);
  }
  const paren = t.indexOf(' (');
  if (paren > 0) {
    const base = t.slice(0, paren);
    if (nameSet.has(base) && t.length - base.length <= 32) add(base, t, 3);
  }
  const space = t.indexOf(' ');
  if (space > 0) {
    const base = t.slice(0, space);
    const tail = t.slice(space + 1);
    if (nameSet.has(base) && tail.length <= 12 && !/\d{3,}/.test(tail)) add(base, t, 4);
  }
  const words = t.split(' ');
  for (let k = 1; k <= 3 && k < words.length; k++) {
    const suffix = words.slice(-k).join(' ');
    if (nameSet.has(suffix) && t.length - suffix.length <= 18) add(suffix, t, 5);
  }
}

const rows = targets.map((s) => {
  const cands = (found.get(s.name.trim()) || []).sort((a, b) => a.rank - b.rank).slice(0, 8);
  return { id: s.id, name: s.name.trim(), area: s.area, cands };
});
fs.writeFileSync(DIR + '/matches-1200.json', JSON.stringify(rows, null, 0));
const withOne = rows.filter((r) => r.cands.length);
console.log('targets', rows.length, 'with candidates', withOne.length);
const dist = {};
for (const r of withOne) dist[r.cands[0].rank] = (dist[r.cands[0].rank] || 0) + 1;
console.log('best rank distribution', JSON.stringify(dist));
console.log(rows.filter((r) => r.cands.length).slice(0, 8).map((r) => r.name + ' -> ' + r.cands.map((c) => c.title + '#' + c.rank).join(' , ')).join('\n'));
