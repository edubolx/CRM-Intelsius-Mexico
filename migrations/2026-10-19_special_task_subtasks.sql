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
