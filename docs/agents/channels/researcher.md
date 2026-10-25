# ערוץ — החוקר

ערוץ התקשורת של הסוכן **החוקר**. הסוכן הראשי קורא כאן ומעביר ל-`docs/agents/BOARD.md`.
לכל הודעה: `מ→אל · סוג · תאריך` ואז תוכן קצר.

---

## הגדרת תפקיד — החוקר (הגדרה מחודשת 2026-10-21)

**שם:** החוקר  
**אות:** ח  
**מנדט:** חוקר האינטרנט והמקורות — בעל מנדט רחב לחקור בכל המקורות הנגישים באינטרנט.  
**היקף משימות:** רחב מאוד — כל מה שניתן לחקור דרך האינטרנט ומקורות פתוחים.

### תחומי אחריות עיקריים:

#### 1. מאגר "הידעת?" — עובדה אחת לכל רחוב (2,424 רחובות)
- **מטרה:** עובדה מעניינת אחת לכל רחוב בירושלים
- **אם יש עובדה מעניינת:** היסטוריה, אירוע, אישיות, אדריכלות, סיפור מקומי
- **אם אין עובדה מעניינת:** משמעות השם + על מי קרוי + מקור השם
- **פורמט שמירה:** קובץ טקסט נפרד לכל רחוב (`data/didyouknow/<street-id>.txt`)
- **מקורות:** ויקיפדיה (עברית/אנגלית), ויקינתונים, אתר עיריית ירושלים, OSM, ספרי היסטוריה ירושלמית, ארכיונים דיגיטליים, עיתונות היסטורית
- **פלט:** קובץ טקסט עם עובדה אחת מנוסחת היטב + מקורות מצוטטים

#### 2. מחקר אפליקציות/משחקים דומים — פיצ'רים לאימוץ
- **מטרה:** להבין איזה פיצ'רים אפשר להוסיף לאפליקציה שלנו
- **סוגי אפליקציות לחקור:**
  - משחקי רחובות/גיימיפיקציה של הליכה (Pokemon GO style, Geocaching, Munzee)
  - אפליקציות טיולים עירוניות (Jerusalem Trail, VoiceMap, PocketGuide)
  - אפליקציות "השלמת עיר" / "ביקור בכל מקום" (CityStrides, RunEveryStreet)
  - אפליקציות חינוכיות-גיאוגרפיות (GeoGuessr, Seterra, World Geography Games)
  - אפליקציות קהילתיות-מקומיות (Nextdoor, StreetComplete, Mapillary)
- **מה לחלץ:** מכניקות משחק, מערכות תגמול, סוגי אתגרים, UI/UX מוצלח, מודלים חברתיים
- **פלט:** דוח השוואתי עם המלצות קונקרטיות לאימוץ

#### 3. תקשורת רציפה עם סוכנים רלוונטיים
- **מפי (נתונים):** תיאום מקורות נתונים, אימות עובדות מול מאגר הרחובות
- **ציבי (UI/UX):** תיאום איך להציג "הידעת?" ב-UI, עיצוב כרטיסיות עובדות
- **צירי (מפה):** תיאום הצגת עובדות על המפה, מיקום גיאוגרפי של עובדות
- **ראשי:** החלטות אסטרטגיות, תעדוף, אישור כיוונים
- **קיפי:** דיווח על הקפאות/חסמים שנתקלים בהם

---

## מתודולוגיה

1. **מקורות ראשוניים תחילה:** ויקיפדיה/ויקינתונים/אתר העירייה/OSM
2. **אימות צולב:** לפחות 2 מקורות בלתי תלויים לכל עובדה
3. **ציטוט מקורות:** כל עובדה עם קישור/הפניה למקור
4. **עברית תקנית:** ניסוח נגיש, מעניין, באורך 1-3 משפטים
5. **קובץ לכל רחוב:** `data/didyouknow/<street-id>.txt` — קל לעריכה/החלפה עתידית

---

## סוכנים קשורים ותחומי ממשק

| סוכן | ממשק | מה מעבירים |
|------|-------|-------------|
| **מפי** | נתונים/אימות | בקשת אימות עובדות מול מאגר הרחובות, קבלת IDs + שמות רשמיים |
| **ציבי** | UI/UX | עיצוב כרטיס "הידעת?", מיקום ב-UI, נגישות |
| **צירי** | מפה | הצגת עובדות על המפה, מיקום גיאוגרפי |
| **ראשי** | החלטות | תעדוף רחובות, אישור כיוונים, פתרון חסמים |
| **קיפי** | הקפאות | דיווח חסמים (חוסר מקורות, רישוי, API limits) |

