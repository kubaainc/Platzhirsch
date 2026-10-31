-- Ein angemeldeter Nutzer legt ein Team an, wird dessen Admin und bekommt den Bereich „Restaurant“.
create function public.create_team(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into teams (name, slug) values (p_name, p_slug) returning id into tid;
  insert into memberships (team_id, user_id, role) values (tid, auth.uid(), 'admin');
  insert into rooms (team_id, name, sort) values (tid, 'Restaurant', 0);
  return tid;
end $$;
revoke execute on function public.create_team(text, text) from public, anon;
grant execute on function public.create_team(text, text) to authenticated;
