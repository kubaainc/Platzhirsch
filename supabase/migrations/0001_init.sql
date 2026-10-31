-- Platzhirsch: mandantenfähiges Reservierungssystem (auf Supabase-Projekt yptjbsqqapqesrixskir angewendet).
create type member_role as enum ('admin','editor','reservations','viewer');

create table teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  settings jsonb not null default '{"colors":{"free":"#2f7d4f","busy":"#9A3334","reserve":"#8a8a80"},"online_lead_hours":24,"online_quota":0.7,"stay_minutes":120}',
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table memberships (
  team_id uuid not null references teams on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role member_role not null,
  primary key (team_id, user_id)
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  name text not null, sort int not null default 0,
  width int not null default 1200, height int not null default 800,
  outdoor boolean not null default false
);
-- hellgraue Elemente (Wände, Säulen, Bar ...)
create table room_elements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  room_id uuid not null references rooms on delete cascade,
  kind text not null default 'rect', x real, y real, w real, h real, rot real not null default 0
);
create table tables (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  room_id uuid not null references rooms on delete cascade,
  label text not null, min_seats int not null default 1, max_seats int not null default 2,
  online_bookable boolean not null default true,
  pair_table_id uuid references tables on delete set null, -- Wetter-Reserve (draußen)
  placed boolean not null default false, -- false = noch nicht im Raumplan platziert
  x real, y real, w real, h real, rot real not null default 0, round boolean not null default false
);
create table layouts ( -- Anordnungen (Sommer/Winter)
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  name text not null, data jsonb not null,
  unique (team_id, name)
);
create table guests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  name text not null, phone text, email text
);
create unique index on guests (team_id, phone) where phone is not null;
create unique index on guests (team_id, lower(email)) where email is not null;
create table reservations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams on delete cascade,
  guest_id uuid references guests on delete set null,
  table_id uuid references tables on delete set null,
  alt_table_id uuid references tables on delete set null,
  day date not null, start_min int not null, duration_min int not null default 120,
  party int not null check (party > 0), source text not null default 'team', note text,
  created_at timestamptz not null default now()
);
create index on reservations (team_id, day);
create table day_rules ( -- gesperrte Tage und Tageshinweise
  team_id uuid not null references teams on delete cascade,
  day date not null, blocked boolean not null default false, note text,
  primary key (team_id, day)
);

-- Zugriff: nur Zeilen der eigenen Teams; Schreibrechte nach Rolle
create function is_member(t uuid) returns boolean language sql stable security definer set search_path = public
  as $$ select exists(select 1 from memberships where team_id=t and user_id=auth.uid()) $$;
create function has_role(t uuid, r member_role[]) returns boolean language sql stable security definer set search_path = public
  as $$ select exists(select 1 from memberships where team_id=t and user_id=auth.uid() and role = any(r)) $$;

do $$ declare x text; begin
 foreach x in array array['teams','memberships','rooms','room_elements','tables','layouts','guests','reservations','day_rules'] loop
  execute format('alter table %I enable row level security', x);
 end loop; end $$;

create policy teams_read on teams for select using (is_member(id));
create policy teams_admin on teams for update using (has_role(id, '{admin}')) with check (has_role(id, '{admin}'));
create policy mem_read on memberships for select using (is_member(team_id));
create policy mem_admin on memberships for all using (has_role(team_id, '{admin}')) with check (has_role(team_id, '{admin}'));

do $$ declare x text; begin
 foreach x in array array['rooms','room_elements','tables','layouts'] loop
  execute format('create policy %1$s_read on %1$s for select using (is_member(team_id))', x);
  execute format('create policy %1$s_write on %1$s for all using (has_role(team_id, ''{admin,editor}'')) with check (has_role(team_id, ''{admin,editor}''))', x);
 end loop;
 foreach x in array array['guests','reservations','day_rules'] loop
  execute format('create policy %1$s_read on %1$s for select using (is_member(team_id))', x);
  execute format('create policy %1$s_write on %1$s for all using (has_role(team_id, ''{admin,editor,reservations}'')) with check (has_role(team_id, ''{admin,editor,reservations}''))', x);
 end loop; end $$;
-- Gäste von außen buchen nicht direkt auf den Tabellen, sondern über eine Server-Funktion (Edge Function) mit Spam-Schutz.
