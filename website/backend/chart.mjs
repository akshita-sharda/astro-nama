import * as Astronomy from 'astronomy-engine';
import {DateTime,IANAZone} from 'luxon';
import {InputError} from './errors.mjs';
export {InputError} from './errors.mjs';
export const SIGNS=['Aries / Mesh','Taurus / Vrishabh','Gemini / Mithun','Cancer / Kark','Leo / Singh','Virgo / Kanya','Libra / Tula','Scorpio / Vrishchik','Sagittarius / Dhanu','Capricorn / Makar','Aquarius / Kumbh','Pisces / Meen'];
const NAK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const LORDS=['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'],YEARS=[7,20,6,10,7,18,16,19,17],YEAR_MS=365.25*86400000;
export const norm=x=>((x%360)+360)%360;
export function placement(lon){const v=norm(lon),i=Math.floor(v/30),n=Math.floor(v/(360/27));return {longitude:+v.toFixed(6),sign:SIGNS[i],signIndex:i,degree:+(v%30).toFixed(4),nakshatra:NAK[n],pada:Math.floor((v%(360/27))/(360/108))+1};}
export function validateProfile(raw){
  if(!raw||typeof raw!=='object')throw new InputError('Add your birth details first.');
  const {dob,time,timezone,latitude,longitude}=raw;
  if(typeof dob!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dob))throw new InputError('Enter a valid birth date.');
  const day=DateTime.fromISO(dob,{zone:'UTC'});
  if(!day.isValid||day.year<1900||day>DateTime.utc().endOf('day'))throw new InputError('Birth date must be between 1900 and today.');
  if(raw.unknown===true)throw new InputError('An exact birth time is required for this chart. Numerology is available without it.');
  if(typeof time!=='string'||!/^\d{2}:\d{2}$/.test(time))throw new InputError('Enter an exact birth time.');
  if(typeof timezone!=='string'||!IANAZone.isValidZone(timezone))throw new InputError('Choose a birthplace or enter a valid IANA timezone, such as Asia/Kolkata.');
  if(typeof latitude!=='number'||!Number.isFinite(latitude)||Math.abs(latitude)>=66)throw new InputError('Latitude must be between -66 and 66 degrees. Polar ascendants are not supported yet.');
  if(typeof longitude!=='number'||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw new InputError('Longitude must be between -180 and 180 degrees.');
  const local=DateTime.fromISO(`${dob}T${time}`,{zone:timezone});
  if(!local.isValid||local.toFormat('yyyy-MM-dd HH:mm')!==`${dob} ${time}`)throw new InputError('This local time did not exist because of a clock change. Please check the birth record.');
  if(local.getPossibleOffsets().length>1)throw new InputError('This birth time is ambiguous during a daylight-saving clock change. A verified UTC birth time is needed; this version cannot resolve it.');
  return {date:local.toJSDate(),local:local.toISO(),utc:local.toUTC().toISO(),latitude,longitude,timezone};
}
// Development approximation, not a Swiss Ephemeris Lahiri implementation.
export function ayanamsa(date){const t=(date.getTime()-Date.UTC(2000,0,1,12))/86400000/36525;return 23.85305556+(5028.796195*t+1.1054348*t*t)/3600;}
export function ascendant(date,latitude,longitude){const t=(date.getTime()-Date.UTC(2000,0,1,12))/86400000/36525,r=Math.PI/180;const eps=(23+26/60+21.448/3600-(46.815*t+.00059*t*t-.001813*t*t*t)/3600)*r;const theta=norm(Astronomy.SiderealTime(date)*15+longitude)*r;return norm(Math.atan2(-Math.cos(theta),Math.sin(theta)*Math.cos(eps)+Math.tan(latitude*r)*Math.sin(eps))/r+180);}
export function vimshottari(moon,birth,now=new Date()){
  const span=360/27,nak=Math.floor(norm(moon)/span),first=nak%9,fraction=norm(moon)%span/span;
  let cursor=birth.getTime()-fraction*YEARS[first]*YEAR_MS;const periods=[];
  for(let i=0;i<10;i++){const k=(first+i)%9,end=cursor+YEARS[k]*YEAR_MS;const p={lord:LORDS[k],start:new Date(cursor).toISOString(),end:new Date(end).toISOString(),years:YEARS[k]};
    if(now.getTime()>=cursor&&now.getTime()<end){let sub=cursor;for(let j=0;j<9;j++){const s=(k+j)%9,subEnd=sub+YEARS[k]*YEARS[s]/120*YEAR_MS;if(now.getTime()>=sub&&now.getTime()<subEnd)p.currentAntardasha={lord:LORDS[s],start:new Date(sub).toISOString(),end:new Date(subEnd).toISOString()};sub=subEnd;}}
    periods.push(p);cursor=end;
  }
  return {yearDays:365.25,periods,current:periods.find(p=>now>=new Date(p.start)&&now<new Date(p.end))||null};
}
export function calculateChart(raw,now=new Date()){
  const p=validateProfile(raw),ay=ayanamsa(p.date),asc=placement(ascendant(p.date,p.latitude,p.longitude)-ay);
  const planets=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'].map(name=>{
    const lon=Astronomy.Ecliptic(Astronomy.GeoVector(name,p.date,true)).elon;
    const before=Astronomy.Ecliptic(Astronomy.GeoVector(name,new Date(p.date.getTime()-3600000),true)).elon,after=Astronomy.Ecliptic(Astronomy.GeoVector(name,new Date(p.date.getTime()+3600000),true)).elon;
    const v=placement(lon-ay);return {name,...v,house:(v.signIndex-asc.signIndex+12)%12+1,retrograde:norm(after-before+180)-180<0};
  });
  const t=(p.date.getTime()-Date.UTC(2000,0,1,12))/86400000/36525,node=norm(125.04452-1934.136261*t+.0020708*t*t+t*t*t/450000)-ay;
  for(const [name,lon]of [['Rahu',node],['Ketu',node+180]]){const v=placement(lon);planets.push({name,...v,house:(v.signIndex-asc.signIndex+12)%12+1,retrograde:true,nodeType:'mean'});}
  const moon=planets.find(p=>p.name==='Moon');
  return {version:1,calculatedAt:now.toISOString(),birth:{local:p.local,utc:p.utc,timezone:p.timezone},method:{engine:'Astronomy Engine',zodiac:'Sidereal',ayanamsa:'Approximate Lahiri-style (J2000 reference + precession)',ayanamsaDegrees:+ay.toFixed(6),houses:'Whole sign',nodes:'Mean lunar nodes',dasha:'Vimshottari, 365.25-day years',accuracy:'Development calculation: ayanamsa and dasha timing are approximate; not independently certified against a reference kundali.'},ascendant:asc,moon,planets,houses:Array.from({length:12},(_,i)=>({house:i+1,sign:SIGNS[(asc.signIndex+i)%12],signIndex:(asc.signIndex+i)%12})),dasha:vimshottari(moon.longitude,p.date,now)};
}
