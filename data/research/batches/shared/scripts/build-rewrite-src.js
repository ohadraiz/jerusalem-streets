const fs = require('fs');
const { execFileSync } = require('child_process');
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const man = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8'));
const oldIds = new Set(JSON.parse(execFileSync('git', ['show', 'HEAD:data/didyouknow/index.json'], { cwd: ROOT, encoding: 'utf8' })).ids);
const cache = JSON.parse(fs.readFileSync(DIR + '/intro-cache.json', 'utf8'));

function titleFromUrl(u) {
  const m = u.match(/\/wiki\/(.+)$/);
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : '';
}

const rows = [];
for (const [id, v] of Object.entries(man.streets)) {
  if (oldIds.has(id)) continue;
  const src = (v.sources || []).find((s) => s.kind === 'content');
  const title = src ? titleFromUrl(src.url) : '';
  const intro = (cache[title] || {}).extract || '';
  rows.push({ id, name: '', fact: v.fact, title, intro, len: v.fact.length });
}
// names/areas from data
const vm = require('vm');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(ROOT + '/assets/data.js', 'utf8'), sb);
const byId = new Map(sb.window.JLM_DATA.streets.map((s) => [s.id, s]));
for (const r of rows) { const s = byId.get(r.id); r.name = s ? s.name : ''; r.area = s ? s.area : ''; }

const KW = ['ראשון', 'ראשונה', 'היחיד', 'היחידה', 'האחרון', 'נהרג', 'נרצח', 'בגיל', 'פרס', 'שיא', 'ייסד', 'הקים', 'חיבר', 'כתב', 'גילה', 'המציא', 'התנקש', 'מבצע', 'נכלא', 'הציל', 'מייסד', 'ממייסדי', 'חתן', 'כלת', 'אישה', 'היהודי', 'עלה', 'העפיל', 'מחתרת', 'לוחם'];
let noHook = 0, withHook = 0;
for (const r of rows) {
  r.hookScore = KW.filter((k) => r.intro.includes(k)).length;
  r.digits = (r.intro.match(/\d/g) || []).length;
  if (r.hookScore === 0 && r.digits < 6) noHook++; else withHook++;
}
fs.writeFileSync(DIR + '/rewrite-src.json', JSON.stringify(rows, null, 0), 'utf8');
console.log('rows', rows.length, 'withHook', withHook, 'noHook', noHook);
console.log('missing intro', rows.filter((r) => !r.intro).length);
const short = rows.filter((r) => r.len < 90);
console.log('short facts', short.length);
// distribution of hook score
const dist = {};
for (const r of rows) dist[r.hookScore] = (dist[r.hookScore] || 0) + 1;
console.log('hookScore dist', JSON.stringify(dist));
// sample low-hook
console.log('\n-- low hook sample --');
for (const r of rows.filter((x) => x.hookScore <= 1).slice(0, 12)) {
  console.log('[' + r.id + '] ' + r.name + ' | ' + r.title);
  console.log('  fact: ' + r.fact);
  console.log('  intro: ' + r.intro.slice(0, 300));
}
