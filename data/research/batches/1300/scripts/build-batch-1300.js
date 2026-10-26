const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const rows = [
  ['jlm-93ef07ce27', 'המצור', 'סן סימון'],
  ['jlm-54ee3d6525', 'המשוריינים', 'קטמון הישנה'],
  ['jlm-73174fdaa4', 'השיירות', 'סן סימון'],
  ['jlm-39900f8cc3', 'הנבל', 'הרובע היהודי'],
  ['jlm-ee7b4243e8', 'העומר', 'הרובע היהודי'],
  ['jlm-34a740eff5', 'הנחושת', 'אזור תעשיה עטרות'],
  ['jlm-3b58729f0d', 'הנמר', 'מלחה'],
  ['jlm-805d48e5a6', 'השועל', 'מלחה'],
  ['jlm-1400bbe79a', 'הסדנא', 'תלפיות'],
  ['jlm-cea4b8d8df', 'האומן', 'תלפיות'],
  ['jlm-045d4a2ca0', 'הסתת', 'רמת בית הכרם'],
  ['jlm-6d4b062e7f84', 'הסיגלית', 'גילה'],
  ['jlm-3b860d1bf1dc', 'הצבעוני', 'גילה'],
  ['jlm-39fd61aa3b23', 'הרוזמרין', 'גילה'],
  ['jlm-e585f95754', 'השליו', 'גילה'],
  ['jlm-3600d555c5', 'הנורית', 'עיר גנים'],
  ['jlm-b9af354323', 'הצלף', 'עיר גנים'],
  ['jlm-086d418411', 'השלכת', 'עיר גנים'],
  ['jlm-43571348b2', 'התפוח', 'נחלאות'],
  ['jlm-5821545997', 'השזיף', 'נחלאות'],
  ['jlm-8404e038f0', 'הקבלן', 'הר נוף'],
  ['jlm-89e5fb1d7d', 'בית הדפוס', 'קרית משה'],
  ['jlm-4e3d27ea31', 'האופה', 'גבעת שאול'],
  ['jlm-68ae0479cc', 'בעל השאילתות', 'גבעת שאול'],
  ['jlm-cefd5f1a95', 'רב שרירא גאון', 'גבעת שאול'],
  ['jlm-9e70f95726', 'גדוד מכמש', 'פסגת זאב מרכז'],
  ['jlm-b5d027e785', 'האדריכל', 'רוממה'],
  ['jlm-523d48d4df3b', 'גזר', 'נחלאות'],
  ['jlm-a3d7395dfc', 'יזרעאל', 'נחלאות'],
  ['jlm-3baa6c28b3', 'הפרטיזנים', 'הגבעה הצרפתית'],
  ['jlm-f0a259a9d0', 'הצייר יוסי', 'רמת דניה'],
  ['jlm-00e69fb6c0', 'קובובי', 'רמת דניה'],
  ['jlm-5e71493f95cb', 'כנרת', 'מקור ברוך'],
  ['jlm-efb251da07', 'נתיב המזלות', 'פסגת זאב צפון'],
  ['jlm-b63f4ecb07', 'מעגלות הרב פרדס', 'נווה יעקב'],
  ['jlm-ee49ad6304ad', 'מעלות המחנך', 'בית הכרם'],
  ['jlm-956fcaf49b', 'מפעלות', 'אזור תעשיה עטרות'],
  ['jlm-0e5ea1213c', 'שמחת כהן', 'חומת שמואל'],
  ['jlm-5f4244a436', 'תורה מציון', 'רוממה'],
  ['jlm-76a2d144f0', 'נחשון', 'גבעת חנניה'],
  ['jlm-d232618900', 'עובד', 'גבעת חנניה'],
  ['jlm-933c972f01', 'שמעוני', 'רסקו (גבעת הוורדים)'],
  ['jlm-6a5d3cfee3', 'קדושי בבל', 'תלפיות מזרח'],
  ['jlm-b862cb4f43', 'תירוש', 'גילה'],
];
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const batch = rows.filter(([id]) => !idx.has(id) && !manual[id]).map(([id, name, area]) => ({ id, name, area, title: 'שמות רחובות בירושלים' }));
if (batch.length !== rows.length) console.log('WARNING: filtered', rows.length - batch.length);
fs.writeFileSync(DIR + '/batch-1300.json', JSON.stringify(batch, null, 0));
const text = fs.readFileSync(DIR + '/naming-article.txt', 'utf8');
const arts = {};
for (const b of batch) arts[b.id] = { title: b.title, text };
fs.writeFileSync(DIR + '/articles-batch-1300.json', JSON.stringify(arts, null, 0));
console.log('batch', batch.length, 'article chars', text.length);
