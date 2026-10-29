import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalDealClient, loadLocalData } from '../src/lib/localDeals.js';
import { createDealSaveSession } from '../src/lib/dealSave.js';
import { storageGet } from '../src/lib/supabaseOps.js';
const id='00000000-0000-4000-8000-000000000011',p={id:'00000000-0000-4000-8000-000000000012',line:'Pharmatherm'};
const storage=()=>{let value=null;return {getItem(){return value;},setItem(_,v){value=v;}};};
test('local fallback saves atomic row and revision with real serialization/readback',async()=>{
  const s=storage(),initialData={co:[{id:'c'}],ct:[],dl:[],users:[],stages:[]};
  const client=createLocalDealClient({storage:s,initialData});
  const session=createDealSaveSession({id,mode:'create',base:{}});
  await session.save(client,{name:'Local',product_interests:[p]});
  const loaded=loadLocalData(s,initialData);assert.equal(loaded.dl[0].productInterests[0].line,'Pharmatherm');assert.equal(loaded.dl[0].productInterestsRevision,0);assert.deepEqual(loaded.co,initialData.co);
  const second=createDealSaveSession({id,mode:'edit',base:{name:'Local',product_interests:[p],product_interests_revision:0}});
  await second.save(client,{name:'Renamed',product_interests:[p]});assert.equal(loadLocalData(s,initialData).dl[0].productInterestsRevision,0);
  assert.deepEqual(initialData.dl,[]);
});
test('no-supabase storageGet uses isolated local/sample data without inferring selections',async()=>{
  const saved=globalThis.localStorage;globalThis.localStorage=storage();
  try {
    const sample={co:[],ct:[],dl:[{id:'sample',name:'D',productInterest:'Orca M'}],users:[]};
    const loaded=await storageGet({supabase:null,SAMPLE_DATA:sample,DEFAULT_STAGES:[]});
    assert.equal(loaded.__source,'local');assert.deepEqual(loaded.dl[0].productInterests,[]);assert.equal(loaded.dl[0].productInterestsRevision,0);
    assert.equal(sample.dl[0].productInterests,undefined);
  } finally {globalThis.localStorage=saved;}
});
