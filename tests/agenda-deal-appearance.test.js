import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadJsx,nodes} from './helpers/loadJsx.js';
import {createAgendaController} from '../src/components/agenda/agendaController.js';
import {createAgendaRepository,newAgendaDraft} from '../src/components/agenda/agendaRepository.js';
import {database} from './helpers/agendaDatabase.js';

const t={activityType:'Tipo',activityTitle:'Título',activityDueDate:'Fecha compromiso',activityResponsible:'Responsable',activityStatus:'Estado',activityImportance:'Importancia',activityUrgency:'Urgencia',activityEisenhowerScore:'Score Eisenhower',activityComment:'Comentario',addActivity:'Nueva actividad',activityUpdate:'Guardar cambios',activityEdit:'Editar actividad',deleteBtn:'Eliminar',cancel:'Cancelar',selectOpt:'Seleccionar',pending:'Pendiente',done:'Hecha',inProgress:'En progreso',blocked:'Bloqueada',task:'Tarea',emailType:'Correo',call:'Llamada',meeting:'Reunión',note:'Nota',noActivities:'Sin actividades todavía.'};
async function setup(rows=[]) {
  const {default:Panel}=await loadJsx('components/activities/ActivitiesPanel.jsx');
  const {default:Editor}=await loadJsx('components/agenda/AgendaEditor.jsx');
  const db=database({deal_activities:rows});
  const deal={id:'d',name:'Deal',activities:rows.map(row=>({id:row.id,title:row.title,type:row.type,status:row.status,responsible:row.responsible,dueDate:row.due_date,comment:row.comment,importanceScore:row.importance_score,urgencyScore:row.urgency_score,eisenhowerScore:row.importance_score==null || row.urgency_score==null?null:Number(row.importance_score)+Number(row.urgency_score),nativeRow:row}))};
  const c=createAgendaController(createAgendaRepository(db.client),(source,row,deleted)=>{
    assert.equal(source,'deal_activity');
    deal.activities=deal.activities.filter(a=>a.id!==row.id);
    if(!deleted)deal.activities.push({id:row.id,title:row.title,type:row.type,status:row.status,responsible:row.responsible,dueDate:row.due_date,comment:row.comment,importanceScore:row.importance_score,urgencyScore:row.urgency_score,nativeRow:row});
  });
  const panel=()=>Panel({deal,deals:[deal,{id:'other',name:'Destination'}],t,users:[{id:'u',alias:'Edu',name:'Eduardo'}],helpers:{today:()=> '2026-11-04'},agendaController:c,agendaEditor:c.getSnapshot()});
  const form=()=>{const shared=nodes(panel()).find(n=>n.type===Editor);assert.ok(shared,'shared AgendaEditor must render even while idle');return Editor(shared.props);};
  const field=label=>nodes(form()).find(n=>n.props['aria-label']===label);
  return {db,deal,c,panel,form,field};
}

