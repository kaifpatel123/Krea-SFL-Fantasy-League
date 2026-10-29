-- Import WSFL players from the WSFL sheet in SFL_Players_by_Team.xlsx.
-- Team maps to auction_team; Starting Price maps to auction_price; Current Price maps to fantasy_price (credits).
-- Upserts by case-insensitive name, team, and league; safe to run again after enable_wsfl_fantasy.sql.
INSERT INTO public.players (name, position, auction_team, auction_price, fantasy_price, source, league)
SELECT incoming.name, incoming.position, incoming.auction_team,
       incoming.auction_price, incoming.fantasy_price, 'SFL_Players_by_Team.xlsx', 'WSFL'
FROM (VALUES
  ('Aarushi Gudepkar', 'GK', 'Yutika Mehrotra', 8.0, 8.0),
  ('Aarna', 'DEF', 'Yutika Mehrotra', 6.0, 6.0),
  ('Arushi Ganesh', 'DEF', 'Yutika Mehrotra', 10.0, 10.0),
  ('Umi', 'DEF', 'Yutika Mehrotra', 6.0, 6.0),
  ('Eeksha', 'MID', 'Yutika Mehrotra', 7.0, 7.0),
  ('Sagarika Ghanagam', 'MID', 'Yutika Mehrotra', 9.0, 9.0),
  ('Samedha Selvam', 'MID', 'Yutika Mehrotra', 6.0, 6.0),
  ('Treia Menon', 'FWD', 'Yutika Mehrotra', 23.0, 23.0),
  ('Anika Chakraborty', 'GK', 'Ria Deo', 13.0, 13.0),
  ('Diya Pradeep Kumar', 'DEF', 'Ria Deo', 6.0, 6.0),
  ('Harshita Bhandari', 'DEF', 'Ria Deo', 6.5, 6.5),
  ('Kadambari', 'DEF', 'Ria Deo', 14.5, 14.5),
  ('Mitali N', 'MID', 'Ria Deo', 14.5, 14.5),
  ('Nehhal Golchha', 'MID', 'Ria Deo', 6.0, 6.0),
  ('Asmi Beniwal', 'FWD', 'Ria Deo', 6.0, 6.0),
  ('Saranya Bagga', 'FWD', 'Ria Deo', 10.0, 10.0),
  ('Angel', 'GK', 'Antim Khare', 6.0, 6.0),
  ('Denuka', 'GK', 'Antim Khare', 6.0, 6.0),
  ('Akshara Prasanna', 'DEF', 'Antim Khare', 6.0, 6.0),
  ('Sayie', 'DEF', 'Antim Khare', 7.0, 7.0),
  ('Mehak', 'MID', 'Antim Khare', 17.5, 17.5),
  ('Suhani Medhekar', 'MID', 'Antim Khare', 6.0, 6.0),
  ('Mishka Katyayan', 'FWD', 'Antim Khare', 20.0, 20.0),
  ('Pallavi', 'FWD', 'Antim Khare', 8.0, 8.0),
  ('Aathirai', 'DEF', 'Khushi Kumari Singh', 6.0, 6.0),
  ('Anaiya Marwah', 'DEF', 'Khushi Kumari Singh', 6.0, 6.0),
  ('Urvi Jain', 'DEF', 'Khushi Kumari Singh', 6.0, 6.0),
  ('Deepa', 'MID', 'Khushi Kumari Singh', 22.5, 22.5),
  ('Haasini Reddy', 'MID', 'Khushi Kumari Singh', 6.0, 6.0),
  ('Inaara Tayal', 'MID', 'Khushi Kumari Singh', 6.5, 6.5),
  ('Sia', 'MID', 'Khushi Kumari Singh', 6.0, 6.0),
  ('Mahalaxmi Kumaran', 'FWD', 'Khushi Kumari Singh', 10.0, 10.0)
) AS incoming(name, position, auction_team, auction_price, fantasy_price)
ON CONFLICT (lower(name), auction_team, league) DO UPDATE
SET position = EXCLUDED.position,
    auction_price = EXCLUDED.auction_price,
    fantasy_price = EXCLUDED.fantasy_price,
    source = EXCLUDED.source;
