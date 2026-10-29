import test from 'node:test';
import assert from 'node:assert/strict';
import { dealFromRow, dealToRow } from '../src/lib/dealModel.js';
import { storageGet } from '../src/lib/supabaseOps.js';
const product={id:'00000000-0000-4000-8000-000000000001',line:'Orca M',temperature:'-15 a -25'};
test('database serialization/load preserves products, zero revision and won_at without inferred legacy products',()=>{
  const raw={id:'existing-text-id',name:'D',company_id:'c',contact_id:'ct',closing_date:'2026-12-01',won_at:'2026-10-01',product_interests:[product],product_interests_revision:0};
  const loaded=dealFromRow(raw);
  assert.equal(loaded.companyId,'c');assert.equal(loaded.wonAt,raw.won_at);assert.equal(loaded.productInterestsRevision,0);
  const out=dealToRow(loaded);assert.equal(out.product_interests[0].temperature,'-15 a -25');assert.equal(out.product_interests_revision,undefined);
  assert.deepEqual(dealFromRow({id:'old',product_interest:'Orca M'}).productInterests,[]);
  loaded.productInterests[0].line='Orca S';assert.equal(raw.product_interests[0].line,'Orca M');
});
test('all storage refresh mappings preserve product fields and revision',async()=>{
  const client={from(table){const q={select(){return q;},order(){return Promise.resolve({data:table==='deals'?[{id:'D',value:5,product_interests:[product],product_interests_revision:0}]:[],error:null});}};return q;}};
  const loaded=await storageGet({supabase:client,SAMPLE_DATA:{users:[]},DEFAULT_STAGES:[]});
  assert.equal(loaded.dl[0].productInterests[0].line,'Orca M');assert.equal(loaded.dl[0].productInterestsRevision,0);
});
