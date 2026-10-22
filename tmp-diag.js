const fs = require('fs');
console.log('=== search for "כרטיס" across app files ===');
for (const p of ['assets/app.js','assets/map.js','assets/ui.js','assets/beta-tools.js','assets/dyk-facts.js','index.html','assets/styles.css']) {
  const s = fs.readFileSync(p, 'utf8');
  let i = -1;
  while ((i = s.indexOf('כרטיס', i + 1)) >= 0) {
    console.log('--- ' + p + ' @' + i);
    console.log(s.substring(Math.max(0, i - 120), i + 120).replace(/\n/g, ' | '));
  }
}
console.log('\n=== .dyk-modal CSS in styles.css ===');
const css = fs.readFileSync('assets/styles.css', 'utf8');
const i = css.indexOf('.dyk-modal {');
console.log(css.substring(i, i + 900));
