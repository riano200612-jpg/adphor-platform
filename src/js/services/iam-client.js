// Cliente de operador ADPHOR. Nunca contiene claves de servicio ni decide privilegios.
export function createIamClient(auth, request=globalThis.fetch){
 const endpoint='/api/iam';
 async function call(method,payload){
   if(typeof request!=='function')throw Error('No hay transporte IAM disponible.');
   const {data,error}=await auth.getSession();
   if(error||!data?.session?.access_token)throw Error('Inicia sesión para revisar permisos.');
   const options={
     method,
     headers:{Authorization:'Bearer '+data.session.access_token,'Accept':'application/json'},
     // IAM lives behind Cloudflare Access on this same origin. Its HttpOnly
     // Access cookie must accompany the user JWT; never send it cross-origin.
     credentials:'same-origin',redirect:'error',cache:'no-store'
   };
   if(method==='POST'){
     options.headers['Content-Type']='application/json';
     options.body=JSON.stringify(payload);
   }
   let response;
   try{response=await request(endpoint,options);}
   catch{throw Error('No hay conexión con el servicio de usuarios.');}
   let body;
   try{body=await response.json();}catch{body={};}
   if(!response.ok){
     if(response.status===503)throw Error('La gestión de cuentas aún no está habilitada o requiere conciliación.');
     if(response.status===403||response.status===401)throw Error('Tu sesión no tiene permiso administrativo general o le falta MFA.');
     throw Error('No se pudo completar la operación. Comprueba el historial antes de reintentar.');
   }
   return body;
 }
 return {
   read(){return call('GET');},
   command({action,email,name='',assignments=[],reason,requestId,historic_alias=''}){
     const id=requestId || globalThis.crypto?.randomUUID?.();
     if(!id)throw Error('No se pudo generar el identificador de operación segura.');
     return call('POST',{action,email,name,assignments,reason,requestId:id,
       ...(action==='invite'&&historic_alias?{historic_alias}:{})});
   }
 };
}
