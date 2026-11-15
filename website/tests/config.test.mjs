import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getAIConfig} from '../backend/config.mjs';
test('model/key changes load on the next request without process restart',()=>{
  const folder=mkdtempSync(join(tmpdir(),'astronoma-config-'));
  const path=join(folder,'.env');
  try{
    writeFileSync(path,'GEMINI_API_KEY=fake-test-key\nGEMINI_MODEL=gemini-3.5-flash-lite\n');
    assert.equal(getAIConfig({path,env:{}}).model,'gemini-3.5-flash-lite');
    writeFileSync(path,'GEMINI_API_KEY=fake-new-key\nGEMINI_MODEL=test-updated-model\n');
    assert.deepEqual(getAIConfig({path,env:{}}),{apiKey:'fake-new-key',model:'test-updated-model'});
  }finally{rmSync(path,{force:true});rmdirSync(folder);}
});
