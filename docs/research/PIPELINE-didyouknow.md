# Pipeline "הידעת?" — תיעוד תפעולי

**מטרה:** לייצר עובדה אחת מגובת-מקור לכל רחוב מתוך 2,424 הרחובות ב-`assets/data.js`, בקובץ `data/didyouknow/<street-id>.txt`.

**סטטוס (2026-10-22):** פיילוט 50 הרחובות הושלם — 50/50 אושרו, 0 נדחו, ו-50 קבצים סופיים נכתבו ל-`data/didyouknow/`. דוח הבקרה: `docs/research/pilot-50-qa.md`.

---

## 1. מקורות

| מקור | מה נותן | רישיון/מגבלה | קצב |
|------|---------|---------------|------|
| ויקיפדיה העברית | ערך על הרחוב / השכונה / האדם שעל שמו | CC BY-SA 4.0; ייחוס חובה | בקשה כל 1.0 שנייה |
| ויקיפדיה האנגלית | מקור תוכן משני כשהוא קיים | CC BY-SA 4.0 | בקשה כל 1.0 שנייה |
| Wikidata | זיהוי הישות, קואורדינטות, שנות חיים, קישורים | CC0 | בקשה כל 1.2 שנייה |
| OSM / Nominatim | אימות שהרחוב קיים, שם, סוג, מרחק מהנקודה שלנו | ODbL; ייחוס `© OpenStreetMap contributors` | בקשה כל 1.5 שנייה |
| data.gov.il — "רשימת רחובות ישראל" | שם רשמי + סמל רחוב של ירושלים (4,383 רשומות) | נתוני ממשלה פתוחים | בקשה כל 0.6 שנייה, נטען פעם אחת |

**לא בשימוש:** שכבות GIS עירוניות (`odata.org.il`) — מוקפאות עד אישור רישיון כתוב (החלטה 040/042 ב-`docs/agents/BOARD.md`).

---

## 2. ארכיטקטורה

```
assets/data.js
     │  (2,424 רחובות: id, name, area, lat, lng)
     ▼
┌─────────────────────────────────────────────────────────┐
│ research-didyouknow.js                                  │
│                                                         │
│  1. officialMatches()  ← data.gov.il (cache יומי)        │
│  2. findWikipedia()    ← he.wikipedia (עמוד + חיפוש)     │
│  3. findEnglishWiki()  ← langlinks → en.wikipedia        │
│  4. findWikidata()     ← wbsearchentities + wbgetentities│
│  5. findOsm()          ← Nominatim                       │
│                                                         │
│  Rate limiter לכל host  →  Cache בדיסק (30 יום)          │
│  Retry עם backoff על 429/5xx                             │
└─────────────────────────────────────────────────────────┘
     │
     ▼
data/research/candidates/<id>.json   ← כל המקורות + טיוטת עובדה
     │
     ▼  (בדיקה ידנית → data/research/manual-facts.json)
node tools/research-didyouknow.js --review --list data/research/pilot-50.json
     │
     ▼  (שער איכות; נכתב review_status=approved)
data/research/pilot-50-review.json   ← סטטוס בדיקה לכל רחוב
     │
     ▼  node tools/research-didyouknow.js --promote-all --list data/research/pilot-50.json
data/didyouknow/<id>.txt
```

### הרצה אוטומטית מלאה (עתידי)

```bash
node tools/research-didyouknow.js --all
# עצירה באמצע: Ctrl+C — נשמר progress, והרצה חוזרת ממשיכה מהמקום שבו עצרה
node tools/research-didyouknow.js --all
```

### פקודות

