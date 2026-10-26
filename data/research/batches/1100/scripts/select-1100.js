const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const pool = JSON.parse(fs.readFileSync(DIR + '/pool-1100.json', 'utf8'));
const arts = JSON.parse(fs.readFileSync(DIR + '/articles-pool.json', 'utf8'));

const reject = new Set([
  3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 18, 22, 24, 27, 28, 29, 34, 36, 40, 41, 42, 43, 47, 48, 50, 52, 56, 58, 59, 60,
  61, 63, 64, 65, 67, 68, 72, 85, 87, 90, 91, 92, 95, 96, 225, 228, 229, 230, 231, 232, 251, 253, 254, 255, 256, 258,
]);

const sel = pool.filter((x, i) => !reject.has(i + 1));
console.log('selected', sel.length);

const batch = sel.map((x) => ({ id: x.id, name: x.name, area: x.area, title: x.title }));
const articles = {};
for (const x of sel) articles[x.id] = { text: (arts[x.id] || {}).text || '' };

fs.writeFileSync(DIR + '/batch-1100.json', JSON.stringify(batch, null, 0), 'utf8');
fs.writeFileSync(DIR + '/articles-1100.json', JSON.stringify(articles), 'utf8');

// dump for drafting
const HEAD = /^(ראו גם|לקריאה נוספת|קישורים חיצוניים|הערות שוליים|מקורות|ביאורים)/;
function sents(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .filter((p) => p.trim() && !HEAD.test(p.trim()))
    .join(' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 55 && s.length <= 210 && !/==/.test(s) && !/^[\d\s.,;:%-]+$/.test(s));
}
const out = [];
for (const x of sel) {
  const text = (arts[x.id] || {}).text || '';
  const paras = text.split(/\n+/).filter(Boolean);
  const intro = (paras[0] || '').replace(/\s+/g, ' ').slice(0, 250);
  const ranked = sents(paras.slice(1).join('\n'));
  const scored = ranked
    .map((s) => {
      let sc = 0;
      if (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(s)) sc += 2;
      if (/ראשון|ראשונה|היחיד|היחידה|היחידים/.test(s)) sc += 2;
      if (/נהרג|נרצח|נפל|גורש|ברח|נעצר|הוגלה|הציל/.test(s)) sc += 1.5;
      if (/הקים|ייסד|יסד|הקימה|הנהיג|עמד בראש/.test(s)) sc += 1;
      return { s, sc };
    })
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3)
    .map((y) => y.s);
  out.push('### ' + x.id + ' | ' + x.name + ' | ' + x.area + ' | ' + x.title);
  out.push('I: ' + intro);
  scored.forEach((s, i) => out.push('E' + (i + 1) + ': ' + s));
  out.push('');
}
fs.writeFileSync(DIR + '/draft-src.txt', out.join('\n'), 'utf8');
console.log('dump lines', out.length, 'chars', out.join('\n').length);
