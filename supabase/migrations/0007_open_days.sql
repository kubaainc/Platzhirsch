-- Öffnungstage pro Team: settings.open_days = Liste der Wochentage (1 = Montag bis 7 = Sonntag), ohne Eintrag sind alle Tage offen.
-- An geschlossenen Wochentagen gibt es online keine freien Zeiten (public_slots, damit auch public_book).

create or replace function public_slots(p_slug text, p_day date, p_party int, p_room uuid default null)
returns table (start_min int, free boolean, pct int) language plpgsql stable security definer set search_path = public as $$
declare tm uuid; st jsonb; lead int; stay int; o_from int; o_to int; s int; cap int; now_b timestamp; od int[]; day_open boolean;
begin
  select id, settings into tm, st from teams where slug = p_slug;
  if tm is null or p_party < 1 or p_party > 30 then return; end if;
  lead := coalesce((st->>'online_lead_hours')::int, 24); stay := coalesce((st->>'stay_minutes')::int, 120);
  o_from := coalesce((st->>'open_from')::int, 1080); o_to := coalesce((st->>'open_to')::int, 1320);
  od := case when jsonb_typeof(st->'open_days') = 'array' then array(select jsonb_array_elements_text(st->'open_days')::int) else array[1,2,3,4,5,6,7] end;
  day_open := extract(isodow from p_day)::int = any(od);
  now_b := now() at time zone 'Europe/Berlin';
  select coalesce(sum(max_seats), 0) into cap from tables where team_id = tm and online_bookable;
  s := o_from;
  while s + stay <= o_to loop
    start_min := s;
    free := day_open
      and not exists (select 1 from day_rules where team_id = tm and day = p_day and blocked)
      and (p_day::timestamp + make_interval(mins => s)) - now_b >= make_interval(hours => lead)
      and _tpick(tm, p_day, s, stay, p_party, p_room, false) is not null;
    pct := case when cap = 0 then 100 else least(100, round(100.0 * coalesce((select sum(r.party) from reservations r
      where r.team_id = tm and r.day = p_day and r.start_min <= s and s < r.start_min + r.duration_min), 0) / cap)::int) end;
    return next; s := s + 60;
  end loop;
end $$;

-- fünf: Di bis Sa offen, Sonntag (Menüabende nur nach Ankündigung) und Montag (Ruhetag) zu.
update teams set settings = settings || '{"open_days":[2,3,4,5,6]}'::jsonb where slug = 'fuenf';