```bash
node tools/research-didyouknow.js --init
# טוען את רשימת הרחובות הרשמית של ירושלים

node tools/research-didyouknow.js --list data/research/pilot-50.json
# מריץ את הפיילוט (50 רחובות)

node tools/research-didyouknow.js --only yafo,ben-yehuda --force
# בדיקה ממוקדת, גם אם כבר קיים candidate

node tools/research-didyouknow.js --all --limit 100
# 100 רחובות ראשונים מהרשימה המלאה

node tools/research-didyouknow.js --report
# סיכום התקדמות

node tools/research-didyouknow.js --promote yafo
# כותב קובץ סופי רק אם קיים candidate עם עובדה ומקור תוכן

node tools/research-didyouknow.js --review --list data/research/pilot-50.json
# ממזג את manual-facts.json ל-candidates, מסמן review_status=approved,
# וכותב דוח בקרה ל-data/research/pilot-50-review.json

node tools/research-didyouknow.js --promote-all --list data/research/pilot-50.json
# כותב .txt לכל רחוב שאושר ידנית ויש לו מקור תוכן
```

### דגלים

| דגל | משמעות |
|-----|--------|
| `--force` | לא מדלג על רחוב שכבר יש לו candidate |
| `--refresh-cache` | מתעלם מהמטמון ומוריד מחדש |
| `--dry-run` | לא כותב candidates/progress |
| `--no-nominatim` | מפסיק את מקור OSM (למצב חסום/מהיר) |
| `--limit N` | מגביל מספר רחובות |
| `--review` | ממזג עובדות ידניות ומריץ שערי איכות (דורש `--list`) |
| `--promote-all` | כותב את כל הקבצים המאושרים (דורש `--list`) |

---

## 3. Rate limiting, caching, resume

- **Rate limiting:** תור סדרתי לכל host עם מרווח מינימלי. ויקימדיה 1.0–1.2 שניות, Nominatim 1.5 שניות. אין מקבילות בתוך אותו host.
- **Retry:** עד 3 ניסיונות; על `429` מכבד `Retry-After` (עד 60 שניות) ואז backoff. על `5xx`/רשת — 1.5s, 3s.
- **Cache:** `data/research/cache/<host>/<sha256(url)>.json`; TTL 30 יום (רשמי: 7 יום). `--refresh-cache` לעקיפה. המטמון לא נכנס לגיט.
- **Resume:** `data/research/progress.json` נכתב אחרי כל רחוב. הרצה חוזרת מדלגת על `status=ok` עם candidate קיים. `Ctrl+C` מסיים את הרחוב הנוכחי ושומר.
- **כשל בודד לא עוצר את הריצה:** רחוב שנכשל מסומן `error` עם `lastError`, והריצה ממשיכה.

---

## 4. שערי איכות (0 המצאות)

לכל רחוב נשמרים ב-candidate:

- `official[]` — התאמה לרשימה הרשמית (סמל רחוב).
- `wikipedia` — הערך שנבחר, ציון התאמה ונימוקים, ותמצית.
- `wikidata` — ישות מקום/אדם, קואורדינטה ומרחק.
- `osm` — אובייקט OSM, מרחק מהנקודה שלנו.
- `fact`, `fact_type`, `confidence`, `sources[]`, `notes[]`.

**שיטות העובדה בקובץ הסופי:**

| `method` | מתי | אמון טיפוסי |
|-----|-----|------|
| `street-article` | ערך ויקיפדיה על הרחוב עצמו | high |
| `municipal-street-page` | דף הרחוב הרשמי של עיריית ירושלים | high |
| `municipal+street-article` | דף עירוני + ערך רחוב | high |
| `municipal+person-article` | דף עירוני + ערך אדם | high |
| `municipal+place-article` | דף עירוני + ערך מקום | high |
| `person-article` | ערך על האדם שעל שמו הרחוב; הקריאה בשם מבוססת התאמת שם | medium |
| `place-article` | ערך על המקום/השכונה שעל שמם הרחוב | medium |
| `history-article` | ערך על אירוע היסטורי שהרחוב מנציח | high |

**כלל ברזל:** עובדה שלא ניתן לגזור מהמקור — לא נכתבת. אם אין מקור תוכן, הרחוב נשאר `no-fact` ומועבר לטיפול ידני. `medium` אינו אומר שהעובדה מוטלת בספק; הוא אומר שהקישור בין שם הרחוב לדמות/למקום לא נתמך במשפט קריאה מפורש.

