const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8'));
const names = ['החרושת', 'היוזמה', 'הבנאי', 'מבוא רפידים', 'מבוא תמנע', 'עין גדי', 'כפר השילוח', 'היען', 'החסידה', 'החלמית', 'הכרכום', 'הביכורים', 'החצוצרות', 'חברת ש"ס', 'רבי אריה', 'המייסדים'];
const batch = [];
for (const n of names) {
  const s = unc.find((x) => x.name.trim() === n && !idx.has(x.id) && !manual[x.id]);
  if (!s) { console.log('MISSING', n); continue; }
  batch.push({ id: s.id, name: s.name, area: s.area, title: 'שמות רחובות בירושלים' });
}
fs.writeFileSync(DIR + '/batch-1400.json', JSON.stringify(batch, null, 0));
const text = fs.readFileSync(DIR + '/naming-article.txt', 'utf8');
const arts = {};
for (const b of batch) arts[b.id] = { title: b.title, text };
fs.writeFileSync(DIR + '/articles-batch-1400.json', JSON.stringify(arts, null, 0));
console.log('batch', batch.length, batch.map((b) => b.name + '/' + b.area + '/' + b.id).join(' | '));
