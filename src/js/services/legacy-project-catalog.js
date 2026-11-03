// Safe projection of José's Master ADPHOR catalog for a PRIVATE QA import.
// The full Sheets contents, photo identifiers and personal contacts must remain outside GitHub.
const norm=v=>String(v??'').trim();
const internal=['e','ID_Copropiedad','ID_Propiedad'];
export function projectCatalogCandidates(rows,{approvedProjectMap={}}={}) {
 if(!Array.isArray(rows)||rows.length<1)return {projects:[],rejected:[]};
 const headers=rows[0].map(norm);
 const byName=new Map(headers.map((v,i)=>[v,i]));
 if(!byName.has('Copropiedad'))throw Error('La fuente no tiene Copropiedad');
 const at=(r,k)=>byName.has(k)?norm(r[byName.get(k)]):'';
 const projects=[],rejected=[],seen=new Set();
 for(let i=1;i<rows.length;i++){
  const r=rows[i],name=at(r,'Copropiedad');
  const sourceId=internal.map(k=>at(r,k)).find(Boolean)||'';
  const approvedId=norm(approvedProjectMap[sourceId]||approvedProjectMap[name]);
  if(!name||!approvedId){rejected.push({row:i+1,reason:'missing_name_or_approved_mapping'});continue;}
  if(seen.has(approvedId)){rejected.push({row:i+1,reason:'duplicate_project'});continue;}
  seen.add(approvedId);
  projects.push({id:approvedId,name,sector:at(r,'Sector'),source:'jose_master',
   migration_status:'candidate',requires_server_approval:true});
 }
 return {projects,rejected};
}
