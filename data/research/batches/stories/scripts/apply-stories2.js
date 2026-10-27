const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const sources = JSON.parse(fs.readFileSync(DIR + '/story-sources.json', 'utf8'));
const patches = [
  ['jlm-bd7d4bff5b', 'הכיכר קיבלה את שמה מקולנוע ״ציון״, שפעל בה מ-1912 עד שנהרס ב-1972. ב-4 ביולי 1975 התפוצץ בה מקרר תופת — הפיגוע הקטלני ביותר בכיכר, שבו נהרגו 15 איש ונפצעו 77.', 'התרחש הפיגוע הקטלני ביותר בכיכר'],
  ['jlm-dffbc9d80c', 'משה זמורה, לימים נשיא בית המשפט העליון הראשון, גויס ב-1912 לחיל התותחנים הגרמני, שירת במלחמת העולם הראשונה ונפצע בחזית המזרחית.', 'גויס לשירות בחיל ה תותחנים'],
  ['jlm-576f21f481', 'אחרי מותו הפתאומי של הרצל ב-1904 נותרה התנועה הציונית בלי מנהיג, ובמאי 1905 נבחרו ורבורג, נורדאו ווולפסון כצוות הנהגה. שנה לאחר מכן היה ורבורג בין מייסדי בצלאל ומינה את בוריס שץ למנהלו.', 'בעקבות מותו הפתאומי של הרצל'],
  ['jlm-35956954c6', 'דוד גויטיין, לימים שופט בית המשפט העליון ושגריר ישראל הראשון בדרום אפריקה, עלה ארצה ב-1929 בעקבות אורה מויאל — אחותו של אל״ם אהרון מויאל — שאותה פגש בתנועת הבונים.', 'עלה בעקבותיה בשנת 1929'],
  ['jlm-b0fc5e9bc1', 'זבולון המר כיהן כסגן שר החינוך, ובנובמבר 1975 — חודשים אחרי פטירתו של השר יעקב מיכאל חזני — נבחר למלא את מקומו ונכנס לראשונה לממשלה כשר הסעד.', 'נבחר המר למלא את מקומו'],
  ['jlm-7528df4b8f10', 'בקונגרס הציוני הראשון בבזל, 1897, נבחר שמואל פינלס לסגן נשיא — לצד מקס נורדאו ואברהם זאלץ. פינלס נמנה עם מפעילי קונגרס פוקשאן, מכינוסיה המוקדמים של התנועה הציונית.', 'נבחר פינלס כסגן נשיא'],
  ['jlm-a7bc45c6f7', 'ב-1987 הכריז הרב ברוך אבוחצירא, בביקור בקריית אתא, על מציאת הקבר המיוחס לרבי יהודה בן בבא — תנא מהדור השלישי ומעשרת הרוגי מלכות.', 'על מציאת הקבר המיוחס לבן בבא'],
  ['jlm-ba00f16514', 'השל״ה גורש מפרנקפורט ב-1614, שב לפראג ושימש בה ברבנות, וב-1622 יצא למסע רגלי ארוך — דרך חלב שבסוריה — עד ירושלים, שם התקבל בכבוד רב.', 'הגיע דרך העיר חלב'],
  ['jlm-01d661f4d9', 'חנוך אלבק, מחוקרי המשנה הבולטים, לימד בשנים 1926–1936 בבית המדרש הגבוה ללימודי יהדות בברלין, וב-1969 זכה בפרס ביאליק על ספרו ״מבוא לתלמודים״.', 'בין 1926 ל- 1936 לימד'],
  ['jlm-8a18a139d6', 'עם שחרורו של רזיאל מהכלא באוקטובר 1939 ושחרור חברי מפקדת האצ״ל ביוני 1940, הגיעו הדברים לעימות גלוי בין רזיאל לשטרן — והפילוג באצ״ל היה לעובדה מוגמרת.', 'הפילוג באצ"ל היה לעובדה מוגמרת'],
  ['jlm-c3bf361a17', 'חטיבת גבעתי הוקמה מחדש ב-1983 כחטיבת חי״ר סדירה שלישית. אחרי הנסיגה מלבנון ב-2000 עברה לפיקוד הדרום והוצבה בעזה, והובילה מבצעים שבהם נהרגו מאות מחבלים.', 'בעקבות הנסיגה מלבנון בשנת 2000'],
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
