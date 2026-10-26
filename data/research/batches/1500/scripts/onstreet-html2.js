/**
 * "What is on the street" — improved pass.
 * Targets ordinary street names in central neighbourhoods (not paths/plazas).
 * Search: "<name> ירושלים" on he.wikipedia HTML, then read up to 4 articles and keep
 * sentences where "רחוב" appears within 80 characters of the street name.
 * Output: onstreet-html2.json
 */
const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'Mozilla/5.0 (compatible; JLM-Street-Journal research)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8')).filter((s) => !idx.has(s.id) && !manual[s.id]);
const central = /^(מרכז העיר|נחלאות|רחביה|קטמון|קטמונים|בית הכרם|טלביה|מחנה ישראל|זכרון משה|גאולה|מאה שערים|בית ישראל|בתי אונגרין|שערי חסד|רוממה|קרית משה|מקור ברוך|ימין משה|נחלת שבעה|המושבה הגרמנית|המושבה היוונית|מוסררה|אבו תור|הרובע היהודי|הרובע הנוצרי|הרובע הארמני|הרובע המוסלמי|עין כרם|בית וגן|רמת בית הכרם|נווה שאנן|פלורנטין)/;
const skip = /(כיכר|טיילת|שביל|חיבור|מעלה |מבוא |דרך |כביש|חניון|כניסה|מגרש|ללא)/;
const targets = unc
  .filter((s) => central.test(s.area) && !skip.test(s.name) && s.name.length >= 4 && s.name.length <= 16 && /^[\u05d0-\u05ea]/u.test(s.name))
  .sort((a, b) => a.area.localeCompare(b.area, 'he') || a.name.localeCompare(b.name, 'he'))
  .slice(0, 70);
const OUT = DIR + '/onstreet-html2.json';
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

function decode(s) {
  return s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}
function plain(html) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
async function get(url) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return await r.text();
      await sleep(3000 * (a + 1));
    } catch (e) { await sleep(1500 * (a + 1)); }
  }
  return '';
}

(async () => {
  let n = 0;
  for (const s of targets) {
    if (store[s.id]) continue;
    const name = s.name.replace(/"/g, '\u05F4').replace(/'/g, '\u05F3');
    const html = await get('https://he.wikipedia.org/w/index.php?search=' + encodeURIComponent(name + ' ירושלים') + '&fulltext=1&ns0=1');
    const titles = [...html.matchAll(/class="mw-search-result-heading"[^>]*>\s*<a[^>]*title="([^"]+)"/g)].map((m) => decode(m[1])).slice(0, 4);
    const hits = [];
    for (const t of titles) {
      if (t === s.name) continue;
      const page = await get('https://he.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')));
      if (!page) continue;
      const text = plain(page);
      if (!text.includes('ירושלים')) continue;
      const sents = text.split(/(?<=[.!?])\s+/).filter((x) => {
        if (x.length < 40 || x.length > 220) return false;
        const i = x.indexOf(s.name);
        if (i < 0) return false;
        const around = x.slice(Math.max(0, i - 90), i + s.name.length + 90);
        return around.includes('רחוב');
      });
      if (sents.length) hits.push({ title: t, sentences: sents.slice(0, 3) });
    }
    store[s.id] = { id: s.id, name: s.name, area: s.area, titles, hits };
    n++;
    if (n % 5 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(store));
      process.stdout.write('done ' + Object.keys(store).length + '/' + targets.length + ' matched ' + Object.values(store).filter((x) => x.hits.length).length + '\n');
    }
    await sleep(1000);
  }
  fs.writeFileSync(OUT, JSON.stringify(store));
  console.log('finished', Object.keys(store).length, 'matched', Object.values(store).filter((x) => x.hits.length).length);
})();
