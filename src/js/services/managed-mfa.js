// Managed TOTP only: no generation, storage, logging, enrollment or account resets.
export function createManagedMfa(auth) {
  let pending=null, checking=false;
  const read=result=>{if(result.error)throw Error('No se pudo verificar la autenticación.');return result.data;};
  return {
    clear(){pending=null;},
    async begin(userId){
      pending=null;
      const data=read(await auth.mfa.listFactors());
      const factors=(data.all || []).filter(f=>f.status==='verified');
      if(!factors.length)return false;
      const factor=factors.find(f=>f.factor_type==='totp');
      if(!factor)throw Error('El factor configurado requiere un método de acceso compatible.');
      pending={userId,factorId:factor.id};return true;
    },
    async complete(code){
      if(!pending || checking)throw Error('Inicia una nueva verificación.');
      if(typeof code!=='string' || !/^\d{6}$/.test(code))throw Error('Ingresa los seis dígitos del autenticador.');
      checking=true;
      try {
        const current=read(await auth.getUser());
        if(current.user?.id!==pending.userId) {pending=null;throw Error('La sesión cambió. Vuelve a ingresar.');}
        read(await auth.mfa.challengeAndVerify({factorId:pending.factorId,code}));
        const assurance=read(await auth.mfa.getAuthenticatorAssuranceLevel());
        if(assurance.currentLevel!=='aal2')throw Error('La verificación adicional no se completó.');
        const id=pending.userId;pending=null;return id;
      } finally {checking=false;}
    }
  };
}
