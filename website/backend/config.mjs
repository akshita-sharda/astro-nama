import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const configFile=new URL('../.env',import.meta.url);
// Read at request time so changing a local key/model does not require a restart.
export function getAIConfig({path=configFile,env=process.env}={}){
  let local={};
  try{local=parseEnv(readFileSync(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  return {apiKey:(local.GEMINI_API_KEY??env.GEMINI_API_KEY??'').trim(),model:(local.GEMINI_MODEL??env.GEMINI_MODEL??'gemini-3.5-flash-lite').trim()};
}
