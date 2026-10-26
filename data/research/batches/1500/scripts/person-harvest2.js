const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const UA = 'Mozilla/5.0 (compatible; JLM-Street-Journal research)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
const plain = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const unc = JSON.parse(fs.readFileSync(ROOT + '/data/research/batches/shared/uncovered-724.json', 'utf8')).filter((s) => !idx.has(s.id) && !manual[s.id]);
const normName = (n) => n.replace(/["'׳״]/g, '').trim();
async function get(url) {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) return await r.text(); await sleep(2500 * (a + 1)); } catch (e) { await sleep(1200 * (a + 1)); }
  }
  return '';
}
(async () => {
  const existing = JSON.parse(fs.readFileSync(DIR + '/person-titles.json', 'utf8'));
  const titles = new Set(existing);
  const queries = ['"נקרא על שמו רחוב"', '"על שמה רחוב"', '"רחוב על שמו"', '"הקרוי על שמו" ירושלים', '"הנצחה" "רחוב" ירושלים', '"על שמו קרוי" ירושלים'];
  for (const q of queries) {
    for (let off = 0; off < 150; off += 50) {
      const html = await get('https://he.wikipedia.org/w/index.php?search=' + encodeURIComponent(q) + '&fulltext=1&ns0=1&offset=' + off);
      const found = [...html.matchAll(/class="mw-search-result-heading"[^>]*>\s*<a[^>]*title="([^"]+)"/g)].map((m) => decode(m[1]));
      if (!found.length) break;
      for (const t of found) titles.add(t);
      await sleep(700);
    }
  }
  console.log('titles now', titles.size);
  const byName = new Map();
  for (const s of unc) { const n = normName(s.name); if (n.length >= 3 && n.length <= 20) byName.set(n, s); }
  const matched = [];
  for (const t of titles) {
    for (const tok of t.split(/[\s(),–-]+/).map(normName).filter((x) => x.length >= 3)) {
      const st = byName.get(tok);
      if (st && !matched.some((m) => m.id === st.id)) matched.push({ id: st.id, name: st.name, area: st.area, article: t });
    }
  }
  console.log('matched', matched.length);
  const out = [];
  for (const m of matched) {
    const html = await get('https://he.wikipedia.org/wiki/' + encodeURIComponent(m.article.replace(/ /g, '_')));
    if (!html) continue;
    const text = plain(html);
    if (!text.includes('ירושלים')) continue;
    const sents = text.split(/(?<=[.!?])\s+/).filter((x) => x.includes('רחוב') && (x.includes('ירושלים') || /נקרא|קרוי|קרויה|קרויים/.test(x)) && x.length >= 40 && x.length <= 240);
    if (sents.length) out.push({ ...m, sentences: sents.slice(0, 3) });
    if (out.length % 5 === 0) fs.writeFileSync(DIR + '/person-streets2.json', JSON.stringify(out, null, 0));
    await sleep(800);
  }
  fs.writeFileSync(DIR + '/person-streets2.json', JSON.stringify(out, null, 0));
  console.log('kept', out.length);
})();
