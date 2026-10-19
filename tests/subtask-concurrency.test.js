import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubtaskRepository, createSubtaskStore } from '../src/components/special-tasks/subtaskStore.js';

// In-memory PostgREST boundary: real repository and stores share server state.
function backend() {
  const rows = new Map([['c', { id: 'c', parent_task_id: 'p', title: 'Read', owner_id: 'u', status: 'notStarted', due_date: null, revision: 0, created_at: 'original' }]]);
  const calls = [];
  const state = { rows, calls, after: null, readError: null };
  const client = { from(table) {
    assert.equal(table, 'special_task_subtasks');
    let operation = 'read'; let payload; const filters = [];
    const query = {
      insert(value) { operation = 'insert'; payload = { ...value }; return this; },
      update(value) { operation = 'update'; payload = { ...value }; return this; },
      delete() { operation = 'delete'; return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      select() { return this; }, order() { return this; },
      async execute(mode) {
        calls.push({ operation, payload, filters: [...filters], mode });
        if (operation === 'read' && state.readError) return { data: null, error: state.readError };
        let data = [...rows.values()].filter(row => filters.every(([key, value]) => row[key] === value));
        if (operation === 'insert') {
          if (rows.has(payload.id)) return { data: null, error: { code: '23505', message: 'duplicate id' } };
          const row = { ...payload, revision: 0, created_at: 'server-created' }; rows.set(row.id, row); data = [row];
        }
        if (operation === 'update') data = data.map(row => { const next = { ...row, ...payload, revision: row.revision + 1 }; rows.set(row.id, next); return next; });
        if (operation === 'delete') data.forEach(row => rows.delete(row.id));
        if (state.after) await state.after(operation, data);
        data = data.map(row => ({ ...row }));
        if (mode === 'single' && data.length !== 1) return { data: null, error: { message: 'Expected one row' } };
        return { data: mode === 'many' ? data : data[0] || null, error: null };
      },
      single() { return this.execute('single'); },
      maybeSingle() { return this.execute('maybeSingle'); },
      then(resolve, reject) { return this.execute('many').then(resolve, reject); },
    };
    return query;
  } };
  state.repo = createSubtaskRepository(client);
  return state;
}
async function stores(server, count = 2) {
  const result = Array.from({ length: count }, () => createSubtaskStore(server.repo));
  await Promise.all(result.map(store => store.load()));
  return result;
}
const row = store => store.getSnapshot().rows.find(item => item.id === 'c');

test('lost UPDATE acknowledgement followed by reverting to the old base never discards the latest intention', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  server.after = async operation => { if (operation === 'update') { server.after = null; throw Error('lost update ACK'); } };
  store.edit('p', 'c', { title: 'Committed but unacknowledged' });
  await store.save('p', 'c');
  assert.equal(server.rows.get('c').title, 'Committed but unacknowledged');
  assert.equal(row(store).sync, 'error');
  store.edit('p', 'c', { title: 'Read' });
  await store.save('p', 'c');
  assert.equal(row(store).title, 'Read');
  assert.equal(row(store).sync, 'error');
  assert.equal(row(store).conflict, true);
  await store.save('p', 'c');
  assert.equal(server.rows.get('c').title, 'Committed but unacknowledged');
  await store.save('p', 'c', { retry: true });
  assert.equal(server.rows.get('c').title, 'Read');
  assert.equal(row(store).sync, 'saved');
});

test('readback rejects any acknowledgement with the wrong id or parent', async () => {
  for (const wrong of [{ id: 'wrong', parent_task_id: 'p' }, { id: 'c', parent_task_id: 'wrong' }]) {
    const query = { update() { return this; }, delete() { return this; }, eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { ...wrong, title: 'Wrong' }, error: null }; }, then(resolve, reject) { return Promise.resolve({ data: [{ ...wrong, title: 'Wrong' }], error: null }).then(resolve, reject); } };
    const repo = createSubtaskRepository({ from: () => query });
    const child = { id: 'c', parentTaskId: 'p', title: 'Local', ownerId: '', status: 'notStarted', dueDate: '', baseValues: { title: 'Old', ownerId: '', status: 'notStarted', dueDate: '' }, serverRevision: 0, isNew: false };
    await assert.rejects(repo.write(child), /confirm/i);
    await assert.rejects(repo.remove(child), /confirm/i);
  }
});

test('creation and server revision metadata cannot be edited or sent in a patch', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  store.edit('p', 'c', { title: 'Changed', createdAt: 'forged', created_at: 'forged', serverRevision: 88, baseValues: {} });
  await store.save('p', 'c');
  assert.deepEqual(server.calls.find(call => call.operation === 'update').payload, { title: 'Changed' });
  assert.equal(row(store).createdAt, 'original'); assert.equal(row(store).serverRevision, 1);
});

test('same intended remote value is not treated as an overlapping conflict', async () => {
  const server = backend(); const [a, b] = await stores(server);
  a.edit('p', 'c', { title: 'Same' }); await a.save('p', 'c');
  b.edit('p', 'c', { title: 'Same' }); await b.save('p', 'c');
  assert.equal(row(b).sync, 'saved'); assert.equal(server.rows.get('c').title, 'Same');
});

