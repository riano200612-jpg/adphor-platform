import {createManagedMfa} from './managed-mfa.js';

export function createCloudAuthentication(client, {required, allowEnrollment, allowDemoAlias=false}) {
  const auth = client.auth;
  const mfa = createManagedMfa(auth, {required, allowEnrollment});
  const read = result => {if(result.error) throw Error(result.error.message); return result.data;};
  async function finish(id) {
    // A second check at the protected read boundary also covers SDK/session drift.
    if (required) {
      const level = read(await auth.mfa.getAuthenticatorAssuranceLevel());
      if (level?.currentLevel !== 'aal2') throw Error('Completa la verificación MFA antes de acceder al perfil.');
      const current = read(await auth.getUser());
      if (current.user?.id !== id) throw Error('La sesión cambió. Vuelve a ingresar.');
    }
    const result = await client.from('profiles').select('name').eq('id',id).single();
    if (result.error || !result.data?.name) {
      throw Error('No se pudo acceder al perfil autorizado. Contacta al administrador de QA.');
    }
    return {id, name:result.data.name};
  }
  async function resetAfterFailure() {
    mfa.clear();
    try {await auth.signOut();} catch { /* Preserve the original verification error. */ }
  }
  return {
    async login({email,password}) {
      mfa.clear();
      // The demo alias is opt-in and never applies when MFA is mandatory (known QA).
      // Otherwise 'adphor' is sent as typed and Supabase rejects it as an invalid login.
      const loginEmail = allowDemoAlias && !required && email.trim().toLowerCase() === 'adphor'
        ? 'demo-adphor@example.invalid' : email.trim();
      const data = read(await auth.signInWithPassword({email:loginEmail,password}));
      try {
        if(await mfa.begin(data.user.id)) return {mfaRequired:true,enrollmentRequired:mfa.needsEnrollment()};
        return await finish(data.user.id);
      } catch(error) {await resetAfterFailure(); throw error;}
    },
    enrollMfa(){return mfa.enroll();},
    async completeMfa(code){return finish(await mfa.complete(code));},
    async logout(){mfa.clear();read(await auth.signOut());},
  };
}
