# SFL Fantasy (FSFL)

Fantasy league for the SIAS Football League. Next.js 14 (App Router) + Supabase + Tailwind, deployed on Vercel.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys (ask Vishant for the Supabase keys and admin passcode).
3. Run the payment-table SQL in `supabase/schema.md` in the Supabase SQL editor.
4. For fantasy data setup, run the three player/league SQL scripts listed in order in `supabase/schema.md`.
5. Configure the Google Form URL, public payment QR image URL, and a random form webhook secret
   in `.env.local` and in the deployment platform.
6. `npm run dev`

## Structure
- `app/`: pages (home, squad picker, league table, stats, fantasy leaderboard, admin, login) and API routes in `app/api/`
- `components/`: UI (SquadBuilder, AdminPanel, etc.)
- `lib/config.js`: squad rules (8 players, 1 GK / 3 DEF / 3 MID / 1 FWD, 100 credit budget) and the test-mode switch
- `lib/scoring.js`: fantasy points engine
- `lib/manager.js`: current-user and admin checks
- `lib/payments.js`: manual entry-payment access checks
- `supabase/schema.md`: database tables
- `supabase/enable_wsfl_fantasy.sql` and the two player import scripts: separate MSFL/WSFL squads and rosters

## Notes
- Krea Google sign-in is required by default. Set `NEXT_PUBLIC_TEST_MODE=true` only for local testing;
  test managers should never be enabled in production.
- Krea Google sign-in and admin approval of the one-time entry fee are required to create a
  fantasy squad. League tables, fixtures, and stats remain publicly viewable. Players pay using
  the official QR, then submit their Krea email, transaction reference, and screenshot in the
  Google Form. The linked spreadsheet forwards each response to the app for admin review.
- `REQUIRE_PAYMENT` defaults to `true`; set it to `false` only when payment gating is intentionally
  disabled. Production should also keep `NEXT_PUBLIC_TEST_MODE=false` so only Krea accounts can sign in.
- `NEXT_PUBLIC_GOOGLE_FORM_URL` is the player-facing form link. The entry payment page shows
  `public/payment-qr.jpeg`; replace that file with the official UPI QR and deploy the change.
  `NEXT_PUBLIC_UPI_ID` and `NEXT_PUBLIC_UPI_PAYEE_NAME` configure the public UPI details shown
  alongside it. Set these `NEXT_PUBLIC_` values in Vercel and redeploy after changing them.
- `GOOGLE_FORM_WEBHOOK_SECRET` must be a long random value. Keep it private; do not use a
  `NEXT_PUBLIC_` variable for it.
- Server routes use the Supabase service role key, so all writes go through the API routes.
- Env vars must be added manually in the Vercel dashboard.
- Admin: go to `/admin` and enter the passcode to lock gameweeks, enter results and player stats, run scoring,
  and view proof, approve/reject payments, export records, or configure the entry fee.

### Connect Google Forms to payment review

1. Add these questions to the form: **Krea email**, **Transaction reference**, and a screenshot
   file-upload question. Require the email and screenshot. Make sure the form collects the same
   email the player uses to sign in to the league, restrict file uploads to trusted accounts, and
   give payment admins access to the uploaded files in Drive.
2. Link the form to a Google spreadsheet. In the linked spreadsheet, open **Extensions → Apps
   Script** and add the script below. Replace the three question titles if your form uses different
   labels.
3. In Apps Script **Project Settings → Script Properties**, add `PAYMENT_WEBHOOK_URL` with value
   `https://<your-domain>/api/payments/google-form` and `PAYMENT_WEBHOOK_SECRET` with the same
   private value as `GOOGLE_FORM_WEBHOOK_SECRET`.
4. Run `installPaymentTrigger` once and grant the requested permissions. Submit a test response,
   confirm it appears in the admin Payments tab, then delete/reject the test record.
5. Players must sign in and complete their manager profile before submitting the form so their Krea
   email already exists in the league.

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
      email: firstAnswer('Krea email'),
      transactionReference: firstAnswer('Transaction reference'),
      proofUrl: firstAnswer('Payment screenshot'),
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
