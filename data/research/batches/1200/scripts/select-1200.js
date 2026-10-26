/**
 * Classifies and scores fetched candidate articles, and writes:
 *   selected-1200.json  (candidates worth drafting, sorted by score)
 * Usage: node select-1200.js [limit]
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const cands = JSON.parse(fs.readFileSync(DIR + '/candidates-1200.json', 'utf8'));
const arts = JSON.parse(fs.readFileSync(DIR + '/articles-1200.json', 'utf8'));
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;

const head = (t) => t.slice(0, 400);
function classify(text) {
  if (!text || text.length < 300) return 'empty';
  if (/האם התכוונתם ל|פירושונים/.test(text.slice(0, 600))) return 'disambig';
  if (/^(שם משפחה|שם פרטי|הוא שם (פרטי|משפחה))/.test(text.replace(/^[^\n]*\n+/, '').trim())) return 'name-page';
  if (/הוא שם (פרטי|משפחה) /.test(head(text))) return 'name-page';
  if (/^רשימת /.test(text)) return 'list';
  return 'article';
}

const rows = [];
for (const c of cands) {
  const a = arts[c.id] || {};
  const text = (a.text || '').replace(/\r/g, '');
  const kind = classify(text);
  const years = (text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g) || []).length;
  let score = 0;
  if (kind === 'article') score += 6;
  if (kind === 'list') score += 1;
  score += Math.min(6, Math.floor(text.length / 1500));
  score += Math.min(4, years / 3);
  if (/\d/.test(text)) score += 1;
  if (text.length > 60000) score -= 3;
  if (manual[c.id]) score -= 100;
  rows.push({ ...c, kind, len: text.length, years, score: Math.round(score * 10) / 10, missing: !!a.missing, error: a.error || null });
}

rows.sort((a, b) => b.score - a.score);
const dist = {};
for (const r of rows) dist[r.kind] = (dist[r.kind] || 0) + 1;
console.log('classified', rows.length, JSON.stringify(dist));
const usable = rows.filter((r) => r.kind === 'article' && r.len >= 600 && !r.missing);
console.log('usable article candidates', usable.length, 'of', rows.length);
console.log('top 10:');
for (const r of usable.slice(0, 10)) console.log(' ', r.name.padEnd(14), r.area.padEnd(18), r.len, 'y' + r.years, r.title);
fs.writeFileSync(DIR + '/selected-1200.json', JSON.stringify(usable, null, 0));
fs.writeFileSync(DIR + '/rejected-1200.json', JSON.stringify(rows.filter((r) => r.kind !== 'article' || r.len < 600 || r.missing), null, 0));
console.log('wrote selected-1200.json', usable.length);
