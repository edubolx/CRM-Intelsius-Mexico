import test from 'node:test';
import assert from 'node:assert/strict';
import { saveDealSnapshot } from '../src/lib/dealSnapshot.js';
import { database, id, product } from './helpers/dealDatabase.js';
test('global/legacy snapshots without product fields never reset existing selections',async()=>{
  const db=database({id,name:'D',value:0,stage:'Open',product_interests:[product],product_interests_revision:4});
  await saveDealSnapshot(db,{id,name:'Imported',stage:'Open'});
  assert.equal(db.row.product_interests[0].line,'Orca M');assert.equal(db.row.product_interests_revision,4);
  assert.equal(db.writes[0].payload.product_interests,undefined);
});
test('global snapshots use original revision CAS, reject stale products and do not recreate deleted saved deals',async()=>{
  const db=database({id,name:'D',product_interests:[product],product_interests_revision:4});
  await assert.rejects(()=>saveDealSnapshot(db,{id,name:'Import',productInterests:[],productInterestsRevision:3}),/conflicto/i);
  assert.equal(db.row.product_interests.length,1);
  db.row=null;await assert.rejects(()=>saveDealSnapshot(db,{id,name:'Import',productInterests:[],productInterestsRevision:3}),/eliminado/i);
});
