begin;
create table if not exists public.village_readings (
 id uuid primary key,
 received_at timestamptz not null default clock_timestamp(),
 main_pct int not null check(main_pct between 0 and 100),
 lower_pct int not null check(lower_pct between 0 and 100),
 chlorine numeric not null check(chlorine >= 0),
 condition text not null check(condition in ('open','held','cloudy','low_chlorine','high_chlorine')),
 alert boolean not null
);
alter table public.village_readings add column if not exists stats jsonb;
create index if not exists village_latest on public.village_readings(received_at desc);
alter table public.village_readings enable row level security;
revoke all on public.village_readings from public, anon, authenticated;
grant select on public.village_readings to anon, authenticated;
grant insert,select on public.village_readings to service_role;
drop policy if exists village_public_read on public.village_readings;
create policy village_public_read on public.village_readings for select using(true);

drop trigger if exists send_village_alert on public.village_readings;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='village_readings') then
 alter publication supabase_realtime add table public.village_readings;
 end if;
end $$;
commit;
