import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { normalizeProducts, PRODUCT_CATALOGUE } from '../src/lib/dealProducts.js';
const id='00000000-0000-4000-8000-000000000033';
test('rental is an independent optional purchase mode on every product line',()=>{
  for(const line of Object.keys(PRODUCT_CATALOGUE)){
    const row=normalizeProducts([{id,line,periodicity:'rental'}])[0];
    assert.deepEqual(row,{id,line,size:null,temperature:null,quantity:null,periodicity:'rental'});
    assert.equal(normalizeProducts([{id,line,quantity:'40',periodicity:'rental'}])[0].quantity,40);
    for(const periodicity of [null,'one_time','monthly'])assert.equal(normalizeProducts([{id,line,periodicity}])[0].periodicity,periodicity);
    for(const periodicity of ['weekly','rent','Renta'])assert.throws(()=>normalizeProducts([{id,line,periodicity}]));
  }
});
async function component(name){
  const url=new URL(`../src/components/deals/${name}.jsx`,import.meta.url);
  const source=(await readFile(url,'utf8')).replace(/from ['"]([^'"]+\.js)['"]/g,(_,p)=>`from '${new URL(p,url).href}'`);
  const {code}=await transformWithEsbuild(source,name+'.jsx',{loader:'jsx',jsxFactory:'React.createElement'});
  return (await import('data:text/javascript;base64,'+Buffer.from(`import React from '${import.meta.resolve('react')}';\n`+code).toString('base64'))).default;
}
test('rental selection is controlled and appears in Spanish and English card summaries',async()=>{
  const Editor=await component('ProductInterestEditor'),Summary=await component('ProductInterestSummary');
  for(const lang of ['es','en']){
    let draft=[{id,line:'Orca M',periodicity:null}];
    const tree=Editor({value:draft,lang,onChange:v=>{draft=v;}}),elements=[];
    function visit(e){if(!React.isValidElement(e))return;elements.push(e);React.Children.forEach(e.props.children,visit);}visit(tree);
    const select=elements.find(e=>e.type==='select'&&e.props['aria-label']===(lang==='es'?'Periodicidad 1':'Frequency 1'));
    assert.match(renderToStaticMarkup(tree),new RegExp('value="rental">'+(lang==='es'?'Renta':'Rental')));
    select.props.onChange({target:{value:'rental'}});
    const normalized=normalizeProducts(draft);assert.equal(normalized[0].periodicity,'rental');
    const html=renderToStaticMarkup(React.createElement(Summary,{value:normalized,compact:true,lang}));
    assert.match(html,lang==='es'?/Renta/:/Rental/);assert.doesNotMatch(html,/Mensual|Monthly|Una vez|One time/);
  }
});
test('rental migration expands only the validator and canonical schema matches',async()=>{
  const old=await readFile(new URL('../migrations/2026-10-29_deal_product_interests.sql',import.meta.url),'utf8');
  const migration=await readFile(new URL('../migrations/2026-10-29_deal_product_rental.sql',import.meta.url),'utf8');
  const schema=await readFile(new URL('../supabase_schema.sql',import.meta.url),'utf8');
  const fn=s=>s.slice(s.indexOf('CREATE OR REPLACE FUNCTION public.is_valid_deal_product_interests'),s.indexOf('$$;',s.indexOf('CREATE OR REPLACE FUNCTION public.is_valid_deal_product_interests'))+3);
  assert.equal(fn(migration),fn(old).replace("ARRAY['one_time','monthly']","ARRAY['one_time','monthly','rental']"));
  assert.equal(fn(schema),fn(migration));
  assert.doesNotMatch(migration,/\b(ALTER TABLE|GRANT|REVOKE|INSERT INTO|UPDATE|DELETE FROM|DROP)\b/i);
});
