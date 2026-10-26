const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const sel = JSON.parse(fs.readFileSync(DIR + '/selected-1200.json', 'utf8'));
const arts = JSON.parse(fs.readFileSync(DIR + '/articles-1200.json', 'utf8'));
const rows = sel.filter((s) => s.title === s.name || s.title.startsWith('רחוב '));
rows.sort((a, b) => a.area.localeCompare(b.area, 'he') || a.name.localeCompare(b.name, 'he'));
const out = rows.map((s, i) => {
  const t = ((arts[s.id] || {}).text || '').replace(/\s+/g, ' ');
  return String(i + 1).padStart(3, ' ') + ' | ' + s.name + ' | ' + s.area + ' | ' + s.title + ' | ' + s.len + ' | ' + t.slice(0, 105);
});
fs.writeFileSync(DIR + '/review-1200.txt', out.join('\n'), 'utf8');
console.log('rows', rows.length, 'chars', out.join('\n').length);
