import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const path=new URL('../migrations/2026-10-29_deal_product_interests.sql',import.meta.url);

test('deal product migration adds validated JSONB and server-controlled CAS without rewriting old deals',()=>{
  assert.ok(existsSync(path),'Product-interest validation and CAS migration is not implemented');
  const sql=readFileSync(path,'utf8');
  assert.match(sql,/ADD COLUMN IF NOT EXISTS product_interests jsonb NOT NULL DEFAULT '\[\]'::jsonb/i);
  assert.match(sql,/ADD COLUMN IF NOT EXISTS product_interests_revision bigint NOT NULL DEFAULT 0/i);
  assert.match(sql,/is_valid_deal_product_interests/);
  assert.match(sql,/CHECK\s*\(public\.is_valid_deal_product_interests\(product_interests\)\)/i);
  assert.match(sql,/NEW\.product_interests IS DISTINCT FROM OLD\.product_interests/i);
  assert.match(sql,/OLD\.product_interests_revision \+ 1/i);
  assert.match(sql,/NEW\.product_interests_revision := OLD\.product_interests_revision/i);
  assert.doesNotMatch(sql,/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|UPDATE\s+public\.deals\s+SET/i);
  assert.doesNotMatch(sql,/CREATE\s+POLICY|ALTER\s+POLICY|DISABLE\s+ROW\s+LEVEL/i);
});

test('database product catalogue preserves generic sizes, exact negative range and two purchase frequencies',()=>{
  assert.ok(existsSync(path),'Product catalogue migration is not implemented');
  const sql=readFileSync(path,'utf8');
  for(const label of ['Orca M','Orca S','Orca pallet','Biotherm','Pharmatherm','-15 a -25','Dry Ice','one_time','monthly'])assert.ok(sql.includes("'"+label+"'"),label);
  assert.match(sql,/9007199254740991/);
  assert.match(sql,/trunc\(quantity_value\)/);
  assert.match(sql,/seen_ids/);
  assert.doesNotMatch(sql,/liters|litres|litros|weekly|quarterly|yearly/i);
});
