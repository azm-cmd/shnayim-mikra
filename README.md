# Chevra Shnayim Mikra

A static site for a shnayim mikra v'echad targum group: this week's parsha, one aliyah a day, and a weekly raffle check-in.

## Structure

```
index.html        Page markup
css/styles.css    All styles (light and dark themes)
js/config.js      Live-service settings (see SETUP.md)
js/data.js        Settings, parshiyos, aliyos, entry window
js/sefaria.js     Loads Mikra and Targum Onkelos from Sefaria
js/service.js     Raffle API client and Sign in with Google
js/app.js         Hero, day strip, reader, check-in, organizer sheet
server/Code.gs    Google Apps Script: entries in a Google Sheet, organizer checks
tests/            Server and entry-window tests (node --test)
fonts/            Noto Sans Hebrew, for the reading text
```

Live site: https://azm-cmd.github.io/shnayim-mikra/

No build step. Open `index.html` directly, or serve the folder with any static host. GitHub Pages serves it from the root of `master`; every push to `master` updates the live site.

## Daily aliyah

The strip under the parsha title shows Rishon through Shevi'i (Sunday through Shabbos), with today highlighted. Tapping a day opens that aliyah pasuk by pasuk, with the Hebrew text and Targum Onkelos.

- **Progress fills in as you scroll.** A pasuk counts as read once it has been on screen for 1.5 seconds and has scrolled up past a line 30% from the top. Flicking straight to the end doesn't count. Reopening a day picks up at the first unread pasuk. "Mark all pesukim read" covers learning from a printed Chumash.
- **Double pasuk** prints each pasuk twice, then the Targum, so you can read straight down. **Ta'amim** turns the cantillation marks on or off. Both settings are remembered.
- The reading text is set in Noto Sans Hebrew, a sans close to the Heebo used on the main page. Heebo itself has no ta'amim. The font is hosted in `fonts/` (SIL Open Font License).

- Aliyah divisions are the standard weekday-reading divisions (the same as Hebcal and Sefaria), stored in `js/data.js`.
- Text is fetched in the browser from the [Sefaria](https://www.sefaria.org) API: *Miqra according to the Masorah* and *Targum Onkelos*. Each aliyah is cached on the device after it loads.
- The strip follows the coming Shabbos's parsha. On Sunday through Tuesday the raffle card can still show last week's parsha, because check-in stays open until Wednesday.

## Raffle entries

Entries go to a Google Sheet through a small Google Apps Script (`server/Code.gs`), with one tab per week. It's sized for 1,000 or more entries a week. The organizer panel opens only after Sign in with Google, and the server checks the account against an organizer list. [SETUP.md](SETUP.md) walks through connecting it.

Until `js/config.js` is filled in, the site runs in **demo mode**: entries and winners stay on the visitor's device, and the organizer panel opens with demo tools.

## Tests

```
node --test
```

This runs `server/Code.gs` against an in-memory Google Sheet. It checks entries, duplicates, closed windows, the Google sign-in checks, a 1,000-entry week, and that the entry window matches the site exactly.
