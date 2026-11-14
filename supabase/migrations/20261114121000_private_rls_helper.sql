-- Keep the RLS helper out of the exposed API schema (not callable via /rest/v1/rpc).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_cmo_of(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles me join public.profiles them on them.mission_code = me.mission_code
    where me.id = auth.uid() and me.is_cmo and them.id = target
  );
$$;
revoke all on function private.is_cmo_of(uuid) from public, anon;
grant execute on function private.is_cmo_of(uuid) to authenticated;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_cmo_of(id));

drop function if exists public.is_cmo_of(uuid) cascade;
