import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
const root=new URL('../src/',import.meta.url);
async function load(relative) {
  let source=await readFile(new URL(relative,root),'utf8');
  source=source.replace(/from ['"]react['"]/g,`from '${import.meta.resolve('react')}'`).replace(/from ['"]([^'"]+\.js)['"]/g,(_,p)=>`from '${new URL(p,new URL(relative,root)).href}'`);
  // Tests load the real summary once, then inject its data-URL for the real card.
  if(source.includes('./ProductInterestSummary.jsx'))source=source.replace('"./ProductInterestSummary.jsx"',JSON.stringify(await moduleURL('components/deals/ProductInterestSummary.jsx')));
  const {code}=await transformWithEsbuild(source,relative,{loader:'jsx',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'});
  return `data:text/javascript;base64,${Buffer.from("import React from '"+import.meta.resolve('react')+"';\n"+code).toString('base64')}`;
}
const moduleURL=load;
const nodes=tree=>{const result=[];function visit(el){if(!React.isValidElement(el))return;result.push(el);React.Children.forEach(el.props.children,visit);}visit(tree);return result;};
const p={id:'00000000-0000-4000-8000-000000000012',line:'Orca M',size:'4',temperature:'-15 a -25',quantity:2,periodicity:'monthly'};
test('real Kanban scopes cards by ID and integrates compact product summary',async()=>{
  const {default:Kanban}=await import(await load('components/deals/Kanban.jsx'));
  const deals=[{id:'card1',name:'Deal',stage:'Open',value:0,productInterests:[p,{...p,id:'2'},{...p,id:'3'}]}];
  const html=renderToStaticMarkup(React.createElement(Kanban,{deals,cos:[],cts:[],t:{pipelineTotal:'Pipeline',closedWon:'Won',totalDeals:'Total'},currency:'USD',stages:[{id:'s',name:'Open'}],helpers:{fv:String,calcTotal:()=>0,Ic:()=>null}}));
  assert.match(html,/data-deal-id="card1"/);assert.match(html,/Productos de interés/);assert.match(html,/\+1/);
});
test('create/edit form mounts controlled draft editor and stable session; existing save is no upsert',async()=>{
  const source=await readFile(new URL('App.jsx',root),'utf8');
  const form=source.slice(source.indexOf('function DlForm('),source.indexOf('// ─── Import Modal'));
  assert.match(form,/<ProductInterestEditor/);assert.match(form,/structuredClone/);assert.match(form,/createDealSaveSession/);assert.match(form,/submitGuard\.current/);
  assert.match(form,/role=\{submitState/);
  const save=source.slice(source.indexOf('const saveDl='),source.indexOf('const chStage='));
  assert.match(save,/session\.save/);assert.doesNotMatch(save,/\.upsert\(/);
});
test('controlled editor accessible optional fields, add/remove/edit retain isolated drafts',async()=>{
  const {default:Editor}=await import(await load('components/deals/ProductInterestEditor.jsx'));
  const original=[p];let draft=original;
  const tree=Editor({value:original,onChange:v=>{draft=v;},lang:'es'}),all=nodes(tree);
  const html=renderToStaticMarkup(tree);
  assert.match(html,/Productos de interés/);assert.match(html,/Por definir/);assert.match(html,/type="number"/);assert.match(html,/step="1"/);
  assert.match(html,/value="one_time"/);assert.match(html,/value="monthly"/);assert.doesNotMatch(html,/weekly| litros| L<| m³/);
  assert.equal((html.match(/required=""/g)||[]).length,1);
  assert.match(html,/-15 a -25 °C/);
  all.find(n=>n.type==='select' && n.props['aria-label']==='Línea 1').props.onChange({target:{value:'Biotherm'}});
  assert.equal(draft[0].size,null);assert.equal(draft[0].temperature,null);assert.equal(original[0].size,'4');
  all.find(n=>n.type==='button' && n.props['aria-label']==='Eliminar producto 1').props.onClick();assert.deepEqual(draft,[]);
  all.find(n=>n.type==='button' && n.props['aria-label']==='Agregar producto').props.onClick();assert.equal(draft.length,2);assert.notEqual(draft[1].id,p.id);assert.equal(draft[1].line,'');
});
test('compact summary at most two rows plus N; empty list renders nothing; English supported',async()=>{
  const {default:Summary}=await import(await load('components/deals/ProductInterestSummary.jsx'));
  assert.equal(renderToStaticMarkup(React.createElement(Summary,{value:[]})),'');
  const html=renderToStaticMarkup(React.createElement(Summary,{value:[p,{...p,id:'2'},{...p,id:'3'}],compact:true}));
  assert.equal((html.match(/data-product-summary-row/g)||[]).length,2);assert.match(html,/\+1/);assert.match(html,/-15 a -25 °C/);
  const full=renderToStaticMarkup(React.createElement(Summary,{value:[{...p,periodicity:'one_time'}],lang:'en'}));assert.match(full,/One time/);
});
