const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const ids = ['jlm-bc384a0f3a', 'jlm-eab0857671'];
const fresh = {};
for (const f of ['facts-1100-05.json', 'facts-1100-07.json']) {
  for (const x of JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8'))) fresh[x.id] = x;
}
const manualPath = ROOT + '/data/research/manual-facts.json';
const manual = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
for (const id of ids) {
  const fact = fresh[id].after;
  manual.streets[id].fact = fact.replace(/\s+/g, ' ').trim();
  const txtPath = ROOT + '/data/didyouknow/' + id + '.txt';
  const txt = fs.readFileSync(txtPath, 'utf8').replace(/^fact: .*$/m, () => 'fact: ' + manual.streets[id].fact);
  fs.writeFileSync(txtPath, txt, 'utf8');
  const cPath = ROOT + '/data/research/candidates/' + id + '.json';
  const c = JSON.parse(fs.readFileSync(cPath, 'utf8'));
  c.fact = manual.streets[id].fact;
  fs.writeFileSync(cPath, JSON.stringify(c, null, 2) + '\n', 'utf8');
  console.log(id, manual.streets[id].fact.length, 'ok');
}
fs.writeFileSync(manualPath, JSON.stringify(manual, null, 2) + '\n', 'utf8');
