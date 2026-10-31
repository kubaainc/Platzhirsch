-- Bereiche sperren: rooms.closed = dauerhaft zu, rooms.closed_ranges = Zeiträume [{"from":"2026-11-01","to":"2027-03-31"}] (beide Tage inklusive).
-- Gesperrte Bereiche gibt es online nicht (keine Tische, auch nicht als Wetter-Reserve). Das Team kann intern weiter eintragen.
alter table rooms add column closed boolean not null default false;
alter table rooms add column closed_ranges jsonb not null default '[]'::jsonb;

create function _room_closed(rid uuid, d date) returns boolean language sql stable set search_path = public as $$
  select coalesce((select r.closed or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(r.closed_ranges) = 'array' then r.closed_ranges else '[]'::jsonb end) x
      where d between (x->>'from')::date and (x->>'to')::date)
    from rooms r where r.id = rid), false)
$$;
revoke execute on function _room_closed(uuid, date) from anon, authenticated, public;

create or replace function _tpick(tm uuid, d date, s int, dur int, party int, room uuid, outdoor_only boolean)
returns uuid language sql stable set search_path = public as $$
  select tb.id from tables tb join rooms ro on ro.id = tb.room_id
  where tb.team_id = tm and tb.online_bookable and tb.min_seats <= party and party <= tb.max_seats
    and (room is null or tb.room_id = room) and (not outdoor_only or ro.outdoor) and not _room_closed(ro.id, d) and _tfree(tb.id, d, s, dur)
  order by tb.max_seats, tb.min_seats limit 1
$$;

create or replace function public_info(p_slug text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', t.name,
    'rooms', coalesce((select json_agg(json_build_object('id', r.id, 'name', r.name) order by r.sort) from rooms r where r.team_id = t.id and not r.closed), '[]'::json))
  from teams t where t.slug = p_slug
$$;
