import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const migration = new URL('../migrations/2026-10-19_special_task_subtasks_revision.sql', import.meta.url);
test('subtask revision advances atomically on server updates without mutating parents', () => {
  assert.ok(existsSync(migration), 'Missing concurrency revision migration');
  const sql = readFileSync(migration, 'utf8');
  assert.match(sql, /add column if not exists revision integer not null default 0/i);
  assert.match(sql, /new\.revision\s*:?=\s*old\.revision\s*\+\s*1/i);
  assert.match(sql, /before update on public\.special_task_subtasks/i);
  assert.doesNotMatch(sql, /(?:update|delete from|alter table)\s+(?:public\.)?special_tasks\b/i);
  assert.doesNotMatch(sql, /security definer/i);
});
