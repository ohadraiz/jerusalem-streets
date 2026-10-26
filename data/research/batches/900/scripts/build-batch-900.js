const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const pool = require('./pool-900.json');

const bad = /^(האם התכוונתם|פירושונים)|שם משפחה|שם פרטי|הוא מושב|הוא קיבוץ|היא מושב|היא קיבוץ|היא עיר|הוא יישוב|היא התנחלות|הוא כפר|רפובליקה|הוא הר געש|הוא נהר|הוא מחוז|בירת /;
const years = /\b(1[0-9]{3}|20[0-2][0-9])\b/;
const bios = pool.filter((x) => {
  const f = x.first || '';
  if (bad.test(f)) return false;
  const bio = years.test(f.slice(0, 220)) && /[–-]/.test(f.slice(0, 220));
  const jer = /בירושלים/.test(f.slice(0, 160));
  const rel = /^(רבי|הרב|רב |ד״ר|ד"ר|פרופ)/.test(f);
  return bio || jer || rel;
});

const dropBio = new Set(['אמרי קלמן', 'האור', 'הבושם', 'היהודים', 'הקורא', 'התומר', 'התקופה', 'נתיב המזלות', 'מרום ציון', 'קזנובה']);
const chosenBios = bios.filter((x) => !dropBio.has(x.name));

const extraNames = ['אמא שלום', 'אסתר המלכה', 'בית הכרם', 'בית צור', 'ברניקי', 'גדליה', 'גדעון', 'גיחון', 'הר המשחה', 'התקווה', 'החלוץ', 'החסידות', 'החבצלת', 'החורש', 'הטורים', 'הלבנון', 'המ"ג', 'המחתרות', 'הנוטרים', 'הפורצים', 'זרובבל', 'יקים', 'כ"ט בנובמבר', 'כף החיים', 'כפר נחום', 'כפר עציון', 'מבצע קדש', 'מח"ל', 'מקווה ישראל', 'משטרת היישובים', 'משכן שילה', 'משמר הגבול', 'משמר העם', 'משפט דרייפוס', 'נבי שועייב', 'נחלת שמעון', 'סיירת דוכיפת', 'עבודת ישראל', 'עין רוגל', 'פקיעין', 'פרי חדש', 'הגאונים', 'ראשית חכמה', 'רמות פולין', 'שומרי אמונים', 'שמעיה', 'קיבוץ גלויות', 'חטיבת גבעתי'];
const extras = extraNames.map((n) => {
  const x = pool.find((p) => p.name === n);
  if (!x) throw new Error('missing extra ' + n);
  return x;
});

const seen0=new Set();const all=[...chosenBios,...extras].filter(x=>{if(seen0.has(x.id))return false;seen0.add(x.id);return true;});
const ids = new Set(), titles = new Set();
for (const x of all) {
  if (ids.has(x.id)) throw new Error('dup id ' + x.id);
  if (titles.has(x.title)) throw new Error('dup title ' + x.title);
  ids.add(x.id);
  titles.add(x.title);
}
const trimmed = all.map((x) => ({ id: x.id, name: x.name, area: x.area, title: x.title }));
fs.writeFileSync(DIR + '/batch-900.json', JSON.stringify(trimmed, null, 1));
console.log('bios', chosenBios.length, 'extras', extras.length, 'total', trimmed.length);