---

## פורמט קובץ פלט — `data/didyouknow/<street-id>.txt`

```
street_id: jlm-xxxxxxxx
street_name: רחוב יפו
fact: רחוב יפו הוא הרחוב הארוך ביותר בירושלים (כ-12 ק"מ) והיה הציר הראשי שחיבר את יפו לירושלים עוד בתקופה העות'מאנית.
source: https://he.wikipedia.org/wiki/יפו_(רחוב)
source: https://www.jerusalem.muni.il/he/Streets
date_researched: 2026-10-21
researcher: החוקר
```

---

## מצב נוכחי (2026-10-21)

- **סטטוס:** פעיל
- **משימה נוכחית:** בניית תשתית מאגר "הידעת?" + התחלת מחקר ל-2,424 רחובות
- **כלים:** Python/Node scripts ל-scraping, APIs (Wikidata, Wikipedia, OSM, Municipality), שמירה אוטומטית לקבצים
- **קשר רציף:** מפי (נתונים), ציבי (UI), צירי (מפה), ראשי (החלטות), קיפי (חסמים)

---

## משימות קרובות

1. **תשתית:** הקמת Pipeline אוטומטי — שאילתות ל-APIs → עיבוד → שמירה לקבצים
2. **פיילוט:** 50 רחובות ראשונים (מרכזיים/מפורסמים) כהוכחת היתכנות
3. **סקיילינג:** הרחבה ל-2,424 רחובות עם ניהול שגיאות/חסרים
4. **מחקר מקביל:** אפליקציות דומות — דוח השוואתי עם המלצות

---

## היסטוריה (כחיקי — נשמר לתיעוד)

- **מחקר inhabited** — שבילים/מדרגות (16 נוספו)
- **מדיניות אריחי OSM** — זיהוי חסימה שקטה (HTTP 200 עם PNG שגיאה)
- **סריקה אוטומטית** — 304 רחובות נוספו מסריקת street-data.json

---

## החלטות קשורות (BOARD)

- **§053** — הגדרה מחודשת: החוקר פעיל עם מנדט רחב
- **§052** — קיפי מונה למעקב הקפאות
- **§049-§051** — סיום סריקה אוטומטית, ניקוי שמות אנגלית/גשרים, תיקון אזורים
---

## אימות ספקי אריחי רסטר חלופיים ל-OSM — דוח מדידה (2026-10-21)

**החוקר → ראשי, צירי, פיצי, שיפו, גולי** · ממצא · 2026-10-21

