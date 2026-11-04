import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgendaController } from '../src/components/agenda/agendaController.js';
import { createAgendaRepository, newAgendaDraft } from '../src/components/agenda/agendaRepository.js';
import { database } from './helpers/agendaDatabase.js';

test('conflicts retain intention until explicit retry; delete confirmation/cancel are local and delete errors retain selection', async () => {
  const base={...newAgendaDraft('special_task','p'),title:'Base',comments:'Original'};
  const db=database({special_tasks:[base]}),changes=[];
  const c=createAgendaController(createAgendaRepository(db.client),(...args)=>changes.push(args));
  c.open({source:'special_task',id:'p',base,context:'deal:d'}); c.edit({title:'Mine'});
  db.tables.special_tasks[0].title='Remote'; db.tables.special_tasks[0].comments='Other field';
  assert.equal(await c.save(),false); assert.equal(c.getSnapshot().draft.title,'Mine');
  const count=db.calls.length; await c.save(); assert.equal(db.calls.length,count);
  assert.equal(await c.save({retry:true}),true);
  assert.equal(db.tables.special_tasks[0].title,'Mine'); assert.equal(db.tables.special_tasks[0].comments,'Other field');
  const current={...db.tables.special_tasks[0]};
  c.open({source:'special_task',id:'p',base:current,mode:'delete',childCount:2});
  const before=db.calls.length; c.cancel(); assert.equal(db.calls.length,before);
  c.open({source:'special_task',id:'p',base:current,mode:'delete',childCount:2});
  db.fail({before:true}); assert.equal(await c.remove(),false);
  assert.equal(c.getSnapshot().session,'special_task:p'); assert.equal(c.getSnapshot().childCount,2);
  assert.match(c.getSnapshot().error,/offline/);
  assert.equal(await c.remove(),true); assert.equal(db.tables.special_tasks.length,0);
  assert.equal(changes.at(-1)[2],true);
});

test('edits made after a conflict remain intentional on retry, including newly changed fields', async()=>{
  const base={...newAgendaDraft('special_task','p'),title:'Base',comments:'Old'};
  const db=database({special_tasks:[base]}),c=createAgendaController(createAgendaRepository(db.client));
  c.open({source:'special_task',id:'p',base}); c.edit({title:'Mine'});
  db.tables.special_tasks[0].title='Remote'; await c.save();
  c.edit({comments:'Written after conflict'});
  await c.save({retry:true});
  assert.equal(db.tables.special_tasks[0].comments,'Written after conflict');
  assert.equal(db.tables.special_tasks[0].title,'Mine');
});

test('unresolved UPDATE ACK plus local reversion remains a conflict, never a false Saved', async()=>{
  const base={...newAgendaDraft('special_task','p'),title:'Original'};
  const db=database({special_tasks:[base]}),c=createAgendaController(createAgendaRepository(db.client));
  c.open({source:'special_task',id:'p',base}); c.edit({title:'Committed'});
  db.fail({lost:true,readError:'reconcile offline'});
  assert.equal(await c.save(),false);assert.match(c.getSnapshot().error,/reconcile offline/);
  c.edit({title:'Original'});
  assert.equal(await c.save(),false);
  assert.equal(c.getSnapshot().draft.title,'Original');assert.ok(c.getSnapshot().conflict);
  assert.equal(db.tables.special_tasks[0].title,'Committed');
  assert.equal(await c.save({retry:true}),true);assert.equal(db.tables.special_tasks[0].title,'Original');
});

test('opening/cancelling is local, failed save keeps draft and context, double submission writes once', async () => {
  const db=database(),persisted=[];
  const controller=createAgendaController(createAgendaRepository(db.client),(...args)=>persisted.push(args));
  controller.open({source:'special_task',id:'p',context:'agenda'});
  controller.edit({title:'Local'});
  assert.equal(db.calls.length,0); controller.cancel(); assert.equal(db.calls.length,0);
  controller.open({source:'special_task',id:'p',context:'agenda'}); controller.edit({title:'Retained'});
  db.fail({before:true}); await controller.save();
  assert.equal(controller.getSnapshot().draft.title,'Retained');
  assert.equal(controller.getSnapshot().context,'agenda');
  assert.match(controller.getSnapshot().error,/offline/); assert.equal(persisted.length,0);
  const first=controller.save(),second=controller.save();
  assert.equal(first,second); assert.equal(controller.cancel(),false);
  await first;
  assert.equal(controller.getSnapshot().session,null);
  assert.equal(persisted.length,1); assert.equal(db.tables.special_tasks.length,1);
});

for (const source of ['special_task','deal_activity']) {
  test(`${source}: unresolved UPDATE then reversion plus new edits requires review before any further write`, async()=>{
    const task=source==='special_task',table=task?'special_tasks':'deal_activities';
    const base={...newAgendaDraft(source,'same','d'),title:'Original',
      ...(task?{comments:'Original comment'}:{type:'email',responsible:'Edu-USA',comment:'Original comment'})};
    const other={...base,id:'other'};
    const db=database({[table]:[base,other]}),persisted=[];
    const c=createAgendaController(createAgendaRepository(db.client),(...args)=>persisted.push(args));
    c.open({source,id:'same',base});
    c.edit(task?{title:'Committed title'}:{type:'call',responsible:'Committed alias'});
    db.fail({lost:true,readError:'reconcile offline'});
    assert.equal(await c.save(),false);
    c.edit(task?{title:'Original',comments:'New comment'}:{type:'email',responsible:'Edu-USA',comment:'New comment'});
    const writes=()=>db.calls.filter(call=>call.operation!=='read');
    assert.equal(await c.save(),false,'revised draft must not be silently acknowledged');
    assert.equal(writes().length,1,'reconciliation must precede another write');
    assert.equal(persisted.length,0);
    assert.ok(c.getSnapshot().conflict);
    assert.equal(c.getSnapshot().draft[task?'comments':'comment'],'New comment');
    assert.equal(c.getSnapshot().draft[task?'title':'type'],task?'Original':'email');
    c.edit(task?{comments:'Edited after review'}:{comment:'Edited after review',due_date:'2026-12-01'});
    assert.equal(await c.save(),false,'ordinary save cannot bypass conflict review');
    assert.equal(await c.save({retry:true}),true);
    const remote=db.tables[table][0];
    assert.equal(remote[task?'title':'type'],task?'Original':'email');
    assert.equal(remote[task?'comments':'comment'],'Edited after review');
    if(!task) {assert.equal(remote.responsible,'Edu-USA');assert.equal(remote.due_date,'2026-12-01');}
    assert.deepEqual(db.tables[table][1],other);
    assert.deepEqual(Object.keys(writes()[1].payload).sort(),task?['comments','title']:['comment','due_date','responsible','type']);
    assert.ok(db.calls.every(call=>call.table===table&&call.filters.some(([key,value])=>key==='id'&&value==='same')));
    assert.equal(persisted.length,1);
  });
}
