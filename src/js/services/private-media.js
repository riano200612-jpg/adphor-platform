import { companionCandidates } from './client-companion-catalog.js';
import { propertyPhotoPath, signedPropertyPhoto } from './property-photos.js';

const checked=result=>{if(result.error)throw Error(result.error.message);return result.data;};
// Called only by the isolated-QA gate in supabase.js. RLS remains authoritative.
export function createPrivateMediaRepository(client) {
 async function authorize(projectId){
  const {user}=checked(await client.auth.getUser());
  if(!user)throw Error('Sesión necesaria.');
  const rows=checked(await client.from('memberships').select('project_id').eq('project_id',projectId).eq('user_id',user.id).limit(1));
  if(rows?.length!==1)throw Error('Copropiedad no autorizada.');
 }
 return {
  async projectPhotos(projects){
   const ids=projects.map(p=>p.id);
   if(!ids.length)return [];
   return checked(await client.from('qa_property_photos').select('project_id,filename').in('project_id',ids).eq('approved',true));
  },
  async propertyPhoto(projectId,filename){
   await authorize(projectId);
   propertyPhotoPath(projectId,filename);
   const rows=checked(await client.from('qa_property_photos').select('filename').eq('project_id',projectId).eq('filename',filename).eq('approved',true).limit(1));
   if(rows?.length!==1)throw Error('Fotografía no aprobada.');
   return signedPropertyPhoto(client.storage,[{id:projectId}],projectId,filename);
  },
  async companions(projectId,sector){
   await authorize(projectId);
   const rows=checked(await client.from('qa_project_companions').select('id,name,role,role_label,photo_filename').eq('project_id',projectId).eq('approved',true));
   return companionCandidates(rows.map(r=>({...r,roleLabel:r.role_label,photoStoragePath:r.photo_filename?propertyPhotoPath(projectId,r.photo_filename):null})),sector);
  },
  async companionPhoto(projectId,personId){
   await authorize(projectId);
   const rows=checked(await client.from('qa_project_companions').select('photo_filename').eq('project_id',projectId).eq('id',personId).eq('approved',true).limit(1));
   if(rows?.length!==1||!rows[0].photo_filename)throw Error('Fotografía no aprobada.');
   const path=propertyPhotoPath(projectId,rows[0].photo_filename);
   const data=checked(await client.storage.from('staff-photos').createSignedUrl(path,300));
   if(!data?.signedUrl)throw Error('No se recibió una URL firmada.');
   return data.signedUrl;
  }
 };
}
