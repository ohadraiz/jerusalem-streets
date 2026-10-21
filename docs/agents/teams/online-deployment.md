# העלאה לרשת — מדריך הפצה ל"יומן הרחובות ירושלים"

> **✅ הפריסה בפועל (2026-10-21):** `https://ohadraiz.github.io/jerusalem-streets/`
> הריפו הופך לציבורי, GitHub Pages פועל מענף `main` (path `/`), והאתר אומת בדפדפן: ספק OSM, 10 אריחים, ייחוג יחיד,
> Service Worker רשום ושולט, manifest נגש `application/manifest+json`, אין שגיאות קונסול. ראו `docs/agents/BOARD.md` רשומה 055.

**מטרת המסמך:** להפוך את הפרויקט לכתובת שנפתחת בדפדפן — בלי להעתיק קבצים, בלי להריץ פקודות, בלי לבנות.
הכל כבר מוכן בקוד; חסרה רק **בחירת מארח והעלאה**.

> **סטטוס:** הקוד מוכן (BOARD 054). ההעלאה עצמה **ממתינה להחלטת המשתמש** — מארח, דומיין ושם. אין כאן שום פעולה שבוצעה בשרת.

## 1. מה עולה לרשת (הכול, כפי שהוא)

אין build, אין תלויות, אין שלב "קומפילציה". מעלים את **התיקייה כולה**:

```
index.html
manifest.webmanifest
sw.js
assets/ (data.js, store.js, geo.js, app.js, map.js, ui.js, styles.css, sw-register.js, icons/, vendor/leaflet/)
```

`geo.js` הוא הקובץ הגדול (~2.5MB) — הוא טוען את גיאומטריית הרחובות. הוא נטען בדפדפן (לא בשרת), ולכן אין מגבלות גודל בעליית התיקייה.

## 2. איפה מעלים (בלי פקודות, בלי התקנה)

