import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';
import {createAgendaController} from '../src/components/agenda/agendaController.js';
import {newAgendaDraft} from '../src/components/agenda/agendaRepository.js';
import {createAgendaSources} from '../src/components/agenda/agendaSources.js';
import {buildAgenda} from '../src/components/agenda/agendaModel.js';
import {loadJsx} from './helpers/loadJsx.js';
import {renderToStaticMarkup} from 'react-dom/server';

test('accept after a failed initial collection read retains the error and actual Agenda incomplete warning', async()=>{
  let reads=0;
  let offline=true;
  const saved={id:'same',title:'Confirmed task',status:'notStarted'};
  const store=createAgendaSources({from(){return {select(){return this;},order(){
    reads++;
    return Promise.resolve(offline?{error:Error('Tasks offline')}:{data:[]});
  }};}});
  await store.load();
  assert.equal(store.getSnapshot().error,'Tasks offline');
  store.accept(saved);
  assert.equal(store.getSnapshot().error,'Tasks offline');
  assert.equal(store.getSnapshot().loading,false);
  assert.deepEqual(store.getSnapshot().tasks,[saved]);
  const {default:Agenda}=await loadJsx('components/agenda/AgendaView.jsx');
  const source=store.getSnapshot();
  const rows=buildAgenda({...source,deals:[{id:'d',activities:[{id:'same',title:'Loaded activity',type:'call',status:'pending'}]}]});
  const html=renderToStaticMarkup(React.createElement(Agenda,{rows,source,today:'2026-11-04',state:{view:'pending',filters:{},expanded:{}},onStateChange(){}}));
  assert.match(html,/Totales incompletos/);
  assert.match(html,/data-totals-incomplete="true"/);
  assert.match(html,/Tasks offline/);
  assert.match(html,/special_task:same/);
  assert.match(html,/deal_activity:same/);
  assert.match(html,/Confirmed task/);
  assert.match(html,/Loaded activity/);
  assert.equal(reads,2,'accept and render must not trigger reads');
  offline=false;
  await store.load();
  assert.equal(store.getSnapshot().error,'');
  assert.equal(store.getSnapshot().loading,false);
});
test('pending initial full read merges unrelated rows with the latest accepted edit and new record', async()=>{
  const pending=[];
  const store=createAgendaSources({from(table){return {select(){return this;},order(){
    return new Promise(resolve=>pending.push({table,resolve}));
  }};}});
  const load=store.load();
  const latest={id:'same',title:'Latest confirmed edit',status:'waiting'};
  const created={id:'created',title:'Confirmed new row'};
  const other={id:'other',title:'Unrelated collection row'};
  const child={id:'child',parent_task_id:'other'};
  store.accept({...latest,title:'Earlier confirmed edit'});
  store.accept(latest);
  store.accept(created);
  assert.equal(store.getSnapshot().loading,true,'one confirmed row does not complete the collection');
  assert.equal(pending.length,2,'accept must not launch another bulk read');
  pending.find(p=>p.table==='special_tasks').resolve({data:[{...latest,title:'Stale full-read title'},other]});
  pending.find(p=>p.table==='special_task_subtasks').resolve({data:[child]});
  await load;
  const source=store.getSnapshot();
  assert.deepEqual([...source.tasks].sort((a,b)=>a.id.localeCompare(b.id)),[created,other,latest].sort((a,b)=>a.id.localeCompare(b.id)));
  assert.deepEqual(source.children,[child]);
  assert.equal(source.loading,false);
  assert.equal(source.error,'');
  const {default:Agenda}=await loadJsx('components/agenda/AgendaView.jsx');
  const html=renderToStaticMarkup(React.createElement(Agenda,{rows:buildAgenda(source),source,today:'2026-11-04',state:{view:'pending',filters:{},expanded:{}},onStateChange(){}}));
  assert.doesNotMatch(html,/Totales incompletos|data-totals-incomplete="true"|Stale full-read title/);
  assert.match(html,/Unrelated collection row/);
  assert.match(html,/Latest confirmed edit/);
  assert.equal(pending.length,2);
});

