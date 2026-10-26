const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const text = fs.readFileSync(DIR + '/naming-article.txt', 'utf8').replace(/\r/g, '');
const flat = text.replace(/\n+/g, ' ');
const sents = flat.split(/(?<=[.!?])\s+/).map((s) => s.trim());
const names = JSON.parse(fs.readFileSync(DIR + '/themed-list.json', 'utf8'));
for (const n of names) {
  const hits = sents.filter((s) => s.includes(n) && /רחוב|קרו|שם/.test(s));
  console.log('\n### ' + n);
  for (const h of hits.slice(0, 2)) console.log(' - ' + h);
}
