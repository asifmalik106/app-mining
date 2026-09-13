import test from 'node:test';
import assert from 'node:assert/strict';
import { args, dependencyError } from '../src/lib.js';
import { parseModelJson, ProviderError } from '../src/providers.js';
import { normalizeCritic } from '../src/research.js';
test('parses safe command arguments',()=>assert.deepEqual(args(['phase2','--limit','10','--dry-run']),{_:['phase2'],limit:'10','dry-run':true}));
test('dependency explanation names prerequisite',()=>assert.match(dependencyError('phase3'),/Phase 2 — Review Intelligence/));
test('phase ordering protects later work',()=>assert.match(dependencyError('phase6'),/Phase 5/));
test('parses JSON from thinking-model text and fences',()=>{
  assert.deepEqual(parseModelJson('{"ok":true}'),{ok:true});
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'),{ok:true});
});
test('empty model output has an actionable error',()=>assert.throws(()=>parseModelJson(''),/no JSON text/));
test('critic output is bounded and invalid enums become explicit unknowns',()=>{
  const x=normalizeCritic({verdict:'MAYBE',confidence:7,platform_native_risk:'perhaps'});
  assert.equal(x.verdict,'NEEDS_MORE_EVIDENCE');
  assert.equal(x.confidence,1);
  assert.equal(x.platform_native_risk,'unknown');
});
