import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';

export const root = process.cwd();
export const p = (...parts) => path.join(root, ...parts);
export const phases = [
  ['phase1', 'Marketplace Collection'], ['phase2', 'Review Intelligence'], ['phase3', 'Problem Clustering'],
  ['phase4', 'Opportunity Analysis'], ['phase5', 'Business Critic'], ['phase6', 'Final Opportunity Report']
];
export async function ensureDirs() { for (const d of ['data/phase1','data/phase2/primary','data/phase2/verification','data/phase2/adjudication','data/phase2/final','data/runs','state','logs','docs']) await fsp.mkdir(p(d), {recursive:true}); }
export function exists(file) { return fs.existsSync(p(file)); }
export async function readJson(file, fallback) { try { return JSON.parse(await fsp.readFile(p(file), 'utf8')); } catch { return fallback; } }
export async function writeJson(file, value) { await ensureDirs(); const tmp=p(`${file}.tmp`); await fsp.mkdir(path.dirname(tmp),{recursive:true}); await fsp.writeFile(tmp, JSON.stringify(value,null,2)+'\n'); await fsp.rename(tmp,p(file)); }
export async function appendJsonl(file, value) { await ensureDirs(); await fsp.mkdir(path.dirname(p(file)),{recursive:true}); await fsp.appendFile(p(file), JSON.stringify(value)+'\n'); }
export async function writeJsonl(file, values) { await ensureDirs(); const target=p(file),tmp=`${target}.tmp`; await fsp.mkdir(path.dirname(target),{recursive:true}); await fsp.writeFile(tmp,values.map(x=>JSON.stringify(x)).join('\n')+(values.length?'\n':'')); await fsp.rename(tmp,target); }
export async function jsonl(file) { const out=[]; if (!exists(file)) return out; const rl=readline.createInterface({input:fs.createReadStream(p(file)),crlfDelay:Infinity}); for await(const line of rl) { if (!line.trim()) continue; try {out.push(JSON.parse(line));} catch { throw new Error(`Invalid JSONL: ${file}`); } } return out; }
export async function countJsonl(file) { if (!exists(file)) return 0; let n=0; const rl=readline.createInterface({input:fs.createReadStream(p(file)),crlfDelay:Infinity}); for await(const l of rl) if(l.trim()) n++; return n; }
export function loadEnv() { if (!exists('.env')) return; for (const line of fs.readFileSync(p('.env'),'utf8').split(/\r?\n/)) { const m=line.match(/^\s*([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,''); } }
export async function config() { loadEnv(); const models=await readJson('config/models.json',{}), pipe=await readJson('config/pipeline.json',{}); for(const [k,key] of [['primary','PRIMARY'],['verifier','VERIFIER'],['adjudicator','ADJUDICATOR'],['embedding','EMBEDDING']]) { models[k]={...models[k]}; for(const [field,suffix] of [['provider','PROVIDER'],['model','MODEL'],['baseUrl','BASE_URL']]) if(process.env[`${key}_${suffix}`]) models[k][field]=process.env[`${key}_${suffix}`]; } return {models, pipe:{...pipe,timeoutMs:Number(process.env.AI_TIMEOUT_SECONDS||pipe.timeoutMs/1000)*1000}}; }
export function args(argv=process.argv.slice(2)) { const out={_:[]}; for(let i=0;i<argv.length;i++) { let x=argv[i]; if(!x.startsWith('--')) out._.push(x); else { const [k,v]=x.slice(2).split('='); const next=argv[i+1]; out[k]=v??(next!==undefined&&!next.startsWith('--')?argv[++i]:true); } } return out; }
export function icon(s) { return s==='complete'?'✅':s==='in_progress'?'🟡':s==='blocked'?'🔒':s==='failed'?'❌':'⏳'; }
export async function state() { return readJson('state/project-state.json',{schema_version:1, phases:{}}); }
export async function setState(phase, status, extra={}) { const s=await state(); s.phases[phase]={...(s.phases[phase]||{}),status,updated_at:new Date().toISOString(),...extra}; await writeJson('state/project-state.json',s); }
export async function stageRecords(stage, run='production') { return jsonl(`data/${run==='production'?'phase2':`runs/${run}/phase2`}/${stage==='final'?'final/reviews':stage}.jsonl`); }
export function phase2Base(run) { return run==='production'?'data/phase2':`data/runs/${run}/phase2`; }
export function phaseBase(phase, run) { return run==='production'?`data/phase${phase}`:`data/runs/${run}/phase${phase}`; }
export function runId(a) { return a['run-id'] || (a.limit ? `test-${a.limit}` : 'production'); }
export function dependencyError(phase) { const n=Number(phase.slice(5)); const prev=`phase${n-1}`; return `❌ Cannot start Phase ${n}.\n\nRequired dependency:\nPhase ${n-1} — ${phases[n-2][1]}\n\nRecommended command:\nnpm run phase${n-1}`; }
export async function assertDependency(phase) { const s=await state(), n=Number(phase.slice(5)); if(n>1 && s.phases[`phase${n-1}`]?.status!=='complete') throw new Error(dependencyError(phase)); }
export async function csvRecords(file, onRecord) { const stream=fs.createReadStream(p(file),{encoding:'utf8'}); let field='',row=[],quoted=false,first=true,headers; for await(const chunk of stream) for(let i=0;i<chunk.length;i++){ const c=chunk[i]; if(first && c==='﻿') {first=false;continue;} first=false; if(quoted){if(c==='"'){if(chunk[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c; continue;} if(c==='"'&&field===''){quoted=true;continue;} if(c===','){row.push(field);field='';continue;} if(c==='\n'){row.push(field);field=''; if(!headers) headers=row; else {const o=Object.fromEntries(headers.map((h,j)=>[h,row[j]??''])); await onRecord(o);} row=[];continue;} if(c!=='\r')field+=c; } if(field||row.length){row.push(field); if(headers) await onRecord(Object.fromEntries(headers.map((h,j)=>[h,row[j]??''])));}}
export function shell(cmd,args) { return spawnSync(cmd,args,{encoding:'utf8'}); }
