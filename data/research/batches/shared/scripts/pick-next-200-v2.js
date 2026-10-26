const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const good = JSON.parse(fs.readFileSync(DIR + '/unused-good.json', 'utf8'));
const cache = JSON.parse(fs.readFileSync(DIR + '/intro-cache.json', 'utf8'));
const rich = good
  .filter((d) => ((cache[d.title] || {}).extract || '').length >= 180)
  .sort((a, b) => a.name.localeCompare(b.name, 'he'));
const picked = rich.slice(0, 200);
fs.writeFileSync(DIR + '/next-200.json', JSON.stringify(picked, null, 0), 'utf8');
console.log('rich available', rich.length, 'picked', picked.length);
console.log(picked.slice(0, 10).map((x) => x.name).join(', '));
