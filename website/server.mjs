import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {getAIConfig} from './backend/config.mjs';
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/backend-ui.js':'backend-ui.js','/suite.js':'suite.js','/style.css':'style.css'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
let chartModule=null;
async function engine(){try{return chartModule??=await import('./backend/chart.mjs');}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND'){const error=new Error('Chart dependencies are missing. Run npm.cmd install in the website folder, then restart.');error.status=503;throw error;}throw e;}}
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function createApp({fetchImpl=fetch,chatImpl=null,chartImpl=null,accountsStore=null}={}){
  const hits=new Map(),cache=new Map();let daily={date:'',count:0};
  let accounts=accountsStore;const getAccounts=async()=>accounts??=(await import('./backend/accounts.mjs')).createAccounts();
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')){
        const host=req.headers.host;
        if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host||''))fail('This server accepts local requests only.',403);
        if(req.headers.origin&&req.headers.origin!=='http://'+host)fail('Cross-origin requests are not allowed.',403);
        if(req.headers['sec-fetch-site']==='cross-site')fail('Cross-site requests are not allowed.',403);
        if(req.method==='GET'&&url.pathname==='/api/status'){let charts=true;try{await engine();}catch{charts=false;}const config=getAIConfig();return json(200,{suite:true,charts,aiConfigured:!!config.apiKey&&config.apiKey!=='paste_your_key_here',model:config.model});}
        const key=req.socket.remoteAddress||'local',minute=Math.floor(Date.now()/60000),hit=hits.get(key)||{minute,count:0};if(hit.minute!==minute){hit.minute=minute;hit.count=0;}hit.count++;hits.set(key,hit);if(hit.count>40)fail('Too many requests. Please wait a minute.',429);
        if(req.method==='GET'&&url.pathname==='/api/account'){const store=await getAccounts();return json(200,{user:store.current(req)?{username:store.current(req).username}:null});}
        if(req.method==='GET'&&url.pathname==='/api/workspace')return json(200,(await getAccounts()).read(req));
        if(req.method==='GET'&&url.pathname==='/api/places'){
          const q=(url.searchParams.get('q')||'').trim();if(q.length<3||q.length>100)fail('Enter a city name with 3–100 characters.');
          if(cache.has(q.toLowerCase()))return json(200,cache.get(q.toLowerCase()));
          let upstream;try{upstream=await fetchImpl('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:q,count:'8',language:'en',format:'json'}),{signal:AbortSignal.timeout(10000)});}catch{fail('Place search is unavailable. Enter coordinates and timezone manually below.',502);}
          if(!upstream.ok)fail('Place search is unavailable. You can enter coordinates manually.',502);
          const data=await upstream.json(),result={places:(data.results||[]).filter(p=>p.timezone).map(p=>({label:[p.name,p.admin1,p.country].filter(Boolean).join(', '),latitude:p.latitude,longitude:p.longitude,timezone:p.timezone})),attribution:'Location data: GeoNames via Open-Meteo'};if(cache.size>100)cache.clear();cache.set(q.toLowerCase(),result);return json(200,result);
        }
        if(req.method!=='POST'||!['/api/chart','/api/chat','/api/panchang','/api/transits','/api/compatibility','/api/register','/api/login','/api/logout','/api/workspace'].includes(url.pathname))fail('API route not found.',404);
        if(!req.headers['content-type']?.startsWith('application/json'))fail('Send JSON data.',415);
        let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>(url.pathname==='/api/workspace'?1100000:40000))fail('Request is too large.',413);parts.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(parts).toString());}catch{fail('Request JSON is invalid.');}
        if(['/api/register','/api/login','/api/logout'].includes(url.pathname))return json(200,await (await getAccounts()).auth(url.pathname.slice(5),body,req,res));
        if(url.pathname==='/api/workspace')return json(200,(await getAccounts()).save(req,body));
        if(['/api/panchang','/api/transits','/api/compatibility'].includes(url.pathname)){const explore=await import('./backend/explore.mjs');const method=url.pathname.slice(5);return json(200,{result:explore[method](body)});}
        if(url.pathname==='/api/chart'){const calculate=chartImpl||(await engine()).calculateChart;return json(200,{chart:calculate(body?.profile)});}
        const config=getAIConfig();
        if(!chatImpl&&(!config.apiKey||config.apiKey==='paste_your_key_here'))fail('AI is not connected yet. Add GEMINI_API_KEY to website/.env and try again.',503);
        const day=new Date().toISOString().slice(0,10);if(daily.date!==day)daily={date:day,count:0};if(daily.count>=100)fail('The local daily AI limit (100 requests) has been reached.',429);daily.count++;
        await (chatImpl?Promise.resolve():engine());
        const generate=chatImpl||(await import('./backend/ai.mjs')).generateReply;
        return json(200,await generate(body,{fetchImpl}));
      }
      if(req.method!=='GET'&&req.method!=='HEAD')fail('Method not allowed.',405);
      const file=files[url.pathname];if(!file)fail('Not found.',404);
      const body=await readFile(fileURLToPath(new URL(file,import.meta.url)));res.writeHead(200,{'Content-Type':types[file.split('.').pop()]});res.end(req.method==='HEAD'?undefined:body);
    }catch(error){if(!res.headersSent)json(error.status||500,{error:error.status?error.message:'The server could not complete this request.'});else res.end();}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const requested=Number(process.env.PORT||4173);
  if(!Number.isInteger(requested)||requested<1024||requested>65535)throw new Error('PORT must be an integer between 1024 and 65535.');
  let port=requested;
  const server=createApp();
  server.on('error',e=>{
    if(e.code==='EADDRINUSE'&&port<Math.min(requested+10,65535)){
      console.log(`Port ${port} is busy. Trying ${port+1} instead…`);
      port++;server.listen(port,'127.0.0.1');
    }else{console.error('Unable to start the local server.');process.exitCode=1;}
  });
  server.on('listening',()=>console.log(`Astronoma: http://127.0.0.1:${port}`));
  server.listen(port,'127.0.0.1');
}
