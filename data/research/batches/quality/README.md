# Street-card quality queue

Working list for the editorial upgrade pass: not more cards, better ones. Every upgraded card carries one concrete anchor — a year, an event, a first, a named building — instead of only "the street is named after X".

## Scoring

`upgrade-candidates.json` lists 140 cards, highest priority first:

| Signal | Points |
| --- | --- |
| Source is a Wikipedia article about a person/place (not the naming article) | +3 |
| Card contains no digit | +2 |
| Card is shorter than 120 characters | +2 |
| Source is the naming-themes article | −2 |

## Result of the pass

- **25 cards upgraded**, each with a verbatim quote from its own source kept in the research batch files: קרליבך, מל״ל, מסריק, פינס, פרל, רוטשילד, פאפו, קרן היסוד, שמואל הנביא, שדרות בן־צבי, כיכר אלנבי, בית ישראל, חב״ד, אתיופיה, מאה שערים, שער יפו, הבעל שם טוב, בית הכרם, השלשלת, טובלר, רמב״ן, פלוסר, שלומציון המלכה, דוד המלך, ביל״ו.
- 74 further cards have a Wikipedia person/place source. Spot checks of 30 of them found only 4 with an unused dated detail that improves the card; the rest already carry an anchor or their article adds nothing verifiable about the street.
- Cards sourced from "שמות רחובות בירושלים" cannot be upgraded this way: that article documents the theme, not the individual street. They stay short on purpose.

## Two findings from the pass

1. A card does not have to contain the word "רחוב". 1,046 of 1,295 cards describe the namesake instead, and that is the intended style: the popup already shows the street name as its title.
2. Padding is worse than brevity. Where the only available source says "named after X", the card stays a single sentence rather than gaining unverifiable colour.

## Next possible passes

- Add a second source line to cards whose single source is the naming article (municipal decisions, where reachable).
- Replace weak namesakes rather than rewrite cards, when a street's true namesake is documented elsewhere (the יצהר case in batch 1300).
