# Going live: Google Sheet and organizer sign-in

About 20 minutes, once. Until it's done, the site runs in demo mode: entries stay on each visitor's device.

You'll end up with:

- A Google Sheet that only you can open (share it with other organizers if you like). Each week gets its own tab, and winners go on a **Winners** tab.
- An organizer panel on the site that only opens for Google accounts on your list.

## 1. Make the Sheet and add the script

1. Go to [sheets.new](https://sheets.new) and name the sheet, for example *Shnayim Mikra Raffle*.
2. Open **Extensions → Apps Script**. Delete the sample code, paste all of [`server/Code.gs`](server/Code.gs), and click **Save**.
3. In the function menu at the top, pick **setup** and click **Run**. Google asks you to authorize the script. It's your own script, so on the "Google hasn't verified this app" screen choose **Advanced → Go to (project name)**, then **Allow**.

## 2. Create the Google sign-in client ID

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create a project, for example *Shnayim Mikra*.
2. Go to **APIs & Services → OAuth consent screen** (newer consoles call it **Google Auth Platform**). Choose **External**, enter an app name and your email, and save. Under **Audience**, click **Publish app** so any Google account can sign in. Sign-in only reads the email address, so Google doesn't need to review it.
3. Go to **Credentials** (or **Clients**) → **Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://azm-cmd.github.io`
4. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`.

## 3. Tell the script who the organizers are

In Apps Script, open **Project Settings** (gear icon) → **Script properties** and add:

| Property | Value |
| --- | --- |
| `ORGANIZERS` | Organizer Google emails, separated by commas, e.g. `gabbai@gmail.com, second@gmail.com` |
| `GOOGLE_CLIENT_ID` | The client ID from step 2 |

You can change `ORGANIZERS` any time. It takes effect immediately.

## 4. Deploy the web app

1. In Apps Script, click **Deploy → New deployment**, then the gear next to *Select type* → **Web app**.
2. **Execute as:** Me. **Who has access:** Anyone.
3. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

"Anyone" lets members submit entries without signing in. Entries and contacts stay private: the script only gives them to a signed-in organizer on your list, and the public site only ever shows winners' short names, like "Shmuel C."

## 5. Connect the site

Put both values in [`js/config.js`](js/config.js) and push to `master`:

```js
CSM.SERVICE = {
  api: 'https://script.google.com/macros/s/…/exec',
  googleClientId: '1234-abc.apps.googleusercontent.com'
};
```

Then check it: enter the raffle on the live site (while entries are open) and the row appears in the Sheet. Open **Organizer**, sign in with Google, and you should see it.

## Updating the script later

Paste the new code, then **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.

## Capacity

Sized for 1,000 or more entries a week:

- **Storage.** About 7 cells per entry. 1,000 a week for a year is roughly 360,000 cells, against Google Sheets' 10 million.
- **Bursts.** Entries are written without a shared lock, so they don't queue behind each other. Apps Script runs up to 30 requests at once. A rough flood guard turns away anything past 600 entries in a single minute, far above what a group this size sends.
- **Duplicates.** Each email or phone number can enter once per parsha. In the rare case two identical entries land at the same instant, the draw still counts that person once.

## Spam and abuse

- The server checks every entry: the window must be open for that parsha, the name and contact must be valid, and the contact can't be a duplicate.
- A hidden form field catches simple bots.
- Names that start with `=`, `+`, `-` or `@` are stored as plain text, so they can't run as spreadsheet formulas.
- If junk gets through, remove it from the organizer panel or delete the row in the Sheet.
