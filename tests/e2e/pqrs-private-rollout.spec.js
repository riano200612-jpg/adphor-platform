import {test,expect} from '@playwright/test';

test('a private PQRS file is linked only after receipt; retry preserves one case and one file',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
  window.qaRollout={creates:0,uploads:0,records:[]};
  const caseId='302b7970-1365-4f5c-b195-7d2041e99bed';
  const fileId='fdeee31a-ccaf-44ef-8a3a-48aac909a4ac';
  window.qaRepo={
   localDemo:true,
   async list(){return window.qaRollout.records;},
   async create(projectId,payload){
     window.qaRollout.creates++;
     const row={id:caseId,project_id:projectId,subject:payload.subject,
       description:payload.description,status:'open',priority:'medio',version:1};
     window.qaRollout.records=[row];return row;
   },
   async uploadEvidence({caseId:id,files}){
     if(id!==caseId||files.length!==1)throw Error('Unexpected case/file');
     window.qaRollout.uploads++;
     if(window.qaRollout.uploads===1)throw Error('Conexión interrumpida');
     return [{id:fileId,storage_written:true,metadata_linked:true,visibility:'private'}];
   },
   async listEvidence(projectId,id){
     if(id!==caseId)throw Error('Unexpected identity');
     return [{id:fileId,project_id:projectId,case_id:id,media_type:'application/pdf',file_bytes:256}];
   },
   async signedEvidence(){
     return 'https://qfctnnnnltghepwujpdm.supabase.co/storage/v1/object/sign/qa-case-evidence/synthetic?token=qa';
   },
   async history(){return [];},async responses(){return [];}
  };
  const root=document.createElement('main');root.id='qa-evidence-rollout';document.body.append(root);
  mountPqrs(root,{projectId:'qa-evidence',projectName:'Copropiedad QA',role:'admin',members:[],repository:window.qaRepo});
 });
 const root=page.locator('#qa-evidence-rollout');
 await expect(root.locator('[name=evidence]')).toBeEnabled();
 await root.locator('[name=subject]').fill('Evidencia privada de prueba');
 await root.locator('[name=description]').fill('Documento sintético para verificar reintentos.');
 await root.locator('[name=evidence]').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 test synthetic')});
 await root.getByRole('button',{name:'Enviar solicitud PQRS'}).click();
 await expect(root.locator('.pqrs-message')).toContainText('Evidencias incompletas');
 await expect(root.locator('[name=subject]')).toBeDisabled();
 await root.getByRole('button',{name:'Enviar solicitud PQRS'}).click();
 await expect(root.locator('.pqrs-message')).toContainText('Radicado: 302b7970');
 const counters=await page.evaluate(()=>({creates:window.qaRollout.creates,uploads:window.qaRollout.uploads}));
 expect(counters).toEqual({creates:1,uploads:2});
 await page.evaluate(()=>{
   const root=document.querySelector('#qa-evidence-rollout');
   root.replaceChildren();
   const {qaRepo}=window;
   // Remount using a function attached in the initial fixture.
   return import('/adphor-platform/src/js/ui-pqrs.js').then(({mountPqrs})=>
     mountPqrs(root,{projectId:'qa-evidence',projectName:'Copropiedad QA',role:'admin',members:[],repository:qaRepo}));
 });
 await expect(root.locator('.pqrs-cases')).toContainText('Evidencia privada de prueba');
 const evidence=root.getByRole('button',{name:'Consultar evidencias privadas'});
 await evidence.click();
 await expect(root.locator('[data-pqrs-stored-evidence]')).toContainText('application/pdf');
 await expect(root.locator('a[data-private-url]')).toHaveCount(0);
 await root.getByRole('button',{name:/Preparar enlace privado/}).click();
 await expect(root.getByRole('link',{name:'Abrir archivo privado'}))
  .toHaveAttribute('href',/^https:\/\/qfctnnnnltghepwujpdm.supabase.co\/storage\/v1\/object\/sign\/qa-case-evidence\//);
});
