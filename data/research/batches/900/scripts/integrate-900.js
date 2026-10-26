const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const batch = require(DIR + '/batch-900.json');
const arts = require(DIR + '/articles-900.json');
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));

const files = ['facts-900-01.json', 'facts-900-02.json', 'facts-900-03.json', 'facts-900-04.json', 'facts-900-05.json', 'facts-900-06.json', 'facts-900-07.json'];
const all = files.flatMap((f) => JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8')));
const byId = new Map(batch.map((b) => [b.id, b]));
const DATE = '2026-10-26';

let added = 0;
for (const x of all) {
  const b = byId.get(x.id);
  if (!b) throw new Error('no street ' + x.id);
  if (manual.streets[x.id]) throw new Error('exists ' + x.id);
  const url = 'https://he.wikipedia.org/wiki/' + encodeURIComponent(b.title.replace(/ /g, '_'));
  const sources = [{ label: 'ויקיפדיה העברית — ' + b.title, url, kind: 'content' }];
  const text = (arts[x.id] || {}).text || '';
  const isPerson = /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(text.slice(0, 260)) && /[–-]/.test(text.slice(0, 260));
  const method = isPerson ? 'person-article' : 'topic-article';
  const notes = 'שם הרחוב זהה לשם האישיות או המוסד; לא נמצא מאמר רחוב ישיר.';
  manual.streets[x.id] = { fact: x.after, confidence: 'medium', method, sources, notes };
  const txt = [
    'street_id: ' + x.id,
    'street_name: ' + b.name,
    'area: ' + b.area,
    'fact: ' + x.after,
    'source: ' + url,
    'date_researched: ' + DATE,
    'researcher: החוקר',
    'confidence: medium',
    'method: ' + method,
    '',
  ].join('\n');
  fs.writeFileSync(ROOT + '/data/didyouknow/' + x.id + '.txt', txt, 'utf8');
  added++;
}

fs.writeFileSync(ROOT + '/data/research/manual-facts.json', JSON.stringify(manual, null, 2) + '\n', 'utf8');
fs.writeFileSync(
  ROOT + '/data/research/batch-900.json',
  JSON.stringify({ version: 1, streets: batch.map((b) => ({ id: b.id, name: b.name, area: b.area })) }, null, 2) + '\n',
  'utf8'
);

const idx = JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8'));
const set = new Set([...idx.ids, ...batch.map((b) => b.id)]);
const ids = [...set].sort((a, b) => a.localeCompare(b, 'en'));
fs.writeFileSync(ROOT + '/data/didyouknow/index.json', JSON.stringify({ version: 1, updatedAt: DATE, count: ids.length, ids }, null, 2) + '\n', 'utf8');
console.log('added', added, 'manual total', Object.keys(manual.streets).length, 'index', ids.length);
