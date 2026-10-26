const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'Mozilla/5.0 (compatible; JLM research)';
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8')).filter((s) => !idx.has(s.id) && !manual[s.id]);
const pairs = [
  ['מלצר', 'איסר זלמן מלצר'],
  ['נחמה', 'נחמה ליבוביץ'],
  ['טוניק', 'יצחק טוניק (מבקר המדינה)'],
  ['טיכו', 'אברהם אלברט טיכו'],
  ['יערי', 'אברהם יערי'],
  ['קרליבך', 'יוסף צבי קרליבך'],
  ['טובלר', 'טיטוס טובלר'],
  ['לבוש מרדכי', 'משה מרדכי אפשטיין'],
  ['מל"ל', 'משה לייב ליליינבלום'],
  ['מסריק', 'טומאש מסריק'],
];
const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
(async () => {
  const arts = {};
  for (const [street, article] of pairs) {
    const s = unc.find((x) => x.name === street);
    if (!s) { console.log('NO STREET', street); continue; }
    const r = await fetch('https://he.wikipedia.org/wiki/' + encodeURIComponent(article.replace(/ /g, '_')), { headers: { 'User-Agent': UA } });
    const html = await r.text();
    const text = plain(html);
    arts[s.id] = { title: article, text };
    const sents = text.split(/(?<=[.!?])\s+/).filter((x) => x.includes('רחוב') && x.includes('ירושלים') && x.length < 260);
    console.log('\n###', street, '|', s.area, '|', s.id, '|', article, '|', r.status, text.length);
    for (const x of sents.slice(0, 3)) console.log(' -', x.slice(0, 240));
  }
  fs.writeFileSync(DIR + '/articles-batch-1500.json', JSON.stringify(arts));
  console.log('\nsaved', Object.keys(arts).length);
})();
