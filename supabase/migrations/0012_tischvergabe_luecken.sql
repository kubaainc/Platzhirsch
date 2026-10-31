-- Automatische Tischvergabe: unter den freien, passenden Tischen (bis zur doppelten Größe des kleinsten)
-- zuerst der mit Anschluss an eine andere Reservierung (wenig Leerlauf davor oder danach), dann der kleinste.

create or replace function _tpick(tm uuid, d date, s int, dur int, party int, room uuid, outdoor_only boolean)
returns uuid language sql stable set search_path = public as $$
  with c as (
    select tb.id, tb.max_seats, tb.min_seats,
      least(
        coalesce((select s - max(r.start_min + r.duration_min) from reservations r
          where (r.table_id = tb.id or r.alt_table_id = tb.id) and r.day = d and r.start_min + r.duration_min <= s), 240),
        coalesce((select min(r.start_min) - (s + dur) from reservations r
          where (r.table_id = tb.id or r.alt_table_id = tb.id) and r.day = d and r.start_min >= s + dur), 240),
        240) as slack
    from tables tb join rooms ro on ro.id = tb.room_id
    where tb.team_id = tm and tb.online_bookable and tb.min_seats <= party and party <= tb.max_seats
      and (room is null or tb.room_id = room) and (not outdoor_only or ro.outdoor) and not _room_closed(ro.id, d) and _tfree(tb.id, d, s, dur)
  )
  select id from c where max_seats <= 2 * (select min(max_seats) from c)
  order by slack, max_seats, min_seats limit 1
$$;