test('deal idle form restores original grid, labels and blue action without acquiring a session; first interaction and cancel share the controller',async()=>{
  const {db,c,panel,form,field}=await setup();
  const html=renderToStaticMarkup(panel());
  assert.match(html,/data-presentation="deal"/);
  for(const label of ['Tipo','Título','Fecha compromiso','Responsable','Estado','Importancia','Urgencia','Score Eisenhower','Comentario'])assert.ok(html.includes(label),label);
  assert.match(html,/grid-template-columns:repeat\(auto-fit,minmax\(170px,1fr\)\)/);
  assert.match(html,/background:#003e7e/);
  assert.equal(field('Score Eisenhower').props.disabled,true);
  assert.equal(field('Fecha compromiso').props.value,'2026-11-04');
  assert.equal(field('Importancia').props.value,'');
  assert.equal(c.getSnapshot().session,null);
  assert.equal(db.calls.length,0);
  field('Título').props.onChange({target:{value:'Draft only'}});
  assert.match(c.getSnapshot().session,/^deal_activity:/);
  assert.equal(c.getSnapshot().context,'deal:d');
  assert.equal(c.getSnapshot().draft.title,'Draft only');
  nodes(form()).find(n=>n.props['data-action']==='cancel-editor').props.onClick();
  assert.equal(c.getSnapshot().session,null);
  assert.equal(field('Título').props.value,'');
  assert.equal(db.calls.length,0);
  c.open({source:'special_task',id:'elsewhere'});
  const before=c.getSnapshot();
  field('Título').props.onChange({target:{value:'Do not hijack'}});
  assert.deepEqual(c.getSnapshot(),before);
  assert.equal(field('Título').props.disabled,true);
  assert.equal(db.calls.length,0);
});

test('deal cards restore pale compact styling, translated badges, score ordering, metadata and edit/trash icon controls',async()=>{
  const low={...newAgendaDraft('deal_activity','low','d'),title:'Low',type:'call',importance_score:1,urgency_score:1};
  const high={...newAgendaDraft('deal_activity','high','d'),title:'High',type:'emailType',status:'done',responsible:'Edu-USA',due_date:'2026-11-10',importance_score:5,urgency_score:4,comment:'Follow up'};
  const {panel,c,db}=await setup([low,high]);
  const tree=panel(); const cards=nodes(tree).filter(n=>n.props.role==='listitem');
  assert.equal(cards[0].props['data-agenda-key'],'deal_activity:high');
  assert.deepEqual(cards[0].props.style,{background:'#f5f7fa',border:'1px solid #cfd8e3',borderRadius:10,padding:'9px 10px'});
  assert.ok(!(cards[0].props.className || '').split(/\s+/).includes('agenda-context-item'),'compact old cards must not inherit Agenda context 40px button and block/margin span CSS');
  const html=renderToStaticMarkup(cards[0]);
  assert.match(html,/>Correo</); assert.match(html,/>Hecha</); assert.match(html,/📅 2026-11-10/); assert.match(html,/👤 Edu-USA/);
  assert.match(html,/Imp 5/); assert.match(html,/Urg 4/); assert.match(html,/Score 9/); assert.match(html,/Follow up/);
  assert.doesNotMatch(html,/emailType · done|<strong/);
  const edit=nodes(cards[0]).find(n=>n.props['data-edit-key']==='deal_activity:high');
  const del=nodes(cards[0]).find(n=>n.props['data-delete-key']==='deal_activity:high');
  assert.equal(edit.props.title,t.activityEdit); assert.equal(del.props.title,t.deleteBtn);
  assert.equal(edit.props.style.padding,2); assert.equal(del.props.style.color,'#ef4444');
  assert.match(renderToStaticMarkup(edit),/<svg/); assert.match(renderToStaticMarkup(del),/<svg/);
  assert.equal(nodes(cards[0]).find(n=>n.type==='select').props.style.width,120);
  assert.equal(c.getSnapshot().session,null); assert.equal(db.calls.length,0);
});

test('edited deal cards derive score and ordering from current priorities, not stale stored score (parent self-review)',async()=>{
  const base={...newAgendaDraft('deal_activity','a','d'),title:'Edited',importance_score:1,urgency_score:1,eisenhower_score:1};
  const other={...newAgendaDraft('deal_activity','b','d'),title:'Other',importance_score:4,urgency_score:4,eisenhower_score:8};
  const fallback={...newAgendaDraft('deal_activity','legacy','d'),title:'Legacy unknown priorities',importance_score:null,urgency_score:null,eisenhower_score:7};
  const unknown={...newAgendaDraft('deal_activity','unknown','d'),title:'No known score',importance_score:null,urgency_score:null};
  const {db,panel,form,field}=await setup([base,other,fallback,unknown]);
  nodes(panel()).find(n=>n.props['data-edit-key']==='deal_activity:a').props.onClick();
  field('Importancia').props.onChange({target:{value:'5'}});
  field('Urgencia').props.onChange({target:{value:'5'}});
  assert.equal(field('Score Eisenhower').props.value,10);
  assert.equal(await form().props.onSubmit({preventDefault(){}}),true);
  assert.deepEqual(db.tables.deal_activities,[{...base,importance_score:5,urgency_score:5},other,fallback,unknown],'legacy stored score is not rewritten');
  const cards=nodes(panel()).filter(n=>n.props.role==='listitem');
  assert.deepEqual(cards.map(n=>n.props['data-agenda-key']),['deal_activity:a','deal_activity:b','deal_activity:legacy','deal_activity:unknown']);
  assert.match(renderToStaticMarkup(cards[0]),/Score 10</);
  assert.match(renderToStaticMarkup(cards[2]),/Score 7</,'unknown priorities retain stored fallback');
  assert.doesNotMatch(renderToStaticMarkup(cards[3]),/Score /);
});

test('restored card edit runs shared save/error/cancel without coercing email aliases, native nulls or unknown values',async()=>{
  const base={...newAgendaDraft('deal_activity','legacy','d'),title:'  Native title  ',type:'email',status:'historic-state',responsible:'Unknown alias',due_date:null,comment:null,importance_score:null,urgency_score:9};
  const untouched={...newAgendaDraft('deal_activity','other','d'),title:'Untouched'};
  const {db,c,panel,form,field}=await setup([base,untouched]);
  const original=structuredClone(db.tables.deal_activities);
  nodes(panel()).find(n=>n.props['data-edit-key']==='deal_activity:legacy').props.onClick();
  assert.equal(field('Tipo').props.value,'email'); assert.equal(field('Estado').props.value,'historic-state');
  assert.equal(field('Responsable').props.value,'Unknown alias'); assert.equal(field('Importancia').props.value,''); assert.equal(field('Urgencia').props.value,'9');
  assert.match(renderToStaticMarkup(form()),/Destination/);
  assert.equal(db.calls.length,0);
  field('Comentario').props.onChange({target:{value:'Discard me'}});
  nodes(form()).find(n=>n.props['data-action']==='cancel-editor').props.onClick();
  assert.deepEqual(db.tables.deal_activities,original); assert.equal(db.calls.length,0);
  nodes(panel()).find(n=>n.props['data-edit-key']==='deal_activity:legacy').props.onClick();
  field('Comentario').props.onChange({target:{value:'Retained draft'}});
  db.fail({before:true});
  const submit=()=>form().props.onSubmit({preventDefault(){}});
  assert.equal(await submit(),false); assert.match(renderToStaticMarkup(panel()),/offline/);
  assert.equal(c.getSnapshot().draft.comment,'Retained draft'); assert.equal(c.getSnapshot().session,'deal_activity:legacy');
  assert.deepEqual(db.tables.deal_activities,original);
  assert.equal(await submit(),true); assert.equal(c.getSnapshot().session,null);
  assert.deepEqual(db.tables.deal_activities,[{...base,comment:'Retained draft'},untouched]);
  assert.match(renderToStaticMarkup(panel()),/Retained draft/);
});

test('compact status control saves through shared controller, keeps errors in its draft and delete opens exact confirmation',async()=>{
  const base={...newAgendaDraft('deal_activity','a','d'),title:'Status',type:'emailType',responsible:'Edu-USA',importance_score:null};
  const {db,c,panel,form}=await setup([base]);
  const select=nodes(panel()).find(n=>n.props['data-status-key']==='deal_activity:a');
  assert.ok(select,'compact controller-bound status select');
  db.fail({before:true});
  assert.equal(await select.props.onChange({target:{value:'done'}}),false);
  assert.equal(c.getSnapshot().draft.status,'done'); assert.equal(c.getSnapshot().draft.type,'emailType');
  assert.match(renderToStaticMarkup(panel()),/offline/);
  assert.equal(await form().props.onSubmit({preventDefault(){}}),true);
  assert.deepEqual(db.tables.deal_activities,[{...base,status:'done'}]);
  nodes(panel()).find(n=>n.props['data-delete-key']==='deal_activity:a').props.onClick();
  assert.equal(c.getSnapshot().mode,'delete'); assert.equal(c.getSnapshot().session,'deal_activity:a');
  const deletion=form(); assert.equal(deletion.props.role,'alertdialog');
  nodes(deletion).find(n=>n.props['data-action']==='cancel-editor').props.onClick();
  assert.deepEqual(db.tables.deal_activities,[{...base,status:'done'}]);
});

test('new deal form requires original scores before writes, creates once through shared save, and cancels back to idle',async()=>{
  const existing={...newAgendaDraft('deal_activity','existing','d'),title:'Original',type:'email',importance_score:null,urgency_score:null};
  const {c,db,panel,form,field}=await setup([existing]);
  const task={...newAgendaDraft('special_task','task'),title:'Task original',owner_id:'u'};
  db.tables.special_tasks.push(task);
  const originalTasks=structuredClone(db.tables.special_tasks);
  const submit=()=>form().props.onSubmit({preventDefault(){}});
  assert.equal(await submit(),false); assert.equal(db.calls.length,0); assert.equal(c.getSnapshot().session,null);
  field('Título').props.onChange({target:{value:'  Create through shared editor  '}});
  const id=c.getSnapshot().id;
  assert.equal(await submit(),false,'no create until both required original scores are selected');
  assert.equal(db.calls.length,0); assert.equal(c.getSnapshot().id,id);
  field('Importancia').props.onChange({target:{value:'4'}});
  assert.equal(await submit(),false); assert.equal(db.calls.length,0);
  field('Urgencia').props.onChange({target:{value:'5'}});
  assert.equal(field('Score Eisenhower').props.value,9);
  field('Tipo').props.onChange({target:{value:'emailType'}});
  field('Responsable').props.onChange({target:{value:'Edu'}});
  field('Comentario').props.onChange({target:{value:'Created locally'}});
  const pending=submit();
  assert.equal(nodes(form()).find(n=>n.props['data-action']==='save-editor').props.disabled,true);
  const duplicate=submit();
  assert.equal(await pending,true); assert.equal(await duplicate,false,'busy form ignores duplicate submission');
  assert.equal(db.calls.filter(call=>call.operation==='insert').length,1);
  assert.equal(c.getSnapshot().session,null);
  assert.deepEqual(db.tables.deal_activities,[existing,{id,title:'Create through shared editor',deal_id:'d',type:'emailType',responsible:'Edu',status:'pending',due_date:'2026-11-04',comment:'Created locally',importance_score:4,urgency_score:5}]);
  assert.deepEqual(db.tables.special_tasks,originalTasks);
  assert.match(renderToStaticMarkup(panel()),/Created locally/);
  const calls=db.calls.length;
  field('Título').props.onChange({target:{value:'Never persist'}});
  nodes(form()).find(n=>n.props['data-action']==='cancel-editor').props.onClick();
  assert.equal(db.calls.length,calls); assert.equal(c.getSnapshot().session,null); assert.equal(db.tables.deal_activities.length,2);
  assert.equal(field('Título').props.value,''); assert.equal(field('Importancia').props.value,'');
});

for(const action of ['change','submit','cancel']) {
  test(`same-ID deal reopen rejects stale ${action} callback`,async()=>{
    const base={...newAgendaDraft('deal_activity','a','d'),title:'A'};
    const {c,db,panel,form}=await setup([base]);
    const open=()=>nodes(panel()).find(n=>n.props['data-edit-key']==='deal_activity:a').props.onClick();
    open();
    const stale=form();
    const change=nodes(stale).find(n=>n.props['aria-label']==='Título').props.onChange;
    const cancel=nodes(stale).find(n=>n.props['data-action']==='cancel-editor').props.onClick;
    cancel();
    open();
    c.edit({comment:'New session intention'});
    const before=c.getSnapshot();
    if(action==='change')change({target:{value:'Stale mutation'}});
    if(action==='submit')assert.equal(await stale.props.onSubmit({preventDefault(){}}),false);
    if(action==='cancel')assert.equal(cancel(),false);
    assert.deepEqual(c.getSnapshot(),before);
    assert.equal(db.calls.length,0);
    assert.deepEqual(db.tables.deal_activities,[base]);
    // The current form still works after rejecting the stale callback.
    assert.equal(await form().props.onSubmit({preventDefault(){}}),true);
    assert.deepEqual(db.tables.deal_activities,[{...base,comment:'New session intention'}]);
  });
}

for(const action of ['change','submit','cancel']) {
  test(`old deal ${action} callback cannot target same-ID Agenda session`,async()=>{
    const base={...newAgendaDraft('deal_activity','a','d'),title:'A'};
    const {c,db,panel,form}=await setup([base]);
    nodes(panel()).find(n=>n.props['data-edit-key']==='deal_activity:a').props.onClick();
    const stale=form();
    const cancel=nodes(stale).find(n=>n.props['data-action']==='cancel-editor').props.onClick;
    cancel();
    c.open({source:'deal_activity',id:'a',base,context:'agenda'});
    c.edit({comment:'Agenda intention'});
    const before=c.getSnapshot();
    if(action==='change')nodes(stale).find(n=>n.props['aria-label']==='Título').props.onChange({target:{value:'Stale mutation'}});
    if(action==='submit')assert.equal(await stale.props.onSubmit({preventDefault(){}}),false);
    if(action==='cancel')assert.equal(cancel(),false);
    assert.deepEqual(c.getSnapshot(),before);
    assert.equal(db.calls.length,0);
    assert.deepEqual(db.tables.deal_activities,[base]);
    assert.equal(await c.save(),true);
    assert.deepEqual(db.tables.deal_activities,[{...base,comment:'Agenda intention'}]);
  });
}

for(const context of ['deal:d','agenda']) {
  test(`stale deal deletion confirmation cannot delete same-ID reopened in ${context}`,async()=>{
    const base={...newAgendaDraft('deal_activity','a','d'),title:'A'};
    const {c,db,panel,form}=await setup([base]);
    nodes(panel()).find(n=>n.props['data-delete-key']==='deal_activity:a').props.onClick();
    const stale=form();
    const cancel=nodes(stale).find(n=>n.props['data-action']==='cancel-editor').props.onClick;
    const confirm=nodes(stale).find(n=>n.props['data-action']==='confirm-delete').props.onClick;
    cancel();
    c.open({source:'deal_activity',id:'a',base,context,mode:'delete'});
    const before=c.getSnapshot();
    assert.equal(cancel(),false);
    assert.deepEqual(c.getSnapshot(),before);
    assert.equal(await confirm(),false);
    assert.deepEqual(c.getSnapshot(),before);
    assert.equal(db.calls.length,0);
    assert.deepEqual(db.tables.deal_activities,[base]);
    const currentConfirm=context==='deal:d'?nodes(form()).find(n=>n.props['data-action']==='confirm-delete').props.onClick:()=>c.remove();
    assert.equal(await currentConfirm(),true,'current deletion still works');
    assert.deepEqual(db.tables.deal_activities,[]);
  });
}

for(const captured of ['idle','blocked']) {
  test(`${captured} deal callbacks cannot lazily acquire after another session closes`,async()=>{
    const {c,db,form,field}=await setup();
    if(captured==='blocked')c.open({source:'deal_activity',id:'a',context:'agenda'});
    const staleChange=nodes(form()).find(n=>n.props['aria-label']==='Título').props.onChange;
    if(captured==='idle')c.open({source:'deal_activity',id:'a',context:'agenda'});
    c.cancel();
    const before=c.getSnapshot();
    staleChange({target:{value:'Must not acquire'}});
    assert.deepEqual(c.getSnapshot(),before);
    assert.equal(db.calls.length,0);
    const freshChange=field('Título').props.onChange;
    freshChange({target:{value:'Fresh draft'}});
    const token=c.getSnapshot().sessionToken;
    freshChange({target:{value:'Same draft'}});
    assert.equal(c.getSnapshot().sessionToken,token,'idle callback acquires exactly once');
    assert.equal(c.getSnapshot().draft.title,'Same draft');
    c.cancel();
    freshChange({target:{value:'Cannot reacquire'}});
    assert.equal(c.getSnapshot().session,null);
    assert.equal(db.calls.length,0);
  });
}

test('stale deal form callbacks cannot edit, save, cancel or replace a later shared session',async()=>{
  const a={...newAgendaDraft('deal_activity','a','d'),title:'A'};
  const b={...newAgendaDraft('deal_activity','b','d'),title:'B'};
  const {c,db,panel,form,field}=await setup([a,b]);
  nodes(panel()).find(n=>n.props['data-edit-key']==='deal_activity:a').props.onClick();
  const staleChange=field('Título').props.onChange;
  const staleForm=form(); const staleCancel=nodes(staleForm).find(n=>n.props['data-action']==='cancel-editor').props.onClick;
  staleCancel();
  nodes(panel()).find(n=>n.props['data-edit-key']==='deal_activity:b').props.onClick();
  const before=c.getSnapshot();
  staleChange({target:{value:'Must not target B'}});
  assert.deepEqual(c.getSnapshot(),before);
  assert.equal(await staleForm.props.onSubmit({preventDefault(){}}),false);
  staleCancel(); assert.deepEqual(c.getSnapshot(),before); assert.equal(db.calls.length,0);
  c.cancel();
  staleChange({target:{value:'Must not create draft'}});
  assert.equal(c.getSnapshot().session,null); assert.equal(db.calls.length,0);
});
