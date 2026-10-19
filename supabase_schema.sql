-- ============================================================
-- CRM Intelsius México — Supabase Schema
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Companies
create table if not exists companies (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  industry    text,
  website     text,
  phone       text,
  notes       text,
  created_at  timestamptz default now()
);

-- 2. Contacts
create table if not exists contacts (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  email       text,
  phone       text,
  title_f     text,
  linkedin    text,
  company_id  text references companies(id) on delete set null,
  notes       text,
  created_at  timestamptz default now()
);

-- 3. Deals
create table if not exists deals (
  id                 text primary key default gen_random_uuid()::text,
  name               text not null,
  value              numeric default 0,
  stage              text not null,
  company_id         text references companies(id) on delete set null,
  contact_id         text references contacts(id) on delete set null,
  lead_source        text,
  lead_source_custom text,
  closing_date       date,
  notes              text,
  created_at         timestamptz default now()
);

alter table deals add column if not exists lead_source text;
alter table deals add column if not exists lead_source_custom text;

-- 4. MEDDIC evaluations
create table if not exists meddic_evals (
  id        text primary key default gen_random_uuid()::text,
  deal_id   text not null references deals(id) on delete cascade,
  date      date not null default current_date,
  meddic    jsonb not null default '{}'
);

-- 5. Pipeline stages
create table if not exists pipeline_stages (
  id        text primary key default gen_random_uuid()::text,
  name      text not null,
  emoji     text default '📋',
  bg        text default '#e8f4fc',
  border    text default '#a0c4e0',
  accent    text default '#003e7e',
  is_won    boolean default false,
  is_lost   boolean default false,
  position  integer default 0
);

-- ============================================================
-- Row Level Security (RLS)
-- Habilita acceso público por ahora (sin auth).
-- Cuando agregues autenticación, cambia las policies.
-- ============================================================

alter table companies      enable row level security;
alter table contacts       enable row level security;
alter table deals          enable row level security;
alter table meddic_evals   enable row level security;
alter table pipeline_stages enable row level security;

-- Políticas: acceso total al anon key (uso interno del equipo)
create policy "allow_all_companies"       on companies       for all using (true) with check (true);
create policy "allow_all_contacts"        on contacts        for all using (true) with check (true);
create policy "allow_all_deals"           on deals           for all using (true) with check (true);
create policy "allow_all_meddic_evals"    on meddic_evals    for all using (true) with check (true);
create policy "allow_all_pipeline_stages" on pipeline_stages for all using (true) with check (true);

-- ============================================================
-- Índices para performance
-- ============================================================
create index if not exists idx_contacts_company    on contacts(company_id);
create index if not exists idx_deals_company       on deals(company_id);
create index if not exists idx_deals_contact       on deals(contact_id);
create index if not exists idx_deals_stage         on deals(stage);
create index if not exists idx_meddic_deal         on meddic_evals(deal_id);
create index if not exists idx_stages_position     on pipeline_stages(position);

-- 6. Deal activities / tasks
create table if not exists deal_activities (
  id          text primary key default gen_random_uuid()::text,
  deal_id     text not null references deals(id) on delete cascade,
  type        text not null default 'task',
  title       text not null,
  due_date    date,
  responsible text,
  status      text not null default 'pending',
  comment     text,
  created_at  timestamptz default now()
);

alter table deal_activities enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deal_activities' and policyname='allow_all_deal_activities') then
    create policy "allow_all_deal_activities" on deal_activities for all using (true) with check (true);
  end if;
end $$;

create index if not exists idx_deal_activities_deal on deal_activities(deal_id);
create index if not exists idx_deal_activities_due  on deal_activities(due_date);

-- 6b. Deal journal / logbook
create table if not exists deal_journal_entries (
  id         text primary key default gen_random_uuid()::text,
  deal_id    text not null references deals(id) on delete cascade,
  source     text not null default 'manual',
  entry_type text not null default 'note',
  title      text,
  content    text,
  author     text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table deal_journal_entries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deal_journal_entries' and policyname='allow_all_deal_journal_entries') then
    create policy "allow_all_deal_journal_entries" on deal_journal_entries for all using (true) with check (true);
  end if;
end $$;

create index if not exists idx_deal_journal_entries_deal on deal_journal_entries(deal_id);
create index if not exists idx_deal_journal_entries_created on deal_journal_entries(created_at);

-- 7. Users for task assignment
create table if not exists crm_users (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  alias      text not null,
  email      text not null,
  created_at timestamptz default now()
);

alter table crm_users enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='crm_users' and policyname='allow_all_crm_users') then
    create policy "allow_all_crm_users" on crm_users for all using (true) with check (true);
  end if;
end $$;

