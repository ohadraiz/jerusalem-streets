const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const factsDir = path.join(root, 'data', 'didyouknow');
const files = fs.readdirSync(factsDir).filter(x => x.endsWith('.txt')).slice(0, 3);
for (const f of files) {
  const lines = fs.readFileSync(path.join(factsDir, f), 'utf8').split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const m = line.match(/^([a-z_]+):\s?(.*)$/);
    if (m) obj[m[1]] = m[2];
  }
  console.log(f + ':', obj.street_name || obj.street_id, '-> fact starts with:', (obj.fact || '').slice(0, 60) + '...');
}
