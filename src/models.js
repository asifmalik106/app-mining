import { ensureOllama } from './ollama-runtime.js';
import { checkProvider } from './providers.js';

// Pull through the configured server, so models stay in its persistent cache.
export async function ensureModels(models, {log=console.log}={}) {
  const seen=new Set();
  for (const [role,settings] of Object.entries(models)) {
    const key=JSON.stringify([settings.provider,settings.baseUrl,settings.model]);
    if (seen.has(key)) continue;
    seen.add(key);
    let ready=await checkProvider(settings);
    if(settings.provider==='ollama'&&ready.code==='ECONNREFUSED') {await ensureOllama(settings,{log});ready=await checkProvider(settings);}
    if (ready.ok) { log(`${role}: ${settings.model} ready`); continue; }
    if (settings.provider!=='ollama') throw new Error(`${role}: ${ready.reason}. Configure and start the model server.`);
    // Only a confirmed missing model should trigger a download.
    if (ready.code!=='MODEL_MISSING') throw new Error(`${role}: ${ready.reason}. Start Ollama with "ollama serve" (install: https://ollama.com/download), or correct the model BASE_URL in .env.`);
    log(`${role}: downloading ${settings.model}…`);
    try {
      const response=await fetch(`${settings.baseUrl.replace(/\/$/,'')}/api/pull`,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({model:settings.model,stream:true}),
        signal:AbortSignal.timeout(2*60*60*1000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0,200)}`);
      let pending='',success=false,lastProgress='';
      const decoder=new TextDecoder();
      function report(line) {
        if (!line.trim()) return;
        const event=JSON.parse(line);
        if (event.error) throw new Error(event.error);
        if (event.status==='success') success=true;
        const progress=event.total?`${event.status} ${Math.floor(100*(event.completed||0)/event.total/10)*10}%`:event.status;
        if (progress && progress!==lastProgress) {log(`${settings.model}: ${progress}`);lastProgress=progress;}
      }
      for await (const chunk of response.body) {
        pending+=decoder.decode(chunk,{stream:true});
        let end;
        while ((end=pending.indexOf('\n'))!==-1) {report(pending.slice(0,end));pending=pending.slice(end+1);}
      }
      report(pending+decoder.decode());
      if (!success) throw new Error('Download ended before success; rerun to resume.');
      const installed=await checkProvider(settings);
      if (!installed.ok) throw new Error(`Download verification failed: ${installed.reason}`);
    } catch(e) {throw new Error(`Cannot install ${settings.model}: ${e.message}`,{cause:e});}
  }
}
