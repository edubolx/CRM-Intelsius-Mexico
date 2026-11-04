import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/components/agenda/agendaModel.js';
import {createSubtaskStore} from '../src/components/special-tasks/subtaskStore.js';
import {rowToSubtask} from '../src/components/special-tasks/subtaskModel.js';

test('Agenda progress uses confirmed child values, not unsaved/status drafts, and updates immediately after CAS ACK', async()=>{
  let resolveWrite;
  const raw={id:'c',parent_task_id:'p',title:'Child',status:'notStarted',revision:1};
  const store=createSubtaskStore({list:async()=>[rowToSubtask(raw)],write:async()=>new Promise(resolve=>{resolveWrite=resolve;})});
  await store.load();store.edit('p','c',{status:'done'});store.add({id:'p'},'draft');
  assert.equal(typeof model.persistedAgendaChildren,'function');
  let children=model.persistedAgendaChildren(store.getSnapshot().rows);
  assert.deepEqual(children.map(c=>[c.id,c.status]),[['c','notStarted']]);
  const saving=store.save('p','c');
  assert.equal(model.persistedAgendaChildren(store.getSnapshot().rows)[0].status,'notStarted');
  resolveWrite(rowToSubtask({...raw,status:'done',revision:2}));await saving;
  children=model.persistedAgendaChildren(store.getSnapshot().rows);
  assert.equal(children[0].status,'done');
  const roots=model.buildAgenda({tasks:[{id:'p',title:'Parent',status:'waiting'}],children});
  assert.equal(roots.length,1);assert.equal(roots[0].status,'waiting');assert.equal(roots[0].children.length,1);
});
