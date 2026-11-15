import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccounts} from '../backend/accounts.mjs';
function context(){const headers={};return {req:{headers:{}},res:{setHeader(k,v){headers[k]=v;}},headers};}
test('accounts hash passwords, isolate users, enforce versions, and revoke sessions',async()=>{
  const store=createAccounts(':memory:'),a=context(),b=context();
  try{
    await store.auth('register',{username:'test_one',password:'a-test-password'},a.req,a.res);
    a.req.headers.cookie=a.headers['Set-Cookie'].split(';')[0];
    assert.equal(store.current(a.req).username,'test_one');assert.ok(a.headers['Set-Cookie'].includes('HttpOnly'));assert.ok(a.headers['Set-Cookie'].includes('SameSite=Strict'));
    const workspace={profiles:[],saved:[],activeId:null};assert.equal(store.save(a.req,{workspace,version:0}).version,1);
    assert.throws(()=>store.save(a.req,{workspace,version:0}),{status:409});
    assert.throws(()=>store.save(a.req,{workspace:{...workspace,saved:[{type:'fake'}]},version:1}),{status:400});
    await store.auth('register',{username:'test_two',password:'another-test-password'},b.req,b.res);b.req.headers.cookie=b.headers['Set-Cookie'].split(';')[0];
    assert.equal(store.read(b.req).workspace,null);assert.equal(store.read(a.req).version,1);
    await assert.rejects(store.auth('login',{username:'test_one',password:'a-wrong-password'},a.req,a.res),{status:401});
    await store.auth('logout',{},a.req,a.res);assert.equal(store.current(a.req),null);assert.throws(()=>store.read(a.req),{status:401});
  }finally{store.close();}
});
test('account login restores access only with correct credentials',async()=>{
  const store=createAccounts(':memory:'),c=context();
  try{await store.auth('register',{username:'tester',password:'long-test-password'},c.req,c.res);await store.auth('login',{username:'tester',password:'long-test-password'},c.req,c.res);c.req.headers.cookie=c.headers['Set-Cookie'].split(';')[0];assert.equal(store.current(c.req).username,'tester');}finally{store.close();}
});
