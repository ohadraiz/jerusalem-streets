/**
 * Editorial triage for the next batch: classifies each selected candidate by subject type
 * and marks whether the article title is an exact match for the street name.
 * Output: triage-1200.json + console summary.
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const sel = JSON.parse(fs.readFileSync(DIR + '/selected-1200.json', 'utf8'));
const arts = JSON.parse(fs.readFileSync(DIR + '/articles-1200.json', 'utf8'));

function kindOf(text, name, title) {
  const head = text.slice(0, 700);
  const work = /(סרט|שיר|ספר|רומן|אופרטה|מחזה|סדרה|אלבום|להקה|מיני.?סדרה|קומדיה|טלנובלה)/;
  const org = /(עמותה|חברה בע|חברה פרטית|רשת |מועדון|מפעל|בית חולים|ישיבה|בית ספר|מכללה|אוניברסיטה|קרן |מכון )/;
  const place = /(עיר|כפר|קיבוץ|מושב|יישוב|נחל|הר |ים |אגם|מדינה|מחוז|שכונה|אתר |מבצר|תל |נפה|עיירה|כפריר)/;
  const person = /\(\s*[^)]*\d{3,4}[^)]*[–-][^)]*\d{3,4}[^)]*\)/.test(head) || /נולד[ה]? ב-?\d{3,4}/.test(head);
  if (person) return 'person';
  if (work.test(head.slice(0, 200))) return 'work';
  if (org.test(head.slice(0, 250))) return 'org';
  if (place.test(head.slice(0, 300))) return 'place';
  return 'generic';
}

const rows = sel.map((s) => {
  const text = ((arts[s.id] || {}).text || '').replace(/\s+/g, ' ');
  const exact = s.title === s.name;
  const streetArticle = s.title.startsWith('רחוב ');
  return { ...s, exact, streetArticle, kind: kindOf(text, s.name, s.title), head: text.slice(0, 220) };
});
const keep = rows.filter((r) => r.exact || r.streetArticle);
const dist = {};
for (const r of rows) dist[r.kind] = (dist[r.kind] || 0) + 1;
console.log('selected', rows.length, JSON.stringify(dist));
console.log('exact or street-article', keep.length);
const kd = {};
for (const r of keep) kd[r.kind] = (kd[r.kind] || 0) + 1;
console.log('among exact:', JSON.stringify(kd));
fs.writeFileSync(DIR + '/triage-1200.json', JSON.stringify(rows, null, 0));
for (const k of ['person', 'place', 'org', 'generic', 'work']) {
  const g = keep.filter((r) => r.kind === k).slice(0, 6);
  if (!g.length) continue;
  console.log('\n[' + k + ']');
  for (const r of g) console.log(' ', r.name, '|', r.area, '|', r.title, '|', r.head.slice(0, 120));
}
