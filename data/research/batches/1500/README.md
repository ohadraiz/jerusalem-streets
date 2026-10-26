# Batch 1500 — deep research log and 9 new cards

**1,286 → 1,295 cards.** This is the smallest batch so far, and the folder is as much a research log as an archive: it records which external sources are reachable from this machine and what each one yields.

## What produced cards

The nine cards came from person-naming sentences: a Wikipedia article states that a Jerusalem street is named after the subject, and the street in the app carries that name.

| Street | Area | Source article | Link |
| --- | --- | --- | --- |
| נחמה | חומת שמואל | נחמה ליבוביץ | "על שמה נקראו רחובות בשכונת חומת שמואל בירושלים (רחוב נחמה)" |
| טוניק | פסגת זאב מזרח | יצחק טוניק | "בשנת 1992 נקרא על שמו רחוב בשכונת פסגת זאב" |
| טיכו | נחלת שבעה | אברהם אלברט טיכו | "רחוב אברהם טיכו — זהו הרחוב הקטן המוביל לביתו" |
| יערי | גילה | אברהם יערי | "ב-14 באוקטובר 1979 ... נקרא על שמו רחוב בשכונת גילה" |
| קרליבך | ארנונה | יוסף צבי קרליבך | "נקרא על שמו רחוב בשכונת תלפיות שבירושלים" |
| טובלר | שייח' ג'ראח | טיטוס טובלר | "בשכונת שייח' ג'ראח בירושלים נקרא רחוב על שמו" |
| לבוש מרדכי | גאולה | משה מרדכי אפשטיין | "נקרא על שם ספרו 'לבוש מרדכי' רחוב בשכונת גאולה" |
| מל"ל | המושבה הגרמנית | משה לייב ליליינבלום | "על שמו נקראו ... רחובות מל"ל בירושלים" |
| מסריק | המושבה הגרמנית | טומאש מסריק | "רחובות על שמו ב... ירושלים" |

Discovery method: Wikipedia full-text searches for phrases such as `"רחוב בירושלים"` and `"על שמו נקרא רחוב"`, collecting 440 candidate articles, keeping only those whose title token matches an uncovered street name.

## What did not work (measured, not guessed)

| Source | Result |
| --- | --- |
| `jerusalem.muni.il` street-name database (official naming reasons and approval dates) | HTTP 403 — Akamai blocks this network |
| Wikipedia `api.php` / REST API | HTTP 429 after the earlier batches; HTML pages still return 200 |
| Wikidata SPARQL, streets in Jerusalem with "named after" | only 20 streets, all already carded |
| Wikidata bulk query with subclass paths | query timeout |
| Category-driven scan (synagogues, museums, hospitals …) | category titles mostly wrong/empty; 35 articles fetched, 0 street matches |
| "What is on the street" scan, 70 central streets | 10 raw matches, 3 plausible, 0 usable (mostly other cities) |
| Synagogue scan, 45 streets | 4 raw matches, 0 usable for Jerusalem |
| Local news search (כל העיר, mynet) | no usable search endpoint; homepage only |
| Facebook public pages | page HTML loads, but no reliable street-level content without login; login is out of scope |
| Instagram | requires login |

## Integrity

- 9 drafts, unique ids, all in `batch-1500.json`; every `evidence` string is a substring of the stored article text; every published card equals its draft.
- Card lengths 92–139 characters.
- Review gate: 9 approved, 0 rejected (`data/research/batch-1500-review.json`).

## Practical conclusion

For the ~1,130 remaining streets the free, verifiable web is close to exhausted: these are small streets with no article, no news coverage and no accessible municipal record. Further growth needs one of:
1. access to the municipal street-name database from an unblocked network,
2. a paid news/archive subscription,
3. a library source (e.g. the municipal street-naming book),
4. accepting person-naming facts found one by one, at roughly 10–20 cards per research session.
