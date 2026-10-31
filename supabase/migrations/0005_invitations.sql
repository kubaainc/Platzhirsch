-- Einladungen: Admin trägt E-Mail und Rolle ein; wer sich mit dieser Adresse anmeldet, tritt automatisch bei.
create table invitations (
  team_id uuid not null references teams on delete cascade,
  email text not null check (email = lower(email)),
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (team_id, email)
);
alter table invitations enable row level security;
create policy inv_admin on invitations for all using (has_role(team_id, '{admin}')) with check (has_role(team_id, '{admin}'));

create function accept_invitations() returns int language plpgsql security definer set search_path = public, auth as $$
declare n int; em text;
begin
  select lower(email) into em from auth.users where id = auth.uid();
  if em is null then return 0; end if;
  insert into memberships (team_id, user_id, role)
    select team_id, auth.uid(), role from invitations where email = em
    on conflict (team_id, user_id) do nothing;
  get diagnostics n = row_count;
  delete from invitations where email = em;
  return n;
end $$;
revoke execute on function accept_invitations() from anon, public;
grant execute on function accept_invitations() to authenticated;

create function team_members(p_team uuid) returns table (user_id uuid, email text, role member_role)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, u.email::text, m.role from memberships m join auth.users u on u.id = m.user_id
  where m.team_id = p_team and is_member(p_team)
$$;
revoke execute on function team_members(uuid) from anon, public;
grant execute on function team_members(uuid) to authenticated;

-- Der letzte Admin eines Teams darf nicht entfernt oder herabgestuft werden.
create function keep_one_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (select 1 from memberships where team_id = old.team_id and role = 'admin' and user_id <> old.user_id) then
    if tg_op = 'DELETE' and not exists (select 1 from teams where id = old.team_id) then return old; end if;
    raise exception 'Das Team braucht mindestens einen Admin';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger memberships_keep_admin before update or delete on memberships for each row execute function keep_one_admin();
