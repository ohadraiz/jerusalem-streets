const cp = require('child_process');
const fs = require('fs');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const P = ROOT + '/data/research/manual-facts.json';

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

const oldText = cp.execSync('git show HEAD~1:data/research/manual-facts.json', { cwd: ROOT, maxBuffer: 60 * 1024 * 1024 }).toString('utf8');
const current = JSON.parse(fs.readFileSync(P, 'utf8'));
const old = JSON.parse(oldText);
const newIds = Object.keys(current.streets).filter((id) => !old.streets[id]);
if (newIds.length !== 200) throw new Error('expected 200 new ids, got ' + newIds.length);
for (const id of newIds) {
  if (JSON.stringify(current.streets[id]) !== JSON.stringify(current.streets[id])) throw new Error('bad ' + id);
}

// insert before the final two closing lines of the streets object
const lines = oldText.replace(/\r\n/g, '\n').split('\n');
let closeIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === '}') { closeIdx = i; break; }
}
if (closeIdx < 1 || lines[closeIdx - 1].trim() !== '}') throw new Error('unexpected file tail');
// ensure last existing street line has a trailing comma before appending
let lastStreet = closeIdx - 2;
while (lastStreet > 0 && !lines[lastStreet].trimEnd().endsWith('}')) lastStreet--;
if (!lines[lastStreet].trimEnd().endsWith(',')) lines[lastStreet] = lines[lastStreet].trimEnd() + ',';
const added = newIds.map((id, i) => '    ' + JSON.stringify(id) + ': ' + spaced(current.streets[id]) + (i === newIds.length - 1 ? '' : ','));
lines.splice(closeIdx - 1, 0, ...added);
const out = lines.join('\n');
const reparsed = JSON.parse(out);
if (JSON.stringify(reparsed) !== JSON.stringify(current)) throw new Error('content mismatch');
fs.writeFileSync(P, out, 'utf8');
console.log('inserted', added.length, 'entries; lines', oldText.split('\n').length, '->', out.split('\n').length);
