# Batch 1300 research archive

Themed street-naming facts: **1,226 → 1,270 cards** (44 new), built from a different source type than the earlier batches.

## Why this batch exists

The namesake-article pool was exhausted at 1,226. Instead of searching for an article per street, this batch starts from the Hebrew Wikipedia article **"שמות רחובות בירושלים"**, which documents naming themes and lists the streets that belong to each theme. That gives an explicit, sourced street-to-theme link, which the article-based batches could not provide.

Examples of the themes used: קטמון streets named after battles and units of 1948; Temple terms in the Jewish Quarter; industries in the Talpiot and Atarot industrial zones; animals in Malha because of the biblical zoo; flowers in Gilo and Givat Ram; trees in Mahane Yehuda; craftsmen in Beit HaKerem; geonim in Givat Shaul; IDF units in Pisgat Ze'ev; newspapers in Romema; zodiac signs in Pisgat Ze'ev; places in Nahlaot and Mekor Baruch; poets in Rehavia/Resco; the family of David in Abu Tor.

## What is here

| File | Contents |
| --- | --- |
| `batch-1300.json` | The 44 selected streets (id, name, area, article title — all pointing at "שמות רחובות בירושלים"). |
| `facts-1300-01.json` | The 44 drafts with `id`, `after`, `evidence`. |
| `naming-article.txt` | Full plaintext of the source article (18,858 characters), kept so every evidence quote can be re-checked offline. |
| `naming-hits.json` | Every uncovered street name that appears in the article, with 300 characters of context (90 hits, including false positives). |
| `area-naming.json` | Per-neighborhood naming sentences pulled from 30 neighborhood articles, used to cross-check themes. |
| `themed-list.json` | The 44 names that became the batch. |
| `scripts/` | Discovery, extraction, build, validation, integration and checking scripts as run. |

## Integrity

- 44 drafts, unique ids, exactly the 44 ids of `batch-1300.json`.
- Every `evidence` string is a substring of `naming-article.txt`; every published card equals its draft.
- Card lengths 93–156 characters.
- Review gate: 44 approved, 0 rejected (`data/research/batch-1300-review.json`).
- All 44 cards cite the same source, which is correct here: the naming article is what documents the theme.

## Correction made in this batch

`jlm-18096e09b2cd` (יצהר, גילה) previously carried a fact about the Samaritan settlement of Yitzhar, from the 1,200 batch. The naming article shows that גילה streets are named after produce — "דגן, תירוש ויצהר" — so the card was rewritten to the documented theme, with the naming article as its source. This is the only published card changed by this batch.

## Method notes

- Hits were filtered by hand: incidental mentions (for example "מנחם" inside "מנחם בגין", or "יהודה" as a committee member) were discarded.
- Where the article's neighborhood differs from the app's area label (for example התפוח is listed under Mahane Yehuda while the app says Nahlaot), the card describes the naming group without asserting the neighborhood.
- Cards state the naming theme, not a naming decision by the municipality, unless the article says so explicitly.
