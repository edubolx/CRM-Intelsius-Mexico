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
