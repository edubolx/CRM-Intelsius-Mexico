import test from 'node:test';
import assert from 'node:assert/strict';
const { createSubtaskStore, createSubtaskRepository } = await import('../src/components/special-tasks/subtaskStore.js').catch(() => ({}));
const child = { id: 'c', parentTaskId: 'p', title: 'Read', ownerId: 'u', status: 'notStarted', dueDate: '', isNew: false };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const make = async (extra = {}) => {
  assert.equal(typeof createSubtaskStore, 'function', 'serialized child store must exist');
  const repo = { list: async () => [child], write: async row => ({ ...row, isNew: false }), remove: async () => {}, ...extra };
  const store = createSubtaskStore(repo);
  await store.load();
  return store;
};

test('serial saves preserve rapid title, owner and status edits despite late acknowledgements', async () => {
  const first = deferred(); const writes = [];
  const store = await make({ write: async row => { writes.push({ ...row }); return writes.length === 1 ? first.promise : { ...row, isNew: false }; } });
  store.edit('p', 'c', { title: 'New title' });
  const saving = store.save('p', 'c');
  assert.equal(store.getSnapshot().rows[0].sync, 'saving');
  store.edit('p', 'c', { ownerId: 'v' }); store.save('p', 'c');
  store.edit('p', 'c', { status: 'done' }); store.save('p', 'c');
  assert.equal(writes.length, 1);
  first.resolve({ ...writes[0], isNew: false });
  await saving;
  assert.equal(writes.length, 2);
  assert.equal(writes[1].title, 'New title');
  assert.equal(writes[1].ownerId, 'v');
  assert.equal(writes[1].status, 'done');
  assert.equal(store.getSnapshot().rows[0].sync, 'saved');
});

test('failed writes retain text, report error and can retry; missing confirmation is not saved', async () => {
  let attempts = 0;
  const store = await make({ write: async row => { attempts++; if (attempts === 1) throw Error('offline'); if (attempts === 2) return null; return { ...row, isNew: false }; } });
  store.edit('p', 'c', { title: 'Keep me' });
  await store.save('p', 'c');
  assert.equal(store.getSnapshot().rows[0].error, 'offline');
  assert.equal(store.getSnapshot().rows[0].title, 'Keep me');
  await store.save('p', 'c');
  assert.equal(store.getSnapshot().rows[0].sync, 'error');
  await store.save('p', 'c');
  assert.equal(store.getSnapshot().rows[0].sync, 'saved');
});

test('silent refresh preserves drafts, dirty edits and writes confirmed after its query began', async () => {
  const late = deferred(); let reads = 0;
  const store = await make({ list: async () => ++reads === 1 ? [child] : late.promise });
  const refreshing = store.load();
  store.add({ id: 'p', isNew: false, ownerId: 'u' }, 'draft');
  store.edit('p', 'draft', { title: 'Do not lose' });
  store.edit('p', 'c', { title: 'Confirmed new title' });
  await store.save('p', 'c');
  late.resolve([child]); await refreshing;
  assert.equal(store.getSnapshot().rows.find(r => r.id === 'c').title, 'Confirmed new title');
  assert.equal(store.getSnapshot().rows.find(r => r.id === 'draft').title, 'Do not lose');
});

test('wrong-parent edits/saves/deletes do nothing; cancelling blank draft writes nothing', async () => {
  let writes = 0; let removes = 0;
  const store = await make({ write: async row => { writes++; return row; }, remove: async () => { removes++; } });
  store.edit('other', 'c', { title: 'Wrong' });
  await store.save('other', 'c'); await store.remove('other', 'c');
  store.add({ id: 'p', isNew: false }, 'draft');
  await store.remove('p', 'draft');
  assert.equal(writes, 0); assert.equal(removes, 0);
  assert.equal(store.getSnapshot().rows.length, 1);
  assert.equal(store.getSnapshot().rows[0].title, 'Read');
});

