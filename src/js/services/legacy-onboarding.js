// One-way preparation of a managed invitation from a historical staff record.
// No authorization, identity verification, login mapping or email deliverability
// can be inferred from the imported name/alias alone.
const aliasPattern=/^[a-z0-9._-]{2,80}$/;
export function classifyLegacyCandidate(candidate){
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))
  return {canPrepare:false,reason:'Registro histórico inválido'};
 const alias=String(candidate.username||'');
 const name=String(candidate.display_name||'').trim();
 if(!aliasPattern.test(alias)||!name||name.length>120)
  return {canPrepare:false,reason:'Datos de origen pendientes de conciliación'};
 if(candidate.legacy_status==='Bloqueado')
  return {canPrepare:false,reason:'Bloqueado en la fuente original'};
 if(candidate.legacy_status==='Desactivado')
  return {canPrepare:false,reason:'Desactivado en la fuente original'};
 if(candidate.legacy_status!=='Activo')
  return {canPrepare:false,reason:'Estado original no verificado'};
 if(candidate.auth_linked!==false)
  return {canPrepare:false,reason:'Cuenta vinculada o estado de acceso desconocido'};
 if(candidate.review_classification!=='MATCHED'||candidate.staff_matched!==true)
  return {canPrepare:false,reason:'Requiere conciliación de identidad y personal'};
 return {
  canPrepare:true,
  reason:'Solo preselección: confirmar identidad, correo personal y asignaciones antes de invitar'
 };
}
export function prepareLegacyInviteDraft(candidate){
 const status=classifyLegacyCandidate(candidate);
 if(!status.canPrepare)throw new Error(status.reason);
 return Object.freeze({
  historic_alias:candidate.username,
  display_name:candidate.display_name.trim(),
  email:'',
  assignments:[],
  reason:'',
  // The legacy alias is NOT an authentication identifier until a separate
  // backend-verified enrollment and alias binding is certified.
  alias_linked:false
 });
}
