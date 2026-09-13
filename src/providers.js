export class ProviderError extends Error {}

export async function checkProvider(settings) {
  try {
    const base=settings.baseUrl?.replace(/\/$/,'');
    if(settings.provider==='ollama') {
      const r=await fetch(`${base}/api/tags`,{signal:AbortSignal.timeout(10000)});
      if(!r.ok) return {ok:false,reason:`Ollama HTTP ${r.status}`};
      const data=await r.json();
      const found=data.models?.some(x=>x.name===settings.model||x.name.startsWith(`${settings.model}:`));
      return found?{ok:true}:{ok:false,code:'MODEL_MISSING',reason:`model ${settings.model} is not installed`};
    }
    if(settings.provider==='llamacpp') {
      const r=await fetch(`${base}/health`,{signal:AbortSignal.timeout(10000)});
      return r.ok?{ok:true}:{ok:false,reason:`llama.cpp health HTTP ${r.status}`};
    }
    return {ok:false,reason:`unsupported provider ${settings.provider}`};
  } catch(e) { return {ok:false,code:e.cause?.code,reason:`${e.message}${e.cause?.code?`: ${e.cause.code}`:''}`}; }
}

export function parseModelJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || !raw.trim()) throw new ProviderError('Model returned no JSON text');
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  const error = new ProviderError('Model returned invalid or incomplete JSON');
  error.details = { raw_excerpt: text.slice(0, 500) };
  throw error;
}

async function request(settings, prompt, timeoutMs, generation={}) {
  const base=settings.baseUrl?.replace(/\/$/,'');
  let url, body;
  if(settings.provider==='ollama') { url=`${base}/api/generate`; body={model:settings.model,prompt,stream:false,format:'json',think:false,keep_alive:generation.keepAlive??'0',options:{temperature:0,num_ctx:generation.numCtx??8192,num_predict:generation.numPredict??1400}}; }
  else if(settings.provider==='llamacpp') { url=`${base}/v1/chat/completions`; body={model:settings.model||'local',messages:[{role:'user',content:prompt}],temperature:0,max_tokens:generation.numPredict??1400,response_format:{type:'json_object'}}; }
  else throw new ProviderError(`Unsupported provider: ${settings.provider}`);
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs); const started=Date.now();
  try {
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const responseText=await r.text();
    if(!r.ok) throw new ProviderError(`${settings.provider} HTTP ${r.status}: ${responseText.slice(0,200)}`);
    let envelope; try { envelope=JSON.parse(responseText); } catch { throw new ProviderError(`${settings.provider} returned a non-JSON HTTP response`); }
    const text=settings.provider==='ollama'?(envelope.response?.trim()||envelope.thinking?.trim()):envelope.choices?.[0]?.message?.content;
    try { return {result:parseModelJson(text),latency_ms:Date.now()-started,provider_metadata:{done_reason:envelope.done_reason||null,eval_count:envelope.eval_count||null,source:envelope.response?.trim()?'response':'thinking'}}; }
    catch(e) { e.details={...(e.details||{}),done_reason:envelope.done_reason||null,eval_count:envelope.eval_count||null,response_length:envelope.response?.length||0,thinking_length:envelope.thinking?.length||0}; throw e; }
  } finally {clearTimeout(timer);}
}

export async function generate(settings, prompt, timeoutMs, maxRetries=0, generation={}) {
  let last;
  for(let attempt=0;attempt<=maxRetries;attempt++) {
    try { return {...await request(settings,prompt,timeoutMs,generation),attempts:attempt+1}; }
    catch(e) { if(e instanceof ProviderError) last=e; else {const cause=e.cause?.message||e.cause?.code;last=new ProviderError(e.name==='AbortError'?'Model request timed out':`${e.message}${cause?`: ${cause}`:''}`);last.details={cause:cause||null};} if(attempt<maxRetries) continue; }
  }
  throw last;
}

export async function embedTexts(settings, texts, timeoutMs, keepAlive='0') {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),started=Date.now();
  try {const base=settings.baseUrl.replace(/\/$/,''),ollama=settings.provider==='ollama',url=ollama?`${base}/api/embed`:`${base}/v1/embeddings`,payload=ollama?{model:settings.model,input:texts,truncate:true,keep_alive:keepAlive}:{model:settings.model,input:texts};if(!ollama&&settings.provider!=='llamacpp')throw new ProviderError(`Embedding provider ${settings.provider} is not supported`);const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const body=await r.text();if(!r.ok)throw new ProviderError(`embedding HTTP ${r.status}: ${body.slice(0,200)}`);const x=JSON.parse(body),embeddings=ollama?x.embeddings:x.data?.sort((a,b)=>a.index-b.index).map(y=>y.embedding);if(!Array.isArray(embeddings)||embeddings.length!==texts.length)throw new ProviderError('Embedding provider returned the wrong number of vectors');return {embeddings,latency_ms:Date.now()-started};}catch(e){if(e instanceof ProviderError)throw e;const cause=e.cause?.message||e.cause?.code;throw new ProviderError(`${e.message}${cause?`: ${cause}`:''}`);}finally{clearTimeout(timer);}
}
