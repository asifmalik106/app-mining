import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { checkProvider } from './providers.js';

export const runtimeVersion='0.34.0';
export function runtimeAsset(platform=process.platform,arch=process.arch) {
  const cpu={x64:'amd64',arm64:'arm64'}[arch];
  if(!cpu)throw new Error(`Automatic Ollama installation does not support ${platform}/${arch}.`);
  if(platform==='linux')return {name:`ollama-linux-${cpu}.tar.zst`,binary:'bin/ollama'};
  if(platform==='darwin')return {name:'ollama-darwin.tgz',binary:'ollama'};
  if(platform==='win32')return {name:`ollama-windows-${cpu}.zip`,binary:'ollama.exe'};
  throw new Error(`Automatic Ollama installation does not support ${platform}/${arch}.`);
}
export function isLocalOllama(settings) {
  try {const url=new URL(settings.baseUrl);return settings.provider==='ollama'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&url.pathname==='/';}
  catch{return false;}
}
function runnable(binary) {
  const result=spawnSync(binary,['--version'],{encoding:'utf8',timeout:15000,windowsHide:true});
  return !result.error&&result.status===0;
}
async function unpack(archive,directory,asset) {
  if(asset.name.endsWith('.zip')) {
    await new Promise((resolve,reject)=>{
      const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',
        'Expand-Archive -LiteralPath $env:MINER_ARCHIVE -DestinationPath $env:MINER_DEST -Force'],
        {env:{...process.env,MINER_ARCHIVE:archive,MINER_DEST:directory},stdio:'inherit',windowsHide:true});
      child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Archive extraction exited ${code}`)));
    });
  } else {
    const tar=await import('tar');
    if(asset.name.endsWith('.zst')) {
      const {Decompress}=await import('fzstd');
      const decoder=new Transform({transform(chunk,encoding,callback){try{zstd.push(chunk);callback();}catch(e){callback(e);}},flush(callback){try{zstd.push(new Uint8Array(),true);callback();}catch(e){callback(e);}}});
      const zstd=new Decompress(chunk=>decoder.push(Buffer.from(chunk)));
      await pipeline(fs.createReadStream(archive),decoder,tar.x({cwd:directory,strict:true}));
    } else await tar.x({file:archive,cwd:directory,strict:true});
  }
}

export async function installRuntime({log=console.log,root=process.cwd()}={}) {
  const asset=runtimeAsset();
  const downloads=path.join(root,'data/downloads');
  const target=path.join(downloads,`ollama-${runtimeVersion}-${process.platform}-${process.arch}`);
  const binary=path.join(target,asset.binary);
  // Reuse a working project installation or a system installation first.
  const legacy=path.join(downloads,'ollama/bin/ollama');
  for(const candidate of [binary,legacy])if(fs.existsSync(candidate)&&runnable(candidate))return {binary:candidate,local:true};
  if(runnable('ollama'))return {binary:'ollama',local:false};
  await fsp.mkdir(downloads,{recursive:true});
  const staging=await fsp.mkdtemp(path.join(downloads,'.ollama-install-'));
  try {
    const base=`https://github.com/ollama/ollama/releases/download/v${runtimeVersion}`;
    log(`Installing Ollama ${runtimeVersion} for ${process.platform}/${process.arch}…`);
    const sums=await fetch(`${base}/sha256sum.txt`,{signal:AbortSignal.timeout(30000)});
    if(!sums.ok)throw new Error(`Checksum download HTTP ${sums.status}`);
    const expected=(await sums.text()).split('\n').map(line=>line.trim().split(/\s+/)).find(parts=>parts[1]?.replace(/^\*/, '').replace(/^\.\//,'')===asset.name)?.[0];
    if(!expected||!/^[a-f0-9]{64}$/i.test(expected))throw new Error(`No SHA-256 checksum published for ${asset.name}`);
    const response=await fetch(`${base}/${asset.name}`,{signal:AbortSignal.timeout(2*60*60*1000)});
    if(!response.ok)throw new Error(`Runtime download HTTP ${response.status}`);
    const total=Number(response.headers.get('content-length')),hash=createHash('sha256');let received=0,last=Date.now();
    const meter=new Transform({transform(chunk,encoding,callback){received+=chunk.length;hash.update(chunk);if(Date.now()-last>10000){log(`Ollama download: ${Math.round(received/1024/1024)} MB${total?` / ${Math.round(total/1024/1024)} MB`:''}`);last=Date.now();}callback(null,chunk);}});
    const archive=path.join(staging,asset.name),extracted=path.join(staging,'runtime');
    await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(archive));
    if(hash.digest('hex')!==expected.toLowerCase())throw new Error('Ollama archive checksum mismatch');
    await fsp.mkdir(extracted);
    log('Verified Ollama download; extracting runtime…');
    await unpack(archive,extracted,asset);
    const executable=path.join(extracted,asset.binary);
    if(process.platform!=='win32')await fsp.chmod(executable,0o755);
    if(!runnable(executable))throw new Error('Downloaded Ollama cannot execute on this machine. Check OS compatibility in logs.');
    try {await fsp.rename(extracted,target);}catch(error){if(!runnable(binary))throw error;}
    log('Ollama installed.');
    return {binary,local:true};
  } finally {await fsp.rm(staging,{recursive:true,force:true});}
}

export async function ensureOllama(settings,{log=console.log,root=process.cwd()}={}) {
  const initial=await checkProvider(settings);
  if(initial.ok||initial.code==='MODEL_MISSING')return;
  if(!isLocalOllama(settings)||initial.code!=='ECONNREFUSED')throw new Error(`Cannot reach Ollama at ${settings.baseUrl}: ${initial.reason}. Check the configured server and network access.`);
  const runtime=await installRuntime({log,root});
  // A concurrent invocation may have started the server during installation.
  const again=await checkProvider(settings);
  if(again.ok||again.code==='MODEL_MISSING')return;
  const url=new URL(settings.baseUrl);
  await fsp.mkdir(path.join(root,'logs'),{recursive:true});
  const logfile=path.join(root,'logs/ollama.log');
  const fd=fs.openSync(logfile,'a');
  let child,startError;
  try {
    child=spawn(runtime.binary,['serve'],{detached:true,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,
      OLLAMA_HOST:url.host,
      ...(runtime.local&&!process.env.OLLAMA_MODELS?{OLLAMA_MODELS:path.join(root,'data/downloads/ollama/models')}:{})}});
    child.on('error',error=>{startError=error;});child.unref();
  } finally {fs.closeSync(fd);}
  log('Starting Ollama…');
  for(let attempt=0;attempt<60;attempt++) {
    if(startError)throw new Error(`Cannot start Ollama: ${startError.message}`);
    const ready=await checkProvider(settings);
    if(ready.ok||ready.code==='MODEL_MISSING'){log('Ollama ready.');return {pid:child.pid};}
    if(child.exitCode!==null||child.signalCode!==null)break;
    await delay(1000);
  }
  throw new Error(`Ollama did not become ready. Inspect ${logfile}.`);
}
