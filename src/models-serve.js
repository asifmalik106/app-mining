import {config} from './lib.js';
import {ensureOllama} from './ollama-runtime.js';
try {
  const {models}=await config();
  const seen=new Set();
  for(const settings of Object.values(models)) {
    if(settings.provider!=='ollama'||seen.has(settings.baseUrl))continue;
    seen.add(settings.baseUrl);
    await ensureOllama(settings);
  }
  console.log('Configured Ollama servers are ready.');
} catch(error) {console.error(error.message);process.exitCode=1;}
