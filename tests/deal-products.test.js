import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_CATALOGUE, normalizeProducts, changeProductLine } from '../src/lib/dealProducts.js';
const id = '00000000-0000-4000-8000-000000000001';
test('fixed catalogue and line-only optional normalization', () => {
  assert.deepEqual(Object.keys(PRODUCT_CATALOGUE), ['Orca M','Orca S','Orca pallet','Biotherm','Pharmatherm']);
  assert.deepEqual(normalizeProducts([{id,line:'Orca M'}]), [{id,line:'Orca M',size:null,temperature:null,quantity:null,periodicity:null}]);
  assert.deepEqual(normalizeProducts([]), []);
 });
test('every catalogue combination, repeated variants and independent optional fields', () => {
  const expected = [['4','11','23','50'],['4','11','23','50'],['100','255','345'],['7','10','15','30','45','80'],['7','10','15','30','45','80']];
  Object.entries(PRODUCT_CATALOGUE).forEach(([line,c], i) => {
    assert.deepEqual(c.sizes, expected[i]);
    assert.deepEqual(c.temperatures, i < 3 ? ['2 a 8','15 a 25','-15 a -25','Dry Ice'] : ['2 a 8','15 a 25','Dry Ice']);
    for (const size of c.sizes) for (const temperature of c.temperatures) {
      assert.equal(normalizeProducts([{id,line,size,temperature,quantity:1,periodicity:'one_time'}])[0].size,size);
    }
    for (const field of [{size:c.sizes[0]},{temperature:c.temperatures[0]},{quantity:'12'},{periodicity:'monthly'}]) assert.equal(normalizeProducts([{id,line,...field}]).length,1);
  });
  assert.equal(normalizeProducts([{id,line:'Orca M'},{id:'00000000-0000-4000-8000-000000000002',line:'Orca M'}]).length,2);
  assert.equal(normalizeProducts([{id,line:'Orca M',quantity:'12'}])[0].quantity,12);
});
test('rejects invalid fields, combinations, UUIDs and unsafe quantities without dropping rows', () => {
  for (const bad of [null,{},'bad']) assert.throws(()=>normalizeProducts(bad));
  for (const row of [{line:''},{line:'orca M'},{size:'7'},{size:4},{temperature:'-25 a -15'},{line:'Biotherm',temperature:'-15 a -25'},{periodicity:'weekly'},{id:'bad'},{extra:true}]) assert.throws(()=>normalizeProducts([{id,line:'Orca M',...row}]));
  for (const quantity of [0,-1,1.5,'1.5','0','abc','1e3',Infinity,NaN,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>normalizeProducts([{id,line:'Orca M',quantity}]));
  assert.equal(normalizeProducts([{id,line:'Orca M',quantity:Number.MAX_SAFE_INTEGER}])[0].quantity,Number.MAX_SAFE_INTEGER);
  assert.equal(normalizeProducts([{id,line:'Orca M',quantity:''}])[0].quantity,null);
  assert.throws(()=>normalizeProducts([{id,line:'Orca M'},{id,line:'Orca S'}]));
});
test('line changes clear only incompatible specifications and never mutate draft', () => {
  const row={id,line:'Orca M',size:'4',temperature:'-15 a -25',quantity:'2',periodicity:'monthly'};
  assert.deepEqual(changeProductLine(row,'Biotherm'), {...row,line:'Biotherm',size:null,temperature:null});
  assert.deepEqual(changeProductLine(row,'Orca S'), {...row,line:'Orca S'});
  assert.equal(row.line,'Orca M');
  assert.throws(()=>normalizeProducts([{id:'abcdef00-0000-4000-8000-000000000001',line:'Orca M'},{id:'ABCDEF00-0000-4000-8000-000000000001',line:'Orca S'}]));
});
