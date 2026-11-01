-- Tisch T13 (Restaurant, 1–14 Personen) wurde versehentlich gelöscht und wird mit den ursprünglichen Werten wiederhergestellt.
insert into tables (team_id, room_id, label, min_seats, max_seats, online_bookable, placed, x, y, w, h, rot, round)
select r.team_id, r.id, 'T13', 1, 14, true, true, 853, 263, 62, 80, 0, false
from rooms r
where r.id = 'e6ac35a9-58c0-4ef8-a5fa-30a357ef14d6'
  and not exists (select 1 from tables t where t.room_id = r.id and t.label = 'T13');
