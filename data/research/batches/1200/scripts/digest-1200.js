const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const batch = JSON.parse(fs.readFileSync(DIR + '/batch-1200.json', 'utf8'));
const arts = JSON.parse(fs.readFileSync(DIR + '/articles-batch-1200.json', 'utf8'));
const HEAD = /^(ראו גם|לקריאה נוספת|קישורים חיצוניים|הערות שוליים|מקורות|ביאורים|==)/;
function sentences(t) {
  return String(t || '').replace(/\r/g, '').split(/\n+/).filter((p) => p.trim() && !HEAD.test(p.trim())).join(' ')
    .split(/(?<=[.!?])\s+/).map((s) => s.trim())
    .filter((s) => s.length >= 45 && s.length <= 170 && !/==/.test(s));
}
const out = [];
for (const b of batch) {
  const t = (arts[b.id] || {}).text || '';
  const p = t.split(/\n+/).filter(Boolean);
  out.push('## ' + b.id + ' | ' + b.name + ' | ' + b.area + ' | ' + b.title + ' | len=' + t.length);
  out.push('I: ' + (p[0] || '').replace(/\s+/g, ' ').slice(0, 230));
  const sc = sentences(p.slice(1).join('\n')).map((x) => {
    let v = 0;
    if (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(x)) v += 2;
    if (/ראשון|ראשונה|היחיד|היחידה|היחידים/.test(x)) v += 2;
    if (/נהרג|נרצח|נפל|גורש|נעצר|הציל|הקים|ייסד|נבנה|הוקם|נוסד|נקרא|קרוי/.test(x)) v += 1.2;
    return { x, v };
  }).sort((a, b2) => b2.v - a.v).slice(0, 10);
  sc.forEach((s, i) => out.push((i + 1) + ') ' + s.x));
  out.push('');
}
fs.writeFileSync(DIR + '/draft-src-1200.txt', out.join('\n'), 'utf8');
console.log('blocks', batch.length, 'chars', out.join('\n').length);
