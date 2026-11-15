// Lightweight smoke checks; browser layout and interaction QA remain separate.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const elements=new Map();
function el(){return {innerHTML:'',textContent:'',isConnected:true,classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},append(){},insertAdjacentElement(){},click(){},remove(){},addEventListener(){},querySelector(){return el();},style:{},focus(){},value:'',elements:{unknown:{checked:false},time:{}}};}
const document={body:el(),querySelector(q){if(q==='#profile-form')return null;if(!elements.has(q))elements.set(q,el());return elements.get(q);},querySelectorAll(){return [];},createElement:el};
const sandbox={document,location:{hash:''},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem(){return null;},setItem(){}},IntersectionObserver:class{observe(){} unobserve(){} disconnect(){}},fetch:async()=>({ok:true,json:async()=>({charts:false,aiConfigured:false})}),AbortSignal,setTimeout(){},console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/backend-ui.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/suite.js','utf8'),sandbox);
for(const route of ['home','chart','dashboard','chat','numerology','saved','about','profile','tools','profiles','compatibility','transits','panchang','account','missing']){
  sandbox.location.hash='#/'+route;
  vm.runInContext('render()',sandbox);
  assert.ok(elements.get('#main').innerHTML.length,'Empty route: '+route);
}
const named=sandbox.window.AstronomaNameNumbers('Ada Lovelace');
assert.equal(named.expression.n,9);
assert.throws(()=>sandbox.window.AstronomaNameNumbers('123'));
const result=vm.runInContext("calculate('2005-08-15')",sandbox);
assert.equal(result.birth.n,6);
assert.equal(result.life.n,3);
assert.equal(vm.runInContext("calculate('2000-01-08').life.n",sandbox),11);
assert.equal(vm.runInContext("esc('<script>')",sandbox),'&lt;script&gt;');
vm.runInContext("conversation=[{text:'What is a nakshatra?',user:true},{text:'A traditional lunar division.',user:false}];location.hash='#/chat';render();",sandbox);
elements.get('#save-conversation').onclick();
assert.equal(vm.runInContext('saved[0].type',sandbox),'Conversation');
assert.equal(vm.runInContext('saved[0].messages.length',sandbox),2);
assert.equal(vm.runInContext('saved[0].title',sandbox),'What is a nakshatra?');
elements.get('#save-conversation').onclick();
assert.equal(vm.runInContext('saved.length',sandbox),1,'Saving twice updates the same chat');
vm.runInContext("location.hash='#/saved';render();",sandbox);
assert.ok(elements.get('#saved-list').innerHTML.includes('Resume conversation'));
assert.ok(elements.get('#saved-list').innerHTML.includes('A traditional lunar division.'));
vm.runInContext("renderSaved('no matching words');",sandbox);
assert.ok(elements.get('#saved-list').innerHTML.includes('Nothing matches'));
const chatId=vm.runInContext('saved[0].id',sandbox);
const resumeButton=Object.assign(el(),{dataset:{resume:chatId}});
const exportButton=Object.assign(el(),{dataset:{export:chatId}});
document.querySelectorAll=q=>q==='[data-resume]'?[resumeButton]:q==='[data-export]'?[exportButton]:[];
vm.runInContext("renderSaved();conversation=[];",sandbox);
resumeButton.onclick();
assert.equal(sandbox.location.hash,'/chat');
assert.equal(vm.runInContext('conversation.length',sandbox),2,'Resume restores both turns');
vm.runInContext("profile={name:'Other profile'};conversation=[{text:'Keep this',user:true}];location.hash='#/saved';",sandbox);
resumeButton.onclick();
assert.equal(sandbox.location.hash,'#/saved','Different birth context must not resume');
assert.equal(vm.runInContext('conversation[0].text',sandbox),'Keep this');
let exported='';
sandbox.Blob=class{constructor(parts){exported=parts.join('');}};
sandbox.URL={createObjectURL(){return 'blob:unit-test';},revokeObjectURL(){}};
exportButton.onclick();
assert.ok(exported.includes('What is a nakshatra?'));
assert.ok(exported.includes('A traditional lunar division.'));
assert.ok(exported.includes('AI-generated traditional interpretations'));
document.querySelectorAll=()=>[];
vm.runInContext('profile=null',sandbox);
console.log('Passed: route rendering, numerology, safe escaping, chat save/update/resume, profile mismatch protection, collection search and exported transcript.');

async function checkDashboard(){
  const {calculateChart}=await import('./backend/chart.mjs');
  const birth={name:'Test',dob:'2000-01-01',time:'12:00',unknown:false,latitude:28.61,longitude:77.21,timezone:'Asia/Kolkata',place:'Test city'};
  const chart=calculateChart(birth);let calls=0;
  sandbox.fetch=async(path,options)=>{assert.equal(path,'/api/chart');assert.equal(JSON.parse(options.body).profile.dob,birth.dob);calls++;return {ok:true,json:async()=>({chart})};};
  sandbox.testBirth=birth;
  vm.runInContext("profile=testBirth;location.hash='#/dashboard';render();",sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1);
  assert.ok(elements.get('#dashboard-chart').innerHTML.includes(chart.moon.nakshatra));
  assert.ok(elements.get('#dashboard-chart').innerHTML.includes(chart.ascendant.sign.split(' / ')[1]));
  vm.runInContext('render()',sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1,'Unchanged birth profile reuses the calculated chart');
  console.log('Passed: dashboard fetches real calculated chart data and reuses valid cache.');
}
checkDashboard().catch(e=>{console.error(e);process.exitCode=1;});
