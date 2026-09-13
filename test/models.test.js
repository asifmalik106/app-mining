import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureModels} from '../src/models.js';
const model={provider:'ollama',model:'test:latest',baseUrl:'http://localhost:11434'};
test('model setup skips installed models, streams missing ones, and reports failures',async t=>{
 const original=globalThis.fetch;
 t.after(()=>{globalThis.fetch=original;});
 let installed=false,pulls=0,tags=0;
 globalThis.fetch=async (url,options)=>{
  if(url.endsWith('/api/tags')){tags++;return Response.json({models:installed?[{name:model.model}]:[]});}
  assert.equal(JSON.parse(options.body).model,model.model);
  pulls++;installed=true;
  return new Response('{"status":"pulling","completed":1,"total":2}\n{"status":"success"}\n');
 };
 await ensureModels({primary:model,duplicate:model},{log:()=>{}});
 assert.equal(pulls,1);assert.equal(tags,2);
 await ensureModels({primary:model},{log:()=>{}});
 assert.equal(pulls,1);
 installed=false;
 globalThis.fetch=async url=>url.endsWith('/api/tags')?Response.json({models:[]}):new Response('{"error":"disk full"}\n');
 await assert.rejects(ensureModels({primary:model},{log:()=>{}}),/disk full/);
 globalThis.fetch=async ()=>{throw new Error('connection refused');};
 await assert.rejects(ensureModels({primary:model},{log:()=>{}}),/ollama serve/);
 globalThis.fetch=async url=>url.endsWith('/api/tags')?Response.json({models:[]}):new Response('{"status":"pulling"}\n');
 await assert.rejects(ensureModels({primary:model},{log:()=>{}}),/before success/);
});

test('setup downloads every distinct configured model and verifies each one',async t=>{
 const original=globalThis.fetch;
 t.after(()=>{globalThis.fetch=original;});
 const installed=new Set(),pulled=[];
 globalThis.fetch=async (url,options)=>{
  if(url.endsWith('/api/tags'))return Response.json({models:[...installed].map(name=>({name}))});
  const {model:name}=JSON.parse(options.body);
  pulled.push(name);installed.add(name);
  return new Response('{"status":"success"}');
 };
 const models=Object.fromEntries(['primary','verifier','adjudicator','embedding'].map(role=>[role,{...model,model:role}]));
 await ensureModels(models,{log:()=>{}});
 assert.deepEqual(pulled,['primary','verifier','adjudicator','embedding']);
});
