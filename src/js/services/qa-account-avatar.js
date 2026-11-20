import {QA_INTEGRAL_HOST,QA_URL} from './qa-auth-policy.js';

export const ACCOUNT_AVATAR_BUCKET='qa-account-avatars';
export const ACCOUNT_AVATAR_MAX_BYTES=1048576;
export const ACCOUNT_AVATAR_INPUT_MAX_BYTES=5242880;
const corporatePath=/^delegate-[0-9]+\/[a-f0-9]{64}\.(?:jpg|jpeg|png|webp)$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function accountAvatarEnabled({url,hostname}){
  return url===QA_URL&&hostname===QA_INTEGRAL_HOST;
}
export function accountAvatarPath(id){
  if(typeof id!=='string'||!uuid.test(id))throw Error('Identificador de usuario no válido.');
  return id.toLowerCase()+'/avatar.webp';
}
export function validateAvatarInput(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||
     !Number.isInteger(file.size)||file.size<1||file.size>ACCOUNT_AVATAR_INPUT_MAX_BYTES)
    throw Error('Elige una foto JPG, PNG o WebP de máximo 5 MB.');
  return true;
}
export function validateWebpAvatar(blob){
  if(!blob||blob.type!=='image/webp'||!Number.isInteger(blob.size)||
     blob.size<1||blob.size>ACCOUNT_AVATAR_MAX_BYTES)
    throw Error('No se pudo preparar una foto WebP válida de máximo 1 MB.');
  return true;
}
export function createQaAccountAvatarRepository(client,{url,hostname,getActor}){
  if(!accountAvatarEnabled({url,hostname}))return null;
  if(typeof getActor!=='function')throw Error('Falta el contexto de la cuenta.');
  async function verifiedPath(id){
    const path=accountAvatarPath(id);
    if(getActor()?.id!==id)throw Error('La sesión de esta fotografía ya no es válida.');
    const remote=await client.auth.getUser();
    if(remote.error||remote.data?.user?.id!==id||getActor()?.id!==id)
      throw Error('No se pudo confirmar la identidad de tu sesión.');
    const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assurance.error||assurance.data?.currentLevel!=='aal2'||getActor()?.id!==id)
      throw Error('Verifica tu sesión MFA para usar tu foto.');
    return path;
  }
  return {
    // AAL2-only, self-scoped fallback to an already approved staff photo.
    // The server chooses the user-to-staff binding; the caller cannot supply a staff id.
    async staffPreview(id){
      await verifiedPath(id);
      const {data:path,error}=await client.rpc('qa_my_corporate_avatar_path');
      if(error||typeof path!=='string'||!corporatePath.test(path))return null;
      const signed=await client.storage.from('qa-staff-photos').createSignedUrl(path,300);
      if(signed.error||typeof signed.data?.signedUrl!=='string')return null;
      return signed.data.signedUrl;
    },
    async read(id){
      const path=await verifiedPath(id);
      const {data,error}=await client.storage.from(ACCOUNT_AVATAR_BUCKET).download(path);
      if(error){
        if(String(error.statusCode??error.status??'')==='404'||/not found/i.test(String(error.message)))return null;
        throw Error('No fue posible consultar tu fotografía privada.');
      }
      validateWebpAvatar(data);
      return data;
    },
    async upload(id,blob){
      validateWebpAvatar(blob);
      const path=await verifiedPath(id);
      const {error}=await client.storage.from(ACCOUNT_AVATAR_BUCKET).upload(path,blob,{
        upsert:true,contentType:'image/webp',cacheControl:'0'
      });
      if(error)throw Error('No se pudo guardar tu foto. Verifica tu sesión e inténtalo nuevamente.');
      return path;
    },
    async remove(id){
      const path=await verifiedPath(id);
      const {error}=await client.storage.from(ACCOUNT_AVATAR_BUCKET).remove([path]);
      if(error)throw Error('No se pudo quitar tu foto de perfil.');
    }
  };
}
