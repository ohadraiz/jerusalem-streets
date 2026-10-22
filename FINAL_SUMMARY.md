## ירושלים - "הידעת?" - סיום פיילוט 50 רחובות

### תאריך אחרון: 2026-10-22
### חוקר: החוקר

### סטטוס כללי
- **50/50 רחובות אושרו** — אפס נדחיות, אפס המצאות
- **50/50 קבצי .txt נכתבו** ל-`data/didyouknow/`
- כל העובדות כוללות מקור תוכן מאומת

### פירוט לפי ביטחון
- **גבוה (high):** 42 רחובות
- **בינוני (medium):** 8 רחובות
- **נמוך (low):** 0 רחובות

### הפילוח לפי שיטת עובדה
- `street-article`: 27
- `municipal+street-article`: 4
- `person-article`: 5
- `place-article`: 4
- `municipal+person-article`: 4
- `municipal-street-page`: 3
- `municipal+place-article`: 2
- `history-article`: 1

### מקורות תוכן לפי מארח
- **he.wikipedia.org:** 51 מקורות (מעל 50, חלק מהרחובות מצוטטים משני ערכים)
- **www.jerusalem.muni.il:** 15 מקורות (דפי רחוב רשמיים של העירייה)
- **www.hamichlol.org.il:** 1 מקור (המכלול — שמות רחובות בירושלים, עבור "הצבי")

### רחובות בביטחון בינוני (8 רחובות)
שמות הרחוב תואמים אישיות או מקום, אך לא נמצא מאמר רחוב ישיר המציין את הקריאה בשם במפורש. העובדה מבוססת על ערך תוכן, והקישור לרחוב מתבסס על התאמת שם מדויקת:

| רחוב | מזהה | הערה |
|---|---|---|
| קרן היסוד | `keren-hayesod` | שם הרחוב זהה לשם המוסד; לא נמצא מאמר רחוב ישיר |
| עין כרם | `ein-kerem` | הרחוב קרוי על שם השכונה; אין מאמר רחוב ישיר |
| אלקלעי | `alkalai` | שם הרחוב זהה לשם הרב; לא נמצא מאמר רחוב ישיר |
| הרב קוק | `harav-kook` | שם הרחוב זהה לשם הרב; לא נמצא מאמר רחוב ישיר |
| שמואל הנביא | `shmuel-hanavi` | שם הרחוב נגזר משם השכונה; אין מאמר רחוב ישיר |
| רבי עקיבא | `jlm-ad65935e52` | שם הרחוב זהה לשם התנא; לא נמצא מאמר רחוב ישיר |
| רופין | `rupin` | שם הרחוב זהה לשם רופין; לא נמצא מאמר רחוב ישיר |
| הר ציון | `har-tzion` | שם הרחוב זהה לשם ההר; לא נמצא מאמר רחוב ישיר |

### צעדים שבוצעו (מתוך checkpoint)
1. ✅ נוצר `data/research/manual-facts.json` עם 50 עובדות ומאומתות
2. ✅ הוארך `tools/research-didyouknow.js` עם `--review` ו-`--promote-all`
3. ✅ הרצת `node tools/research-didyouknow.js --review --list data/research/pilot-50.json` — 50 אושרו, 0 נדחו
4. ✅ הרצת `node tools/research-didyouknow.js --promote-all --list data/research/pilot-50.json` — נכתבו כל 50 קבצי .txt
5. ✅ אומתו כל 50 `data/didyouknow/<id>.txt` — תקינים עם כל המפתח הנדרשים
6. ✅ נוצר `data/research/pilot-50-review.json` עם ספירת מאושרים/נדחים
7. ✅ נוצר `docs/research/pilot-50-qa.md` — דוח בקרה מפורט
8. ✅ עודכן `docs/research/PIPELINE-didyouknow.md` עם דגלים `--review` ו-`--promote-all`
9. ✅ נוצרו/תוקנו קבצי ערוץ חוקר (`docs/agents/channels/researcher.md`)
10. ✅ נוקה תיקייה: כל `tools/tmp-*.js`, `data/research/tmp-*.js`, `data/research/review-dump.txt`, `data/research/wiki-cache-index.txt`, `data/research/muni-selected.txt`, `data/research/street-articles.txt` הוסרו

### מפתח output files
- `data/research/manual-facts.json` — 50 עובדות ידניות עם מקורות, ביטחון ושיטה
- `data/research/pilot-50-review.json` — סטטוס בדיקה לכל רחוב (50 מאושרים, 0 נדחים)
- `docs/research/pilot-50-qa.md` — דוח בקרה עם פילוחים וטבלאות
- `data/didyouknow/<id>.txt` — 50 קבצי עובדה סופיים (פורמט קבוע)
- `docs/research/apps-comparative.md` ו-`.js` — דוח השוואתי של 12 אפליקציות (בוצע על ידי chiki)
- `docs/research/PIPELINE-didyouknow.md` — תיעוד תפעולי מעודכן

### צעדים הבאים להרחבה ל-2,424 רחובות
1. **הרצת pipeline בבנות של 50–100 רחובות** — להשתמש ב-`--list` עם רשימות sub-sets של `official-streets-jerusalem.json`
2. **עדיפות למקורות ישירים** — רחובות עם `street-article` או `municipal+street-article` יועברו אוטומטically ל-`.txt`; השאר יטופלו ידנית
3. **טיפול ב-`medium` confidence** — 8 הרחובות של הפיילוט מהווים תבנית; להמשיך עם הערות/העשרה באותם מקרים
4. **בודק כפילויות אוטומטי** — להוסיף סcanf יומי של כל 2,424 הקבצים `.txt` לזיהוי כפילויות עובדות
5. **בדיקת קישורים** — לוודא שכל המקורות ב-`.txt` תקינים (200 status); לטפל ב-429 מ-Vikimedia על ידי השהייה ו-retry
6. **סביבת בטא** — כל שינוי באתר הציבורי חייב לעלות ב-`beta.html` תחילה, לעבור שערים (`verify.js`, `store.test.js`, smoke tests), ולקבל אישור מפורש של המשתמש לפני פרסום
7. **אחסון בטא נפרד** — אין לכתוב נתוני בדיקה למפתח האמיתי `jlm-street-journal-v1`; להשתמש ב-`jlm-street-journal-beta-v1`

### אבני דרך שנוצרו לאחרונה
- `PROGRESS_REPORT.md` — דו"ח התקדמות מפורט (נוצר בתהליך הסיום)
- ניקוי כל קבצי הדם הזמניים (`tmp-*.js`, `tmp-street-*.html`, etc.)
- עדכון `agent-status.json` עם סטטוס `working` ו-`note` על סיום הפיילוט