test('a second concurrent revision change stops automatic retry and retains fresh conflict metadata', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  server.rows.set('c', { ...server.rows.get('c'), revision: 1 });
  server.after = async (operation, data) => {
    if (operation === 'read') {
      // Race after the read snapshot but before the next conditional UPDATE.
      const current = server.rows.get('c'); server.rows.set('c', { ...current, revision: current.revision + 1 });
    }
  };
  store.edit('p', 'c', { title: 'Local' }); await store.save('p', 'c');
  assert.equal(server.calls.filter(call => call.operation === 'update').length, 2);
  assert.equal(row(store).sync, 'error'); assert.equal(row(store).serverRevision, 2);
  assert.equal(row(store).title, 'Local'); assert.equal(server.rows.get('c').title, 'Read');
});

test('duplicate INSERT recovery detects same-field remote conflict before writing', async () => {
  const server = backend(); const [a] = await stores(server, 1);
  server.after = async operation => { if (operation === 'insert') { server.after = null; throw Error('lost ACK'); } };
  a.add({ id: 'p', isNew: false }, 'new'); a.edit('p', 'new', { title: 'Inserted' }); await a.save('p', 'new');
  const [b] = await stores(server, 1); b.edit('p', 'new', { title: 'Remote' }); await b.save('p', 'new');
  a.edit('p', 'new', { title: 'Local' }); await a.save('p', 'new');
  const draft = a.getSnapshot().rows.find(item => item.id === 'new');
  assert.equal(draft.title, 'Local'); assert.equal(draft.baseValues.title, 'Remote');
  assert.match(draft.error, /conflicto/i); assert.equal(server.rows.get('new').title, 'Remote');
  await a.save('p', 'new', { retry: true });
  assert.equal(server.rows.get('new').title, 'Local');
});

test('invalid unsent draft cancels without dispatching any write or delete', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  store.add({ id: 'p', isNew: false }, 'blank'); await store.save('p', 'blank');
  assert.ok(!store.getSnapshot().rows.find(item => item.id === 'blank').insertAttempted);
  await store.remove('p', 'blank');
  assert.equal(server.calls.filter(call => call.operation !== 'read').length, 0);
});

test('cancelling an attempted insert that never committed confirms absence', async () => {
  const server = backend(); const actualWrite = server.repo.write;
  server.repo.write = async () => { throw Error('network before commit'); };
  const [store] = await stores(server, 1);
  store.add({ id: 'p', isNew: false }, 'new'); store.edit('p', 'new', { title: 'Valid' }); await store.save('p', 'new');
  server.repo.write = actualWrite; await store.remove('p', 'new');
  assert.equal(store.getSnapshot().rows.some(item => item.id === 'new'), false);
});

test('duplicate id under another parent cannot be recovered or overwritten', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  store.add({ id: 'other', isNew: false }, 'c'); store.edit('other', 'c', { title: 'Wrong parent' });
  await store.save('other', 'c');
  assert.equal(server.rows.get('c').title, 'Read');
  assert.equal(store.getSnapshot().rows.find(item => item.parentTaskId === 'other').sync, 'error');
  assert.equal(server.calls.filter(call => call.operation === 'update').length, 0);
  assert.deepEqual(server.calls.at(-1).filters, [['parent_task_id', 'other'], ['id', 'c']]);
});

test('DELETE committed with lost response converges on explicit retry after scoped absence read', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  server.after = async operation => { if (operation === 'delete') { server.after = null; throw Error('lost delete ACK'); } };
  await store.remove('p', 'c');
  assert.equal(server.rows.has('c'), false);
  assert.equal(row(store).errorOperation, 'delete');
  await store.remove('p', 'c');
  assert.equal(store.getSnapshot().rows.length, 0);
  const absence = server.calls.at(-1);
  assert.equal(absence.operation, 'read');
  assert.deepEqual(absence.filters, [['parent_task_id', 'p'], ['id', 'c']]);
});

test('DELETE already completed by another client or cascade is confirmed as absent', async () => {
  const server = backend(); const [a, b] = await stores(server);
  await a.remove('p', 'c');
  await b.remove('p', 'c');
  assert.equal(b.getSnapshot().rows.length, 0);
});

test('absence read authorization errors remain visible instead of acknowledging DELETE', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  server.rows.delete('c'); server.readError = { code: '42501', message: 'permission denied' };
  await store.remove('p', 'c');
  assert.equal(row(store).errorOperation, 'delete');
  assert.match(row(store).error, /permission denied/);
});

