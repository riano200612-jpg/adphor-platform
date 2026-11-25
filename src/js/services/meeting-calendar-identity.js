// This is a presentation-level identity join, never a claim that two
// provider records are the same event based on names, dates, or proximity.
// A trustworthy bridge MUST expose the actual Google event ID or request key.
const identity=(value)=>typeof value==='string'&&value.length>0?value:null;
const rank=(row)=>{
 const status={created:6,confirmed:5,meet_pending:4,reconciling:2,failed:1}[row.status]??3;
 return status*100+(identity(row.googleEventId)?10:0)+(identity(row.meetLink)?1:0);
};
const present=(row)=>({...row,title:row.summary||row.title||'Reunión'});

export function dedupeCalendarMeetingRows(rows,projectId){
 if(!Array.isArray(rows)||typeof projectId!=='string'||!projectId)throw Error('Invalid calendar meeting identity scope.');
 const list=rows.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)&&
   (row.projectId===undefined||row.projectId===projectId)&&
   (row.project_id===undefined||row.project_id===projectId));
 const parent=list.map((_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{const x=root(a),y=root(b);if(x!==y)parent[y]=x;};
 const owners=new Map();
 list.forEach((row,i)=>{
  const aliases=[
   identity(row.googleEventId)&&'google:'+row.googleEventId,
   identity(row.idempotencyKey)&&'request:'+row.idempotencyKey,
   identity(row.id)&&'qa:'+row.id,
  ].filter(Boolean);
  for(const alias of aliases){
   if(owners.has(alias))join(i,owners.get(alias));
   else owners.set(alias,i);
  }
 });
 const groups=new Map();
 list.forEach((row,i)=>{
  const key=root(i);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 });
 const result=[];
 for(const group of groups.values()){
  // If a purported bridge links different Google event IDs, retain
  // every record rather than silently hiding a potentially real event.
  const googleIds=new Set(group.map(row=>identity(row.googleEventId)).filter(Boolean));
  if(googleIds.size>1){result.push(...group.map(present));continue;}
  let best=group[0];
  for(const row of group.slice(1))if(rank(row)>rank(best))best=row;
  result.push(present(best));
 }
 return result;
}
