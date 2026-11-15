import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {InputError} from './errors.mjs';
const derive=promisify(scrypt),digest=value=>createHash('sha256').update(value).digest('hex');
function validWorkspace(w){
  const text=(v,max)=>typeof v==='string'&&v.length<=max;
  const number=v=>[1,2,3,4,5,6,7,8,9,11,22,33].includes(v?.n);
  if(!w||!Array.isArray(w.profiles)||!Array.isArray(w.saved)||w.profiles.length>30||w.saved.length>300||JSON.stringify(w).length>1000000)return false;
  if(w.profiles.some(p=>!p||!text(p.id,120)||!text(p.name,80)||!text(p.dob,10)||!text(p.place,120)||typeof p.unknown!=='boolean'))return false;
  return w.saved.every(item=>{
    if(!item||!text(item.id,3000)||!text(item.title,300))return false;
    if(item.type==='Conversation')return text(item.contextKey,3000)&&Array.isArray(item.messages)&&item.messages.length<=400&&item.messages.every(m=>typeof m.user==='boolean'&&text(m.text,20000));
    if(item.type==='Numerology')return number(item.result?.birth)&&number(item.result?.life)&&Array.isArray(item.result?.life?.steps)&&text(item.result?.expression,500);
    if(item.type==='Name numerology')return number(item.result?.expression)&&(!item.result.soul||number(item.result.soul))&&(!item.result.personality||number(item.result.personality))&&text(item.result.name,80)&&text(item.result.working,1000);
    if(item.type==='Kundali'){const c=item.chart;return c&&text(c.ascendant?.sign,100)&&Number.isFinite(c.ascendant.degree)&&text(c.moon?.sign,100)&&text(c.moon?.nakshatra,100)&&text(c.method?.accuracy,1000)&&text(c.method?.ayanamsa,300)&&Array.isArray(c.planets)&&c.planets.length<=12&&c.planets.every(p=>text(p.name,40)&&text(p.sign,100)&&text(p.nakshatra,100)&&Number.isFinite(p.degree))&&Array.isArray(c.dasha?.periods)&&c.dasha.periods.every(p=>text(p.lord,30)&&text(p.start,40)&&text(p.end,40));}
    return false;
  });
}
export function createAccounts(path){
  if(!path){mkdirSync(new URL('../data/',import.meta.url),{recursive:true});path=fileURLToPath(new URL('../data/accounts.sqlite',import.meta.url));}
  const db=new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS workspaces(user_id INTEGER PRIMARY KEY,content TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);');
  async function passwordHash(password,salt=randomBytes(16).toString('hex')){return salt+':'+(await derive(password,salt,64)).toString('hex');}
  function current(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('astronoma_session='))?.slice(18);if(!token)return null;const row=db.prepare('SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?').get(digest(token),Date.now());return row||null;}
  function cookie(token,maxAge){return `astronoma_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
  return {current,close:()=>db.close(),async auth(action,body,req,res){
    if(action==='logout'){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('astronoma_session='))?.slice(18);if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.setHeader('Set-Cookie',cookie('',0));return {user:null};}
    const username=String(body?.username||'').trim().toLowerCase(),password=body?.password;
    if(!/^[a-z0-9_-]{3,40}$/.test(username)||typeof password!=='string'||password.length<10||password.length>128)throw new InputError('Use a 3–40 character username (letters, numbers, _ or -) and a 10–128 character password.');
    let user;
    if(action==='register'){const hashed=await passwordHash(password);try{const result=db.prepare('INSERT INTO users(username,password) VALUES (?,?)').run(username,hashed);user={id:Number(result.lastInsertRowid),username};}catch{throw new InputError('That username is unavailable.');}}
    else if(action==='login'){const row=db.prepare('SELECT * FROM users WHERE username=?').get(username);const expected=row?.password||'00000000000000000000000000000000:'+Buffer.alloc(64).toString('hex');const actual=await passwordHash(password,expected.split(':')[0]);if(!row||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw new InputError('Username or password does not match.',401);user={id:row.id,username:row.username};}
    else throw new InputError('Unknown account action.');
    const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token),user.id,Date.now()+7*86400000);res.setHeader('Set-Cookie',cookie(token,7*86400));return {user:{username:user.username}};
  },read(req){const user=current(req);if(!user)throw new InputError('Sign in first.',401);const row=db.prepare('SELECT content,version FROM workspaces WHERE user_id=?').get(user.id);return {workspace:row?JSON.parse(row.content):null,version:row?.version||0};},save(req,body){
    const user=current(req);if(!user)throw new InputError('Sign in first.',401);
    const w=body?.workspace;if(!validWorkspace(w))throw new InputError('Workspace data is invalid. Use up to 30 profiles and 300 supported saved items, within 1 MB.');
    const row=db.prepare('SELECT version FROM workspaces WHERE user_id=?').get(user.id),v=row?.version||0;
    if(body.version!==v)throw new InputError('The account copy changed. Download it before uploading again.',409);
    const content=JSON.stringify(w);db.prepare('INSERT INTO workspaces(user_id,content,version) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET content=excluded.content,version=excluded.version').run(user.id,content,v+1);return {version:v+1};
  }};
}
