import test from 'node:test';
import assert from 'node:assert/strict';
import * as ai from '../backend/ai.mjs';
let core;
try{core=await import('../backend/chart.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const options={skip:!core?'Install dependencies with npm.cmd install to run engine tests':false};
const profile={name:'Test Person',dob:'2000-01-01',time:'12:00',timezone:'Asia/Kolkata',latitude:28.6139,longitude:77.209};
test('timezone conversion uses birth-date zone rules and rejects DST ambiguity',options,()=>{
  assert.equal(core.validateProfile(profile).utc,'2000-01-01T06:30:00.000Z');
  for(const data of [{...profile,dob:'2023-02-30'},{...profile,unknown:true},{...profile,latitude:90},{...profile,timezone:'Fake/Zone'},{...profile,dob:'2024-03-10',time:'02:30',timezone:'America/New_York'},{...profile,dob:'2024-11-03',time:'01:30',timezone:'America/New_York'}])assert.throws(()=>core.validateProfile(data));
});
test('chart positions are finite, houses consistent, lunar nodes opposite',options,()=>{
  const c=core.calculateChart(profile,new Date('2026-11-15T00:00:00Z'));
  assert.equal(c.planets.length,9);assert.equal(c.houses.length,12);
  for(const p of c.planets){assert.ok(p.longitude>=0&&p.longitude<360);assert.ok(p.house>=1&&p.house<=12);assert.equal(p.signIndex,c.houses[p.house-1].signIndex);assert.ok(p.pada>=1&&p.pada<=4);}
  assert.ok(Math.abs(core.norm(c.planets[7].longitude-c.planets[8].longitude)-180)<1e-5);
  // Broad independent seasonal sanity check, not a high-precision reference validation.
  const sun=c.planets.find(p=>p.name==='Sun');assert.ok(sun.longitude>250&&sun.longitude<260);
  assert.ok(c.dasha.current?.currentAntardasha);
});
test('nakshatra boundary and dasha balance calculations',options,()=>{
  assert.equal(core.placement(0).nakshatra,'Ashwini');assert.equal(core.placement(360).signIndex,0);
  const birth=new Date('2000-01-01T00:00:00Z'),d=core.vimshottari(0,birth,birth);assert.equal(d.current.lord,'Ketu');assert.equal(d.current.start,birth.toISOString());assert.equal(d.periods[1].lord,'Venus');
});
test('AI prompt uses recalculated placements without raw identity or birthday',options,async()=>{
  const p=await ai.prepareChat({message:'Explain my chart',profile,consent:true});assert.ok(p.hasChart);assert.ok(!p.system.includes('Test Person'));assert.ok(!p.system.includes('2000-01-01'));
});
test('Gemini adapter handles success, missing key, quota and empty response',async()=>{
  const body={message:'Career kaise samjhun?',consent:true};let sent;
  const r=await ai.generateReply(body,{apiKey:'test-key',fetchImpl:async(url,request)=>{sent=request;assert.ok(!url.includes('test-key'));return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'Namaste!'}]},finishReason:'STOP'}]})};}});
  assert.equal(r.text,'Namaste!');assert.equal(sent.headers['x-goog-api-key'],'test-key');
  await assert.rejects(ai.generateReply(body,{apiKey:''}),{status:503});
  await assert.rejects(ai.generateReply(body,{apiKey:'test',fetchImpl:async()=>({status:429})}),{status:429});
  await assert.rejects(ai.generateReply(body,{apiKey:'test',model:'unavailable-model',fetchImpl:async()=>({status:404})}),e=>e.status===503&&e.message.includes('unavailable-model'));
  await assert.rejects(ai.generateReply(body,{apiKey:'test',fetchImpl:async()=>({ok:true,status:200,json:async()=>({candidates:[]})})}),{status:502});
});
test('chat consent and bounded history are enforced without an external call',async()=>{
  await assert.rejects(ai.prepareChat({message:'hi',consent:false}),{status:400});
  await assert.rejects(ai.prepareChat({message:'hi',consent:true,history:new Array(13).fill({role:'user',text:'x'})}),{status:400});
  const p=await ai.prepareChat({message:'hi',consent:true});assert.equal(p.hasChart,false);assert.ok(p.system.includes('Roman-script Hinglish'));
});
