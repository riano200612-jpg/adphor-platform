const QA_REF = 'qfctnnnnltghepwujpdm';
const QA_ALIAS = 'qa-pqrs-carrusel-integracion.adphor-platform.pages.dev';

// Recovery never loads a profile, tenant data or an operational session.
export function readQaRecovery(location, history, supabaseUrl) {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const present = hash.has('access_token') || hash.has('refresh_token') || hash.has('error') || hash.get('type') === 'recovery' || query.has('code');
  if (!present) return null;
  // Remove credentials before any asynchronous work or UI interaction.
  history.replaceState(null, '', location.pathname);
  const allowedHost = location.hostname === QA_ALIAS || /^[a-f0-9]{8}\.adphor-platform\.pages\.dev$/.test(location.hostname);
  if (location.protocol !== 'https:' || !allowedHost || supabaseUrl !== `https://${QA_REF}.supabase.co`) {
    return {error: 'La recuperación solo está disponible en ADPHOR QA autorizado.'};
  }
  if (hash.has('error')) return {error: 'El enlace es inválido o ha expirado. Solicita un nuevo correo de recuperación.'};
  if (hash.get('type') !== 'recovery' || !hash.get('access_token') || !hash.get('refresh_token')) {
    return {error: 'El enlace no contiene una recuperación válida. Solicita un nuevo correo desde Supabase QA.'};
  }
  return {access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token')};
}

export async function createPasswordRecovery(auth, credentials) {
  let ready = false;
  const {error} = await auth.setSession(credentials);
  if (error) throw new Error('El enlace es inválido o ha expirado. Solicita un nuevo correo de recuperación.');
  const checked = await auth.getUser();
  if (checked.error || !checked.data?.user) {
    await auth.signOut({scope: 'local'});
    throw new Error('No se pudo verificar el enlace de recuperación.');
  }
  ready = true;
  return {
    async update(password, confirmation) {
      if (!ready) throw new Error('Solicita un nuevo enlace de recuperación.');
      if (password.length < 12) throw new Error('Usa al menos 12 caracteres.');
      if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
      const result = await auth.updateUser({password});
      if (result.error) throw new Error('No se pudo guardar la contraseña. Comprueba la política de contraseñas o solicita un enlace nuevo.');
      ready = false;
      const signedOut = await auth.signOut({scope: 'local'});
      return {signedOut: !signedOut.error};
    },
    async cancel() { ready = false; await auth.signOut({scope: 'local'}); },
  };
}
