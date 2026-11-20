// QA Integral: bounded wait for a read-only query. It never retries writes,
// changes authentication, bypasses MFA or fabricates a successful response.
export class QaReadTimeoutError extends Error {
 constructor(){ super('La consulta está tardando más de lo esperado.'); this.name='QaReadTimeoutError'; }
}
export function readWithinDeadline(read,{timeoutMs=12000}={}){
 if(typeof read!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
  throw Error('Parámetros de consulta no válidos.');
 let timer;
 const timeout=new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(new QaReadTimeoutError()),timeoutMs);
 });
 return Promise.race([Promise.resolve().then(read),timeout]).finally(()=>clearTimeout(timer));
}
export function qaMeetingReadFeedback(error){
 return error instanceof QaReadTimeoutError
  ? 'La consulta de reuniones está tardando. Pulsa «Actualizar datos» para reintentar.'
  : 'No se pudieron consultar las reuniones verificadas. Pulsa «Actualizar datos» para reintentar.';
}
