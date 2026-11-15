import test from 'node:test';
import assert from 'node:assert/strict';
import {panchang,transits,compatibility,skyAt} from '../backend/explore.mjs';
const birth={name:'Test',dob:'2000-01-01',time:'12:00',timezone:'Asia/Kolkata',latitude:28.6139,longitude:77.209};
test('Panchang uses sunrise on the requested local date and valid five-limb values',()=>{
  const r=panchang({date:'2026-11-15',timezone:'Asia/Kolkata',latitude:28.6139,longitude:77.209});
  assert.ok(r.sunrise.startsWith('2026-11-15T06:'));assert.ok(r.sunset.startsWith('2026-11-15T17:'));
  assert.equal(r.weekday,'Sunday');assert.ok(r.tithi.number>=1&&r.tithi.number<=30);assert.ok(r.nakshatra);assert.ok(r.yoga);assert.ok(r.karana);assert.ok(r.at.includes('sunrise'));
  assert.throws(()=>panchang({date:'2026-02-30',timezone:'Asia/Kolkata',latitude:28,longitude:77}));
});
test('compatibility is a measured factor comparison, symmetric in angular distance',()=>{
  const second={...birth,dob:'2002-06-10',time:'08:30'};
  const a=compatibility({first:birth,second}),b=compatibility({first:second,second:birth});
  assert.equal(a.moonSeparation,b.moonSeparation);assert.equal('score' in a,false);assert.equal(a.first.moon.sign,b.second.moon.sign);
  assert.throws(()=>compatibility({first:{...birth,unknown:true},second}));
});
test('transit events are ordered and bracket the computed sign change',()=>{
  const r=transits({profile:birth,date:'2026-11-15',timezone:'Asia/Kolkata',days:7});assert.equal(r.positions.length,7);assert.ok(r.events.length>0);
  for(let i=1;i<r.events.length;i++)assert.ok(r.events[i].time>=r.events[i-1].time);
  const e=r.events.find(e=>e.planet==='Moon'),time=new Date(e.time).getTime();
  assert.equal(skyAt(new Date(time-120000)).find(p=>p.name===e.planet).sign,e.from);
  assert.equal(skyAt(new Date(time+120000)).find(p=>p.name===e.planet).sign,e.to);
  assert.ok(e.natalHouse>=1&&e.natalHouse<=12);
  assert.throws(()=>transits({profile:birth,date:'2026-11-15',timezone:'Asia/Kolkata',days:999}));
});
