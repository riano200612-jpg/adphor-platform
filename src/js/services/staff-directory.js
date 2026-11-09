const checked=r=>{if(r.error)throw Error(r.error.message);return r.data;};
export function createStaffDirectory(client){
 async function authorize(projectId){
  if(typeof projectId!=='string'||!projectId.trim())throw Error('Copropiedad requerida.');
  const level=checked(await client.auth.mfa.getAuthenticatorAssuranceLevel());
  if(level?.currentLevel!=='aal2')throw Error('Completa MFA antes de consultar el equipo.');
  const {user}=checked(await client.auth.getUser());if(!user)throw Error('Sesión requerida.');
  const memberships=checked(await client.from('memberships').select('project_id').eq('project_id',projectId).eq('user_id',user.id).limit(1));
  if(memberships?.length!==1)throw Error('Copropiedad no autorizada.');
 }
 return {
  async list(projectId){
   await authorize(projectId);
   return checked(await client.from('qa_staff_directory').select('project_id,id,name,role_code,role_label,functions,relationship,photo_path').eq('project_id',projectId).order('name'));
  },
  async photo(projectId,personId){
   await authorize(projectId);
   const row=checked(await client.from('qa_staff_directory').select('photo_path').eq('project_id',projectId).eq('id',personId).single());
   if(!row?.photo_path)throw Error('Fotografía no disponible.');
   const result=checked(await client.storage.from('qa-staff-photos').createSignedUrl(row.photo_path,300));
   if(!result?.signedUrl)throw Error('Fotografía no disponible.');return result.signedUrl;
  }
 };
}
