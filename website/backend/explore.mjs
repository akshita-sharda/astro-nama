import * as Astronomy from 'astronomy-engine';
import {DateTime,IANAZone} from 'luxon';
import {calculateChart,placement,ayanamsa,norm,InputError} from './chart.mjs';
const YOGAS=['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
const TITHIS=['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima'];
const KARANAS=['Bava','Balava','Kaulava','Taitila','Gara','Vanija','Vishti'];
export function skyAt(date){
  const ay=ayanamsa(date),bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
  return bodies.map(name=>({name,...placement(Astronomy.Ecliptic(Astronomy.GeoVector(name,date,true)).elon-ay)}));
}
function dayAt(input){
  if(!input||typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!IANAZone.isValidZone(input.timezone||''))throw new InputError('Choose a date and a valid IANA timezone.');
  const d=DateTime.fromISO(input.date,{zone:input.timezone});
  if(!d.isValid||d.year<1900||d.year>2100)throw new InputError('Date must be between 1900 and 2100.');return d.startOf('day');
}
export function panchang(input){
  const day=dayAt(input),{latitude,longitude}=input;
  if(typeof latitude!=='number'||!Number.isFinite(latitude)||Math.abs(latitude)>=66||typeof longitude!=='number'||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw new InputError('Enter coordinates between -66 and 66 latitude and -180 and 180 longitude.');
  const observer=new Astronomy.Observer(latitude,longitude,0),start=day.toJSDate();
  const rise=Astronomy.SearchRiseSet('Sun',observer,1,start,1.1),set=Astronomy.SearchRiseSet('Sun',observer,-1,start,1.1);
  if(!rise||DateTime.fromJSDate(rise.date,{zone:input.timezone}).toISODate()!==input.date)throw new InputError('No sunrise found on this local date for these coordinates.');
  const sky=skyAt(rise.date),sun=sky[0],moon=sky[1],elongation=norm(moon.longitude-sun.longitude),tithiIndex=Math.floor(elongation/12),half=Math.floor(elongation/6);
  const karana=half===0?'Kimstughna':half>=57?['Shakuni','Chatushpada','Naga'][half-57]:KARANAS[(half-1)%7];
  return {date:input.date,timezone:input.timezone,weekday:day.setLocale('en').toFormat('cccc'),sunrise:DateTime.fromJSDate(rise.date,{zone:input.timezone}).toISO(),sunset:set&&DateTime.fromJSDate(set.date,{zone:input.timezone}).toISODate()===input.date?DateTime.fromJSDate(set.date,{zone:input.timezone}).toISO():null,at:'Values at local sunrise (not all-day labels)',tithi:{number:tithiIndex+1,paksha:tithiIndex<15?'Shukla':'Krishna',name:tithiIndex===29?'Amavasya':TITHIS[tithiIndex%15]},nakshatra:moon.nakshatra,pada:moon.pada,yoga:YOGAS[Math.floor(norm(sun.longitude+moon.longitude)/(360/27))],karana,moonSign:moon.sign,method:'Astronomy Engine; sunrise at sea level with standard refraction; approximate Lahiri-style sidereal conversion. No ritual muhurta or element-end times are provided.'};
}
export function compatibility(input){
  const a=calculateChart(input?.first),b=calculateChart(input?.second);
  const separation=Math.min(norm(a.moon.longitude-b.moon.longitude),norm(b.moon.longitude-a.moon.longitude));
  const distance=(b.moon.signIndex-a.moon.signIndex+12)%12+1;
  const elements=['Fire','Earth','Air','Water'];
  return {first:{moon:a.moon,ascendant:a.ascendant,element:elements[a.moon.signIndex%4]},second:{moon:b.moon,ascendant:b.ascendant,element:elements[b.moon.signIndex%4]},moonSeparation:+separation.toFixed(2),relativeMoonHouse:distance,sameMoonSign:a.moon.signIndex===b.moon.signIndex,sameNakshatra:a.moon.nakshatra===b.moon.nakshatra,notes:['Moon rashi is traditionally used to discuss emotional styles; it does not determine a relationship’s outcome.','This comparison shows chart factors only. It is not a 36-point Ashtakoota/Guna Milan score.','Both charts use the app’s approximate ayanamsa. Near sign or nakshatra boundaries, verify with a reference chart.']};
}
export function transits(input){
  const birth=calculateChart(input?.profile),day=dayAt(input),days=Number(input.days??30);
  if(day.plus({days}).year>2100)throw new InputError('The timeline must end before 2101.');
  if(![7,30].includes(days))throw new InputError('Choose a 7-day or 30-day timeline.');
  const initial=skyAt(day.set({hour:12}).toJSDate()),events=[];let previous=initial,previousTime=day.set({hour:12}).toJSDate();
  for(let i=1;i<=days;i++){
    const time=day.plus({days:i}).set({hour:12}).toJSDate(),current=skyAt(time);
    for(let j=0;j<current.length;j++)if(current[j].signIndex!==previous[j].signIndex){
      let lo=previousTime.getTime(),hi=time.getTime();
      for(let k=0;k<14;k++){const mid=(lo+hi)/2,at=skyAt(new Date(mid))[j];if(at.signIndex===previous[j].signIndex)lo=mid;else hi=mid;}
      const next=current[j];events.push({planet:next.name,from:previous[j].sign,to:next.sign,time:DateTime.fromMillis(hi,{zone:input.timezone}).toISO(),natalHouse:(next.signIndex-birth.ascendant.signIndex+12)%12+1});
    }
    previous=current;previousTime=time;
  }
  return {date:input.date,timezone:input.timezone,days,asOf:day.set({hour:12}).toISO(),positions:initial.map(p=>({...p,natalHouse:(p.signIndex-birth.ascendant.signIndex+12)%12+1})),events:events.sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)),method:'Geocentric sidereal positions at local noon; 7 classical planets. Sign changes detected with daily samples and refined to about one minute. Approximate ayanamsa; no claims about event outcomes.'};
}
