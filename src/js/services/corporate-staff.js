const checked = result => {
  if (result?.error) throw new Error(result.error.message || 'Servicio no disponible.');
  return result?.data;
};
const validPersonId = id => typeof id === 'string' && /^delegate-[0-9]+$/.test(id);
const validPhotoPath = path => typeof path === 'string' &&
  /^delegate-[0-9]+\/[a-f0-9]{64}\.(?:jpg|jpeg|png|webp)$/.test(path);

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
  };
}
