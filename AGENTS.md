# הנחיות פרויקט — "יומן הרחובות של ירושלים"

קובץ זה חל על כל הסוכנים והצוותים בפרויקט.

## סביבת בטא תחילה

1. **שום שינוי לא עולה לאתר הציבורי לפני שנבדק ב-beta.html ואושר במפורש על ידי המשתמש.**
   התהליך מתואם על ידי **פתחי** (`.opencode/agents/pitchei.md`).
2. כל שינוי מוצג ב-beta (או ב-localhost) עם תוצאות שערים, ואז נשלחת בקשה מפורשת
   לאישור. אישור של סוכן אחר או שתיקה — אינם אישור.
3. `assets/` משותפים ל-`index.html` ול-`beta.html`. שינוי התנהגות או עיצוב שמשפיע על
   האתר הציבורי חייב לעלות מאחורי דגל (`window.JLM_BETA` / `html.is-beta`) עד לאישור.
4. `beta.html` נוצר אוטומטית; אין לערוך אותו ביד:
   `node tools/make-beta.js` (ולפני פרסום: `node tools/make-beta.js --check`).
5. אחסון הבטא נפרד (`jlm-street-journal-beta-v1`). אין לכתוב נתוני בדיקה למפתח האמיתי
   (`jlm-street-journal-v1`).

## גבולות קבועים

- אין לשנות את חוזה `JLMAPI`, `JLMBus`, `JLM_GEO`, את מזהי ה-DOM, את LOD 12,
  או את סכמת האחסון בלי אישור מפורש.
- מקור האריחים המאושר היחיד הוא OpenStreetMap (ODbL).
- אין force push, אין שכתוב היסטוריה שפורסמה, ואין פרסום שינוי שלא נבדק.

## קישורים

- אתר ציבורי: https://ohadraiz.github.io/jerusalem-streets/
- סביבת בטא: https://ohadraiz.github.io/jerusalem-streets/beta.html
- ערוץ פתחי: `docs/agents/channels/pitchei.md`