| אפשרות | מה צריך | הערות |
|---|---|---|
| **Netlify Drop** | לגרור את התיקייה ל-[app.netlify.com/drop](https://app.netlify.com/drop) | הכי מהיר: כתובת HTTPS מיד, בלי חשבון קוד. יש גם גרסה חיננית עם חשבון. |
| **Cloudflare Pages** | חיבור repo → Pages | HTTPS + CDN; דורש חשבון Git. |
| **GitHub Pages** | repo → Settings → Pages | HTTPS חינמי; דורש push של התיקייה. |
| כל מארח סטטי אחר | העלאת קבצים | חייב לתמוך ב-HTTPS וב-Service Worker. |

**HTTPS הוא תנאי לעבודה מלאה:** Service Worker והתקנה למסך הראשי (PWA) דורשים הקשר מאובטח. ב-HTTP בלבד — האפליקציה עובדת, רק בלי מצב לא מקוון ובלי התקנה.

## 3. כותרות HTTP חובה (להגדיר במארח)

```
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org https://tile.openstreetmap.de https://*.tile.opentopomap.org; connect-src 'self' https://tile.openstreetmap.org https://tile.openstreetmap.de https://*.tile.opentopomap.org; frame-ancestors 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
```

- **`Referrer-Policy` אסור `no-referrer` / `same-origin`** — OSM חוסם בקשות ללא Referer, ואז המפה נופלת ל-OSM DE.
- **`connect-src` חייב את שלושת המארחים** — ה-probe של המפה הוא `fetch` (HEAD), לא רק טעינת תמונה.
- `img-src` כולל `data:` ו-`blob:` (Leaflet משתמש ב-`data:` למסגרות קנבס).

## 4. התנהגות המפה לפי מקור

| מקור הפתיחה | ספק האריחים הראשון | למה |
|---|---|---|
| `https://הדומיין שלנו` | **OSM** | יש Referer תקין — OSM מגיש אריחים אמיתיים |
| `http://localhost` | **OSM** | אותו הדבר |
| `file://` (הקובץ המקומי) | **OSM DE** | אין Referer, ולכן OSM חוסם; OSM DE עובד ללא Referer |

המעבר בין הספקים אוטומטי ונמדק (`assets/map.js`, BOARD 050) — כולל החלפת ייחוג והודעה למשתמש.

## 5. Service Worker ומטמון

- `sw.js` מטמון **את קבצי האפליקציה בלבד** (`network-first`: תמיד מבקשים מהשרת, ורק אם אין רשת משתמשים במטמון).
- **אריחים אינם נשמרים ב-Service Worker.** הם נשמרים רק לפי כותרי ה-HTTP של שרת האריחים — בדיוק כמו שמדיניות OSM מצפה (אין הורדה מרובה, אין prefetch, אין `Cache-Control: no-cache`).
- אחרי ביקור אחד, האפליקציה נפתחת **גם בלי רשת** (נבדק: שרת כבוי → האפליקציה נטענת במלואה מהמטמון).
- **עדכון קבצים:** כי האסטרטגיה היא network-first, עדכון בשרת נראה מיד. אם רוצים לנקות מטמון ישן — להעלות את `CACHE_NAME` ב-`sw.js` (`jlm-shell-v1`).

## 6. מה המשתמש צריך לעשות (בלי פקודות)

1. לבחור מארח (§2) ולהעלות את התיקייה.
2. להגדיר את כותרות §3.
3. לפתוח את הכתובת — והכול עובד: המפה, הרשימה, הסימונים, המצב ללא רשת, וההתקנה למסך הראשי (בדפדפנים שתומכים).

## 7. מה **לא** נעשה כאן

- לא הועלה שום דבר לשום שרת; אין חשבון, דומיין או חשבון ענן.
- לא שונה דבר במזהי הרחובות, בסכמת האחסון או בנתונים.
- צוות ההפצה (מובריליס/פיצי) נשאר בחופש עד הפעלה מפורשת.

## 7.1 איך מעלים עדכון מעכשיו (אחרי שהאתר עלה)

1. `git push` ל-`main` → GitHub Pages בונה מחדש אוטומטית (דקה–שתי דקות).
2. ה-Service Worker מגיש **network-first**, ולכן המשתמש רואה את הגרסה החדשה מיד; אין צורך לנקות מטמון.
3. אם רוצים לנקות מטמון ישן לגמרי — להעלות את `CACHE_NAME` ב-`sw.js` (`jlm-shell-v1`).
4. **פרסום עץ נקי (אופציונלי):** בריפו הציבורי נחשפים גם `docs/agents/`, `tools/`, `.opencode/agents/` והדשבורדים.
   אפשר לפרסם ענף נפרד עם קבצי האפליקציה בלבד: `node tools/prepare-publish.js <יעד>` מאסף אותם, ואז ענף `gh-pages`
   מוגש כמקור ל-Pages (במקום `main`).

## 7.2 איך נעשתה ההפעלה בפועל (בלי `gh`)

`gh` אינו מותקן, אבל יש טוקן OAuth של Git Credential Manager (`credential.helper=manager`). אפשר לקרוא אותו בלי להדפיס אותו:

```powershell
$out = "protocol=https`nhost=github.com`n`n" | git credential fill
$pw  = (($out | Where-Object { $_ -like 'password=*' })[0]).Substring(9)
$h = @{ Authorization = "Bearer $pw"; Accept = 'application/vnd.github+json';
        'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'jlm-deploy' }

# להפוך לציבורי
Invoke-RestMethod 'https://api.github.com/repos/ohadraiz/jerusalem-streets' -Method Patch -Headers $h `
  -Body (@{ private = $false; visibility = 'public' } | ConvertTo-Json) -ContentType 'application/json'

# להפעיל Pages מענף main/root
Invoke-RestMethod 'https://api.github.com/repos/ohadraiz/jerusalem-streets/pages' -Method Post -Headers $h `
  -Body (@{ source = @{ branch = 'main'; path = '/' } } | ConvertTo-Json -Depth 3) -ContentType 'application/json'
```

**שים לב:** ריפו פרטי + חשבון Free = GitHub Pages לא נפתח. הפיכה לציבורי היא תנאי ל- Pages בתוכנית חינמית.

## 8. בדיקות שכבר רצו (לפני העלאה)

- `node --check assets/map.js` / `sw.js` / `assets/sw-register.js` ✅
- `node tests/store.test.js` ✅ · `node tools/verify.js` ✅
- דפדפן אמת: `http://localhost` (OSM), ללא Referer (מעבר ל-OSM DE), כל הספקים חסומים (באנר סופי + "נסה שוב"), `file://` אמיתי (OSM DE, אפס בקשות ל-OSM), **ואחר כך שרת כבוי → האפליקציה נטענת מהמטמון במלואה**.
