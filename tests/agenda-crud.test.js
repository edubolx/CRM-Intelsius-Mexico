import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgendaRepository, newAgendaDraft } from '../src/components/agenda/agendaRepository.js';

import { database } from './helpers/agendaDatabase.js';

test('existing activity patches only changed native fields with CAS; overlapping conflicts never overwrite', async () => {
  const base={...newAgendaDraft('deal_activity','a','d'),title:'Mail',type:'email',responsible:'Edu-USA',comment:'Original'};
  const db=database({deal_activities:[base,{...base,id:'other'}]}),repo=createAgendaRepository(db.client);
  const saved=await repo.save({source:'deal_activity',id:'a',base,draft:{...base,title:'Edited'}});
  assert.equal(saved.type,'email'); assert.equal(saved.responsible,'Edu-USA');
  const update=db.calls.find(c=>c.operation==='update');
  assert.deepEqual(update.payload,{title:'Edited'});
  assert.ok(update.filters.some(([k,v])=>k==='id'&&v==='a'));
  assert.ok(update.filters.some(([k,v])=>k==='title'&&v==='Mail'));
  assert.equal(db.tables.deal_activities[1].title,'Mail');
  await assert.rejects(repo.save({source:'deal_activity',id:'a',base,draft:{...base,title:'Stale draft'}}),/Conflicto/);
  assert.equal(db.tables.deal_activities[0].title,'Edited');
});

test('lost insert/update acknowledgements reconcile exact IDs and retries never duplicate or erase an intention', async () => {
  const db=database(),repo=createAgendaRepository(db.client);
  const draft={...newAgendaDraft('special_task','p'),title:'Parent'};
  db.fail({lost:true});
  const base=await repo.save({source:'special_task',id:'p',draft});
  assert.equal(base.title,'Parent');
  db.fail({lost:true});
  const saved=await repo.save({source:'special_task',id:'p',base,draft:{...base,title:'Changed'}});
  assert.equal(saved.title,'Changed');
  const recovered=await repo.save({source:'special_task',id:'p',draft:{...draft,title:'Changed'}});
  assert.equal(recovered.id,'p');
  assert.equal(db.tables.special_tasks.length,1);
  await assert.rejects(repo.save({source:'special_task',id:'p',base,draft:base}),/Conflicto/);
  assert.equal(db.tables.special_tasks[0].title,'Changed');
});

test('delete reconciles lost ACK and absence, scopes source and ID, and refuses stale record deletion', async () => {
  const a={...newAgendaDraft('special_task','same'),title:'Identical'};
  const db=database({special_tasks:[a,{...a,id:'other'}],deal_activities:[{id:'same',title:'Other source'}]});
  const repo=createAgendaRepository(db.client);
  db.tables.special_tasks[0].title='Concurrent';
  await assert.rejects(repo.remove({source:'special_task',id:'same',base:a}),/Conflicto/);
  assert.equal(db.tables.special_tasks.length,2);
  db.fail({lost:true});
  await repo.remove({source:'special_task',id:'same',base:{...a,title:'Concurrent'}});
  assert.deepEqual(db.tables.special_tasks.map(r=>r.id),['other']);
  assert.equal(db.tables.deal_activities.length,1);
  await repo.remove({source:'special_task',id:'same',base:a});
  assert.ok(db.calls.filter(c=>c.operation==='delete').every(c=>c.filters.some(([k,v])=>k==='id'&&v==='same')));
});

test('unrelated edits preserve native nulls, unknown scores/types/states and aliases without coercion', async () => {
  const base={...newAgendaDraft('deal_activity','a','d'),title:'  Historical title  ',type:'emailType',status:'legacyState',responsible:null,importance_score:'unknown',urgency_score:0,comment:null};
  const db=database({deal_activities:[base]}),repo=createAgendaRepository(db.client);
  const saved=await repo.save({source:'deal_activity',id:'a',base,draft:{...base,due_date:'2026-12-01'}});
  assert.deepEqual(db.calls.find(c=>c.operation==='update').payload,{due_date:'2026-12-01'});
  for(const key of ['title','type','status','responsible','importance_score','urgency_score','comment']) assert.equal(saved[key],base[key],key);
  await assert.rejects(repo.save({source:'deal_activity',id:'a',base:saved,draft:{...saved,status:'notStarted'}}),/Estado/);
  await assert.rejects(repo.save({source:'deal_activity',id:'a',base:saved,draft:{...saved,importance_score:7}}),/prioridad/);
});

