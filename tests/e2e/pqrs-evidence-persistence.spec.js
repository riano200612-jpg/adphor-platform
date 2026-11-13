import {test,expect} from '@playwright/test';
test('PQRS shows stored QA evidence after remount and only creates a short-lived private link on request',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
  const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
  window.qaEvidenceListCalls=0;window.qaSignedCalls=0;
  window.qaCaseRepo={
   list:async()=>[{id:'13ae039e-99ca-4f17-ab41-75a401f0d0ee',project_id:'qa-p',subject:'PQRS privada',
      description:'Con evidencias persistentes',status:'open',priority:'medio',version:1}],
   history:async()=>[],responses:async()=>[],
   listEvidence:async()=>{window.qaEvidenceListCalls++;return [{id:'c8709acb-9e96-8dfa-b3d1-53f42528315b',
       project_id:'qa-p',case_id:'13ae039e-99ca-4f17-ab41-75a401f0d0ee',media_type:'application/pdf',
       file_bytes:1234,created_at:'2026-11-13T10:00:00Z'}];},
   signedEvidence:async()=>{window.qaSignedCalls++;return 'https://qfctnnnnltghepwujpdm.supabase.co/storage/v1/object/sign/qa-case-evidence/qa-p/pqrs/test?token=synthetic';}
  };
  window.qaRemount=()=>{document.body.innerHTML='<main id="qa-pqrs-fixture"></main>';mountPqrs(document.querySelector('main'),{repository:window.qaCaseRepo,projectId:'qa-p',role:'admin',members:[]});};
  window.qaRemount();
 });
 const card=page.locator('.pqrs-cases article').first();
 await expect(card).toContainText('PQRS privada');
 await page.evaluate(()=>window.qaRemount());
 const second=page.locator('.pqrs-cases article').first();
 await expect(second).toContainText('PQRS privada');
 const evidence=second.getByRole('button',{name:'Consultar evidencias privadas'});
 await evidence.click();
 await expect(second.locator('[data-pqrs-stored-evidence]')).toContainText('application/pdf');
 await expect(second.locator('a[data-private-url]')).toHaveCount(0);
 await second.getByRole('button',{name:/Preparar enlace privado/}).click();
 const link=second.getByRole('link',{name:'Abrir archivo privado'});
 await expect(link).toHaveAttribute('rel','noopener noreferrer');
 await expect(link).toHaveAttribute('href',/^https:\/\/qfctnnnnltghepwujpdm.supabase.co\/storage\/v1\/object\/sign\/qa-case-evidence/);
 expect(await page.evaluate(()=>window.qaEvidenceListCalls)).toBe(1);
 expect(await page.evaluate(()=>window.qaSignedCalls)).toBe(1);
});
