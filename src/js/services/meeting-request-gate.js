// Owns UI request state, not authorization. Older network operations may finish,
// but cannot publish results or release controls owned by their replacement.
export function createMeetingRequestGate({snapshot,connected,onBusy}){
 let current=null,inFlight=false;
 const active=()=>Boolean(connected());
 return {
  begin(){
   if(inFlight||!active())return null;
   const selection=snapshot();
   const ticket={
    isCurrent:()=>current===ticket&&active()&&selection===snapshot(),
    finish(){
     if(current!==ticket||!inFlight)return false;
     inFlight=false;
     if(active())onBusy(false);
     return true;
    }
   };
   current=ticket;inFlight=true;onBusy(true);
   return ticket;
  },
  invalidate(){
   current=null;
   const wasBusy=inFlight;inFlight=false;
   if(wasBusy&&active())onBusy(false);
  }
 };
}
