-- Zusammengestellte Tische: eine Reservierung kann zusätzlich zu table_id weitere Tische belegen.
alter table reservations add column if not exists extra_table_ids uuid[] not null default '{}';

-- Online-Buchung: Tische, die Teil einer Kombination sind, gelten als belegt.
create or replace function _tfree(t uuid, d date, s int, dur int) returns boolean language sql stable set search_path = public as $$
  select not exists (select 1 from reservations r where (r.table_id = t or r.alt_table_id = t or t = any(r.extra_table_ids)) and r.day = d
    and r.start_min < s + dur and s < r.start_min + r.duration_min)
$$;
