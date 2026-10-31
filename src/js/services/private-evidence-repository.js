// QA-only adapter: caller supplies an authenticated server-side evidence API.
// This module must never expose storage credentials or public object URLs.
export function createPrivateEvidenceRepository(api) {
 if(typeof api?.putCaseEvidence!=='function')throw Error('API privada de evidencias no disponible');
 return {
  async uploadEvidence({projectId,caseId,kind,files}) {
   if(!projectId||!caseId||!['pqrs','recorridos'].includes(kind))throw Error('Caso inválido');
   if(!Array.isArray(files)||!files.length)throw Error('Archivos requeridos');
   const results=[];
   for(const file of files) {
    let result;
    try {
      result=await api.putCaseEvidence({projectId,caseId,kind,file});
    } catch {
      throw Error('Carga interrumpida: '+results.length+' de '+files.length+' archivos confirmados. Revisa las evidencias del caso antes de reintentar.');
    }
    if(result?.project_id!==projectId||result?.case_id!==caseId||result?.visibility!=='private'||!result?.id)
      throw Error('Confirmación inválida: '+results.length+' de '+files.length+' archivos confirmados. Verifica el historial antes de reintentar.');
    results.push({id:result.id,project_id:projectId,case_id:caseId,visibility:'private'});
   }
   return results;
  }
 };
}