-- 8. Prospecting (independent from pipeline data)
create table if not exists prospecting_companies (
  id           text primary key default gen_random_uuid()::text,
  name         text not null,
  status       text not null default 'nueva',
  owner_id     text,
  industry     text,
  country      text,
  company_size text,
  lead_source  text,
  priority     text,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists prospecting_contacts (
  id           text primary key default gen_random_uuid()::text,
  company_id   text not null references prospecting_companies(id) on delete cascade,
  name         text not null,
  title        text,
  email        text,
  phone        text,
  linkedin_url text,
  notes        text,
  is_archived  boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists prospecting_activities (
  id             text primary key default gen_random_uuid()::text,
  company_id     text not null references prospecting_companies(id) on delete cascade,
  contact_id     text references prospecting_contacts(id) on delete set null,
  activity_type  text not null default 'investigacion',
  status         text not null default 'pendiente',
  activity_at    timestamptz not null default now(),
  outcome        text,
  next_step      text,
  next_action_at date,
  owner_id       text,
  notes          text,
  attachment_url text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table prospecting_companies enable row level security;
alter table prospecting_contacts enable row level security;
alter table prospecting_activities enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prospecting_companies' and policyname='allow_all_prospecting_companies') then
    create policy "allow_all_prospecting_companies" on prospecting_companies for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prospecting_contacts' and policyname='allow_all_prospecting_contacts') then
    create policy "allow_all_prospecting_contacts" on prospecting_contacts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prospecting_activities' and policyname='allow_all_prospecting_activities') then
    create policy "allow_all_prospecting_activities" on prospecting_activities for all using (true) with check (true);
  end if;
end $$;

alter table prospecting_activities add column if not exists status text not null default 'pendiente';

create index if not exists idx_prospecting_contacts_company on prospecting_contacts(company_id);
create index if not exists idx_prospecting_activities_company on prospecting_activities(company_id);
create index if not exists idx_prospecting_activities_contact on prospecting_activities(contact_id);
create index if not exists idx_prospecting_activities_next_action on prospecting_activities(next_action_at);
-- Tareas especiales — independent operational task board with Eisenhower scoring
create table if not exists special_tasks (
  id                 text primary key default gen_random_uuid()::text,
  title              text not null,
  description        text,
  owner_id           text references crm_users(id) on delete set null,
  deal_id            text references deals(id) on delete set null,
  importance_score   integer not null default 3 check (importance_score between 1 and 5),
  urgency_score      integer not null default 3 check (urgency_score between 1 and 5),
  eisenhower_score   integer generated always as (importance_score + urgency_score) stored,
  due_date           date,
  status             text not null default 'notStarted' check (status in ('notStarted','inProgress','waiting','blocked','done','cancelled')),
  comments           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table special_tasks enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'special_tasks'
      and policyname = 'allow_all_special_tasks'
  ) then
    create policy "allow_all_special_tasks" on special_tasks for all using (true) with check (true);
  end if;
end $$;

create index if not exists idx_special_tasks_owner on special_tasks(owner_id);
create index if not exists idx_special_tasks_deal on special_tasks(deal_id);
create index if not exists idx_special_tasks_due on special_tasks(due_date);
create index if not exists idx_special_tasks_status on special_tasks(status);
create index if not exists idx_special_tasks_score on special_tasks(eisenhower_score desc);

-- Additive, one-level subtasks. Existing parent rows/counters are unchanged.
create table if not exists public.special_task_subtasks (
  id text primary key default gen_random_uuid()::text,
  parent_task_id text not null references public.special_tasks(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  owner_id text references public.crm_users(id) on delete set null,
  status text not null default 'notStarted'
    check (status in ('notStarted','inProgress','waiting','blocked','done','cancelled')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists special_task_subtasks_parent_idx
  on public.special_task_subtasks(parent_task_id, created_at);
alter table public.special_task_subtasks enable row level security;
-- Match existing parent CRUD roles, but require visibility of the parent.
grant select, insert, update, delete on public.special_task_subtasks to anon, authenticated, service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='special_task_subtasks' and policyname='subtasks_visible_parent') then
    create policy subtasks_visible_parent on public.special_task_subtasks
      for all to anon, authenticated
      using (exists (select 1 from public.special_tasks p where p.id=parent_task_id))
      with check (exists (select 1 from public.special_tasks p where p.id=parent_task_id));
  end if;
  if exists (select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
    and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='special_task_subtasks') then
    alter publication supabase_realtime add table public.special_task_subtasks;
  end if;
end $$;

-- Server-owned revision for compare-and-swap child updates.
alter table public.special_task_subtasks
  add column if not exists revision integer not null default 0;
create or replace function public.bump_special_task_subtask_revision()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid='public.special_task_subtasks'::regclass
    and tgname='special_task_subtask_revision' and not tgisinternal) then
    create trigger special_task_subtask_revision
      before update on public.special_task_subtasks
      for each row execute function public.bump_special_task_subtask_revision();
  end if;
end $$;