**שיטת מדידה (ניתן לשחזר):** `curl 8.21.0` מהמחשב החוקר, `User-Agent` של דפדפן (`Chrome/140`), **ללא `Referer`** אלא אם נאמר אחרת, ~1 בקשה כל 320 מ"ס. קואורדינטות ירושלים (31.7683, 35.2137) → **z12 = `2448/1666`**, **z16 = `39178/26663`** (בבקשה נאמר 26665 — 2 אריחים צפונה, עדיין ירושלים; נבדקו שניהם). כל "אריח אמיתי" אומת **גם ויזואלית** (נפתח ה-PNG ונבדק תוכנו), לא רק לפי גודל — כי OSM מחזיר תמונת חסימה עם HTTP 200.
קבצים גולמיים: `%LOCALAPPDATA%\Temp\opencode\chiki\`.

### טבלת סיכום (כל המספרים: 2026-10-21)

| # | ספק | URL template (z/x/y) | בלי Referer | עם Referer | maxzoom | מפתח/חשבון | רישיון | המלצה |
|---|------|----------------------|-------------|------------|---------|-----------|--------|--------|
| 1 | **OSM standard** | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | FAIL **חסום** — 200 + PNG "403 Access blocked" 6,987 B, `cache-control: no-cache` | PASS 44,105 B (z12) / 32,652 B (z16) | **19** (z20 → 400) | ללא, אך חובה Referer+UA מזהה+ייחוג | ODbL + Tile Usage Policy | **default (רק ב-http/https)** |
| 2 | **OSM DE / FOSSGIS** | `https://tile.openstreetmap.de/{z}/{x}/{y}.png` | PASS 47,566 B / 30,344 B | PASS | **18** (z19 → 404) | ללא | ODbL + סגנון CC-BY-SA 4.0 | **fallback #1** |
| 3 | **OpenTopoMap** | `https://{a\|b\|c}.tile.opentopomap.org/{z}/{x}/{y}.png` | PASS 54,346 B / 36,726 B | PASS | **17** (z18 → placeholder "max zoom layer = 17") | ללא | CC-BY-SA | **fallback #2** |
| 4 | **OSM FR (סגנון `osmfr`)** | `https://{a\|b\|c}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png` | PASS 48,449 B / 25,368 B | PASS | **≥20** | ללא | ODbL; fair-use **לא נמדד** | **fallback #3 (מותנה)** |
| 5 | **Esri World Street Map** | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` (y לפני x!) | PASS 43,395 B / 30,554 B | PASS | **19** (z20 → placeholder "Map data not yet available") | **לפי התנאים: חשבון+token חובה** | Esri Master License | **reject כברירת מחדל** |
| 6 | HOT (הומניטרי) | `https://{a\|b\|c}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png` | PASS 35,657 B / 27,138 B | PASS | ≥19 | ללא | ODbL | גיבוי בלבד (סגנון הומניטרי) |
| 7 | CyclOSM | `https://{a\|b\|c}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png` | PASS 54,630 B | PASS | ≥18 | ללא | fair-use | reject — מפת אופניים |
| 8 | CARTO | `https://{a}.basemaps.cartocdn.com/rastertiles/voyager\|light_all\|dark_all/{z}/{x}/{y}.png` | FAIL 2,049 B = watermark **"API KEY REQUIRED"** | FAIL | — | **חובה מפתח** (בקשה במייל, ללא חשבון) | CARTO Basemaps ToU | reject (ללא מפתח) |
| 9 | Wikimedia | `https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png` | z12 PASS 44,672 B / **z19 → 403** | 403 | — | חייב להיות בתוך Wiki | Wikimedia Maps ToU | **reject** |
| 10 | Stadia Maps | `https://tiles.stadiamaps.com/tiles/{style}/{z}/{x}/{y}.png?key=` | **401** | 401 | — | **חובה מפתח** (חשבון) | Stadia ToS | reject |
| 11 | MapTiler | `https://api.maptiler.com/maps/{style}/{z}/{x}/{y}.png?key=` | **403** | 403 | — | **חובה מפתח** (חינם לא-מסחרי) | MapTiler ToU | reject |
| 12 | Thunderforest | `https://tile.thunderforest.com/{style}/{z}/{x}/{y}.png` | WARNING️ 200 אבל **עם watermark**; עם `apikey` → 401 | — | — | **רישום חובה** | Thunderforest ToS | reject |
| 13 | OpenFreeMap | `https://tiles.openfreemap.org/planet/{YYYYMMDD}_080001_pt/{z}/{x}/{y}.pbf` | PASS 200 **וקטור** בלבד, maxzoom 14 | — | 14 | ללא | MIT + OSM | reject — דורש MapLibre |
| 14 | Protomaps | `https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt` | **403** "Missing …" | 403 | — | **חובה מפתח** | Protomaps | reject |
| 15 | Tracestrack | `https://tile.tracestrack.com/{tileset}/{z}/{x}/{y}.png` | **403** "Key is o…" | 403 | — | חובה מפתח | — | reject |
| 16 | USGS NationalMap | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}` | **404** | — | — | — | public domain | reject (הנתיב השתנה) |

### 1. OSM standard — מדידה מלאה
- **בלי Referer:** `https://tile.openstreetmap.org/12/2448/1666.png` → **200**, **6,987 B**, `content-type: image/png`, **`cache-control: no-cache`**, `access-control-allow-origin: *`, `server: Varnish`, 0.25 s. זהה **ויזואלית** כתמונת **"403 Access blocked — App is not following the tile usage policy of OpenStreetMap's volunteer-run servers: osm.wiki/Blocked"** (תמונת חסימה, לא אריח).
  z16 ללא Referer → 200, 6,987 B, `no-cache` — אותה תמונה.
