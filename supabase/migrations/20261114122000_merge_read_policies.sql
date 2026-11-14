-- One SELECT policy per table (owner OR mission medical officer), separate write policies.
do $$ declare t text; begin
  foreach t in array array['sessions','symptoms','workouts','food_log','calendar_events'] loop
    execute format('drop policy if exists "%1$s owner" on public.%1$s', t);
    execute format('drop policy if exists "%1$s cmo read" on public.%1$s', t);
    execute format('create policy "%1$s read" on public.%1$s for select to authenticated using (user_id = (select auth.uid()) or private.is_cmo_of(user_id))', t);
    execute format('create policy "%1$s insert own" on public.%1$s for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s update own" on public.%1$s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s delete own" on public.%1$s for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