test('delete waits for in-flight insert, and stale reload cannot resurrect deleted row', async () => {
  const first = deferred(); const late = deferred(); const removed = []; let reads = 0;
  const store = await make({ list: async () => ++reads === 1 ? [child] : late.promise, write: async row => { await first.promise; return { ...row, isNew: false }; }, remove: async row => { removed.push(row); } });
  store.add({ id: 'p', isNew: false }, 'new'); store.edit('p', 'new', { title: 'New' });
  const saving = store.save('p', 'new'); const deleting = store.remove('p', 'new');
  first.resolve(); await saving; await deleting;
  assert.equal(removed[0].isNew, false);
  const refresh = store.load(); await store.remove('p', 'c'); late.resolve([child]); await refresh;
  assert.equal(store.getSnapshot().rows.length, 0);
});

test('retry after an insert committed but acknowledgement was lost reads only the same parent/id', async () => {
  assert.equal(typeof createSubtaskRepository, 'function');
  const calls = [];
  const row = { id: 'c', parent_task_id: 'p', title: 'Retried', owner_id: child.ownerId, status: 'done', due_date: null, revision: 0 };
  const query = { insert() { calls.push('insert'); return this; }, update() { calls.push('update'); return this; }, eq(key, value) { calls.push([key, value]); return this; }, select() { return this; }, async single() { return { data: null, error: { code: '23505', message: 'duplicate id' } }; }, async maybeSingle() { calls.push('read'); return { data: row, error: null }; } };
  const repo = createSubtaskRepository({ from: () => query });
  const saved = await repo.write({ ...child, title: 'Retried', status: 'done', isNew: true });
  assert.equal(saved.isNew, false);
  assert.ok(calls.includes('read'));
  assert.ok(!calls.includes('update'), 'already intended values need no update');
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'parent_task_id' && call[1] === 'p'));
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'id' && call[1] === 'c'));
});

test('delete failure preserves row for explicit retry and load failure preserves drafts', async () => {
  let failures = 0;
  const store = await make({ remove: async () => { if (++failures === 1) throw Error('delete offline'); } });
  await store.remove('p', 'c');
  assert.equal(store.getSnapshot().rows[0].errorOperation, 'delete');
  assert.equal(store.getSnapshot().rows[0].deleting, false);
  await store.remove('p', 'c');
  assert.equal(store.getSnapshot().rows.length, 0);
  const failing = createSubtaskStore({ list: async () => { throw Error('load offline'); } });
  failing.add({ id: 'p', isNew: false }, 'draft');
  await failing.load();
  assert.equal(failing.getSnapshot().error, 'load offline');
  assert.equal(failing.getSnapshot().rows[0].id, 'draft');
});

test('repository scopes updates/deletes by both keys and requires exact confirmation', async () => {
  assert.equal(typeof createSubtaskRepository, 'function');
  const calls = []; let response = { id: 'c', parent_task_id: 'p', title: 'Read', status: 'done' };
  const query = { update(row) { calls.push(['update', row]); return this; }, insert(row) { calls.push(['insert', row]); return this; }, delete() { calls.push(['delete']); return this; }, eq(key, value) { calls.push(['eq', key, value]); return this; }, select(value) { calls.push(['select', value]); return this; }, async single() { calls.push(['single']); return { data: response, error: null }; }, async maybeSingle() { calls.push(['maybeSingle']); return { data: response, error: null }; }, then(resolve, reject) { return Promise.resolve({ data: response ? [response] : [], error: null }).then(resolve, reject); } };
  const repo = createSubtaskRepository({ from(table) { assert.equal(table, 'special_task_subtasks'); return query; } });
  await repo.write({ ...child, status: 'done' });
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'parent_task_id' && c[2] === 'p'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === 'c'));
  assert.deepEqual(calls.at(-1), ['maybeSingle']);
  calls.length = 0; await repo.remove(child);
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'parent_task_id'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'id'));
  response = null;
  await assert.rejects(repo.write(child), /confirm/i);
});