**כלל ברזל:** עובדה שלא ניתן לגזור מהמקור — לא נכתבת. אם אין מקור תוכן, הרחוב נשאר `no-fact` ומועבר לטיפול ידני.

---

## 5. פורמט הפלט

`data/didyouknow/<street-id>.txt`:

```
street_id: yafo
street_name: יפו
area: נחלאות
fact: רחוב יפו נסלל ב-1869 לקראת ביקור הקיסר פרנץ יוזף, ומאז 2007 חלקו הוא המדרחוב הארוך בישראל — כ-1.5 קילומטרים בין כיכר צה"ל לשוק מחנה יהודה.
source: https://he.wikipedia.org/wiki/%D7%A8%D7%97%D7%95%D7%91_%D7%99%D7%A4%D7%95
source: https://www.wikidata.org/wiki/Q2091860
source: https://data.gov.il/dataset/321
source: https://www.openstreetmap.org/way/263353093
date_researched: 2026-10-22
researcher: החוקר
confidence: high
method: street-article
```

- `fact` — עד 500 תווים, עברית תקנית, ללא ניקוד. עדיף ניסוח קצר ומדויק, אך אפשר להרחיב כשפרט מקומי מגובה היטב הופך את הסיפור למעניין יותר.
- `source` — שורה לכל מקור; סדר: מקורות תוכן (ויקיפדיה/עירייה/מכלול) ואז מקורות זהות (data.gov.il/OSM/Wikidata).
- `confidence` — high / medium / low.
- `method` — סוג העובדה.

---

## 6. מגבלות ידועות

1. **כיסוי ויקיפדיה חלקי.** לרוב הרחובות Residential אין ערך. הם יסומנו `no-fact` ולא יומצא להם תוכן.
2. **אין API רשמי לאטימולוגיה.** רשימת data.gov.il נותנת שם וסמל בלבד. לכן "על שם מי" דורש מקור נוסף (ערך רחוב, ערך שכונה, או מקור היסטורי).
3. **אנשים חיים.** עובדות על דיירים נוכחיים (למשל "ראש העיר מתגורר ברחוב") מסוננות מהטיוטה; אין להסתמך עליהן.
4. **ויקיפדיה משתנה.** כל קובץ נושא `date_researched`; רענון תקופתי נדרש.
5. **קואורדינטות.** ההתאמה מבוססת על מרכז הרחוב מ-OSM; ערך רחוק מ-5 ק"מ נפסל אלא אם הכותרת זהה בדיוק.
6. **דפי הרחוב העירוניים חסומים חלקית.** נקודת הקצה `POST /Umbraco/Surface/StreetSearch/GetStreet/` דורשת טוקן reCAPTCHA תקין ומחזירה `400 Invalid CAPTCHA` גם עם טוקן מהדפדפן. רק דפים שנאספו ואומתו ידנית שימשו כמקור.
7. **שמות ללא מאמר רחוב.** 8 מתוך 50 רחובות סומנו `medium` משום שהקישור בין שם הרחוב לאישיות/למקום מבוסס התאמת שם ולא משפט קריאה מפורש. אין להפוך אותם ל-`high` בלי מקור נוסף.

---

## 7. תחזוקה

- להוסיף או לעדכן עובדה: הוסף רשומה ל-`data/research/manual-facts.json`, הרץ `--review --list <list>`, ואז `--promote-all --list <list>`.
- לעדכן עובדה קיימת: ערוך את הרשומה ב-`manual-facts.json`, הרץ שוב `--review` ו-`--promote-all`.
- לבדוק שלמות: בדיקת השדות והכפילויות מובנית ב-`--review`; בדיקת קישורים אוטומטית עדיין לא קיימת.
- לדוח בקרה: `data/research/pilot-50-review.json` ו-`docs/research/pilot-50-qa.md`.

---

## 8. ייחוס

- ויקיפדיה: CC BY-SA 4.0 — נדרש קרדיט בעמוד האפליקציה.
- Wikidata: CC0.
- OpenStreetMap: © OpenStreetMap contributors, ODbL.
- data.gov.il: נתוני ממשלה פתוחים; מקור — רשות האוכלוסין וההגירה.