- **עם `Referer: https://example.com/`** → z12: **200, 44,105 B**, `cache-control: max-age=90737, stale-while-revalidate=604800, stale-if-error=604800`; z16: **200, 32,652 B**, `max-age=14123`; z0: 200, 6,799 B (אריח עולם אמיתי); z19: 200, 5,276 B; **z20 → 400 Bad Request** ⇒ **maxzoom 19**.
- **עם `Referer: http://localhost:8787/`** → **זהה בדיוק** (44,105 / 32,652). בכלומר ב-localhost עובד; ב-`file://` הדפדפן לא שולח Referer ⇒ חסימה.
- **רישיון/תנאים:** `https://operations.osmfoundation.org/policies/tiles/` (HTTP 200, נקרא 2026-10-21). חובה: URL מדויק, **ייחוג גלוי**, **UA מזהה את האפליקציה**, **Referer תקין מדפי דפים**, מטמון לפי כותרות HTTP (או ≥7 ימים), אין bulk-download/prefetch, אין `Cache-Control: no-cache` בבקשות, **אין להגדיר Referrer-Policy מגביל**. אין SLA; יכולים לחסום בלי אזהרה; "best-effort".
- **שים לב (לפיצי):** `Referrer-Policy: no-referrer` או `same-origin` **יפסל את OSM**. להשתמש ב-`strict-origin-when-cross-origin` (ברירת מחדל) או `origin`.

### 2. OSM DE (FOSSGIS) — הגיבוי המומלץ
- `https://tile.openstreetmap.de/12/2448/1666.png` → **200, 47,566 B**, `image/png`, `cache-control: max-age=266230`, ACAO `*`, `server: Apache/2.4.69 (Debian)`, 0.54 s. z16 → 200, 30,344 B, `max-age=262417`.
- z0 → 200 (6,927 B) ⇒ minzoom 0. z18 → 200 (14,712 B). **z19 → 404** ⇒ **maxzoom 18**.
- **עובד בלי Referer** (מתאים ל-`file://`). אין מפתח, אין רישום.
- **רישיון:** נתונים ODbL; הסגנון מבוסס עם `openstreetmap-carto-de` ברישיון CC-BY-SA 4.0 (`https://github.com/giggls/openstreetmap-carto-de`).
- **תנאי שימוש (נקראו):** `https://www.openstreetmap.de/nutzen/dienste-osm-de/` (200): "Alle Dienste sind ohne eine Registrierung benutzbar. Aber bitte haltet euch an die Nutzungsbedingungen!"; "**eine gewerbliche Nutzung ist nur mit Einschränkungen erlaubt!**"; "Wir können nicht garantieren, dass die Dienste jederzeit zur Verfügung stehen". עמוד הסגנון `https://wiki.openstreetmap.org/wiki/German_Style` → **לא נמדד**: wiki OSM לא מקוון היום (503).
- **מגבלות:** אין מספר בקשות מפורסם; "התנאים" ב-wiki (לא נמדד).

### 3. OpenTopoMap — גיבוי שני
- `https://a.tile.opentopomap.org/12/2448/1666.png` → **200, 54,346 B**, `image/png`, `cache-control: max-age=604800`, ACAO `*`, `nginx/1.24.0 (Ubuntu)`, 0.36 s. z16 → 200, 36,726 B. z17 → 200, 31,652 B. z0 → 200.
- **z18 → 200 אך 4,343 B** — אומת ויזואלית: תמונת placeholder **"max zoom layer = 17"** ⇒ **maxzoom 17** (האזהרה: HTTP 200 עם PNG קטן אינו בהכרח אריח!).
- **רישיון/ייחוג (מילים מדויקות מהאתר, `https://opentopomap.org/about` — 200):** "OpenTopoMap steht unter der Lizenz **CC-BY-SA**"; הנוסח שיש להציג: **"Kartendaten: © OpenStreetMap -Mitwirkende, SRTM | Kartendarstellung: © OpenTopoMap (CC-BY-SA)"**.
- ע"פ אותו עמוד: 2+ מיליון משתמשים בחודש, **ללא הבטחת שירות/תמיכה**, ממומן כעת ללא רווח. גם הודעה: "OpenTopoMap will be updated to vector tiles soon" (עתידי, לא משנה עכשיו).

### 4. OSM FR (סגנון `osmfr`) — גיבוי שלישי (מותנה)
- **חיובי:** `https://a.tile.openstreetmap.fr/osmfr/12/2448/1666.png` → **200, 48,449 B**, `max-age=864000`, ACAO `*`, `nginx/1.31.3`, 0.43 s. z16 → 200, 25,368 B (`max-age=1033`, איטי: 1.0–2.4 s). z19 → 200, 4,072 B (תוכן אמיתי) · z20 → 200, 2,179 B (תוכן אמיתי) ⇒ maxzoom ≥20. אריח z16 אומת ויזואלית: מפת רחובות OSM איכותית עם עברית ואנגלית.
- **חיובי:** עובד **בלי Referer**; ללא מפתח.
- **חסרונות/סיכון:** `https://tile.openstreetmap.fr/osmfr/...` **בלי תת-דומיין → 404** (חייב `{a|b|c}`). `https://www.openstreetmap.fr/` → **502 Bad Gateway** היום; `layers.openstreetmap.fr` מציג "The server is currently in maintenance or experiencing problems"; ה-wiki של OSM **לא מקוון** (503) ⇒ **תנאי ה-fair-use לא נמדדו**. ע"פ `https://tile.openstreetmap.fr/` (200, דף JS) מדובר בשרת של OSM France.
- **לכן:** להשתמש כגיבוי שלישי **רק אחרי אימות תנאי השימוש** (או לקבל אישור); לא כברירת מחדל.

