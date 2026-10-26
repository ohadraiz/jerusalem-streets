const fs = require('fs');
const DIR = 'C:/Users/ohadr/AppData/Local/Temp/opencode/jlm';
const ROOT = 'C:/Users/ohadr/Documents/Default Project';
const rows = [
  ['jlm-60b16e1692', 'נחמה', 'חומת שמואל', 'נחמה ליבוביץ'],
  ['jlm-1da9dec323', 'טוניק', 'פסגת זאב מזרח', 'יצחק טוניק (מבקר המדינה)'],
  ['jlm-ecee2aa742', 'טיכו', 'נחלת שבעה', 'אברהם אלברט טיכו'],
  ['jlm-a5d941fc9fe6', 'יערי', 'גילה', 'אברהם יערי'],
  ['jlm-f9ae05ebcd', 'קרליבך', 'ארנונה', 'יוסף צבי קרליבך'],
  ['jlm-ee94a36391', 'טובלר', "שייח' ג'ראח", 'טיטוס טובלר'],
  ['jlm-04aa2fde2c', 'לבוש מרדכי', 'גאולה', 'משה מרדכי אפשטיין'],
  ['jlm-8deee3a06b', 'מל"ל', 'המושבה הגרמנית', 'משה לייב ליליינבלום'],
  ['jlm-3f71adc690', 'מסריק', 'המושבה הגרמנית', 'טומאש מסריק'],
];
const idx = new Set(JSON.parse(fs.readFileSync(ROOT + '/data/didyouknow/index.json', 'utf8')).ids);
const manual = JSON.parse(fs.readFileSync(ROOT + '/data/research/manual-facts.json', 'utf8')).streets;
const batch = rows.filter(([id]) => !idx.has(id) && !manual[id]).map(([id, name, area, title]) => ({ id, name, area, title }));
fs.writeFileSync(DIR + '/batch-1500.json', JSON.stringify(batch, null, 0));
console.log('batch', batch.length);
