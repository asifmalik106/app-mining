import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { jsonl, countJsonl } from '../src/lib.js';

test('JSONL preserves Unicode separators and records spanning stream chunks', async t => {
  const dir=await fs.mkdtemp('.jsonl-test-');
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const file=`${dir}/records.jsonl`;
  const records=[{text:'first\u2028second\u2029third'}, {text:'é'.repeat(70000)}, {last:true}];
  await fs.writeFile(file,records.map(JSON.stringify).join('\r\n\n'));
  assert.deepEqual(await jsonl(file),records);
  assert.equal(await countJsonl(file),records.length);
  await fs.writeFile(file,'{}\n\n{"broken":\n');
  await assert.rejects(jsonl(file),/at line 3/);
  assert.deepEqual(await jsonl(`${dir}/missing.jsonl`),[]);
  assert.equal(await countJsonl(`${dir}/missing.jsonl`),0);
});