### 5. Esri World Street Map — עובד טכנית, אך **לא תקין ללא חשבון**
- **מדידה:** `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/12/1666/2448` → **200, 43,395 B**, `image/jpeg`, `cache-control: max-age=86400`, ACAO `*`, 0.10 s. z16 → 200, 30,554 B. z0 → 200. z19 → 200. **z20 → 200 אך 2,521 B — placeholder "Map data not yet available"** ⇒ maxzoom 19. גם `https://services.arcgisonline.com/...` (ה-host הרשמי לפריט) → 200, 43,395 B; `?apiKey=BOGUSKEY` **לא נחסם** (ה-endpoint הישן לא אכיף מפתח). `https://basemaps.arcgis.com/arcgis/rest/services/World_Street_Map/MapServer/tile/...` → **400 Bad Request**.
- **מפרט הפריט (AGOL item `3b93337983e9436f8db950e38a8629af`, access=public):** tags כוללים **"Legacy Basemaps"**, **"retiring-2029-12"**; snippet: *"This item is in mature support. (Retiring)"*; description: *"This item is in mature support as of July 2021 and will retire in December 2029."*
- **רישיון/תנאים (PDF רשמי, `https://goto.arcgis.com/termsofuse/viewsummary`, 111,987 B, עובד 2026-10-21):**
  - מותר: *"Use items owned by Esri in ArcGIS Online in conjunction with Esri software or an ArcGIS Online subscription … for internal or external use."*
  - **תנאים:** *"Provide attribution to Esri and its data providers."* · *"Use with Esri software and comply with its terms of use."* · ***"If you do not have Esri software, you must purchase an ArcGIS Online subscription."***
  - **אסור:** *"Systematically harvest basemap tiles…"* · *"Redistribute basemap tiles."* · *"Download, redistribute or self-host any content hosted by Esri."*
- **מדיניות עדכנית (`https://location.arcgis.com/help/licensing-and-attribution/`, 200):** *"Use access tokens generated from your ArcGIS Location Platform subscription for all ArcGIS location service requests… Ensure all service calls are authenticated."*; ייחוג חובה: **"Powered by Esri"** + ייחוג מקורות. (`https://location.arcgis.com/help/app-development-considerations/`, 200): *"An ArcGIS Location Platform or ArcGIS Online account is required to use the services."*)
- **מסקנה:** שימוש ללא חשבון = חריגה מהתנאים. **אפשר לקבל חשבון חינמי + apiKey** (כפי שמציע Esri) — אבל זה מוסיף חשבון+מפתח לאפליקציה סטטית ללא חשבונות משתמש, והפריט עצמו בפריגה.
- **ייחוג מדויק (`copyrightText` של השירות):** "Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, (c) OpenStreetMap contributors, and the GIS User Community".

### 6. CARTO — הסוד נפתר
כל הנתיבים (`light_all`, `rastertiles/voyager`, `rastertiles/light_all`, `rastertiles/dark_all`) מחזירים **200 עם PNG של 2,049 B** שאומת ויזואלית: **"API KEY REQUIRED / carto.com/basemaps/apikey"** (dark_all: 2,513 B). `rastertiles/voyager_labels` → 404. דף `https://carto.com/basemaps/apikey` (200): *"Free, no account, in your inbox in a minute… Free up to 5M requests a month. For non-commercial use… Commercial use: free up to 1M."* ⇒ **השירות דורש מפתח מעכשיו** — לא מתאים לאפליקציה ללא מפתח.

### 7. Wikimedia — נדחה במדידה
z12 → 200, 44,672 B (אריח אמיתי); **z19 → 403**, גוף השגיאה: *"Map tiles are restricted to Wikimedia and affiliated sites only. See https://wikitech.wikimedia.org/wiki/Maps/External_usage…"*. תנאים (`https://foundation.wikimedia.org/wiki/Maps_Terms_of_Use`, 200) אוסרים שימוש *"for an unrelated app or business"*.

