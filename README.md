# LearnLoop

A skill-exchange platform with two tracks:
- **Browse Skills** — free, peer-to-peer skill swaps (8 skills).
- **Learn a New Skill** — paid, professionally taught courses requiring a Pro subscription (₹499/month).

Built with Node.js, Express, and EJS templates. Deploys easily on [Render](https://render.com).

## Pages

| Page | Route |
|---|---|
| Home | `/` |
| Browse Skills (free) | `/skills` |
| One free skill article | `/skills/:slug` |
| Learn a New Skill (paid) | `/learn` |
| One paid course article | `/learn/:slug` |
| How It Works | `/how-it-works` |
| Pricing | `/pricing` |
| FAQ | `/faq` |
| Privacy Policy | `/privacy` |
| Join (registration form) | `/join` |
| Registration success | `/join/success` |
| CSV export of all registrations (admin only) | `/admin/export?key=YOUR_ADMIN_KEY` |

## Running it locally

1. Install [Node.js](https://nodejs.org) 18 or newer.
2. In this folder, install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your real values (see "Setting up confirmation emails" below).
4. Start the server:
   ```
   npm start
   ```
5. Open `http://localhost:3000` in your browser.

## Setting up confirmation emails

When someone submits the Join form, the site:
1. Saves their registration (with a unique ID like `LL-9F3A2C1B`) to `data/registrations.json`.
2. Emails **them** a confirmation with their registration ID.
3. Emails **you** (the admin) a copy of the new registration.

To enable this, you need SMTP credentials. The easiest free option is Gmail:

1. Turn on 2-Step Verification on your Google account.
2. Go to <https://myaccount.google.com/apppasswords> and create an "App Password" for Mail.
3. Use these values:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=youraddress@gmail.com
   SMTP_PASS=the 16-character app password (not your normal Gmail password)
   FROM_EMAIL="LearnLoop <youraddress@gmail.com>"
   ADMIN_NOTIFY_EMAIL=youraddress@gmail.com
   ```
   Any other SMTP provider (Brevo, SendGrid, Resend, Mailgun) works the same way — just swap in their host/port/credentials.

If you skip this setup, the site still works and still saves registrations — it just won't send emails (you'll see a warning in the server logs).

## Tracking registrations (the "spreadsheet" requirement)

Every registration is saved to `data/registrations.json` on the server. To get them as a spreadsheet:

- Visit `https://your-site-url/admin/export?key=YOUR_ADMIN_KEY` (set `ADMIN_KEY` in your environment variables first) — this downloads a `.csv` file you can open directly in Excel or Google Sheets.

**Important caveat for Render's free tier:** the filesystem resets on every deploy or restart, so `registrations.json` is not permanent storage there. For a class project / demo this is fine — just export your CSV before redeploying. For a real production site, the fix is to add Render's free Postgres database and swap the `readRegistrations`/`writeRegistrations` functions in `server.js` for database calls, or point the form at a Google Sheets webhook instead.

## Deploying to Render (step by step)

1. **Push this code to GitHub first** (Render deploys from a GitHub repo, it doesn't accept a zip upload):
   - Go to <https://github.com/new>, create a new repository (e.g. `learnloop`), keep it empty (no README/.gitignore from GitHub).
   - On your computer, unzip this project, then in that folder run:
     ```
     git init
     git add .
     git commit -m "Initial LearnLoop site"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/learnloop.git
     git push -u origin main
     ```
2. **Create the Render service:**
   - Go to <https://dashboard.render.com> → **New** → **Web Service**.
   - Connect your GitHub account and select the `learnloop` repo.
   - Settings:
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Instance Type:** Free is fine for a class project.
3. **Add environment variables** (Render dashboard → your service → **Environment** tab), matching `.env.example`:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `ADMIN_NOTIFY_EMAIL`, `ADMIN_KEY`
   - (`PORT` is set automatically by Render — don't add it yourself.)
4. Click **Create Web Service**. Render will build and deploy automatically; you'll get a live URL like `https://learnloop.onrender.com`.
5. Every time you push a new commit to GitHub, Render redeploys automatically.

## Editing content

- **Free skills:** edit `data/skills.js` — one object per skill, with `whatIsIt`, `duration`, `topics`, `howExchangeWorks`, `steps`, `whyThisWay`, and `whoFor`.
- **Paid "Learn a New Skill" courses:** edit `data/premiumSkills.js` the same way.
- **Pricing numbers:** edit `views/pricing.ejs` directly.
- **Colors/fonts:** edit the `:root` variables at the top of `public/css/style.css`.

## Project structure

```
learnloop-render/
├── server.js              Express app, routes, email sending, CSV export
├── package.json
├── .env.example            Template for environment variables
├── data/
│   ├── skills.js            8 free skill-exchange articles
│   └── premiumSkills.js     4 paid "Learn a New Skill" courses
├── views/                  EJS templates (one per page)
│   └── partials/           Shared header/footer
└── public/
    ├── css/style.css
    └── js/main.js           Mobile menu toggle
```
