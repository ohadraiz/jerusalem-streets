const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'Mozilla/5.0 (compatible; JLM-Street-Journal research)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8')).filter((s) => !idx.has(s.id) && !manual[s.id]);
const areas = /^(מאה שערים|בתי אונגרין|בית ישראל|גאולה|נחלאות|זכרון משה|שערי חסד|מחנה ישראל|הבוכרים|בית וגן|קרית משה|רוממה)$/;
const skip = /(כיכר|טיילת|שביל|חיבור|מעלה |מבוא |דרך |כביש|חניון|כניסה|מגרש|ללא)/;
const targets = unc.filter((s) => areas.test(s.area) && !skip.test(s.name) && s.name.length >= 4 && s.name.length <= 16).sort((a, b) => a.area.localeCompare(b.area, 'he')).slice(0, 45);
const OUT = DIR + '/onstreet-shuls.json';
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
const plain = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
async function get(url) {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) return await r.text(); await sleep(3000 * (a + 1)); } catch (e) { await sleep(1500 * (a + 1)); }
  }
  return '';
}
(async () => {
  let n = 0;
  for (const s of targets) {
    if (store[s.id]) continue;
    const name = s.name.replace(/"/g, '\u05F4').replace(/'/g, '\u05F3');
    const html = await get('https://he.wikipedia.org/w/index.php?search=' + encodeURIComponent(name + ' בית כנסת ירושלים') + '&fulltext=1&ns0=1');
    const titles = [...html.matchAll(/class="mw-search-result-heading"[^>]*>\s*<a[^>]*title="([^"]+)"/g)].map((m) => decode(m[1])).slice(0, 3);
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
        return around.includes('רחוב') || around.includes('בית כנסת');
      });
      if (sents.length) hits.push({ title: t, sentences: sents.slice(0, 3) });
    }
    store[s.id] = { id: s.id, name: s.name, area: s.area, titles, hits };
    n++;
    if (n % 5 === 0) { fs.writeFileSync(OUT, JSON.stringify(store)); process.stdout.write('done ' + Object.keys(store).length + '/' + targets.length + ' matched ' + Object.values(store).filter((x) => x.hits.length).length + '\n'); }
    await sleep(1000);
  }
  fs.writeFileSync(OUT, JSON.stringify(store));
  console.log('finished', Object.keys(store).length, 'matched', Object.values(store).filter((x) => x.hits.length).length);
})();
