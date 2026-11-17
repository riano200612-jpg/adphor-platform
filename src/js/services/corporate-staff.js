const checked = result => {
  if (result?.error) throw new Error(result.error.message || 'Servicio no disponible.');
  return result?.data;
};
const validPersonId = id => typeof id === 'string' && /^delegate-[0-9]+$/.test(id);
const validPhotoPath = path => typeof path === 'string' &&
  /^delegate-[0-9]+\/[a-f0-9]{64}\.(?:jpg|jpeg|png|webp)$/.test(path);


// These signatures are checked against the real bytes, not a spoofable filename or MIME.
const photoFormat = bytes => {
  if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return {ext:'jpg',mime:'image/jpeg'};
  if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return {ext:'png',mime:'image/png'};
  if (String.fromCharCode(...bytes.slice(0,4))==='RIFF' &&
      String.fromCharCode(...bytes.slice(8,12))==='WEBP')
    return {ext:'webp',mime:'image/webp'};
  return null;
};
const hex = bytes => [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');

export function createCorporateStaff(client) {
  async function ensureAal2() {
    const assurance = checked(await client.auth.mfa.getAuthenticatorAssuranceLevel());
    if (assurance?.currentLevel !== 'aal2')
      throw new Error('Completa MFA AAL2 para consultar el equipo corporativo.');
    const identity = checked(await client.auth.getUser());
    if (!identity?.user?.id) throw new Error('Sesión corporativa requerida.');
    return identity.user.id;
  }
  return {
    async list() {
      await ensureAal2();
      const people = checked(await client.rpc('qa_carousel_directory'));
      if (!Array.isArray(people)) throw new Error('El directorio no respondió correctamente.');
      return people;
    },
    async canManage() {
      await ensureAal2();
      return checked(await client.rpc('qa_carousel_can_manage')) === true;
    },
    async setVisible(id, visible) {
      if (!validPersonId(id) || typeof visible !== 'boolean')
        throw new Error('Colaborador o estado inválidos.');
      await ensureAal2();
      const result = checked(await client.rpc('qa_carousel_set_visibility', {
        p_staff_id: id, p_visible: visible,
      }));
      if (result !== visible) throw new Error('La actualización no fue confirmada.');
      return result;
    },
    async history() {
      await ensureAal2();
      const rows = checked(await client.rpc('qa_carousel_history'));
      if (!Array.isArray(rows)) throw new Error('No se pudo cargar el historial.');
      return rows;
    },
    async photo(path) {
      if (!validPhotoPath(path)) throw new Error('Ruta de fotografía inválida.');
      await ensureAal2();
      const data = checked(await client.storage.from('qa-staff-photos').createSignedUrl(path, 300));
      if (!data?.signedUrl) throw new Error('Fotografía privada no disponible.');
      return data.signedUrl;
    },
    async uploadPhoto(id, file) {
      if (!validPersonId(id) || !file || typeof file.arrayBuffer!=='function' ||
          !Number.isFinite(file.size) || file.size<12 || file.size>10485760)
        throw new Error('Selecciona una imagen válida de hasta 10 MB.');
      await ensureAal2();
      if (checked(await client.rpc('qa_carousel_can_manage'))!==true)
        throw new Error('Solo un administrador corporativo puede importar fotos.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const format=photoFormat(bytes);
      if (!format || (file.type && file.type!==format.mime))
        throw new Error('Solo se admiten imágenes JPEG, PNG o WebP auténticas.');
      const sha=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
      const path=id+'/'+sha+'.'+format.ext;
      const stored=await client.storage.from('qa-staff-photos').upload(path,file,{
        contentType:format.mime,cacheControl:'300',upsert:false,
      });
      // Retry after an interrupted finalization; never overwrite an object.
      if (stored?.error && !/already.exists|duplicate/i.test(stored.error.message||''))
        throw new Error('No se pudo cargar la fotografía al almacenamiento privado.');
      const saved=checked(await client.rpc('qa_carousel_attach_photo',{
        p_staff_id:id,p_sha256:sha,p_extension:format.ext,
      }));
      if (saved!==path) throw new Error('La asociación privada no fue confirmada.');
      return path;
    },
  };
}
