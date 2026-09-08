-- Preserve player identity and weekly locks. Historical city matches remain
-- unchanged and do not count toward country standings.
UPDATE players SET city_code = 'TR'
WHERE city_code IN ('IST','ANK','IZM','BUR','TRA','RIZ','ADA','ANT');
