import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createApp} from '../server.mjs';
import {createAccounts} from '../backend/accounts.mjs';

function request(server,path,{method='GET',body,headers={}}={}){
  return new Promise((resolve,reject)=>{
    const payload=typeof body==='string'?body:JSON.stringify(body);
    const req=Readable.from(payload?[Buffer.from(payload)]:[]);req.url=path;req.method=method;req.socket={remoteAddress:'127.0.0.1'};req.headers={host:'127.0.0.1:4173',...(body!==undefined?{'content-type':'application/json'}:{}),...headers};
    const response={headers:{},headersSent:false,setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);this.headersSent=true;},end(data){resolve({status:this.status,headers:this.headers,text:Buffer.isBuffer(data)?data.toString():data||''});}};
    try{server.emit('request',req,response);}catch(e){reject(e);}
  });
}
test('static assets serve; secrets and backend source are not exposed',async()=>{
  const app=createApp();
  for(const path of ['/','/app.js','/backend-ui.js','/suite.js','/style.css'])assert.equal((await request(app,path)).status,200);
  for(const path of ['/.env','/.env.example','/backend/ai.mjs','/../users.json','/data/accounts.sqlite'])assert.equal((await request(app,path)).status,404);
});
test('chart API uses server calculation, not client chart data',async()=>{
  let received;const app=createApp({chartImpl:p=>{received=p;return {serverCalculated:true};}});
  const r=await request(app,'/api/chart',{method:'POST',body:{profile:{dob:'2000-01-01'},chart:{fake:true}}});
  assert.equal(r.status,200);assert.equal(received.dob,'2000-01-01');assert.deepEqual(JSON.parse(r.text),{chart:{serverCalculated:true}});
});
test('cross-origin and DNS-rebinding requests cannot use APIs',async()=>{
  const app=createApp();
  assert.equal((await request(app,'/api/chart',{method:'POST',body:{},headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await request(app,'/api/status',{headers:{host:'evil.example'}})).status,403);
  assert.equal((await request(app,'/api/status',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
});
test('invalid JSON, content types and oversized requests are rejected',async()=>{
  const app=createApp();
  assert.equal((await request(app,'/api/chart',{method:'POST',body:'{'})).status,400);
  assert.equal((await request(app,'/api/chart',{method:'POST',body:{},headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await request(app,'/api/chart',{method:'POST',body:{large:'x'.repeat(41000)}})).status,413);
});
test('city search maps only necessary data, caches, and reports outages',async()=>{
  let calls=0;
  const app=createApp({fetchImpl:async url=>{calls++;assert.ok(url.includes('name=Amritsar'));return {ok:true,json:async()=>({results:[{name:'Amritsar',admin1:'Punjab',country:'India',latitude:31.63,longitude:74.87,timezone:'Asia/Kolkata'}]})};}});
  let r=await request(app,'/api/places?q=Amritsar');assert.equal(r.status,200);assert.equal(JSON.parse(r.text).places[0].timezone,'Asia/Kolkata');
  await request(app,'/api/places?q=Amritsar');assert.equal(calls,1);
  const offline=createApp({fetchImpl:async()=>{throw Error('offline');}});
  assert.equal((await request(offline,'/api/places?q=Delhi')).status,502);
});
test('unexpected errors do not disclose internal errors or credentials',async()=>{
  const app=createApp({chartImpl:()=>{throw Error('secret-key-internal');}});
  const r=await request(app,'/api/chart',{method:'POST',body:{}});assert.equal(r.status,500);assert.ok(!r.text.includes('secret-key'));
});
test('new calculation routes return computed Panchang, transits and comparison',async()=>{
  const app=createApp(),profile={dob:'2000-01-01',time:'12:00',latitude:28.61,longitude:77.21,timezone:'Asia/Kolkata'};
  const cases=[['panchang',{date:'2026-11-15',...profile},r=>!!r.result.sunrise],['compatibility',{first:profile,second:profile},r=>r.result.moonSeparation===0],['transits',{profile,date:'2026-11-15',timezone:'Asia/Kolkata',days:7},r=>r.result.positions.length===7]];
  for(const [route,body,check]of cases){const r=await request(app,'/api/'+route,{method:'POST',body});assert.equal(r.status,200,r.text);assert.ok(check(JSON.parse(r.text)));}
});
test('account and sync endpoints require a private session and reject stale versions',async()=>{
  const store=createAccounts(':memory:'),app=createApp({accountsStore:store});
  try{
    assert.equal((await request(app,'/api/workspace')).status,401);
    const registered=await request(app,'/api/register',{method:'POST',body:{username:'api_user',password:'test-api-password'}});assert.equal(registered.status,200);
    const headers={cookie:registered.headers['Set-Cookie'].split(';')[0]};
    assert.equal(JSON.parse((await request(app,'/api/account',{headers})).text).user.username,'api_user');
    const body={workspace:{profiles:[],saved:[],activeId:null},version:0};
    assert.equal((await request(app,'/api/workspace',{method:'POST',headers,body})).status,200);
    assert.equal((await request(app,'/api/workspace',{method:'POST',headers,body})).status,409);
    assert.equal(JSON.parse((await request(app,'/api/workspace',{headers})).text).version,1);
    assert.equal((await request(app,'/api/logout',{method:'POST',headers,body:{}})).status,200);
    assert.equal((await request(app,'/api/workspace',{headers})).status,401);
  }finally{store.close();}
});
