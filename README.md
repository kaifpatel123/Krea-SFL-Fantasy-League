# SFL Fantasy (FSFL)

Fantasy league for the SIAS Football League. Next.js 14 (App Router) + Supabase + Tailwind, deployed on Vercel.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys (ask Vishant for the Supabase keys and admin passcode).
3. `npm run dev`

## Structure
- `app/`: pages (home, squad picker, league table, stats, fantasy leaderboard, admin, login) and API routes in `app/api/`
- `components/`: UI (SquadBuilder, AdminPanel, etc.)
- `lib/config.js`: squad rules (8 players, 1 GK / 3 DEF / 3 MID / 1 FWD, 100 credit budget) and the test-mode switch
- `lib/scoring.js`: fantasy points engine
- `lib/manager.js`: current-user and admin checks
- `supabase/schema.md`: database tables

## Notes
- Test mode is currently ON: sign-in is skipped and managers are created with just a team name (cookie-based).
  Set `NEXT_PUBLIC_TEST_MODE=false` to switch to Supabase magic-link sign-in.
- Server routes use the Supabase service role key, so all writes go through the API routes.
- Env vars must be added manually in the Vercel dashboard.
- Admin: go to `/admin` and enter the passcode to lock gameweeks, enter results and player stats, and run scoring.
