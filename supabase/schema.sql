-- Workspace Tracker MVP schema + RLS
create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'Work' check (category in ('Work','Personal','Learning','Health','Other')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  planned_hours int not null default 0 check (planned_hours >= 0),
  planned_minutes int not null default 0 check (planned_minutes between 0 and 59),
  frequency text not null default 'repeat' check (frequency in ('once','repeat')),
  single_date date,
  work_days text[] not null default array['Mon'],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  resumed_at timestamptz,
  ended_at timestamptz,
  total_seconds int not null default 0,
  status text not null default 'running' check (status in ('running','paused','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.task_absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  date date not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, task_id, date)
);

create table if not exists public.attendance_absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.tasks enable row level security;
alter table public.attendance enable row level security;
alter table public.timer_sessions enable row level security;
alter table public.task_absences enable row level security;
alter table public.attendance_absences enable row level security;

drop policy if exists "tasks_owner" on public.tasks;
create policy "tasks_owner" on public.tasks
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "attendance_owner" on public.attendance;
create policy "attendance_owner" on public.attendance
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "timer_sessions_owner" on public.timer_sessions;
create policy "timer_sessions_owner" on public.timer_sessions
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "task_absences_owner" on public.task_absences;
create policy "task_absences_owner" on public.task_absences
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "attendance_absences_owner" on public.attendance_absences;
create policy "attendance_absences_owner" on public.attendance_absences
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks add column if not exists frequency text not null default 'repeat';
alter table public.tasks add column if not exists single_date date;
update public.tasks set frequency = 'repeat' where frequency is null;
alter table public.tasks drop constraint if exists tasks_frequency_check;
alter table public.tasks add constraint tasks_frequency_check check (frequency in ('once','repeat'));

-- Grants required in addition to RLS policies.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.attendance to authenticated;
grant select, insert, update, delete on table public.timer_sessions to authenticated;
grant select, insert, update, delete on table public.task_absences to authenticated;
grant select, insert, update, delete on table public.attendance_absences to authenticated;

-- Optional read-only access for anon (no writes).
grant select on table public.tasks to anon;
grant select on table public.attendance to anon;
grant select on table public.timer_sessions to anon;
grant select on table public.task_absences to anon;
grant select on table public.attendance_absences to anon;

-- Service role grants for admin scripts/seeding.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.tasks to service_role;
grant select, insert, update, delete on table public.attendance to service_role;
grant select, insert, update, delete on table public.timer_sessions to service_role;
grant select, insert, update, delete on table public.task_absences to service_role;
grant select, insert, update, delete on table public.attendance_absences to service_role;
