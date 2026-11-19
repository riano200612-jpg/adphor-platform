// ADPHOR QA Integral — 10-minute *browser* inactivity logout (R04).
// The server is still the authority for identity, AAL2 and tenant permissions.
// The browser-wide stamp survives reloads/restarts; no token or credential is stored.
export const QA_IDLE_LIMIT_MS=10*60*1000;
export const QA_IDLE_STORAGE_KEY='adphor.qa.integral.idle.v1';

export function readIdleStamp(storage){
 try{
  const raw=storage?.getItem(QA_IDLE_STORAGE_KEY);
  if(!raw)return null;
  const s=JSON.parse(raw);
  if(typeof s?.uid!=='string'||!s.uid||!Number.isFinite(s.at)||typeof s.expired!=='boolean')return {expired:true,uid:'',at:0};
  return {uid:s.uid,at:s.at,expired:s.expired};
 }catch{return {expired:true,uid:'',at:0};}
}
export function expiredStoredSession(storage,now=Date.now(),limit=QA_IDLE_LIMIT_MS){
 const s=readIdleStamp(storage);
 return Boolean(s&&(s.expired||now<s.at||now-s.at>=limit));
}
export function createQaIdleGuard({
 storage,onExpire,now=()=>Date.now(),
 schedule=(fn,ms)=>setTimeout(fn,ms),
 cancel=id=>clearTimeout(id),
 limit=QA_IDLE_LIMIT_MS
}){
 if(typeof onExpire!=='function'||!Number.isFinite(limit)||limit<=0)throw Error('Invalid inactivity guard');
 let uid='',last=0,timer=null,active=false;
 const persist=expired=>{
  try{storage?.setItem(QA_IDLE_STORAGE_KEY,JSON.stringify({uid,at:last,expired}));}catch{/* Timer remains authoritative while page is open. */}
 };
 const clear=()=>{if(timer!==null){cancel(timer);timer=null;}};
 const expire=()=>{
  if(!active)return false;
  active=false;clear();persist(true);
  onExpire();
  return false;
 };
 const arm=()=>{
  clear();
  if(active)timer=schedule(check,Math.max(1,limit-Math.max(0,now()-last)));
 };
 function check(){
  if(!active)return false;
  // Other tabs may also be in active use. Honor the newest timestamp, while
  // an explicit expired marker or account switch always wins (fail closed).
  const shared=readIdleStamp(storage);
  if(shared){
   if(shared.uid!==uid||shared.expired)return expire();
   if(shared.at>last)last=shared.at;
  }
  const elapsed=now()-last;
  if(elapsed<0||elapsed>=limit)return expire();
  arm();
  return true;
 }
 return {
  start(userId,{fresh=false}={}){
   if(typeof userId!=='string'||!userId)throw Error('User required');
   if(active&&uid===userId)return check(); // Re-render does not reset inactivity.
   const prior=readIdleStamp(storage);
   uid=userId;active=true;
   if(fresh||!prior||prior.uid!==userId){
    last=now();persist(false);
   }else{
    last=prior.at;
    if(prior.expired)return expire();
   }
   return check();
  },
  activity(){
   if(!check())return false; // Never re-arm an already expired session.
   last=now();persist(false);arm();
   return true;
  },
  check,
  stop({clearStorage=false}={}){
   active=false;uid='';last=0;clear();
   if(clearStorage){try{storage?.removeItem(QA_IDLE_STORAGE_KEY);}catch{/* no protected state retained */}}
  },
  isActive:()=>active
 };
}
