// Executes the real DlForm source with a small synchronous hook harness. Not browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { transformWithEsbuild } from 'vite';
import { dealFromRow,dealToRow } from '../src/lib/dealModel.js';
import { createDealSaveSession } from '../src/lib/dealSave.js';
import { database,id,product } from './helpers/dealDatabase.js';
const Inp=()=>null, Sel=()=>null, Txta=()=>null, Btn=()=>null, ProductInterestEditor=()=>null;
function nodes(el){const out=[];function walk(n){if(!React.isValidElement(n))return;out.push(n);React.Children.forEach(n.props.children,walk);}walk(el);return out;}
async function formHarness(props={}) {
  const source=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  const form=source.slice(source.indexOf('function DlForm('),source.indexOf('// ─── Import Modal'));
  const prefix=`import React from '${import.meta.resolve('react')}'; export function make(hooks,helpers){const {useState,useRef,useEffect}=hooks;const {Inp,Sel,Txta,Btn,ProductInterestEditor,uid,dealFromRow,dealToRow,createDealSaveSession,LEAD_SOURCES,setTimeout,clearTimeout}=helpers;`;
  const {code}=await transformWithEsbuild(prefix+form+';return DlForm;}', 'DlForm.jsx',{loader:'jsx',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'});
  const {make}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const slots=[];let cursor=0;const effects=[];
  const hooks={useState(init){const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(init){const i=cursor++;return slots[i]??=( {current:init} );},useEffect(effect){effects.push(effect);}};
  const t={dealName:'Name',value:'Value',stage:'Stage',company:'Company',contact:'Contact',notes:'Notes',save:'Save',cancel:'Cancel',ph:{}};
  const timers=[];let generated=0;
  const Form=make(hooks,{Inp,Sel,Txta,Btn,ProductInterestEditor,uid:()=>{generated++;return id;},dealFromRow,dealToRow,createDealSaveSession,LEAD_SOURCES:[],setTimeout:fn=>{timers.push(fn);return 1;},clearTimeout(){}});
  return {render(){cursor=0;return Form({init:{},cos:[],cts:[],stages:[{name:'Open'}],t,lang:'es',currency:'USD',onSave(){},onClose(){},...props});},nodes,slots,timers,get generated(){return generated;}};
}
const findSave=tree=>nodes(tree).find(n=>n.type===Btn && n.props.ch==='Save');
test('real create form prevents same-tick double click and disables edits while atomic save is pending',async()=>{
  const db=database();let release,calls=0;db.gate=new Promise(r=>{release=r;});
  const h=await formHarness({onSave:(f,session)=>{calls++;return session.save(db,dealToRow(f));}});
  let tree=h.render();nodes(tree).find(n=>n.type===Inp && n.props.label==='Name *').props.onChange({target:{value:'New'}});
  tree=h.render();const first=findSave(tree).props.onClick();findSave(tree).props.onClick();
  const pending=h.render();
  try {assert.equal(calls,1);assert.equal(h.generated,1);assert.equal(pending.type,'fieldset');assert.equal(pending.props.disabled,true);}
  finally {release();await first;}
  assert.equal(db.writes.length,1);assert.equal(db.row.id,id);
});
test('real form never claims saved for an empty or missing save result',async()=>{
  for (const result of [[],undefined,{ok:false,message:'No confirmado'}]) {
    const h=await formHarness({init:{name:'N'},onSave:async()=>result});
    await findSave(h.render()).props.onClick();
    const tree=h.render();assert.ok(nodes(tree).some(n=>n.props.role==='alert'));assert.equal(h.timers.length,0);
  }
});
test('real form keeps draft after network/validation/CAS errors and cancellation before save writes nothing',async()=>{
  let saves=0,closed=0;
  const initial={id,name:'Existing',productInterests:[product],productInterestsRevision:0};
  const h=await formHarness({init:initial,onSave:async()=>{saves++;return {ok:false,message:'Conflicto de red'};},onClose:()=>{closed++;}});
  let tree=h.render();nodes(tree).find(n=>n.type===ProductInterestEditor).props.onChange([{...product,line:'Orca S',quantity:'7'}]);
  tree=h.render();await findSave(tree).props.onClick();tree=h.render();
  assert.equal(nodes(tree).find(n=>n.type===ProductInterestEditor).props.value[0].quantity,'7');
  assert.equal(initial.productInterests[0].line,'Orca M');assert.equal(saves,1);
  assert.equal(nodes(tree).find(n=>n.props.role==='alert').props.children,'Conflicto de red');
  nodes(tree).find(n=>n.type===Btn && n.props.ch==='Cancel').props.onClick();assert.equal(closed,1);assert.equal(saves,1);
  const cancel=await formHarness({onSave:()=>{throw Error('must not save');},onClose:()=>{closed++;}});
  nodes(cancel.render()).find(n=>n.type===Btn && n.props.ch==='Cancel').props.onClick();assert.equal(closed,2);
});
