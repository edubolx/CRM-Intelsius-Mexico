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
