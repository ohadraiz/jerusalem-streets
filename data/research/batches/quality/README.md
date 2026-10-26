# Street-card quality queue

Working list for the editorial upgrade pass. The goal is not more cards but better ones: every card should carry one concrete anchor — a year, an event, a first, a place you can point at — rather than only "the street is named after X".

## How the list is scored

`upgrade-candidates.json` lists 140 cards, highest priority first:

| Signal | Points |
| --- | --- |
| Source is a Wikipedia article about a person/place (not the naming article) | +3 |
| Card contains no digit (no date, no number) | +2 |
| Card is shorter than 120 characters | +2 |
| Source is the naming-themes article | −2 |

Only cards whose text contains a naming phrase ("קרוי", "נקרא", "על שמו" …) are considered.

## Status

- Enriched so far (19): קרליבך, מל״ל, מסריק, פינס, פרל, רוטשילד, פאפו, קרן היסוד, שמואל הנביא, שדרות בן־צבי, כיכר אלנבי, בית ישראל, חב״ד, אתיופיה, מאה שערים, שער יפו, הבעל שם טוב, בית הכרם, השלשלת.
- Rewrites are only accepted when the new sentence is backed by a verbatim quote from the card's own source (the quote is kept in the research batch files, not in the card).
- Cards sourced from the naming-themes article cannot be upgraded this way: that article documents the theme, not the individual street. They should stay short.

## Remaining work

The next pass takes the top ~30 entries, fetches each source, and keeps only the ones where a dated or dramatic detail exists. Cards whose source has no such detail stay as they are rather than being padded.
