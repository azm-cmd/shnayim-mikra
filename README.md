# Chevra Shnayim Mikra

A static site for a shnayim mikra v'echad targum group: this week's parsha, one aliyah a day, and a weekly raffle check-in.

## Structure

```
index.html        Page markup
css/styles.css    All styles (light and dark themes)
js/data.js        Settings, parshiyos, aliyos, pesukim per perek
js/sefaria.js     Loads Mikra and Targum Onkelos from Sefaria
js/app.js         Hero, day strip, reader, check-in, organizer sheet
fonts/            Cardo Hebrew, for the reading text
```

Live site: https://azm-cmd.github.io/shnayim-mikra/

No build step. Open `index.html` directly, or serve the folder with any static host. GitHub Pages serves it from the root of `master`; every push to `master` updates the live site.

## Daily aliyah

The strip under the parsha title shows Rishon through Shevi'i (Sunday through Shabbos), with today highlighted. Tapping a day opens that aliyah pasuk by pasuk, with the Hebrew text and Targum Onkelos.

- **Progress fills in as you scroll.** A pasuk counts as read once it has been on screen for 1.5 seconds and has scrolled up past a line 30% from the top. Flicking straight to the end doesn't count. Reopening a day picks up at the first unread pasuk. "Mark all pesukim read" covers learning from a printed Chumash.
- **Double pasuk** prints each pasuk twice, then the Targum, so you can read straight down. **Ta'amim** turns the cantillation marks on or off. Both settings are remembered.
- The reading text is set in Cardo, which supports full nikud and ta'amim. It's hosted in `fonts/` (SIL Open Font License).

- Aliyah divisions are the standard weekday-reading divisions (the same as Hebcal and Sefaria), stored in `js/data.js`.
- Text is fetched in the browser from the [Sefaria](https://www.sefaria.org) API: *Miqra according to the Masorah* and *Targum Onkelos*. Each aliyah is cached on the device after it loads.
- The strip follows the coming Shabbos's parsha. On Sunday through Tuesday the raffle card can still show last week's parsha, because check-in stays open until Wednesday.

## Prototype limits

Entries, winners and reading progress are saved in the visitor's browser (`localStorage`), not on a server. The organizer code in `js/data.js` is visible in the page source.
