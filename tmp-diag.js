const fs = require('fs');

console.log('=== assets dir listing (dyk files) ===');
console.log(fs.readdirSync('assets').filter(n => /dyk/.test(n)).join('\n'));

console.log('\n=== app.js: isBeta + streetRow state ===');
const app = fs.readFileSync('assets/app.js', 'utf8');
console.log('isBeta def:', /function isBeta/.test(app));
const m = app.match(/function isBeta[\s\S]{0,300}/);
if (m) console.log(m[0].split('\n').slice(0, 8).join('\n'));

console.log('\napp.js has street__dyk:', app.includes('street__dyk'));
console.log('app.js has data-street-name:', app.includes('data-street-name'));

console.log('\n=== map.js: dyk hook state ===');
const map = fs.readFileSync('assets/map.js', 'utf8');
console.log('map.js has map-popup__dyk:', map.includes('map-popup__dyk'));
console.log('map.js has JLMFacts:', map.includes('JLMFacts'));
console.log('map.js has hover handler:', /mouseover/.test(map));

console.log('\n=== styles.css: dyk styles ===');
const css = fs.readFileSync('assets/styles.css', 'utf8');
console.log('has .street__dyk:', css.includes('.street__dyk'));
console.log('has .dyk-modal:', css.includes('.dyk-modal'));

console.log('\n=== index.html: script tags ===');
fs.readFileSync('index.html', 'utf8').split('\n').forEach((l, i) => {
  if (l.includes('<script src=')) console.log((i + 1) + ': ' + l.trim());
});