test('missing/mismatched identity and invalid source are rejected before any transport', async()=>{
  const db=database(),repo=createAgendaRepository(db.client),draft={...newAgendaDraft('special_task','p'),title:'Valid'};
  await assert.rejects(repo.save({source:'special_task',id:'other',base:draft,draft}),/identidad/i);
  await assert.rejects(repo.save({source:'special_task',id:'',draft}),/identidad/i);
  await assert.rejects(repo.save({source:'unknown',id:'p',draft}),/Origen/);
  assert.equal(db.calls.length,0);
});

test('empty INSERT/UPDATE/DELETE acknowledgements require exact-ID readback and converge without duplicate records', async()=>{
  const db=database(),repo=createAgendaRepository(db.client),draft={...newAgendaDraft('deal_activity','a','d'),title:'Activity'};
  db.fail({empty:true}); const base=await repo.save({source:'deal_activity',id:'a',draft});
  db.fail({empty:true}); const saved=await repo.save({source:'deal_activity',id:'a',base,draft:{...base,status:'done'}});
  assert.equal(saved.status,'done');assert.equal(db.tables.deal_activities.length,1);
  db.fail({empty:true}); await repo.remove({source:'deal_activity',id:'a',base:saved});
  assert.equal(db.tables.deal_activities.length,0);
  assert.ok(db.calls.filter(c=>c.operation==='read').every(c=>c.filters.some(([key,value])=>key==='id'&&value==='a')));
});

test('clearing a required task score fails validation before any request instead of violating native constraints', async()=>{
  const db=database(),repo=createAgendaRepository(db.client);
  const draft={...newAgendaDraft('special_task','p'),title:'Task',importance_score:null};
  await assert.rejects(repo.save({source:'special_task',id:'p',draft}),/prioridad/);
  assert.equal(db.calls.length,0);
});

test('new task inserts only its native fields, optional deal, stable exact ID; invalid activity writes nothing', async () => {
  const db=database(), repo=createAgendaRepository(db.client);
  const task=newAgendaDraft('special_task','new-task');
  task.title=' A task '; task.importance_score=4; task.urgency_score=3;
  const saved=await repo.save({source:'special_task',id:task.id,isNew:true,base:null,draft:task});
  assert.equal(saved.id,'new-task'); assert.equal(saved.title,'A task');
  assert.equal(saved.deal_id,null); assert.equal(saved.status,'notStarted');
  assert.equal(db.calls.filter(c=>c.operation==='insert').length,1);
  assert.ok(!('eisenhower_score' in db.tables.special_tasks[0]));
  assert.ok(!('completed_at' in db.tables.special_tasks[0]));
  const activity=newAgendaDraft('deal_activity','new-activity'); activity.title='Activity';
  await assert.rejects(repo.save({source:'deal_activity',id:activity.id,isNew:true,draft:activity}),/oportunidad/i);
  assert.equal(db.tables.deal_activities.length,0);
});

for(const source of ['special_task','deal_activity']) {
  test(`${source}: repeated reconciliation failures retain attempted intentions and block revised writes`,async()=>{
    const task=source==='special_task',table=task?'special_tasks':'deal_activities';
    const base={...newAgendaDraft(source,'same','d'),title:'Original',
      ...(task?{comments:'Original comment'}:{type:'emailType',responsible:'Edu-USA',comment:'Original comment'})};
    const db=database({[table]:[base]}),repo=createAgendaRepository(db.client);
    const attempted={...base,...(task?{title:'Committed title'}:{type:'meeting',responsible:'Other alias'})};
    db.fail({lost:true,readError:'reconcile offline'});
    await assert.rejects(repo.save({source,id:'same',base,draft:attempted}),/reconcile offline/);
    const revised={...base,[task?'comments':'comment']:'New comment'};
    db.failRead('still offline');
    await assert.rejects(repo.save({source,id:'same',base,draft:revised}),/still offline/);
    assert.equal(db.calls.filter(call=>call.operation==='update').length,1);
    let error;
    try { await repo.save({source,id:'same',base,draft:revised}); } catch(caught) {error=caught;}
    assert.ok(error?.remote,'must surface exact remote values for explicit review');
    assert.ok(error.dirty.includes(task?'title':'type'));
    if(!task) assert.ok(error.dirty.includes('responsible'));
    assert.ok(error.dirty.includes(task?'comments':'comment'));
    assert.equal(db.calls.filter(call=>call.operation==='update').length,1);
    assert.equal(db.tables[table][0][task?'comments':'comment'],'Original comment');
  });
}
