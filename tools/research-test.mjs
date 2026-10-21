async function search(q) {
  const url = "https://he.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
    encodeURIComponent(q) + "&format=json&utf8=1&srlimit=5";
  const r = await fetch(url, { headers: { "User-Agent": "JLMStreetJournal/1.0 (local)" } });
  const j = await r.json();
  console.log(q, "=>", j.query && j.query.search ? j.query.search.map((x) => x.title) : j);
}
for (const q of [
  "רחוב הרצל",
  "הרצל ירושלים",
  "רחוב יפו ירושלים",
  "מנחם בגין ירושלים",
  "רחוב איסלנד ירושלים",
  "שמות רחובות ירושלים",
  "קטגוריה:רחובות ירושלים"
]) {
  await search(q);
}
