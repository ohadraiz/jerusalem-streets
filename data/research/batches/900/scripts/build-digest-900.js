const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const batch = require(DIR + '/batch-900.json');
const arts = require(DIR + '/articles-900.json');

function sents(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .filter((p) => p.trim() && !/^(ראו גם|לקריאה נוספת|קישורים חיצוניים|הערות שוליים|מקורות|ביאורים)/.test(p.trim()))
    .join(' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 45 && s.length <= 240);
}

function score(s) {
  let n = 0;
  if (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(s)) n += 2;
  if (/ראשון|ראשונה|היחיד|היחידה|היחידים|לראשונה|אף אחד|אף אחת|היחידה מסוגה/.test(s)) n += 3;
  if (/נהרג|נרצח|נפל|גורש|ברח|נעצר|נשלח|הוגלה|הציל|הבריח|נמלט|נתפס/.test(s)) n += 2;
  if (/הקים|ייסד|ייסדה|הקימה|יסד|הנהיג|עמד בראש/.test(s)) n += 1.2;
  if (/פרס |עיטור|תואר|דוקטור/.test(s)) n += 0.8;
  if (/[0-9]/.test(s)) n += 0.6;
  return n;
}

const out = [];
for (const b of batch) {
  const text = (arts[b.id] || {}).text || '';
  const paras = text.split(/\n+/).filter(Boolean);
  const intro = (paras[0] || '').trim().slice(0, 520);
  const body = paras.slice(1).join(' ');
  const ss = sents(body);
  const ranked = ss
    .map((s) => ({ s, sc: score(s) }))
    .filter((x) => x.sc >= 2.2)
    .sort((a, x) => x.sc - a.sc)
    .slice(0, 8)
    .map((x) => x.s);
  out.push('### ' + b.id + ' | ' + b.name + ' | ' + b.area + ' | ' + b.title + '\nINTRO: ' + intro + (ranked.length ? '\n' + ranked.map((s) => '- ' + s).join('\n') : '') + '\n');
}
fs.writeFileSync(DIR + '/digest-900.txt', out.join('\n'));
fs.writeFileSync(DIR + '/digest-900.json', JSON.stringify(out));
console.log('entries', out.length, 'chars', out.join('\n').length);
