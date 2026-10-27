# Street stories (v1.3 style)

Twenty-three cards rewritten in the style introduced by app version 1.3: a concrete opening, a turn, and a consequence — instead of "the street is named after X".

## The recipe

1. **Open in the middle of the scene.** A date, a person, a place, a number. Never "the street is named after".
2. **Two or three sentences, each carrying new data.** No sentence may be only connective tissue.
3. **A turn.** "Despite", "but", "a study found", "only in 1891".
4. **Close with meaning.** What the detail says about the place or the period.
5. **No links in the body.** The source stays in the card's `source:` line.

Length: 160–270 characters. Compare with the regular card (~110 characters, one fact).

## What is here

| File | Contents |
| --- | --- |
| `stories-applied.json` | The 23 rewritten cards: id, final text, source URL. |
| `sources/` | The full article text used for each card (gzipped), so every claim can be re-checked. |
| `scripts/` | The fetch, digest, and patch scripts that produced the batch. |

## Examples

- **כיכר ציון** — "הכיכר קיבלה את שמה מקולנוע 'ציון', שפעל בה מ-1912 עד שנהרס ב-1972. ב-4 ביולי 1975 התפוצץ בה מקרר תופת — הפיגוע הקטלני ביותר בכיכר, שבו נהרגו 15 איש ונפצעו 77."
- **הנצי״ב** — "הגיע לישיבת וולוז׳ין בגיל 11, וכעבור שנתיים וחצי לקח אותו ראש הישיבה כחתן לבתו. ב-1885 ייסד את אגודת 'נס ציונה' — שלא בידיעתו, ונסגרה כשהמשטרה גילתה אותה."
- **נוטרות** — "ב-1936 גויסו 600 הנוטרים הראשונים; עד 1939 כבר מנו כ-15,000. ב-1938 הוקמה משטרת היישובים העבריים, אך ההסכם שנועד להכשיר אותה לא נכנס לתוקף — בן־גוריון הטיל עליו וטו."

## Method note

Candidates came from 120 cards whose existing source is a Wikipedia article and whose text was under 170 characters. For each, three sentences containing a year and a dramatic verb were extracted and ranked; only cards with a genuine story arc were rewritten. Claims that could not be quoted from the source were dropped, not softened.
