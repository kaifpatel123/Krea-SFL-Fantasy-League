# SFL Fantasy (FSFL)

Fantasy league for the SIAS Football League. Next.js 14 (App Router) + Supabase + Tailwind, deployed on Vercel.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys (ask Vishant for the Supabase keys and admin passcode).
3. Run the payment-table SQL in `supabase/schema.md` in the Supabase SQL editor.
4. Configure Razorpay API keys and a webhook secret in `.env.local`.
5. `npm run dev`

## Structure
- `app/`: pages (home, squad picker, league table, stats, fantasy leaderboard, admin, login) and API routes in `app/api/`
- `components/`: UI (SquadBuilder, AdminPanel, etc.)
- `lib/config.js`: squad rules (8 players, 1 GK / 3 DEF / 3 MID / 1 FWD, 100 credit budget) and the test-mode switch
- `lib/scoring.js`: fantasy points engine
- `lib/manager.js`: current-user and admin checks
- `lib/payments.js` and `lib/razorpay.js`: verified Razorpay entry payments and access checks
- `supabase/schema.md`: database tables

## Notes
- Krea Google sign-in is required by default. Set `NEXT_PUBLIC_TEST_MODE=true` only for local testing;
  test managers should never be enabled in production.
- Krea Google sign-in and the one-time entry fee are required to create a fantasy squad. League
  tables, fixtures, and stats remain publicly viewable. Razorpay confirmation is verified server-side;
  configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the local
  environment and deployment platform. Never expose the key secret in a `NEXT_PUBLIC_` variable.
- `REQUIRE_PAYMENT` defaults to `true`; set it to `false` only when payment gating is intentionally
  disabled. Production should also keep `NEXT_PUBLIC_TEST_MODE=false` so only Krea accounts can sign in.
- Razorpay Checkout must have UPI enabled. Point its webhook to `/api/payments/webhook` and subscribe
  to `payment.captured` and `refund.processed`.
- Server routes use the Supabase service role key, so all writes go through the API routes.
- Env vars must be added manually in the Vercel dashboard.
- Admin: go to `/admin` and enter the passcode to lock gameweeks, enter results and player stats, run scoring,
  and view/export/refund payments or configure the entry fee.
