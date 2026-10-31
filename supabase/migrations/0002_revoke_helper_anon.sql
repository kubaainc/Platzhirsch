revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.has_role(uuid, member_role[]) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, member_role[]) to authenticated;
