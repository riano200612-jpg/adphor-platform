// A photo can be requested only for a project already present in the
// authenticated user's RLS-filtered portfolio. The Storage bucket is private.
// This module never accepts a public Drive link or a raw browser-supplied URL.
export const PROPERTY_PHOTO_BUCKET='property-photos';
const safeId=/^[a-z0-9-]+$/;
const safeFilename=/^[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

export function propertyPhotoPath(projectId,filename){
 if(!safeId.test(String(projectId??'')))throw new Error('ID de copropiedad inválido');
 if(!safeFilename.test(String(filename??'')))throw new Error('Nombre de fotografía inválido');
 return `${projectId}/${filename}`;
}

export async function signedPropertyPhoto(storage,authorizedProjects,projectId,filename){
 if(!Array.isArray(authorizedProjects)||!authorizedProjects.some(p=>p.id===projectId)){
  throw new Error('La copropiedad no está en el portafolio autorizado');
 }
 const path=propertyPhotoPath(projectId,filename);
 const {data,error}=await storage.from(PROPERTY_PHOTO_BUCKET).createSignedUrl(path,300);
 if(error)throw new Error('No se pudo obtener la fotografía privada');
 if(!data?.signedUrl)throw new Error('No se recibió una URL firmada');
 return data.signedUrl;
}
