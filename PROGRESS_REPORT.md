# ירושלים - "הידעת?" - פיילוט 50 רחובות - דו"ח סיום
תאריך: 2026-10-22
חוקר: החוקר

## סטטוס כללי
- 50/50 רחובות אושרו (0 נדחו)
- 50/50 קבצי .txt נכתבו ל-data/didyouknow/
- 0 עובדות כפולות
- כל העובדות כוללות לפחות מקור תוכן אחד

## פירוט לפי ביטחון
- גבוה (high): 42 רחובות
- בינוני (medium): 8 רחובות
- נמוך (low): 0 רחובות

## מקורות תוכן לפי מארח
- he.wikipedia.org: 51 מקורות
- www.jerusalem.muni.il: 15 מקורות
- www.hamichlol.org.il: 1 מקור

רחובות בביטחון בינוני (שם הרחוב תואם אישיות/מקום, אך אין מאמר רחוב מפורש):
- קרן היסוד (keren-hayesod)
- עין כרם (ein-kerem)
- אלקלעי (alkalai)
- הרב קוק (harav-kook)
- שמואל הנביא (shmuel-hanavi)
- רבי עקיבא (jlm-ad65935e52)
- רופין (rupin)
- הר ציון (har-tzion)

## פקודות pipeline ששימשו
```
node tools/research-didyouknow.js --review --list data/research/pilot-50.json
node tools/research-didyouknow.js --promote-all --list data/research/pilot-50.json
```

## קבצי פלט מרכזיים
- data/research/manual-facts.json — 50 עובדות שנבדקו ידנית עם מקורות
- data/research/pilot-50-review.json — סטטוס בדיקה לכל רחוב
- data/didyouknow/<id>.txt — 50 קבצי עובדה סופיים

## צעדים הבאים (מתוך checkpoint)
1. הרחבת pipeline ל-2,424 רחובות ברשימה הרשמית, בבנות של 50–100
2. עדיפות לרחובות עם מאמר רחוב ישיר או extract עירוני
3. בניית ממשק סקירה לרחובות בביטחון בינוני
4. הוספת בודק קישורים אוטומטי והסרת כפילויות
5. בדיקת בטא לפני פריסה ציבורית לפי AGENTS.md