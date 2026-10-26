# Database schema (Supabase, public schema)

profiles       id uuid (= auth user id), display_name, email, budget numeric default 100, created_at
players        id uuid, name, position (GK/DEF/MID/FWD), batch, auction_team, auction_price, fantasy_price, source, created_at
teams          key, club, league (MSFL/WSFL)
fixtures       id serial, league, gameweek_no, match_date, kickoff, home, away, home_goals, away_goals
gameweeks      id serial, label, match_date, is_locked bool, is_scored bool, created_at
squads         id uuid, profile_id, gameweek_id, captain_id, vice_captain_id, transfers_used, created_at  (unique: profile_id + gameweek_id)
squad_players  id uuid, squad_id, player_id, is_starting
player_stats   id uuid, gameweek_id, player_id, minutes_played, goals, assists, clean_sheet, goals_conceded,
               yellow_cards, red_cards, own_goals, motm, created_at
squad_points   id uuid, squad_id, gameweek_id, points, breakdown jsonb, computed_at
wsfl_stats     id serial, name, team, goals, assists, yellow_cards, red_cards
