const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const sources = JSON.parse(fs.readFileSync(DIR + '/story-sources.json', 'utf8'));
const patches = [
  ['jlm-a9f9ad4e6c', 'עקיבא אזולאי, מראשוני הנוטרים בירושלים, נולד לאב בן 89 ולאם בת 25 — בן למשפחה שעלתה ממרוקו ב-1906. ב-1914, עם פרוץ מלחמת העולם הראשונה, גורש עם משפחתו למצרים רק משום שהיו נתינים זרים.', 'גורש עם בני משפחתו למצרים בשל היותם נתינים זרים'],
  ['jlm-5ab107a2bb', 'רבי חסדאי קרשקש נאסר ב-1378 בברצלונה עם הר״ן והריב״ש בעקבות עלילת שקר. ב-1391, בגזירות קנ״א, נהרג בנו היחיד והוטלו גזירות שמד על יהודי ספרד.', 'נהרג בנו היחיד'],
  ['jlm-c76a52b23b', 'הנצי״ב הגיע לישיבת וולוז׳ין בגיל 11, וכעבור שנתיים וחצי לקח אותו ראש הישיבה כחתן לבתו. ב-1885 ייסד את אגודת ״נס ציונה״ — שלא בידיעתו, ונסגרה כשהמשטרה גילתה אותה.', 'שלא בידיעתו ונסגרה לאחר שהמשטרה גילתה אותה'],
  ['jlm-271e39ffdd', 'אב״א אחימאיר פרסם את מאמרו הראשון בעברית ב-1922, על הגותו של משה הס. ב-1930 הקים את ארגון ברית הבריונים, שהיה ראשון למחות נגד שלטון המנדט — ועל כך נעצר שוב ושוב.', 'בשנת 1930 הקים אחימאיר את ארגון'],
  ['jlm-cc56dfae4f11', 'חיים ולירו ייסד ב-1848 עם שותפים את בנק ולירו ושות׳, הבנק העברי הראשון, שפעל בירושלים. הבנק שרד שנים של פעילות ענפה — ונסגר סופית ב-1915, בעיצומה של מלחמת העולם הראשונה.', 'נסגר הבנק סופית בשנת 1915'],
  ['jlm-09ab6fcb34', 'הרב יוסף חיים זוננפלד עמד ב-1920 בראש מייסדי ועד העיר האשכנזי, שפרש מרבנות ירושלים, ונבחר לרבו הראשון. ב-1927 קיבל את פני נשיא צ׳כוסלובקיה מסריק בביקורו בעיר.', 'נבחר להיות רבו הראשון'],
  ['jlm-26cdf7e563', 'חיים לסקוב עלה ארצה ב-1925 אחרי שאביו, בעל מנסרה, איבד את רכושו במהפכת 1917. במאי 1948 פיקד על הגדוד המשוריין הראשון של צה״ל בקרב לטרון, ולימים היה הרמטכ״ל החמישי.', 'כמפקד הגדוד המשוריין הראשון'],
  ['jlm-e087ec83c7', 'יונה קרמנצקי, מחלוצי תעשיית החשמל באירופה, כיהן כיושב הראש הראשון של קק״ל בשנים 1902–1907. ב-1918, כשפורקה האימפריה האוסטרו־הונגרית, נותקה וינה משטחים שבהם פעלו תחנות הכוח.', 'נותקה וינה משטחים רבים'],
  ['jlm-d62b886d0a', 'ב-1936 גויסו 600 הנוטרים הראשונים; עד 1939 כבר מנו כ-15,000, מהם כ-1,200 בשירות סדיר. ב-1938 הוקמה משטרת היישובים העבריים, אך ההסכם שנועד להכשיר אותה לא נכנס לתוקף — בן־גוריון הטיל עליו וטו.', 'אך לא נכנס לתוקף משום ש דוד בן-גוריון הטיל עליו וטו'],
  ['jlm-b20e0cc3e2', 'מג״ב היה החיל הראשון ששילב נשים כלוחמות מן המניין, ב-1996. ב-2022–2023 לקחה היחידה חלק במבצע שובר גלים, שבו הרגה או עצרה למעלה מ-100 מחבלים, ועל כך קיבלה צל״ש.', 'היחידה לקחה חלק חשוב ב מבצע שובר גלים'],
  ['jlm-0d835a7901', 'יצחק רבין היה ראש הממשלה הראשון שנולד בארץ ישראל, וב-1994 חתם על הסכם השלום עם ירדן. ב-1995 ניסה להעביר תקציבים שנועדו לפיתוח התנחלויות לצרכים חברתיים — רווחה והפחתת אבטלה.', 'ניסה רבין לפעול להעביר תקציבים שנועדו במקור לפיתוח התנחלויות'],
  ['jlm-979a40650e', 'יעקב טהון ייסד ב-1897 בפולין את אגודת הסטודנטים הציונית הראשונה. בין 1919 ל-1930 היה חבר הוועד הלאומי, ובאספת הנבחרים הראשונה כיהן בנשיאותו מטעם הפועל הצעיר.', 'בין השנים 1919 – 1930 היה טהון חבר הוועד הלאומי'],
];
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
function spaced(value) {
  const raw = JSON.stringify(value);
  let out = '', inStr = false, esc = false;
  for (const ch of raw) {
    out += ch;
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === ':' || ch === ',') out += ' ';
  }
  return out;
}
const manualPath = ROOT + '/data/research/manual-facts.json';
const manual = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
let lines = fs.readFileSync(manualPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const errors = [];
for (const [id, fact, ev] of patches) {
  if (!sources[id]) errors.push(['no source', id]);
  else if (!norm(sources[id].text).includes(norm(ev))) errors.push(['evidence', id, ev.slice(0, 40)]);
  if (fact.length > 340) errors.push(['len', id, fact.length]);
  if (!manual.streets[id]) errors.push(['no card', id]);
}
if (errors.length) { console.log('ABORT', JSON.stringify(errors, null, 1)); process.exit(1); }
let ok = 0;
for (const [id, fact] of patches) {
  const entry = manual.streets[id];
  entry.fact = fact;
  const start = lines.findIndex((l) => l.trimStart().startsWith('"' + id + '"'));
  let end = start;
  if (!lines[start].trimEnd().replace(/,$/, '').endsWith('}')) {
    end = start + 1;
    while (end < lines.length && !/^ {4}\},?$/.test(lines[end])) end++;
  }
  const hadComma = lines[end].trimEnd().endsWith(',');
  lines.splice(start, end - start + 1, '    ' + JSON.stringify(id) + ': ' + spaced(entry) + (hadComma ? ',' : ''));
  const txtPath = ROOT + '/data/didyouknow/' + id + '.txt';
  let txt = fs.readFileSync(txtPath, 'utf8');
  txt = txt.replace(/^fact: .*$/m, () => 'fact: ' + fact);
  fs.writeFileSync(txtPath, txt, 'utf8');
  const cPath = ROOT + '/data/research/candidates/' + id + '.json';
  const c = JSON.parse(fs.readFileSync(cPath, 'utf8'));
  c.fact = fact;
  fs.writeFileSync(cPath, JSON.stringify(c, null, 2) + '\n', 'utf8');
  ok++;
}
const text = lines.join('\n');
const check = JSON.parse(text);
for (const [id, fact] of patches) if (check.streets[id].fact !== fact) { console.log('MISMATCH', id); process.exit(1); }
fs.writeFileSync(manualPath, text, 'utf8');
console.log('patched', ok);