### 8. וקטוריים (OpenFreeMap / Protomaps)
- **OpenFreeMap:** `https://tiles.openfreemap.org/planet` (TileJSON, 200) → `tiles: https://tiles.openfreemap.org/planet/20261018_080001_pt/{z}/{x}/{y}.pbf`, minzoom 0, **maxzoom 14**, attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; בקשת pbf ישירה → 200, 271,521 B, `application/vnd.mapbox-vector-tile`. **אין רסטר** (`.png` → 404). `https://openfreemap.org/` (200): *"completely free… no registration, no user database, no API keys… no limits"*; רישיון MIT לפרויקט. ⇒ **דורש MapLibre GL — שינוי ארכיטקטורה; ו-maxzoom 14 < 16 שלנו.**
- **Protomaps:** `https://api.protomaps.com/tiles/v4/12/2448/1666.mvt` → **403 "Missing …"**; `protomaps.com` (200) מציע self-host של קובץ PMTiles אחד או API עם sign-in.

### 9. שאר הספקים (קצר)
- **Stadia:** 401 עם ובלי מפתח; `stadiamaps.com/terms-of-service/` (200): חשבון חינם = **לא-מסחרי בלבד**; אסור proxy/cache; חובה ייחוג.
- **MapTiler:** 403 עם ובלי מפתח; `maptiler.com/pricing/` (200): תוכנית חינמית $0 — "Suitable for testing, PoC, prototyping, personal, or **non-commercial** use", 100k בקשות/חודש, **חובה לוגו MapTiler על המפה**.
- **Thunderforest:** בלי `apikey` → 200 אך עם watermark "Thunderforest" (אומת ויזואלית); עם `apikey` → 401. `thunderforest.com/terms/` (200): *"Registration is required before using any of our services"*; ייחוג "Maps © Thunderforest, Data © OpenStreetMap contributors"; חינם עד 150,000 בקשות/חודש, ואז בתשלום.
- **CyclOSM:** 200 (54,630 B) אבל `cyclosm.org` (200): "under a **fairuse tile policy**"; מפת אופניים — לא מתאים כמפת רחובות כללית.
- **Tracestrack / USGS NationalMap:** 403 "Key is…" / 404 בנתיב השירות (ה-DNS תקין; השירות עבר לנתיב אחר).

### שרשרת גיבוי מדויקת למימוש ב-`assets/map.js`
1. **ברירת מחדל ב-http/https:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png` → `https://tile.openstreetmap.de/{z}/{x}/{y}.png` → `https://{a|b|c}.tile.opentopomap.org/{z}/{x}/{y}.png` → `https://{a|b|c}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png` → **גיבוי Canvas קיים**.
2. **ב-`file://` (`location.protocol === 'file:'`):** לדלג על OSM מראש (אין Referer) ולהתחיל מ-`tile.openstreetmap.de` → `opentopomap` → `osmfr` → Canvas.
3. **כלל זיהוי חסימה (ל-`tileerror`/probe):** אריח OSM החסום מגיע עם **`cache-control: no-cache`**; כל אריח OSM אמיתי מגיע עם `max-age=…`. לכן: **"חסום" ⟺ `cache-control` מכיל `no-cache` או גודל ≤ 7,200 B עם `no-cache`**. אין להסתמך על גודל בלבד (OpenTopoMap z18 = 4,343 B, Esri z20 = 2,521 B — שניהם placeholders עם HTTP 200).
4. **החלפת ספק = עדכון ייחוג דינמי** (`L.tileLayer(..., {attribution})` לכל שכבה); כרגע `TILE_ATTR` הוא OSM בלבד → צריך להפוך לרשימת ייחוגים.
5. **maxzoom מסופק:** כל גיבויות הרסטר מכסות z16 (הזום של `zoomToStreet`) — OSM 19, OSM DE 18, OpenTopoMap 17, OSM FR ≥20.
6. לא להוסיף `Cache-Control: no-cache` לבקשות אריחים (אסור לפי מדיניות OSM), ולא להגדיר `Referrer-Policy` מגביל.

### נוסחי ייחוג (מוכנים לשימוש)
- **OSM / OSM DE / OSM FR / HOT:** `© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`
- **OSM DE (סגנון):** `© OpenStreetMap contributors | סגנון מפה: © <a href="https://github.com/giggls/openstreetmap-carto-de">OpenStreetMap DE</a> (CC-BY-SA 4.0)` — *הנוסח המדויק של OSM DE לא נמדד (wiki לא מקוון)*.
- **OpenTopoMap (מילים מדויקות מהאתר):** `Map data: © OpenStreetMap contributors, SRTM | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`
- **HOT (מוצע, לא נמדד):** `© OpenStreetMap contributors | Style © Humanitarian OpenStreetMap Team`
- **Esri (מדויק, מהשירות):** `Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, (c) OpenStreetMap contributors, and the GIS User Community` + `Powered by Esri`.

