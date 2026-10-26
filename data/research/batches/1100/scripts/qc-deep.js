const cp = require('child_process');
const root = 'C:/Users/ohadr/Documents/Default Project';
const before = JSON.parse(cp.execSync('git show HEAD~1:data/research/manual-facts.json', { cwd: root, maxBuffer: 60 * 1024 * 1024 }).toString('utf8'));
const after = JSON.parse(cp.execSync('git show HEAD:data/research/manual-facts.json', { cwd: root, maxBuffer: 60 * 1024 * 1024 }).toString('utf8'));
const b = Object.keys(before.streets);
const a = Object.keys(after.streets);
const missing = b.filter((id) => !after.streets[id]);
console.log('before', b.length, 'after', a.length, 'missing', missing.length);
let deepChanged = 0;
const sample = [];
for (const id of b) {
  const x = JSON.stringify(before.streets[id]);
  const y = JSON.stringify(after.streets[id]);
  if (x !== y) { deepChanged++; if (sample.length < 5) sample.push(id); }
}
console.log('old entries with any change:', deepChanged, sample.join(','));
console.log('top-level keys before', Object.keys(before).join(','), '| after', Object.keys(after).join(','));
