# Chevra Shnayim Mikra

A static site for a shnayim mikra v'echad targum group: this week's parsha, one aliyah a day, and a weekly raffle check-in.

## Structure

```
index.html        Page markup
css/styles.css    All styles (light and dark themes)
js/data.js        Settings, parshiyos, aliyos, pesukim per perek
js/sefaria.js     Loads Mikra and Targum Onkelos from Sefaria
js/app.js         Hero, day strip, reader, check-in, organizer sheet
```

No build step. Open `index.html` directly, or serve the folder with any static host (for example GitHub Pages).

## Daily aliyah

The strip under the parsha title shows Rishon through Shevi'i (Sunday through Shabbos), with today highlighted. Each ring fills as pesukim are marked read. Tapping a day opens that aliyah pasuk by pasuk, with the Hebrew text and Targum Onkelos.

- Aliyah divisions are the standard weekday-reading divisions (the same as Hebcal and Sefaria), stored in `js/data.js`.
- Text is fetched in the browser from the [Sefaria](https://www.sefaria.org) API: *Miqra according to the Masorah* and *Targum Onkelos*. Each aliyah is cached on the device after it loads.
- The strip follows the coming Shabbos's parsha. On Sunday through Tuesday the raffle card can still show last week's parsha, because check-in stays open until Wednesday.

## Prototype limits

Entries, winners and reading progress are saved in the visitor's browser (`localStorage`), not on a server. The organizer code in `js/data.js` is visible in the page source.
