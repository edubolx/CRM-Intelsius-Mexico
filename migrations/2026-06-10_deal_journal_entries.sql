-- Bitácora por deal: entradas manuales + eventos automáticos futuros (ej. stage changes)
create table if not exists deal_journal_entries (
  id         text primary key default gen_random_uuid()::text,
  deal_id    text not null references deals(id) on delete cascade,
  source     text not null default 'manual', -- manual | system
  entry_type text not null default 'note',   -- note | comment | stage
  title      text,
  content    text,
  author     text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table deal_journal_entries enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='deal_journal_entries'
      and policyname='allow_all_deal_journal_entries'
  ) then
    create policy "allow_all_deal_journal_entries"
      on deal_journal_entries
      for all
      using (true)
      with check (true);
  end if;
end $$;

create index if not exists idx_deal_journal_entries_deal on deal_journal_entries(deal_id);
create index if not exists idx_deal_journal_entries_created on deal_journal_entries(created_at);
