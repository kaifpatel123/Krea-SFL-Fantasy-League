# Krea SFL Fantasy League

A fantasy football web app for the SIAS Football League (SFL). Managers pick real players from the league's auction rosters, build a team within a credit budget, and earn points from match performances. The app supports separate MSFL and WSFL fantasy leagues.

## What the app does

- Shows league fixtures, results, standings, player statistics, fantasy leaderboards, and manager profiles.
- Lets eligible managers create a fantasy squad for each league and gameweek.
- Requires a goalkeeper, 3 defenders, 3 midfielders, and 1 forward, with a 100-credit budget.
- Has managers choose 6 starters (including the goalkeeper) and 2 outfield substitutes. Only starters score.
- Doubles the captain's points; the vice-captain is doubled if the captain does not play.
- Allows one free transfer per gameweek. Each additional transfer costs 4 points.
- Includes an admin area to manage gameweek locks, fixtures and scores, player statistics, fantasy scoring, entry payments, and the entry fee.

### Fantasy scoring

| Match event | Points |
| --- | ---: |
| Appears in a match | +1 |
| Goal (goalkeeper or defender) | +6 |
| Goal (midfielder) | +5 |
| Goal (forward) | +4 |
| Assist | +3 |
| Clean sheet (goalkeeper or defender) | +4 |
| Clean sheet (midfielder) | +1 |
| Man of the match | +3 |
| Every 2 goals conceded (goalkeeper or defender) | -1 |
| Yellow card | -1 |
| Red card | -3 |
| Own goal | -2 |
| Each transfer after the free transfer | -4 |

## How it works

1. A manager signs in with an eligible Krea Google account and chooses a display name.
2. If entry payments are enabled, the manager pays using the displayed UPI details, then submits the transaction reference and payment proof through the linked Google Form. An admin reviews the submission.
3. The manager selects a squad for an open gameweek in MSFL, WSFL, or both. The server validates the roster, positions, budget, starters, and captain choices before saving.
4. An admin enters match results and player statistics, then runs scoring for the gameweek.
5. The app stores the points and breakdown and updates fantasy leaderboards and manager pages.

League tables, fixtures, and statistics are publicly viewable. Creating a fantasy squad requires an account and, by default, an approved entry payment.

## Technology

- **Next.js 14 App Router** and **React 18** for server-rendered pages, client-side interactions, and API routes.
- **Supabase** (PostgreSQL, Auth, and `supabase-js`) for application data and Google sign-in.
- **Tailwind CSS 3** for styling.
- **Vercel** is the intended hosting platform.
- **Google Forms, Sheets, and Apps Script** can forward payment submissions to the app's secured webhook.

## Getting started

### Prerequisites

- Node.js and npm.
- A Supabase project configured with Google OAuth and the database schema expected by the app.
- A Google Form integration if you want to collect payment submissions.

### Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set the required values described below.
3. Set up the database. **The SQL files in `supabase/` do not create the entire database from scratch.** The app expects the foundational tables and columns to already exist in Supabase; the checked-in SQL adds fantasy tables/league support and imports player data. If setting up a new project, first provision the complete base schema required by the app.
4. Add the Supabase Google OAuth provider and configure the Supabase Auth redirect URL to include `http://localhost:3000/auth/callback` for local development. Add the deployed callback URL when deploying.
5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public/anonymous key used by browser and server clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key used by trusted API routes for database operations. Never expose it with a `NEXT_PUBLIC_` prefix. |
| `ADMIN_PASSCODE` | For passcode admin access | Private passcode for the `/admin` sign-in form. |
| `ADMIN_EMAILS` | Optional | Comma-separated email addresses allowed to administer the app when signed in. |
| `NEXT_PUBLIC_TEST_MODE` | No | Set to `true` only for local testing; disables normal Google sign-in requirements and enables test managers. Keep `false` in production. |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` | No | Comma-separated allowed sign-in domains. Defaults to `krea.ac.in,krea.edu.in`. |
| `REQUIRE_PAYMENT` | No | Payment gating is on by default. Set to `false` only if entry payment is intentionally disabled. |
| `NEXT_PUBLIC_GOOGLE_FORM_URL` | Optional | Player-facing Google Form URL for payment submissions. |
| `NEXT_PUBLIC_UPI_ID` | Optional | UPI ID shown on the entry payment screen. |
| `NEXT_PUBLIC_UPI_PAYEE_NAME` | Optional | Payee name shown with the UPI details. |
| `GOOGLE_FORM_WEBHOOK_SECRET` | For the form integration | Private bearer token shared with the Google Apps Script. Use a long random value and keep it secret. |

The public UPI QR image is `public/payment-qr.jpeg`. Replace it with the intended QR image before deployment if needed. Public `NEXT_PUBLIC_` values are included in the client bundle; do not put credentials or other secrets in them.

### Database and roster setup

The checked-in SQL files assume that foundational app tables are already configured in Supabase. In particular, `enable_wsfl_fantasy.sql` expects existing `players`, `profiles`, and `gameweeks` tables. It creates or updates fantasy tables and league constraints but is not a full database bootstrap.

After provisioning the base schema, run these scripts in the Supabase SQL Editor in order:

1. [`supabase/enable_wsfl_fantasy.sql`](supabase/enable_wsfl_fantasy.sql) — creates/updates fantasy squad, player-stat, and points tables and enables separate MSFL/WSFL pools.
2. [`supabase/import_players.sql`](supabase/import_players.sql) — upserts the MSFL player roster and prices.
3. [`supabase/import_wsfl_players.sql`](supabase/import_wsfl_players.sql) — upserts the WSFL player roster and prices.

The import scripts can be run again to update roster details. The application's base schema must also include the tables used for profiles, teams, gameweeks, fixtures, payments, and app settings.

### Payment form integration

When payments are enabled, configure the entry fee in the admin area and set the public Google Form and UPI details. The payment form should collect the manager's Krea email and a Google Drive screenshot link. A separate transaction reference is optional if it is visible in the screenshot. The manager must sign in and create a profile before submitting the form.

To forward form submissions:

1. Link the Google Form to a spreadsheet. In the spreadsheet, open **Extensions → Apps Script**.
2. Add the script below. Change the question titles in `firstAnswer(...)` to match the exact titles in your form. If the form has no separate transaction-reference question, leave `transactionReference` empty; admins can read it from the screenshot.
3. In Apps Script **Project Settings → Script Properties**, set `PAYMENT_WEBHOOK_URL` to `https://<your-domain>/api/payments/google-form` and `PAYMENT_WEBHOOK_SECRET` to the same value as `GOOGLE_FORM_WEBHOOK_SECRET`.
4. Run `installPaymentTrigger` once and grant the requested permissions.
5. Submit a test response and confirm it appears in the admin Payments panel.

```javascript
function forwardPaymentSubmission(event) {
  const answers = event.namedValues;
  const firstAnswer = (title) => (answers[title] || [''])[0].trim();
  const properties = PropertiesService.getScriptProperties();
  const response = UrlFetchApp.fetch(properties.getProperty('PAYMENT_WEBHOOK_URL'), {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${properties.getProperty('PAYMENT_WEBHOOK_SECRET')}`,
    },
    payload: JSON.stringify({
      email: firstAnswer('Krea Email id'),
      transactionReference: '',
      proofUrl: firstAnswer('Payment screenshot showing amount date time and reference number'),
    }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`Payment webhook failed (${response.getResponseCode()}): ${response.getContentText()}`);
  }
}

function installPaymentTrigger() {
  ScriptApp.newTrigger('forwardPaymentSubmission')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onFormSubmit()
    .create();
}
```

## Useful commands

```bash
npm run dev    # Start local development
npm run build  # Build for production
npm run start  # Serve the production build
```

There is no test or lint script currently defined in `package.json`.

## Project structure

```text
app/
  api/                 API routes for squads, managers, payments, and admin actions
  admin/               Admin dashboard
  auth/callback/       Supabase authentication callback
  leaderboard/         Fantasy standings
  manager/[id]/        Manager profile and fantasy history
  squad/               Squad selection and gameweek view
  stats/               Player statistics
  table/               League table and fixtures
components/            Shared UI and interactive components
lib/
  config.js            Squad constraints, transfer rules, and auth settings
  manager.js           Manager and admin access helpers
  payments.js          Entry payment checks and fee access
  scoring.js           Fantasy point calculation
  standings.js         League table calculations
  supabase-*.js         Supabase browser/server clients
public/                Images, logos, and payment QR
supabase/              Fantasy SQL updates and player roster imports
```

## Deployment notes

- Add all environment variables to the hosting provider (for example, Vercel) and redeploy after changing them.
- Set `NEXT_PUBLIC_TEST_MODE=false` in production and use only trusted admin emails/passcodes.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSCODE`, and `GOOGLE_FORM_WEBHOOK_SECRET` private and server-side.
- Configure the production Supabase Auth redirect URL and test Google sign-in, payment forwarding, and admin review before opening the league.
