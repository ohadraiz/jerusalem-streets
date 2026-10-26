/**
 * Integrates the 1,200-batch drafts into the repository:
 *  - writes data/didyouknow/<id>.txt
 *  - appends the new entries to data/research/manual-facts.json preserving the existing byte layout
 *  - writes data/research/batch-1200.json
 *  - updates data/didyouknow/index.json
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const batch = JSON.parse(fs.readFileSync(DIR + '/batch-1200.json', 'utf8'));
const arts = JSON.parse(fs.readFileSync(DIR + '/articles-batch-1200.json', 'utf8'));
const files = ['facts-1200-01.json', 'facts-1200-02.json', 'facts-1200-03.json', 'facts-1200-04.json'];
const all = files.flatMap((f) => JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8')));
const byId = new Map(batch.map((b) => [b.id, b]));
const DATE = '2026-10-26';

const manualPath = ROOT + '/data/research/manual-facts.json';
const manualText = fs.readFileSync(manualPath, 'utf8');
const manual = JSON.parse(manualText);
const existing = Object.keys(manual.streets).length;

function spaced(value) {
  const raw = JSON.stringify(value);
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of raw) {
    out += ch;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === ':' || ch === ',') out += ' ';
  }
  return out;
}

let added = 0;
const lines = [];
for (const x of all) {
  const b = byId.get(x.id);
  if (!b) throw new Error('no street ' + x.id);
  if (manual.streets[x.id]) throw new Error('exists ' + x.id);
  const url = 'https://he.wikipedia.org/wiki/' + encodeURIComponent(b.title.replace(/ /g, '_'));
  const sources = [{ label: 'ויקיפדיה העברית — ' + b.title, url, kind: 'content' }];
  const text = (arts[x.id] || {}).text || '';
  const isPerson = /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(text.slice(0, 260)) && /[–-]/.test(text.slice(0, 260));
  manual.streets[x.id] = {
    fact: x.after,
    confidence: 'medium',
    method: isPerson ? 'person-article' : 'topic-article',
    sources,
    notes: 'שם הרחוב זהה לשם האישיות, המקום או המוסד; לא נמצא מאמר רחוב ישיר.',
  };
  lines.push('    ' + JSON.stringify(x.id) + ': ' + spaced(manual.streets[x.id]));
  const txt = [
    'street_id: ' + x.id,
    'street_name: ' + b.name,
    'area: ' + b.area,
    'fact: ' + x.after,
    'source: ' + url,
    'date_researched: ' + DATE,
    'researcher: החוקר',
    'confidence: medium',
    'method: ' + manual.streets[x.id].method,
    '',
  ].join('\n');
  fs.writeFileSync(ROOT + '/data/didyouknow/' + x.id + '.txt', txt, 'utf8');
  added++;
}

// splice the new compact entries into the existing text before the streets-object closer
const outLines = manualText.replace(/\r\n/g, '\n').split('\n');
let closeIdx = -1;
for (let i = outLines.length - 1; i >= 0; i--) {
  if (outLines[i].trim() === '}') { closeIdx = i; break; }
}
let lastStreet = closeIdx - 2;
while (lastStreet > 0 && !outLines[lastStreet].trimEnd().endsWith('}')) lastStreet--;
if (!outLines[lastStreet].trimEnd().endsWith(',')) outLines[lastStreet] = outLines[lastStreet].trimEnd() + ',';
outLines.splice(closeIdx - 1, 0, ...lines.map((l, i) => l + (i === lines.length - 1 ? '' : ',')));
const newText = outLines.join('\n');
const reparsed = JSON.parse(newText);
if (JSON.stringify(reparsed.streets) !== JSON.stringify(manual.streets)) throw new Error('manual mismatch');
fs.writeFileSync(manualPath, newText, 'utf8');

fs.writeFileSync(
  ROOT + '/data/research/batch-1200.json',
  JSON.stringify({ version: 1, streets: batch.map((b) => ({ id: b.id, name: b.name, area: b.area })) }, null, 2) + '\n',
  'utf8'
);

const idxPath = ROOT + '/data/didyouknow/index.json';
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
const set = new Set([...idx.ids, ...batch.map((b) => b.id)]);
const ids = [...set].sort((a, b) => a.localeCompare(b, 'en'));
fs.writeFileSync(idxPath, JSON.stringify({ version: 1, updatedAt: DATE, count: ids.length, ids }, null, 2) + '\n', 'utf8');
console.log('added', added, 'manual', existing, '->', Object.keys(manual.streets).length, 'index', ids.length);
