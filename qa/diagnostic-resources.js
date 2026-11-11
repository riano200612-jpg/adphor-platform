// Own acquisitions as soon as they start, including resources returned after a deadline.
export function createDiagnosticResources() {
 const pending=new Set();
 const resources=new Map();
 let closing=false;
 const close=resource=>{
  const entry=resources.get(resource);
  if(!entry.closed){
   entry.closed=Promise.resolve().then(()=>resource.close());
  }
  return entry.closed;
 };
 return {
  acquire(create){
   if(closing)return Promise.reject(Error('Diagnostic resources already closing'));
   const acquisition=Promise.resolve().then(create).then(async resource=>{
    if(!resource || typeof resource.close!=='function')throw Error('Resource has no close method');
    resources.set(resource,{closed:null});
    if(closing){
     await close(resource);
     throw Error('Resource completed after diagnostic shutdown');
    }
    return resource;
   });
   pending.add(acquisition);
   // Attach both handlers immediately. Late rejections remain observed.
   acquisition.then(()=>pending.delete(acquisition),()=>pending.delete(acquisition));
   return acquisition;
  },
  async close(){
   closing=true;
   const errors=[];
   // Start every known close before awaiting any one. A page close can need
   // browser shutdown to finish; serial awaiting used to prevent that shutdown.
   const closeKnown=async()=>{
    const results=await Promise.allSettled([...resources.keys()].reverse().map(close));
    for(const result of results)if(result.status==='rejected'&&!errors.includes(result.reason))errors.push(result.reason);
   };
   await closeKnown();
   // Late acquisitions still register and close themselves. No resource escapes
   // ownership. The independent parent watchdog bounds genuinely stuck closes.
   await Promise.allSettled([...pending]);
   await closeKnown();
   if(errors.length)throw new AggregateError(errors,'Diagnostic resource cleanup failed');
  }
 };
}
