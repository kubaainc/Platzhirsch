-- Gast-Storno: jede Reservierung bekommt ein geheimes Token (Link /s/<token>). Stornieren geht bis cancel_hours (Standard 24) vor Beginn.
alter table reservations add column cancel_token uuid not null default gen_random_uuid();
create unique index reservations_cancel_token_idx on reservations (cancel_token);

create or replace function public_book(p_slug text, p_day date, p_start int, p_party int, p_room uuid, p_name text, p_phone text, p_email text, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare tm uuid; st jsonb; stay int; tb uuid; alt uuid; g uuid; ph text; em text; rid uuid; tok uuid; is_out boolean; ok boolean;
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
    values (tm, g, tb, alt, p_day, p_start, stay, p_party, 'online', nullif(btrim(coalesce(p_note, '')), '')) returning id, cancel_token into rid, tok;
  return json_build_object('id', rid, 'token', tok);
end $$;

create function public_cancel_info(p_token uuid) returns json language plpgsql stable security definer set search_path = public as $$
declare r record; ch int; can boolean;
begin
  select re.day, re.start_min, re.party, g.name as guest, ro.name as room, tm.name as team, tm.settings as st into r
    from reservations re join teams tm on tm.id = re.team_id
    left join guests g on g.id = re.guest_id left join tables t on t.id = re.table_id left join rooms ro on ro.id = t.room_id
    where re.cancel_token = p_token;
  if not found then return null; end if;
  ch := coalesce((r.st->>'cancel_hours')::int, 24);
  can := (r.day::timestamp + make_interval(mins => r.start_min)) - (now() at time zone 'Europe/Berlin') >= make_interval(hours => ch);
  return json_build_object('team', r.team, 'day', r.day, 'start_min', r.start_min, 'party', r.party, 'name', r.guest, 'room', r.room, 'can_cancel', can, 'cancel_hours', ch);
end $$;

create function public_cancel(p_token uuid) returns json language plpgsql security definer set search_path = public as $$
declare info json;
begin
  info := public_cancel_info(p_token);
  if info is null then raise exception 'Reservierung nicht gefunden (vielleicht schon storniert)'; end if;
  if not (info->>'can_cancel')::boolean then raise exception 'Online stornieren geht nur bis % Stunden vorher. Bitte ruf uns an.', info->>'cancel_hours'; end if;
  delete from reservations where cancel_token = p_token;
  return info;
end $$;

revoke execute on function public_cancel_info(uuid), public_cancel(uuid) from public;
grant execute on function public_cancel_info(uuid), public_cancel(uuid) to anon, authenticated;
