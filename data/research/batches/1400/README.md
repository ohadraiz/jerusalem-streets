# Batch 1400 research archive

Second helping from the same source: **1,270 → 1,286 cards** (16 new), all drawn from the Hebrew Wikipedia article "שמות רחובות בירושלים".

The full source text is archived once, in `../1300/naming-article.txt`; this folder holds only what is specific to this batch.

## What is here

| File | Contents |
| --- | --- |
| `batch-1400.json` | The 16 selected streets (id, name, area, article title). |
| `facts-1400-01.json` | The 16 drafts with `id`, `after`, `evidence`. |
| `remaining-themed.json` | The 34 leftover street-name hits from the article, each with the sentence that mentions it — the raw material this batch was cut from. |
| `scripts/` | The leftover-mining, build, validation, integration and checking scripts as run. |

## The 16 streets

החרושת, היוזמה (industry themes in Talpiot and Atarot); הבנאי, המייסדים (Beit HaKerem: craftsmen and the neighbourhood's founders); מבוא רפידים, מבוא תמנע (places from the Six-Day War); עין גדי (Talpiot streets named after places seen from the neighbourhood); כפר השילוח (a street named after another Jerusalem neighbourhood); היען, החסידה (animals in Malha and Gilo); החלמית, הכרכום (flowers in Givat Ram); הביכורים, החצוצרות (Temple terms in the Jewish Quarter); חברת ש"ס, רבי אריה (religious concepts and the honorific "רבי").

## Integrity

- 16 drafts, unique ids, exactly the 16 ids of `batch-1400.json`.
- Every `evidence` string is a substring of `../1300/naming-article.txt`; every published card equals its draft.
- Card lengths 103–149 characters.
- Review gate: 16 approved, 0 rejected (`data/research/batch-1400-review.json`).

## Editorial decisions

- Rejected despite appearing in the article: מלכי, המלאכה, ארנון, מודיעין, שדרות נווה יעקב, הנשיא, מעגל, הררי — the article places them in a different neighbourhood than the app's area field, or the name in the article is longer than the app's street name, so the mapping could be to a different street.
- Incidental mentions were discarded: מנחם (inside "מנחם בגין"), לוי (inside "לוי אשכול"), יהודה (a committee member), שמיר (inside "דרך יצחק שמיר"), מעוז (a book author), אשר, פרדס, נחמן, ששת הימים.
- Cards state the naming theme and never claim a municipal decision that the source does not state.
