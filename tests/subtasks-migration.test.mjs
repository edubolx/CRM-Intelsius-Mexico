import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const migration = new URL('../migrations/2026-10-19_special_task_subtasks.sql', import.meta.url);
test('subtasks migration is additive, parent-linked and preserves existing tasks', () => {
  assert.ok(existsSync(migration), 'Missing additive subtasks migration');
  const sql = readFileSync(migration, 'utf8');
  assert.match(sql, /create table if not exists public\.special_task_subtasks/i);
  assert.match(sql, /parent_task_id\s+text\s+not null\s+references public\.special_tasks\(id\) on delete cascade/i);
  assert.match(sql, /owner_id\s+text\s+references public\.crm_users\(id\) on delete set null/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /exists\s*\(select 1 from public\.special_tasks/i);
  assert.doesNotMatch(sql, /(?:update|delete from|alter table)\s+(?:public\.)?special_tasks\b/i);
  assert.doesNotMatch(sql, /drop\s+(?:table|column)/i);
});
