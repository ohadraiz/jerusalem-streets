const b = new Set(require('C:/Users/ohadr/Documents/Default Project/data/research/batch-1100.json').streets.map((s) => s.id));
const m = require('C:/Users/ohadr/Documents/Default Project/data/research/manual-facts.json');
const prot = ['זכרון טוביה', 'אהל משה', 'המערבים', 'מאוריצי גוטליב', 'פלוגת הכותל', 'כובשי קטמון', 'בית דוד', 'סוכת שלום', 'עץ חיים', 'דרך גן החיות'];
for (const name of prot) {
  const hits = Object.entries(m.streets).filter(([, e]) => e.fact.includes(name)).map(([id]) => id + (b.has(id) ? '(NEW)' : ''));
  if (hits.length) console.log(name, '->', hits.join(', '));
}
