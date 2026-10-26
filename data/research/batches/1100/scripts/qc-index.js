const fs = require('fs');
const cp = require('child_process');
const root = 'C:/Users/ohadr/Documents/Default Project';
const before = JSON.parse(cp.execSync('git show HEAD:data/didyouknow/index.json', { cwd: root, maxBuffer: 10 * 1024 * 1024 }).toString('utf8'));
const after = JSON.parse(fs.readFileSync(root + '/data/didyouknow/index.json', 'utf8'));
const b = new Set(before.ids);
const a = new Set(after.ids);
const added = after.ids.filter((x) => !b.has(x));
const removed = before.ids.filter((x) => !a.has(x));
console.log('before', before.count, 'after', after.count, 'added', added.length, 'removed', removed.length);
console.log('removed ids:', removed.join(',') || 'none');
const batch = new Set(require(root + '/data/research/batch-1100.json').streets.map((s) => s.id));
console.log('added not in batch:', added.filter((x) => !batch.has(x)).join(',') || 'none');
const mm = JSON.parse(cp.execSync('git show HEAD:data/research/manual-facts.json', { cwd: root, maxBuffer: 30 * 1024 * 1024 }).toString('utf8'));
const now = fs.readFileSync(root + '/data/research/manual-facts.json', 'utf8');
const after2 = JSON.parse(now);
let changed = 0;
for (const [id, e] of Object.entries(mm.streets)) {
  if (!after2.streets[id] || after2.streets[id].fact !== e.fact) changed++;
}
console.log('old facts changed:', changed);
console.log('manual before', Object.keys(mm.streets).length, 'after', Object.keys(after2.streets).length);