test('cancelling after INSERT committed but its acknowledgement was lost removes the backend row', async () => {
  const server = backend(); const [store] = await stores(server, 1);
  server.after = async operation => { if (operation === 'insert') { server.after = null; throw Error('lost insert ACK'); } };
  store.add({ id: 'p', isNew: false }, 'new');
  store.edit('p', 'new', { title: 'Ambiguous insert' });
  await store.save('p', 'new');
  assert.ok(server.rows.has('new'));
  assert.equal(store.getSnapshot().rows.find(item => item.id === 'new').sync, 'error');
  await store.remove('p', 'new');
  assert.equal(server.rows.has('new'), false);
  assert.equal(store.getSnapshot().rows.some(item => item.id === 'new'), false);
  assert.deepEqual(server.calls.find(call => call.operation === 'delete').filters, [['parent_task_id', 'p'], ['id', 'new']]);
});


test('duplicate INSERT recovery patches only edits since the attempted insert snapshot', async () => {
  const server = backend(); const [a] = await stores(server, 1);
  server.after = async operation => { if (operation === 'insert') { server.after = null; throw Error('lost insert ACK'); } };
  a.add({ id: 'p', isNew: false }, 'new'); a.edit('p', 'new', { title: 'Inserted' }); await a.save('p', 'new');
  const [b] = await stores(server, 1);
  b.edit('p', 'new', { status: 'done' }); await b.save('p', 'new');
  a.edit('p', 'new', { title: 'Retried title' }); await a.save('p', 'new');
  assert.equal(server.rows.get('new').title, 'Retried title');
  assert.equal(server.rows.get('new').status, 'done');
  assert.deepEqual(server.calls.filter(call => call.operation === 'update').at(-1).payload, { title: 'Retried title' });
  const recovered = a.getSnapshot().rows.find(item => item.id === 'new');
  assert.equal(recovered.isNew, false); assert.equal(recovered.sync, 'saved');
});

test('two clients merge independent title/status edits using revision-scoped dirty patches', async () => {
  const server = backend(); const [a, b] = await stores(server);
  a.edit('p', 'c', { title: 'Client A' }); await a.save('p', 'c');
  b.edit('p', 'c', { status: 'done' }); await b.save('p', 'c');
  assert.equal(server.rows.get('c').title, 'Client A');
  assert.equal(server.rows.get('c').status, 'done');
  assert.equal(row(b).title, 'Client A');
  assert.equal(row(b).serverRevision, 2);
  assert.deepEqual(row(b).baseValues, { title: 'Client A', ownerId: 'u', status: 'done', dueDate: '' });
  const updates = server.calls.filter(call => call.operation === 'update');
  assert.deepEqual(updates.map(call => call.payload), [{ title: 'Client A' }, { status: 'done' }, { status: 'done' }]);
  for (const call of updates) {
    assert.ok(call.filters.some(([key]) => key === 'revision'));
    assert.ok(call.filters.some(([key, value]) => key === 'parent_task_id' && value === 'p'));
    assert.ok(call.filters.some(([key, value]) => key === 'id' && value === 'c'));
    assert.equal(call.mode, 'maybeSingle');
  }
  assert.equal(server.rows.get('c').created_at, 'original');
});

test('same-field conflict preserves local draft, refreshes its base and requires explicit retry', async () => {
  const server = backend(); const [a, b] = await stores(server);
  a.edit('p', 'c', { title: 'Remote', status: 'done' }); await a.save('p', 'c');
  b.edit('p', 'c', { title: 'Local' }); await b.save('p', 'c');
  assert.equal(server.rows.get('c').title, 'Remote');
  assert.equal(row(b).sync, 'error');
  assert.match(row(b).error, /conflicto/i);
  assert.equal(row(b).title, 'Local');
  assert.equal(row(b).serverRevision, 1);
  assert.equal(row(b).baseValues.title, 'Remote');
  assert.equal(row(b).status, 'done');
  await b.save('p', 'c'); // A blur must not acknowledge a conflict for the user.
  b.edit('p', 'c', { title: 'Local revised' }); await b.save('p', 'c');
  assert.equal(server.rows.get('c').title, 'Remote');
  await b.save('p', 'c', { retry: true });
  assert.equal(server.rows.get('c').title, 'Local revised');
  assert.equal(server.rows.get('c').status, 'done');
  assert.equal(row(b).sync, 'saved');
});

test('late acknowledgement rebases queued edits without turning untouched remote fields dirty', async () => {
  const server = backend(); const [a, b] = await stores(server);
  a.edit('p', 'c', { status: 'done' }); await a.save('p', 'c');
  let release; let started;
  const wait = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  server.after = async (operation, data) => {
    if (operation === 'update' && data.length) { server.after = null; started(); await wait; }
  };
  b.edit('p', 'c', { title: 'First' }); const saving = b.save('p', 'c');
  await entered;
  b.edit('p', 'c', { ownerId: 'v' }); b.save('p', 'c');
  release(); await saving;
  assert.equal(server.rows.get('c').title, 'First');
  assert.equal(server.rows.get('c').owner_id, 'v');
  assert.equal(server.rows.get('c').status, 'done');
  assert.deepEqual(server.calls.filter(call => call.operation === 'update').at(-1).payload, { owner_id: 'v' });
  assert.equal(row(b).serverRevision, 3);
});