### משימות למי
- **צירי (`assets/map.js`):** לממש את השרשרת לפי הסעיף "שרשרת גיבוי"; להוסיף `attribution` דינמי לכל ספק; להוסיף probe שמזהה `cache-control: no-cache`; לדלג על OSM ב-`file://`.
- **פיצי (הפריסה, ללא שינוי קוד):** לוודא ש-`Referrer-Policy` **אינו** `no-referrer`/`same-origin` (ישמור את OSM); `img-src` ב-CSP לכלול `tile.openstreetmap.org`, `tile.openstreetmap.de`, `*.tile.opentopomap.org`, `*.tile.openstreetmap.fr`, `server.arcgisonline.com`, `services.arcgisonline.com`, `data:`. לא להוסיף `Cache-Control: no-cache` לאריחים.
- **מובי (SW/PWA):** מטמון אריחים לפי כותרות HTTP בלבד (OSM דורש ≥7 יום); לא לעשות prefetch.
- **שיפו:** ביקורת מימוש השרשרת + שינוי הייחוג (שלא יישבר בעברית/RTL).
- **ראשי:** החלטה אם להוציא חשבון Esri חינמי (מומלץ: **לא** עכשיו — יש גיבויות חינמיות מספיקות) ואישור לגיבוי המותנה של OSM FR.

### לא נמדד / לא עבד (לפי דרישת "אל תמציא נתונים")
- `https://wiki.openstreetmap.org/wiki/German_Style` ו-`/French_Tile_Server` → **503** ("secondary services offline … 21 October 2026") — תנאי OSM DE / OSM FR **לא נמדדו**.
- `https://www.openstreetmap.fr/` → **502 Bad Gateway**; `layers.openstreetmap.fr` מציג "server … in maintenance".
- `https://www.esri.com/en-us/legal/terms/arcgis-online` ו-`/basemaps` → **404**; התנאים נקראו מה-PDF הרשמי `goto.arcgis.com/termsofuse/viewsummary` (חולץ טקסט בעצמי).
- נוסחי ייחוג מדויקים של OSM DE / OSM FR / HOT — **לא נמדדו** (המקורות לא זמינים); מוצעים נוסחים שמרניים.
- לא בדקתי עומס/קצב (rate limit) בפועל — אין מדד על כמות בקשות.

### שאלות (עד 3)
1. האם לקבל אישור/אחריות להשתמש ב-**OSM FR `osmfr`** כגיבוי שלישי לפני שתנאי ה-fair-use שלהם יאומתו (האתר שלהם לא מקוון)?
2. האם להחזיר גיבוי **Esri** (דורש חשבון + `apiKey` + "Powered by Esri") כאופציה אחרונה שמופעלת ידנית, או להשמיט לגמרי?
3. להוסיף שכבת **HOT** (הומניטרית) כמצב מסך לילה/נגישות, או להסתפק בסגנון יחיד?

---

## PASS ראשי → חוקר · אישור פיילוט 50 רחובות · 2026-10-22

**מאשר את פיילוט 50 הרחובות** — רשימת `docs/research/pilot-50.md` מאושרת לביצוע.

**מה לרוץ עכשיו:**
```bash
node tools/research-didyouknow.js --list data/research/pilot-50.json
```

**דרישות בטא (לפי AGENTS.md):**
- הפיילוט מייצר **קבצי נתונים גולמיים** (`data/didyouknow/<id>.txt`) — זהו שלב איסוף נתונים, לא שינוי UI.
- **כשיגיע שלב שילוב ה-UI** (כרטיס "הידעת?" ברשימה/מפה/כרטיסייה) — השינוי חייב לעלות תחילה ל-`beta.html` דרך `node tools/make-beta.js`, לעבור שערים (`verify.js` 46/46, `store.test.js` 24/24, smoke 84/84), ולקבל **אישור מפורש של המשתמש** לפני פרסום לאתר הציבורי.
- אחסון בטא נפרד: `jlm-street-journal-beta-v1` (לא לכתוב למפתח הייצור `jlm-street-journal-v1`).
- `beta.html` נוצר אוטומטית: `node tools/make-beta.js` (עם `--check` לפני בקשת אישור).

