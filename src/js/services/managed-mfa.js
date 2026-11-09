// Managed TOTP: enrollment secrets stay in the current UI only; no storage or resets.
export function createManagedMfa(auth, {required=false,allowEnrollment=false}={}) {
  let pending=null, checking=false;
  const read=result=>{if(result.error)throw Error('No se pudo verificar la autenticación.');return result.data;};
  return {
    clear(){pending=null;},
    async begin(userId){
      pending=null;
      const data=read(await auth.mfa.listFactors());
      const factors=(data.all || []).filter(f=>f.status==='verified');
      if(!factors.length){
        if(required && allowEnrollment){pending={userId,factorId:null};return true;}
        if(required)throw Error('El acceso requiere MFA. Solicita al administrador registrar un factor antes de continuar.');
        return false;
      }
      const factor=factors.find(f=>f.factor_type==='totp');
      if(!factor)throw Error('El factor configurado requiere un método de acceso compatible.');
      pending={userId,factorId:factor.id};return true;
    },
    needsEnrollment(){return Boolean(pending && !pending.factorId);},
    async enroll(){
      if(!allowEnrollment || !pending || pending.factorId || checking)throw Error('Inicia una nueva verificación.');
      checking=true;
      const enrollmentContext=pending;
      try {
        const current=read(await auth.getUser());
        if(current.user?.id!==pending.userId){pending=null;throw Error('La sesión cambió. Vuelve a ingresar.');}
        const factor=read(await auth.mfa.enroll({factorType:'totp',friendlyName:`ADPHOR QA ${Date.now()}`}));
        if(!factor.id || !factor.totp?.qr_code || !factor.totp?.secret)throw Error('No se pudo iniciar el registro del autenticador.');
        if(pending!==enrollmentContext)throw Error('La sesión cambió. Vuelve a ingresar.');
        pending.factorId=factor.id;
        return {qrCode:factor.totp.qr_code,secret:factor.totp.secret};
      } finally {checking=false;}
    },
    async complete(code){
      if(!pending?.factorId || checking)throw Error('Inicia una nueva verificación.');
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