test('pending initial full read cannot resurrect a confirmed deletion or its children', async()=>{
  const pending=[];
  const store=createAgendaSources({from(table){return {select(){return this;},order(){
    return new Promise(resolve=>pending.push({table,resolve}));
  }};}});
  const load=store.load();
  const deleted={id:'deleted',title:'Same title'};
  const other={id:'other',title:'Same title'};
  const keptChild={id:'kept-child',parent_task_id:'other'};
  store.accept(deleted);
  store.accept(deleted,true);
  assert.deepEqual(store.getSnapshot().tasks,[]);
  assert.equal(store.getSnapshot().loading,true);
  pending.find(p=>p.table==='special_tasks').resolve({data:[deleted,other]});
  pending.find(p=>p.table==='special_task_subtasks').resolve({data:[{id:'deleted-child',parent_task_id:'deleted'},keptChild]});
  await load;
  assert.deepEqual(store.getSnapshot(),{tasks:[other],children:[keptChild],loading:false,error:''});
  // A later complete read is authoritative, not permanently shadowed by tombstones.
  const next=store.load();
  pending[2].resolve({data:[{...deleted,title:'Recreated later'},other]});
  pending[3].resolve({data:[keptChild]});
  await next;
  assert.deepEqual(store.getSnapshot().tasks,[{...deleted,title:'Recreated later'},other]);
  assert.equal(pending.length,4);
});

async function component(name) {
  const url=new URL(`../src/components/agenda/${name}.jsx`,import.meta.url);
  let source=await readFile(url,'utf8');
  source=source.replace(/from ['"]([^'"]+\.js)['"]/g,(_,p)=>`from '${new URL(p,url).href}'`);
  const {code}=await transformWithEsbuild(source,name+'.jsx',{loader:'jsx',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'});
  return (await import(`data:text/javascript;base64,${Buffer.from(`import React from '${import.meta.resolve('react')}';\n${code}`).toString('base64')}`)).default;
}
const nodes = tree => {const all=[];function visit(el){if(!React.isValidElement(el))return;all.push(el);React.Children.forEach(el.props.children,visit);} visit(tree);return all;};

test('shared editor and nested CAS rows provide responsive layout and keyboard focus styles', async()=>{
  const css=await readFile(new URL('../src/components/agenda/agenda.css',import.meta.url),'utf8');
  assert.match(css,/\.agenda-editor-fields\s*\{/);
  assert.match(css,/\.agenda-editor[^}]*:focus-visible|\.agenda-editor\s+:is\([^)]*\):focus-visible/);
  assert.match(css,/@media[^}]+max-width:\s*600px[\s\S]*\.agenda-subtasks/);
});

test('delete dialog identifies the native activity type, exact source ID and title and cancels locally', async()=>{
  const c=createAgendaController({remove:async()=>assert.fail('Cancel must not write')});
  const Editor=await component('AgendaEditor');
  const base={...newAgendaDraft('deal_activity','same','d'),type:'emailType',title:'Duplicate title'};
  c.open({source:'deal_activity',id:'same',base,mode:'delete'});
  const tree=Editor({snapshot:c.getSnapshot(),controller:c});
  const {renderToStaticMarkup}=await import('react-dom/server');
  const html=renderToStaticMarkup(tree);
  assert.match(html,/emailType/);assert.match(html,/deal_activity:same/);assert.match(html,/Duplicate title/);
  nodes(tree).find(n=>n.props['data-action']==='cancel-editor').props.onClick();
  assert.equal(c.getSnapshot().session,null);
});

test('shared editor preserves native values and drafts; open/cancel/type never write', async()=>{
  const writes=[];
  const c=createAgendaController({save:async attempt=>{writes.push(attempt);throw Error('offline');}});
  const Editor=await component('AgendaEditor');
  const base={...newAgendaDraft('deal_activity','b','d'),title:'Identical',type:'email',responsible:'Edu-USA',due_date:null};
  c.open({source:'deal_activity',id:'b',base});
  const props=()=>({snapshot:c.getSnapshot(),controller:c,users:[],deals:[{id:'d',name:'Deal'}]});
  let all=nodes(Editor(props()));
  assert.equal(all.find(n=>n.props['aria-label']==='Tipo').props.value,'email');
  assert.equal(all.find(n=>n.props['aria-label']==='Responsable').props.value,'Edu-USA');
  assert.equal(all.find(n=>n.props['aria-label']==='Fecha compromiso').props.value,'');
  all.find(n=>n.props['aria-label']==='Título').props.onChange({target:{value:'Retained draft'}});
  assert.equal(writes.length,0);
  all=nodes(Editor(props()));
  await all.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(c.getSnapshot().draft.title,'Retained draft');
  assert.equal(c.getSnapshot().session,'deal_activity:b');
  assert.match(c.getSnapshot().error,/offline/);
  all=nodes(Editor(props())); assert.ok(all.some(n=>n.props.role==='alert'));
  all.find(n=>n.props['data-action']==='cancel-editor').props.onClick();
  assert.equal(writes.length,1); assert.equal(c.getSnapshot().session,null);
});
