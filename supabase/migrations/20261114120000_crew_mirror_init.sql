-- Crew Mirror cloud schema. Stores derived numbers only (never images or video).
-- Row-level security: each astronaut owns their rows; a crew medical officer (is_cmo)
-- can read the rows of crew members who share their mission_code.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  call_sign text not null,
  role text not null default 'Crew member',
  mission_code text not null default 'DEMO',
  is_cmo boolean not null default false,          -- granted by an admin only, never self-assigned
  cmo_requested boolean not null default false,   -- asked for at sign-up; admin approves
  launch_date date,
  phase text not null default 'transit' check (phase in ('preflight','transit','landing','surface','return')),
  transit_days integer not null default 0,
  mass_kg numeric,
  targets jsonb,
  created_at timestamptz not null default now(),
  unique (mission_code, call_sign)
);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  ts timestamptz not null,
  mission_day integer,
  kind text not null check (kind in ('daily','balance','mass')),
  measurements jsonb not null
);
create index if not exists sessions_user_ts on public.sessions (user_id, ts);

create table if not exists public.symptoms (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  ts timestamptz not null,
  region text not null,
  side text,
  kind text,
  intensity smallint check (intensity between 0 and 10),
  triage_level text not null check (triage_level in ('act_now','cmo','self_care')),
  pattern text not null,
  payload jsonb not null
);
create index if not exists symptoms_user_ts on public.symptoms (user_id, ts desc);

create table if not exists public.workouts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  ts timestamptz not null,
  exercise text not null,
  payload jsonb not null
);
create index if not exists workouts_user_ts on public.workouts (user_id, ts);

create table if not exists public.food_log (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  ts timestamptz not null,
  item_id text not null,
  servings numeric not null default 1
);
create index if not exists food_user_ts on public.food_log (user_id, ts);

create table if not exists public.calendar_events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  kind text not null,
  title text not null
);
create index if not exists events_user_date on public.calendar_events (user_id, date);

-- Is the signed-in user the medical officer of the target user's mission?
create or replace function public.is_cmo_of(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles me join public.profiles them on them.mission_code = me.mission_code
    where me.id = auth.uid() and me.is_cmo and them.id = target
  );
$$;
revoke all on function public.is_cmo_of(uuid) from public, anon;
grant execute on function public.is_cmo_of(uuid) to authenticated;

-- New account → profile from sign-up metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- is_cmo is NOT taken from sign-up data (anyone could claim it); only a request is recorded.
  insert into public.profiles (id, call_sign, role, mission_code, cmo_requested)
  values (
    new.id,
    left(coalesce(nullif(upper(new.raw_user_meta_data->>'call_sign'), ''), 'CREW-' || left(new.id::text, 4)), 16),
    left(coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'Crew member'), 40),
    left(upper(coalesce(nullif(new.raw_user_meta_data->>'mission_code', ''), 'DEMO')), 16),
    coalesce((new.raw_user_meta_data->>'cmo_requested')::boolean, false)
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.symptoms enable row level security;
alter table public.workouts enable row level security;
alter table public.food_log enable row level security;
alter table public.calendar_events enable row level security;

-- profiles: read own or (as CMO) own mission's; update own, but not mission/CMO flags
create policy "profiles read" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_cmo_of(id));
create policy "profiles update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Column-level revoke does not override a table-level grant: revoke UPDATE on the table,
-- then grant it back only for the columns a user may change about themselves.
revoke update on public.profiles from authenticated, anon;
grant update (role, launch_date, phase, transit_days, mass_kg, targets) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- data tables: owner full access; CMO of the same mission can read
do $$ declare t text; begin
  foreach t in array array['sessions','symptoms','workouts','food_log','calendar_events'] loop
    execute format('create policy "%1$s owner" on public.%1$s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s cmo read" on public.%1$s for select to authenticated using (public.is_cmo_of(user_id))', t);
  end loop;
end $$;

-- Approve a medical officer (run as admin in the SQL editor):
--   update public.profiles set is_cmo = true where call_sign = 'MS2' and mission_code = 'ARES-1';
