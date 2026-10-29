import test from 'node:test';
import assert from 'node:assert/strict';
import { createDealSaveSession } from '../src/lib/dealSave.js';
import { database, id, product } from './helpers/dealDatabase.js';

const stamp = '2026-10-29T12:34:56.123Z';
const formatted = ['2026-10-29T12:34:56.123000+00:00', '2026-10-29T07:34:56.123000-05:00'];
const base = () => ({id, name:'Original', won_at:null, product_interests:[], product_interests_revision:2});
// Model timestamptz formatting only at server readback; keep sent values untouched.
function serverTimestamp(db, timestamp) {
  const from = db.from;
  db.from = (...args) => {
    const query = from(...args);
    query.maybeSingle = () => {
      if (db.row) db.row.won_at = timestamp;
      return query;
    };
    return query;
  };
  return db;
}

for (const mode of ['create','edit']) {
  for (const timestamp of formatted) {
    test(`${mode} confirms won_at server formatting ${timestamp}`, async () => {
      const db = serverTimestamp(database(mode === 'edit' ? base() : null), timestamp);
      const draft = {...base(), stage:'Won', won_at:stamp, product_interests:[product]};
      const session = createDealSaveSession({id, mode, base:mode === 'edit' ? base() : {}});
      const result = await session.save(db, draft);
      assert.equal(result.ok, true);
      assert.equal(result.row.won_at, timestamp);
      assert.equal(db.writes.length, 1);
      assert.equal(db.writes[0].payload.won_at, stamp);
      assert.equal(draft.won_at, stamp);
    });
  }
  test(`${mode} reconciles lost ACK with normalized won_at immediately`, async () => {
    const db = serverTimestamp(database(mode === 'edit' ? base() : null), formatted[0]);
    db.ackLost = true;
    const session = createDealSaveSession({id, mode, base:mode === 'edit' ? base() : {}});
    const result = await session.save(db, {...base(), won_at:stamp, product_interests:[product]});
    assert.equal(result.ok, true);
    assert.equal(db.writes.length, 1);
  });
  test(`${mode} pending lost ACK accepts equivalent retry intention without another write`, async () => {
    const db = serverTimestamp(database(mode === 'edit' ? base() : null), formatted[1]);
    db.ackLost = true;
    db.readMissing = true;
    const session = createDealSaveSession({id, mode, base:mode === 'edit' ? base() : {}});
    const draft = {...base(), won_at:stamp, product_interests:[product]};
    await assert.rejects(() => session.save(db, draft), /confirmar/i);
    db.readMissing = false;
    assert.equal((await session.save(db, {...draft, won_at:formatted[0]})).ok, true);
    assert.equal(db.writes.length, 1);
    assert.equal(db.row.product_interests_revision, mode === 'create' ? 0 : 3);
  });
}

test('equivalent won_at does not dirty an otherwise unchanged edit', async () => {
  const original = {...base(), won_at:formatted[0]}, db = database(original);
  const session = createDealSaveSession({id, mode:'edit', base:original});
  assert.equal((await session.save(db, {...original, won_at:stamp})).ok, true);
  assert.equal(db.writes.length, 0);
  assert.equal(db.row.won_at, formatted[0]);
});

test('equivalent won_at stays out of metadata patch and preserves concurrent timestamp', async () => {
  const original = {...base(), won_at:formatted[0]};
  const concurrent = '2026-10-30T12:34:56.123Z';
  const db = database({...original, won_at:concurrent});
  const session = createDealSaveSession({id, mode:'edit', base:original});
  assert.equal((await session.save(db, {...original, name:'Edited', won_at:stamp})).ok, true);
  assert.deepEqual(db.writes[0].payload, {name:'Edited'});
  assert.equal(db.row.won_at, concurrent);
});

test('won_at null, different instants and submillisecond differences remain dirty', async () => {
  for (const [before, after] of [[null, stamp], [stamp, null], [stamp, '2026-10-29T12:34:57.123Z'], ['2026-10-29T12:34:56.123001Z', '2026-10-29T12:34:56.123002+00:00']]) {
    const original = {...base(), won_at:before}, db = database(original);
    assert.equal((await createDealSaveSession({id, mode:'edit', base:original}).save(db, {...original, won_at:after})).ok, true);
    assert.deepEqual(db.writes[0].payload, {won_at:after});
  }
});

test('readback rejects null and genuinely different won_at including submilliseconds', async () => {
  for (const timestamp of [null, '2026-10-29T12:34:57.123Z', '2026-10-29T12:34:56.123001+00:00']) {
    const db = serverTimestamp(database(), timestamp);
    await assert.rejects(() => createDealSaveSession({id, mode:'create'}).save(db, {...base(), won_at:stamp}), /conflicto/i);
  }
});

test('pending intention rejects genuinely different timestamps, null and other field formatting', async () => {
  for (const change of [{won_at:null}, {won_at:'2026-10-29T12:34:56.123001Z'}, {name:formatted[0]}, {product_interests:[{...product, quantity:2}]}]) {
    const db = database(); db.ackLost = true; db.readMissing = true;
    const session = createDealSaveSession({id, mode:'create'});
    const draft = {...base(), name:stamp, won_at:stamp, product_interests:[product]};
    await assert.rejects(() => session.save(db, draft), /confirmar/i);
    db.readMissing = false;
    await assert.rejects(() => session.save(db, {...draft, ...change}), /intención/i);
    assert.equal(db.writes.length, 1);
  }
});

test('timestamp-shaped other fields remain literal dirty values', async () => {
  const original = {...base(), name:stamp, contact_id:stamp, closing_date:stamp, notes:stamp};
  const db = database(original);
  await createDealSaveSession({id, mode:'edit', base:original}).save(db, {...original, name:formatted[0], contact_id:formatted[0], closing_date:formatted[0], notes:formatted[0]});
  assert.deepEqual(db.writes[0].payload, {name:formatted[0], contact_id:formatted[0], closing_date:formatted[0], notes:formatted[0]});
});

test('invalid won_at strings never compare equal merely because both fail parsing', async () => {
  const db = serverTimestamp(database(), 'invalid B');
  await assert.rejects(() => createDealSaveSession({id, mode:'create'}).save(db, {...base(), won_at:'invalid A'}), /conflicto/i);
});
