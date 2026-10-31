-- Öffentliche Online-Reservierung (ohne Login). Gäste greifen nie direkt auf Tabellen zu, nur über diese Funktionen.
-- Regeln: Vorlauf (settings.online_lead_hours, Standard 24), Aufenthaltsdauer (settings.stay_minutes, Standard 120),
-- Zeiten (settings.open_from / open_to in Minuten, Standard 18:00-22:00), nur Tische mit online_bookable, gesperrte Tage,
-- Wetter-Reserve (ein Tisch drinnen blockiert einen passenden freien Tisch draußen).

create function _tfree(t uuid, d date, s int, dur int) returns boolean language sql stable set search_path = public as $$
  select not exists (select 1 from reservations r where (r.table_id = t or r.alt_table_id = t) and r.day = d
    and r.start_min < s + dur and s < r.start_min + r.duration_min)
$$;

create function _tpick(tm uuid, d date, s int, dur int, party int, room uuid, outdoor_only boolean)
returns uuid language sql stable set search_path = public as $$
  select tb.id from tables tb join rooms ro on ro.id = tb.room_id
  where tb.team_id = tm and tb.online_bookable and tb.min_seats <= party and party <= tb.max_seats
    and (room is null or tb.room_id = room) and (not outdoor_only or ro.outdoor) and _tfree(tb.id, d, s, dur)
  order by tb.max_seats, tb.min_seats limit 1
$$;

create function public_info(p_slug text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', t.name,
    'rooms', coalesce((select json_agg(json_build_object('id', r.id, 'name', r.name) order by r.sort) from rooms r where r.team_id = t.id), '[]'::json))
  from teams t where t.slug = p_slug
$$;

create function public_slots(p_slug text, p_day date, p_party int, p_room uuid default null)
returns table (start_min int, free boolean, pct int) language plpgsql stable security definer set search_path = public as $$
declare tm uuid; st jsonb; lead int; stay int; o_from int; o_to int; s int; cap int; now_b timestamp;
begin
  select id, settings into tm, st from teams where slug = p_slug;
  if tm is null or p_party < 1 or p_party > 30 then return; end if;
  lead := coalesce((st->>'online_lead_hours')::int, 24); stay := coalesce((st->>'stay_minutes')::int, 120);
  o_from := coalesce((st->>'open_from')::int, 1080); o_to := coalesce((st->>'open_to')::int, 1320);
  now_b := now() at time zone 'Europe/Berlin';
  select coalesce(sum(max_seats), 0) into cap from tables where team_id = tm and online_bookable;
  s := o_from;
  while s + stay <= o_to loop
    start_min := s;
    free := not exists (select 1 from day_rules where team_id = tm and day = p_day and blocked)
      and (p_day::timestamp + make_interval(mins => s)) - now_b >= make_interval(hours => lead)
      and _tpick(tm, p_day, s, stay, p_party, p_room, false) is not null;
    pct := case when cap = 0 then 100 else least(100, round(100.0 * coalesce((select sum(r.party) from reservations r
      where r.team_id = tm and r.day = p_day and r.start_min <= s and s < r.start_min + r.duration_min), 0) / cap)::int) end;
    return next; s := s + 60;
  end loop;
end $$;

create function public_book(p_slug text, p_day date, p_start int, p_party int, p_room uuid, p_name text, p_phone text, p_email text, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare tm uuid; st jsonb; stay int; tb uuid; alt uuid; g uuid; ph text; em text; rid uuid; is_out boolean; ok boolean;
begin
  select id, settings into tm, st from teams where slug = p_slug;
  if tm is null then raise exception 'Unbekanntes Restaurant'; end if;
  p_name := btrim(coalesce(p_name, '')); ph := nullif(btrim(coalesce(p_phone, '')), ''); em := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if length(p_name) < 2 or length(p_name) > 80 or (ph is null and em is null) or length(coalesce(ph, '')) > 30 or length(coalesce(em, '')) > 120
     or length(coalesce(p_note, '')) > 500 then raise exception 'Bitte Name sowie Telefon oder E-Mail angeben'; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-Mail-Adresse ungültig'; end if;
  perform pg_advisory_xact_lock(hashtext(tm::text));
  select free into ok from public_slots(p_slug, p_day, p_party, p_room) where start_min = p_start;
  if not coalesce(ok, false) then raise exception 'Zu dieser Zeit ist nichts mehr frei'; end if;
  if (select count(*) from reservations r join guests gg on gg.id = r.guest_id where r.team_id = tm and r.source = 'online' and r.day >= current_date
        and ((ph is not null and gg.phone = ph) or (em is not null and lower(gg.email) = em))) >= 3
    then raise exception 'Zu viele offene Online-Reservierungen mit diesen Kontaktdaten. Bitte ruf uns an.'; end if;
  stay := coalesce((st->>'stay_minutes')::int, 120);
  tb := _tpick(tm, p_day, p_start, stay, p_party, p_room, false);
  select ro.outdoor into is_out from tables t join rooms ro on ro.id = t.room_id where t.id = tb;
  if not is_out then alt := _tpick(tm, p_day, p_start, stay, p_party, null, true); end if;
  select id into g from guests where team_id = tm and ((ph is not null and regexp_replace(phone, '\D', '', 'g') = regexp_replace(ph, '\D', '', 'g') and length(regexp_replace(ph, '\D', '', 'g')) >= 6)
    or (em is not null and lower(email) = em)) limit 1;
  if g is null then insert into guests (team_id, name, phone, email) values (tm, p_name, ph, em) returning id into g; end if;
  insert into reservations (team_id, guest_id, table_id, alt_table_id, day, start_min, duration_min, party, source, note)
    values (tm, g, tb, alt, p_day, p_start, stay, p_party, 'online', nullif(btrim(coalesce(p_note, '')), '')) returning id into rid;
  return json_build_object('id', rid);
end $$;

revoke execute on function _tfree(uuid, date, int, int), _tpick(uuid, date, int, int, int, uuid, boolean) from anon, authenticated, public;
revoke execute on function public_info(text), public_slots(text, date, int, uuid), public_book(text, date, int, int, uuid, text, text, text, text) from public;
grant execute on function public_info(text), public_slots(text, date, int, uuid), public_book(text, date, int, int, uuid, text, text, text, text) to anon, authenticated;
