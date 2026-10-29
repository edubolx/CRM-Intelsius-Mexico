import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dealFromRow,dealToRow } from '../src/lib/dealModel.js';
import { createDealSaveSession } from '../src/lib/dealSave.js';
import { database,id,product } from './helpers/dealDatabase.js';
async function saveFlow({db,existing,stages=[{name:'Open'},{name:'Won',isWon:true}],pipeline='mexico'}) {
  const source=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('  const saveDl='),source.indexOf('  const chStage='));
  let rows=existing?[existing]:[],journal=[];
  const context={dls:rows,activeStages:stages,activePipelineType:pipeline,USA_HANDOVER_SOURCE:'USA Handover - Michael',supabase:db,dealFromRow,dealToRow,createLocalDealClient(){throw Error('unexpected local path');},setSaveStatus(){},setSaveMessage(){},lang:'es',viewDeal:null,setViewDeal(){},setDls(fn){rows=fn(rows);},logStageChange:async(...args)=>{journal.push(args);}};
  const save=Function(...Object.keys(context),body+';return saveDl;')(...Object.values(context));
  return {save,get rows(){return rows;},journal};
}
const initialDeal=()=>({id,name:'D',stage:'Open',value:5,wonAt:null,productInterests:[],productInterestsRevision:0,_saveTime:'2026-10-29T00:00:00Z'});
test('actual saveDl product-only edit preserves concurrent stage and does not journal someone else’s change',async()=>{
  const initial=initialDeal(),remote={...dealToRow(initial),id,stage:'Won',won_at:'2026-10-28',product_interests_revision:0};
  const db=database(remote),flow=await saveFlow({db,existing:dealFromRow(remote)});
  const session=createDealSaveSession({id,mode:'edit',base:{...dealToRow(initial),product_interests_revision:0}});
  const result=await flow.save({...initial,productInterests:[product]},session,initial);
  assert.equal(result.ok,true);assert.equal(db.row.stage,'Won');assert.equal(db.row.won_at,'2026-10-28');assert.deepEqual(flow.journal,[]);
  assert.equal(flow.rows[0].productInterests.length,1);
});
test('actual saveDl retains USA semantics, won_at, journal on explicit stage change and atomic products',async()=>{
  const initial=initialDeal(),db=database({...dealToRow(initial),id,product_interests_revision:0}),flow=await saveFlow({db,existing:initial,pipeline:'usa_handover'});
  const session=createDealSaveSession({id,mode:'edit',base:{...dealToRow(initial),product_interests_revision:0}});
  const result=await flow.save({...initial,stage:'Won',productInterests:[product]},session,initial);
  assert.equal(result.ok,true);assert.equal(db.row.won_at,initial._saveTime);assert.equal(db.row.lead_source,'Custom');assert.equal(db.row.lead_source_custom,'USA Handover - Michael');
  assert.deepEqual(flow.journal,[[id,'Open','Won']]);assert.equal(db.writes.length,1);assert.equal(db.row.product_interests.length,1);
});
