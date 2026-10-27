const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const list = JSON.parse(fs.readFileSync(DIR + '/story-fetch-list.json', 'utf8'));
const OUT = DIR + '/story-sources.json';
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const UA = 'Mozilla/5.0 (compatible; JLM research)';
const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
(async () => {
  let n = 0;
  for (const r of list) {
    if (store[r.id]) continue;
    try {
      const res = await fetch(r.url, { headers: { 'User-Agent': UA } });
      store[r.id] = { id: r.id, url: r.url, fact: r.fact, text: plain(await res.text()) };
    } catch (e) {
      store[r.id] = { id: r.id, url: r.url, fact: r.fact, text: '', error: e.message };
    }
    n++;
    if (n % 20 === 0) { fs.writeFileSync(OUT, JSON.stringify(store)); process.stdout.write('fetched ' + Object.keys(store).length + '/' + list.length + '\n'); }
    await new Promise((res) => setTimeout(res, 550));
  }
  fs.writeFileSync(OUT, JSON.stringify(store));
  console.log('done', Object.keys(store).length);
})();
