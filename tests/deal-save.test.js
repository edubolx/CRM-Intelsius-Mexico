import test from 'node:test';
import assert from 'node:assert/strict';
import { createDealSaveSession } from '../src/lib/dealSave.js';
import { database, id, product } from './helpers/dealDatabase.js';
test('empty product create is valid and uses server insert revision zero',async()=>{
  const db=database();const session=createDealSaveSession({id,mode:'create',base:{}});
  const result=await session.save(db,{name:'No products',product_interests:[]});
  assert.equal(result.ok,true);assert.equal(result.row.product_interests_revision,0);
});
test('existing deal text IDs are valid; only child product IDs must be UUIDs',async()=>{
  const original={id:'mexico-legacy-deal',name:'Old',product_interests:[],product_interests_revision:0},db=database(original);
  const result=await createDealSaveSession({id:original.id,mode:'edit',base:original}).save(db,{...original,name:'New'});
  assert.equal(result.ok,true);assert.equal(db.row.name,'New');
});
test('metadata-only omitted products preserve base selections; null list is invalid',async()=>{
  const original={id,name:'Old',product_interests:[product],product_interests_revision:0};
  const db=database(original);await createDealSaveSession({id,mode:'edit',base:original}).save(db,{name:'New'});
  assert.equal(db.row.product_interests.length,1);assert.equal(db.writes[0].payload.product_interests,undefined);
  await assert.rejects(()=>createDealSaveSession({id,mode:'create',base:{}}).save(database(),{name:'N',product_interests:null}));
});
test('empty create returning remains ambiguous, readback verifies or blocks later resurrection',async()=>{
  const db=database();db.emptyAfter=true;db.readMissing=true;
  const session=createDealSaveSession({id,mode:'create',base:{}}),draft={name:'N',product_interests:[]};
  await assert.rejects(()=>session.save(db,draft),/confirmar/i);
  db.row=null;db.readMissing=false;await assert.rejects(()=>session.save(db,draft));
  assert.equal(db.writes.length,1);
  const verified=database();verified.emptyAfter=true;
  assert.equal((await createDealSaveSession({id,mode:'create',base:{}}).save(verified,draft)).ok,true);
  assert.equal(verified.reads,1);
});
test('incomplete exact-row readback is never success even for metadata-only edits',async()=>{
  const db=database({id,name:'Old'});
  const session=createDealSaveSession({id,mode:'edit',base:{name:'Old'}});
  const client={from(){let write=false;const q={select(){return q;},update(){write=true;return q;},eq(){return q;},maybeSingle(){return q;},then(resolve){return Promise.resolve({data:write?[{id,name:'New'}]:{id,name:'New'},error:null}).then(resolve);}};return q;}};
  await assert.rejects(()=>session.save(client,{name:'New'}));
});
const base=()=>({id,name:'Base',notes:'old',value:5,product_interests:[],product_interests_revision:3});
test('edit patches only dirty fields with product CAS; preserves concurrent metadata',async()=>{
  const original=base(),db=database({...original,notes:'concurrent'});
  const session=createDealSaveSession({id,mode:'edit',base:original});
  assert.equal((await session.save(db,{...original,name:'New',product_interests:[product]})).ok,true);
  assert.equal(db.row.notes,'concurrent');assert.equal(db.row.value,5);
  assert.deepEqual(Object.keys(db.writes[0].payload).sort(),['name','product_interests']);
  assert.deepEqual(db.writes[0].filters,[['id',id],['product_interests_revision',3]]);
  assert.equal(db.row.product_interests_revision,4);
});
test('CAS conflict and deleted edits never insert or claim success; input draft retained',async()=>{
  for(const remote of [null,{...base(),product_interests_revision:4}]){
    const db=database(remote),draft={...base(),name:'New',product_interests:[product]},snapshot=structuredClone(draft);
    await assert.rejects(()=>createDealSaveSession({id,mode:'edit',base:base()}).save(db,draft),/conflicto|eliminado/i);
    assert.deepEqual(draft,snapshot);assert.equal(db.writes[0].op,'update');
  }
});
test('metadata-only edits do not send products or revision and do not CAS stale products',async()=>{
  const original=base(),db=database({...original,product_interests:[product],product_interests_revision:4});
  await createDealSaveSession({id,mode:'edit',base:original}).save(db,{...original,name:'New'});
  assert.deepEqual(db.writes[0].payload,{name:'New'});assert.equal(db.row.product_interests.length,1);
});
test('lost ACK creates exactly once and repeat save reconciles the stable ID',async()=>{
  const db=database();db.ackLost=true;
  const session=createDealSaveSession({id,mode:'create',base:{}}),draft={name:'New',product_interests:[product]};
  assert.equal((await session.save(db,draft)).ok,true);
  assert.equal((await session.save(db,draft)).ok,true);
  assert.equal(db.writes.length,1);
});
test('synchronous duplicate submit guard prevents a second write',async()=>{
  const db=database();let release;db.gate=new Promise(r=>{release=r;});
  const session=createDealSaveSession({id,mode:'create',base:{}}),draft={name:'N',product_interests:[]};
  const first=session.save(db,draft);
  try { await assert.rejects(()=>Promise.race([session.save(db,draft),new Promise((_,reject)=>setTimeout(()=>reject(new Error('guard missing')),50))]),/guardando/i); }
  finally { release(); }
  await first;assert.equal(db.writes.length,1);
});
test('empty responses and missing readback never fake success; no resurrection after unknown create',async()=>{
  const db=database();db.readMissing=true;
  const session=createDealSaveSession({id,mode:'create',base:{}}),draft={name:'N',product_interests:[]};
  await assert.rejects(()=>session.save(db,draft),/confirmar/i);
  db.row=null;db.readMissing=false;
  await assert.rejects(()=>session.save(db,draft),/confirmar|eliminado/i);
  assert.equal(db.writes.length,1);
  const empty=database();empty.empty=true;
  await assert.rejects(()=>createDealSaveSession({id,mode:'create',base:{}}).save(empty,draft));
});
test('ambiguous edit retry cannot silently replace changed/reverted local intention',async()=>{
  const db=database(base());db.ackLost=true;db.readMissing=true;
  const session=createDealSaveSession({id,mode:'edit',base:base()});
  await assert.rejects(()=>session.save(db,{...base(),product_interests:[product]}));
  db.readMissing=false;
  await assert.rejects(()=>session.save(db,base()),/intención|confirmar/i);
  assert.equal(db.writes.length,1);assert.equal(db.row.product_interests.length,1);
});
test('validation errors make no request; canceled session has no persistence side effects',async()=>{
  const db=database();const session=createDealSaveSession({id,mode:'create',base:{}});
  await assert.rejects(()=>session.save(db,{name:'N',product_interests:[{id:product.id,line:''}]}));
  assert.equal(db.writes.length,0);assert.equal(db.reads,0);
  createDealSaveSession({id,mode:'create',base:{}});assert.equal(db.writes.length,0);
});
test('create uses stable identity, one atomic insert, explicit readback',async()=>{
  const db=database(); const session=createDealSaveSession({id,mode:'create',base:{}});
  const result=await session.save(db,{name:'Deal',notes:'n',product_interests:[product]});
  assert.equal(result.ok,true);assert.equal(result.row.id,id);assert.equal(db.writes.length,1);assert.equal(db.writes[0].op,'insert');assert.equal(db.reads,1);
  assert.equal(db.row.product_interests[0].quantity,null);
});
