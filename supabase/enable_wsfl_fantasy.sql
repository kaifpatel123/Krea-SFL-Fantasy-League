-- Add separate MSFL / WSFL fantasy pools and allow one squad per league per gameweek.
BEGIN;

CREATE TABLE IF NOT EXISTS public.player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gameweek_id integer NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  minutes_played integer NOT NULL DEFAULT 0,
  goals integer NOT NULL DEFAULT 0,
  assists integer NOT NULL DEFAULT 0,
  clean_sheet boolean NOT NULL DEFAULT false,
  goals_conceded integer NOT NULL DEFAULT 0,
  yellow_cards integer NOT NULL DEFAULT 0,
  red_cards integer NOT NULL DEFAULT 0,
  own_goals integer NOT NULL DEFAULT 0,
  motm boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gameweek_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gameweek_id integer NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  league text NOT NULL DEFAULT 'MSFL',
  captain_id uuid REFERENCES public.players(id),
  vice_captain_id uuid REFERENCES public.players(id),
  transfers_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.squad_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id),
  is_starting boolean NOT NULL DEFAULT true,
  UNIQUE (squad_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.squad_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  gameweek_id integer NOT NULL REFERENCES public.gameweeks(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, gameweek_id)
);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS league text NOT NULL DEFAULT 'MSFL';

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_name_team_idx;

DROP INDEX IF EXISTS public.players_name_team_idx;

CREATE UNIQUE INDEX IF NOT EXISTS players_name_team_league_idx
  ON public.players (lower(name), auction_team, league);

ALTER TABLE public.squads
  ADD COLUMN IF NOT EXISTS league text NOT NULL DEFAULT 'MSFL';

ALTER TABLE public.squads
  DROP CONSTRAINT IF EXISTS squads_profile_id_gameweek_id_key;

DROP INDEX IF EXISTS public.squads_profile_id_gameweek_id_key;

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint AS c
    WHERE c.conrelid = 'public.squads'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM unnest(c.conkey) AS key(attnum)
        JOIN pg_attribute AS a
          ON a.attrelid = c.conrelid
         AND a.attnum = key.attnum
      ) = ARRAY['gameweek_id', 'profile_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.squads DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS squads_profile_gameweek_league_idx
  ON public.squads (profile_id, gameweek_id, league);

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_league_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_league_check CHECK (league IN ('MSFL', 'WSFL'));

ALTER TABLE public.squads
  DROP CONSTRAINT IF EXISTS squads_league_check;

ALTER TABLE public.squads
  ADD CONSTRAINT squads_league_check CHECK (league IN ('MSFL', 'WSFL'));

COMMIT;
