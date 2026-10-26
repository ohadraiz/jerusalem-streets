const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const id = 'jlm-18096e09b2cd';
const fact = 'רחוב יצהר בגילה נמנה עם רחובות השכונה הנושאים שמות חקלאיים — דגן, תירוש ויצהר — לצד רחובות פרחים ובשמים.';
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const article = fs.readFileSync(DIR + '/naming-article.txt', 'utf8');
if (!norm(article).includes(norm('יש בה את הרחובות דגן, תירוש ויצהר'))) throw new Error('evidence missing');
const url = 'https://he.wikipedia.org/wiki/' + encodeURIComponent('שמות_רחובות_בירושלים');

const manualPath = ROOT + '/data/research/manual-facts.json';
const manual = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
const entry = manual.streets[id];
if (!entry) throw new Error('no card');
entry.fact = fact;
entry.method = 'topic-article';
entry.sources = [{ label: 'ויקיפדיה העברית — שמות רחובות בירושלים', url, kind: 'content' }];
entry.notes = 'הרחוב נמנה עם קבוצת רחובות בגילה הקרויים על שם תוצרי הארץ; הקישור לקבוצת השמות מתועד במאמר.';

// rewrite manual-facts preserving layout: replace just this entry line
const text = fs.readFileSync(manualPath, 'utf8');
const lines = text.replace(/\r\n/g, '\n').split('\n');
const idx = lines.findIndex((l) => l.trimStart().startsWith('"' + id + '"'));
if (idx < 0) throw new Error('line not found');
function spaced(value) {
  const raw = JSON.stringify(value);
  let out = '';
  let inStr = false, esc = false;
  for (const ch of raw) {
    out += ch;
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === ':' || ch === ',') out += ' ';
  }
  return out;
}
const tail = lines[idx].trimEnd().endsWith(',') ? ',' : '';
lines[idx] = '    ' + JSON.stringify(id) + ': ' + spaced(entry) + tail;
const newText = lines.join('\n');
const check = JSON.parse(newText);
if (check.streets[id].fact !== fact) throw new Error('manual patch failed');
fs.writeFileSync(manualPath, newText, 'utf8');

const txtPath = ROOT + '/data/didyouknow/' + id + '.txt';
let txt = fs.readFileSync(txtPath, 'utf8');
txt = txt.replace(/^fact: .*$/m, () => 'fact: ' + fact)
  .replace(/^source: .*$/m, () => 'source: ' + url)
  .replace(/^method: .*$/m, () => 'method: topic-article');
fs.writeFileSync(txtPath, txt, 'utf8');

const cPath = ROOT + '/data/research/candidates/' + id + '.json';
const c = JSON.parse(fs.readFileSync(cPath, 'utf8'));
c.fact = fact;
c.fact_type = 'topic-article';
c.sources = [{ label: 'ויקיפדיה העברית — שמות רחובות בירושלים', url, kind: 'content' }];
c.notes = [...new Set([...(c.notes || []), 'עודכן: הקישור לקבוצת השמות בגילה מתועד במאמר שמות רחובות בירושלים.'])];
fs.writeFileSync(cPath, JSON.stringify(c, null, 2) + '\n', 'utf8');
console.log('patched', id, fact.length);
