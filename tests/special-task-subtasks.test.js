import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const model = await import('../src/components/special-tasks/subtaskModel.js').catch(() => ({}));

test('child conversion validates title/status and writes only child columns', () => {
  assert.equal(typeof model.subtaskToRow, 'function', 'child conversion must exist');
  const child = model.rowToSubtask({ id: 'c', parent_task_id: 'p', title: 'Read', owner_id: null, due_date: null, status: 'notStarted' });
  assert.equal(child.parentTaskId, 'p');
  assert.equal(child.ownerId, '');
  assert.equal(child.isNew, false);
  assert.deepEqual(model.subtaskToRow({ ...child, title: '  Read  ' }), { id: 'c', parent_task_id: 'p', title: 'Read', owner_id: null, due_date: null, status: 'notStarted' });
  assert.throws(() => model.subtaskToRow({ ...child, title: '  ' }), /título/i);
  assert.throws(() => model.subtaskToRow({ ...child, status: 'finished' }), /estado/i);
});

test('grouping isolates parents and progress counts done, not cancelled or unpersisted drafts', () => {
  assert.equal(typeof model.childrenFor, 'function');
  const rows = [{ id: '1', parentTaskId: 'p', status: 'done' }, { id: '2', parentTaskId: 'p', status: 'cancelled' }, { id: '3', parentTaskId: 'q', status: 'done' }, { id: '4', parentTaskId: 'p', status: 'done', isNew: true }];
  assert.deepEqual(model.childrenFor(rows, 'p').map(c => c.id), ['1', '2', '4']);
  assert.deepEqual(model.childProgress(rows, 'p'), { done: 1, total: 2 });
});

test('new draft inherits editable owner and cannot be created for an unpersisted parent', () => {
  assert.equal(typeof model.newSubtask, 'function');
  const child = model.newSubtask({ id: 'p', ownerId: 'u', isNew: false }, 'c');
  assert.equal(child.ownerId, 'u');
  assert.equal(model.subtaskToRow({ ...child, title: 'Read', ownerId: 'v' }).owner_id, 'v');
  assert.throws(() => model.newSubtask({ id: 'p', isNew: true }, 'c'), /guard/i);
});
