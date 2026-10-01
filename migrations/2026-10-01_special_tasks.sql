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