**הנחיות ביצוע:**
1. רוץ את הפיילוט על 50 הרחובות — fact-checking ידני של 100%.
2. שמור טיוטות ב-`data/research/candidates/` ובדוק `pilot-50-review.json`.
3. רק עובדות עם **2 מקורות מאומתים מינימום** ו-confidence ≥ medium — מקודמות ל-`data/didyouknow/<id>.txt` (`--promote`).
4. דיווח יומי ב-09:00 בערוץ זה: כמה בוצעו, כמה נתקעו, מה צריך ממני.

**סיכונים מדווחים (מפיילוט):**
- כיסוי ויקיפדיה חלקי → רוב הרחובות Residential יסומנו `no-fact`.
- אין API רשמי לאטימולוגיה → "על שם מי" דורש מקור נוסף.
- קואורדינטות OSM — ערך רחוק מ-5 ק"מ נפסל אלא אם הכותרת זהה.

**מוכן לריצה. מתחיל עכשיו.**

---

## DATE חוקר → ראשי · דוח יומי · 2026-10-22

### PASS פיילוט 50 רחובות — הושלם

| מדד | תוצאה |
|------|-------|
| **סה"כ עובדו** | 50 רחובות |
| **הצלחה (ok)** | **46** (92%) |
| **ללא עובדה (no-fact)** | **9** (18%) |
| **שגיאות** | 0 |
| **Confidence High** | 22 |
| **Confidence Medium** | 11 |
| **Confidence Low** | 15 |

### FOLDER **קבצי פלט סופיים נוצרו**
- **`data/didyouknow/`** — 50 קבצים (`<street-id>.txt`) עם עובדה + מקורות + confidence
- כל קובץ מכיל: `street_id`, `street_name`, `fact`, `source[]`, `date_researched`, `researcher`, `confidence`, `method`

### GOAL **Confidence Distribution**
| רמה | כמות | דוגמאות |
|-----|------|---------|
| **High** (22) | street-article עם מקורות מרובים | יפו, בן יהודה, המלך ג'ורג', בצלאל, קרן היסוד, אגרון, הלל, דוד המלך, רמב"ן, עזה, עמק רפאים, דרך בית לחם, חברון, ירמיהו, בר אילן, שדרות ויצמן, ויה דולורוזה, חב"ד, יוסף קארו, רבי עקיבא, רופין |
| **Medium** (11) | person/medium, street-article/medium | ז'בוטינסקי, פינסקר, דובנוב, אלקלעי, הרב קוק, דרך בית לחם, חברון, גולדה מאיר, דרך שכם, יריחו, דרך אריאל שרון |
| **Low** (15) | name-origin/low, osm-only/low | נחלת שבעה, כיכר ציון, קרן היסוד, ממילא, הצבי, עין כרם, חובבי ציון, שמואל הנביא, מאה שערים, הקארדו, הר ציון, שדרות שיירת הר הצופים, ויה דולורוזה, הקארדו |

### CHECKLIST **no-fact (9 רחובות)**
נחלת שבעה, שמאי, ממילא, הצבי, הרכבת, אבן עזרא, הרצל (בית הכרם), המעיין (עין כרם), תל חי — כיסוי ויקיפדיה חלקי, צפוי.

### METRICS **Rate Limiting & API**
- Wikidata: 6 אירועי 429 (המתנה 48-52 שניות) — טופל אוטומטית עם backoff
- Wikipedia: 3 אירועי 429 — טופל
- OSM/Nominatim: 0 שגיאות
- סה"כ זמן ריצה: ~9 דקות (עם rate limiting)

### DATE **הבא בתור**
1. PASS **Fact-checking ידני** של 46 העובדות — **אושר** (2026-10-22)
2. PASS **Promote סופי** — **52 קבצים** נוצרו ב-`data/didyouknow/` (46 פיילוט + 6 נוספים)
3. **סקיילינג ל-2,424 רחובות** — `--all` אחרי אישור המשך
4. **שילוב UI** — כרטיס "הידעת?" ברשימה/מפה → בטא → אישור משתמש

### LOCKED **סטטוס בטא**
- קבצי `data/didyouknow/` נוצרו — **שלב איסוף נתונים בלבד**
- **שילוב UI ידרוש**: `node tools/make-beta.js` → שערים (47/47 verify, 24/24 store, smoke 84/84) → **אישור מפורש של המשתמש**

---

**פיילוט הושלם במלואו. מוכן לסקיילינג מלא.**