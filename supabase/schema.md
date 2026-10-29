# Database schema (Supabase, public schema)

profiles       id uuid (= auth user id), display_name, email, budget numeric default 100, created_at
players        id uuid, name, position (GK/DEF/MID/FWD), league (MSFL/WSFL), batch, auction_team, auction_price, fantasy_price, source, created_at
teams          key, club, league (MSFL/WSFL)
fixtures       id serial, league, gameweek_no, match_date, kickoff, home, away, home_goals, away_goals
gameweeks      id serial, label, match_date, is_locked bool, is_scored bool, created_at
squads         id uuid, profile_id, gameweek_id, league (MSFL/WSFL), captain_id, vice_captain_id, transfers_used, created_at  (unique: profile_id + gameweek_id + league)
squad_players  id uuid, squad_id, player_id, is_starting
player_stats   id uuid, gameweek_id, player_id, minutes_played, goals, assists, clean_sheet, goals_conceded,
               yellow_cards, red_cards, own_goals, motm, created_at
squad_points   id uuid, squad_id, gameweek_id, points, breakdown jsonb, computed_at
wsfl_stats     id serial, name, team, goals, assists, yellow_cards, red_cards

## Manual entry payments (Google Forms + direct UPI)

Run this SQL in the Supabase SQL editor. It creates the manual payment schema and migrates
an existing Razorpay payment table. Payments and settings are only accessed through server
routes using the service-role client; RLS is enabled without client policies.

```sql
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('entry_fee_paise', '10000'::jsonb)
on conflict (key) do nothing;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  submitted_email text,
  transaction_reference text,
  proof_url text,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'rejected', 'refund_pending', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments add column if not exists submitted_email text;
alter table public.payments add column if not exists transaction_reference text;
alter table public.payments add column if not exists proof_url text;

alter table public.payments drop constraint if exists payments_status_check;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'razorpay_order_id'
  ) then
    alter table public.payments alter column razorpay_order_id drop not null;
    execute $migration$
      update public.payments
      set status = 'rejected', updated_at = now()
      where status = 'pending' and razorpay_order_id is not null
    $migration$;
  end if;
end $$;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'paid', 'rejected', 'refund_pending', 'refunded'));

create index if not exists payments_profile_status_idx on public.payments(profile_id, status);
create unique index if not exists payments_one_pending_per_profile_idx
  on public.payments(profile_id) where status = 'pending';
create unique index if not exists payments_transaction_reference_idx
  on public.payments(transaction_reference) where transaction_reference is not null;

alter table public.app_settings enable row level security;
alter table public.payments enable row level security;
```

The initial entry fee is ₹100; admins can update it from the Payments tab. Razorpay columns
on an existing table are left unused and nullable for compatibility; old pending orders are
marked rejected by the migration. New form submissions are matched to an existing profile by
the Krea email in the response and remain pending until an admin approves or rejects them.

## Importing players

To enable fantasy squads for both competitions, run these scripts in the Supabase SQL
editor in order:

1. [`enable_wsfl_fantasy.sql`](./enable_wsfl_fantasy.sql) creates any missing fantasy
   tables, adds the league column to players and squads, and allows one squad per manager,
   gameweek, and league. Existing records are assigned to MSFL.
2. [`import_players.sql`](./import_players.sql) imports or updates the MSFL roster.
3. [`import_wsfl_players.sql`](./import_wsfl_players.sql) imports or updates the WSFL roster.

Both roster imports map the sheet's Team column to `auction_team`, Starting Price to
`auction_price`, and Current Price to `fantasy_price` (the credits used by squad selection).
They upsert by case-insensitive player name, team, and league. Squads and transfers are
kept separate by league; each league uses the existing squad budget and scoring rules.
The current gameweek schedule is shared between MSFL and WSFL. Enter stats for both leagues
before scoring a gameweek; the score action calculates squads from both leagues together.
