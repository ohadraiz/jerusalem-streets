const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const store = JSON.parse(fs.readFileSync(DIR + '/story-sources.json', 'utf8'));
const DRAM = /נהרג|נרצח|גורש|נשבה|הציל|נהרס|נשרף|נסגר|הוקם|נבנה|נחנך|נוסד|נפתח|הקים|ייסד|פוצץ|התנקש|נתפס|ברח|עלה|הגיע|ניסה|סירב|אסר|גירש|החרים|חתם|הכריז|נבחר|כיהן|למד|לימד|כתב/;
const rows = [];
for (const [id, s] of Object.entries(store)) {
  const fact = manual[id]?.fact || '';
  if (!s.text || s.text.length < 4000) continue;
  const sents = s.text.split(/(?<=[.!?])\s+/).map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 60 && x.length <= 190 && /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(x) && !/עריכת קוד מקור|\[|ISBN|עמ'|ויקיפדיה|לערך/.test(x));
  const scored = sents.map((x) => {
    let sc = 0;
    if (DRAM.test(x)) sc += 2;
    if (/ראשון|ראשונה|היחיד|היחידה/.test(x)) sc += 2;
    if (/למרות|אלא|בניגוד|בעקבות|כתוצאה/.test(x)) sc += 1;
    const words = x.split(' ').filter((w) => w.length > 3);
    const overlap = words.filter((w) => fact.includes(w)).length / Math.max(1, words.length);
    return { x, sc: sc - overlap * 3 };
  }).sort((a, b) => b.sc - a.sc).slice(0, 3);
  if (!scored.length) continue;
  rows.push({ id, label: s.url.split('/wiki/')[1] || '', len: s.text.length, fact, top: scored });
}
rows.sort((a, b) => b.top[0].sc - a.top[0].sc);
fs.writeFileSync(DIR + '/story-digest.json', JSON.stringify(rows, null, 1));
console.log('candidates', rows.length);
for (const r of rows.slice(0, 22)) {
  console.log('\n###', decodeURIComponent(r.label), '|', r.id, '|', r.len);
  console.log(' NOW:', r.fact);
  for (const s of r.top.slice(0, 2)) console.log('  *', s.x);
}
