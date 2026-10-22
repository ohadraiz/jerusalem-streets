const fs = require('fs');
const files = fs.readdirSync('data/didyouknow').filter(x => x.endsWith('.txt')).slice(0, 3);
for (const f of files) {
  const lines = fs.readFileSync('data/didyouknow/' + f, 'utf8').split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const m = line.match(/^([a-z_]+):\s?(.*)$/);
    if (m) obj[m[1]] = m[2];
  }
  console.log(f + ':', obj.street_name || obj.street_id, '-> fact starts with:', (obj.fact || '').slice(0, 60) + '...');
}