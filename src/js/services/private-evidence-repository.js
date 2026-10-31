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
    const result=await api.putCaseEvidence({projectId,caseId,kind,file});
    if(result?.project_id!==projectId||result?.case_id!==caseId||result?.visibility!=='private'||!result?.id)
      throw Error('El servidor no confirmó almacenamiento privado. No se confirmó la carga.');
    results.push({id:result.id,project_id:projectId,case_id:caseId,visibility:'private'});
   }
   return results;
  }
 };
}
