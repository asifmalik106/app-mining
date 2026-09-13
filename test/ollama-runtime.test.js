import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeAsset,installRuntime,ensureOllama,isLocalOllama} from '../src/ollama-runtime.js';

test('selects runtime archives and limits server management to loopback',()=>{
 assert.equal(runtimeAsset('linux','arm64').name,'ollama-linux-arm64.tar.zst');
 assert.equal(runtimeAsset('win32','x64').binary,'ollama.exe');
 assert.equal(runtimeAsset('darwin','arm64').name,'ollama-darwin.tgz');
 assert.throws(()=>runtimeAsset('linux','ia32'),/does not support/);
 assert.equal(isLocalOllama({provider:'ollama',baseUrl:'http://127.0.0.1:11434'}),true);
 assert.equal(isLocalOllama({provider:'ollama',baseUrl:'http://example.com:11434'}),false);
});
test('fresh installation verifies and extracts an archive, then reuses it',{skip:process.platform!=='linux'},async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ollama-install-test-'));
 const originalFetch=globalThis.fetch,originalPath=process.env.PATH;
 t.after(async()=>{globalThis.fetch=originalFetch;process.env.PATH=originalPath;await fs.rm(root,{recursive:true,force:true});});
 process.env.PATH='/nonexistent';
 const archive=Buffer.from(await fs.readFile(new URL('./fixtures/ollama-test.tar.zst.base64',import.meta.url),'utf8'),'base64');
 const hash=createHash('sha256').update(archive).digest('hex');let downloads=0;
 globalThis.fetch=async url=>{
  if(url.endsWith('sha256sum.txt'))return new Response(`${hash}  ./${runtimeAsset().name}\n`);
  downloads++;return new Response(archive);
 };
 const installed=await installRuntime({root,log:()=>{}});
 assert.match(await fs.readFile(installed.binary,'utf8'),/ollama version/);
 assert.equal((await installRuntime({root,log:()=>{}})).binary,installed.binary);
 assert.equal(downloads,1);
 const corruptRoot=path.join(root,'corrupt');
 globalThis.fetch=async url=>url.endsWith('sha256sum.txt')?new Response(`${'0'.repeat(64)}  ./${runtimeAsset().name}`):new Response(archive);
 await assert.rejects(installRuntime({root:corruptRoot,log:()=>{}}),/checksum mismatch/);
 assert.deepEqual(await fs.readdir(path.join(corruptRoot,'data/downloads')),[]);
});
test('remote connection failures never trigger local installation',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async()=>{throw new Error('connection refused',{cause:{code:'ECONNREFUSED'}});};
 await assert.rejects(ensureOllama({provider:'ollama',model:'x',baseUrl:'http://remote.invalid:11434'}),/configured server/);
});
