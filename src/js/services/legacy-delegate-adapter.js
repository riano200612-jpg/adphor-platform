// Pure adapter for José's Master_ADPHOR source. Never exports PIN, email, OTP or photo URLs.
// Resolves source IDs for a private import staging pipeline; requires explicit mapping to auth users.
const norm=v=>String(v??'').trim();
export function prepareDelegateAssignments({delegates=[],properties=[],userIdByLegacyId={}}={}) {
 const delegateMap=new Map();
 for(const d of delegates){
  const id=norm(d.ID_Delegado);
  if(!id || delegateMap.has(id))continue;
  const state=norm(d.Estado).toLocaleLowerCase('es');
  if(!['activo','activa','active','habilitado','habilitada'].includes(state))continue;
  const uid=norm(userIdByLegacyId[id]);
  if(!uid)continue;
  delegateMap.set(id,{user_id:uid,role_label:norm(d['Leyenda Rol']||d.Rol)||'Delegado',sector:norm(d['Sector Coordinado'])});
 }
 const seen=new Set(),out=[],rejected=[];
 for(const p of properties) {
  const legacyProjectId=norm(p.ID_Copropiedad),legacyDelegateId=norm(p.ID_Delegado);
  const delegate=delegateMap.get(legacyDelegateId);
  if(!legacyProjectId || !delegate){rejected.push({reason:'unmapped_or_inactive',legacy_project_id:legacyProjectId});continue;}
  const key=legacyProjectId+':'+delegate.user_id;
  if(seen.has(key))continue;
  seen.add(key);
  out.push({legacy_project_id:legacyProjectId,user_id:delegate.user_id,
    role_label:delegate.role_label,sector:delegate.sector,requires_project_id_mapping:true});
 }
 return {assignments:out,rejected};
}
