const fs = require('fs');
const root = 'C:/Users/ohadr/Documents/Default Project/';
const m = require(root + 'data/research/manual-facts.json');
const batch = require(root + 'data/research/batch-1100.json').streets;
const issues = [];
for (const s of batch) {
  const f = m.streets[s.id].fact;
  if (/[\u0400-\u04FF]/.test(f)) issues.push(['CYRILLIC', s.name, f]);
  if (/[A-Za-z]{3,}/.test(f.replace(/[A-Za-z\u05F3\u05F4'"\u2013\u2014\-]/g, ''))) issues.push(['LATIN', s.name, f]);
  if (/[()]/.test(f)) issues.push(['PAREN', s.name, f]);
  if (/\s{2,}/.test(f)) issues.push(['SPACE', s.name, f]);
  if (/["']/.test(f)) issues.push(['QUOTE', s.name, f]);
  if (!/[.!?]$/.test(f)) issues.push(['NOPERIOD', s.name, f]);
  if (f.length > 335) issues.push(['LONG', s.name, f.length + '']);
}
console.log('issues', issues.length);
for (const i of issues) console.log(i[0], '|', i[1], '|', i[2]);
const lens = batch.map((s) => m.streets[s.id].fact.length);
console.log('len min', Math.min(...lens), 'max', Math.max(...lens), 'avg', Math.round(lens.reduce((a, b) => a + b, 0) / lens.length));
const srcs = new Set();
for (const s of batch) m.streets[s.id].sources.forEach((x) => srcs.add(x.url));
console.log('unique source urls', srcs.size);
