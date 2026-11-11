export function summarizeChromiumHandshake(stderr){
 const requests=new Map();
 for(const raw of stderr.split('\n')){
  const line=raw.replace(/\u001b\[[0-9;]*m/g,'');
  if(!line.includes('pw:protocol'))continue;
  const json=line.match(/\{.*\}/)?.[0];if(!json)continue;
  try{
   const message=JSON.parse(json);
   if(line.includes('SEND')&&['Browser.getVersion','Target.setAutoAttach'].includes(message.method)){
    requests.set(message.id,{id:message.id,method:message.method,sent:true,received:false});
   }else if(line.includes('RECV')&&requests.has(message.id)){
    requests.get(message.id).received=true;
    requests.get(message.id).error=message.error?.message??null;
   }
  }catch{/* Preserve raw log; truncated lines cannot prove receipt. */}
 }
 return [...requests.values()];
}
