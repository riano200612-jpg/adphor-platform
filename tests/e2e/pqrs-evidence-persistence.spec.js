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


test('GAUNTLET: browser retires the private signed link before its 90-second server TTL and can issue another',async({page})=>{
 await page.goto('./');
 await page.clock.install();
 await page.evaluate(async()=>{
  const {mountPqrs}=await import('/adphor-platform/src/js/ui-pqrs.js');
  document.body.replaceChildren();
  const root=document.createElement('main');
  document.body.append(root);
  window.qaSignedReissues=0;
  const caseId='13ae039e-99ca-4f17-ab41-75a401f0d0ee';
  mountPqrs(root,{projectId:'qa-p',role:'admin',members:[],repository:{
   list:async()=>[{id:caseId,project_id:'qa-p',subject:'Evidencia temporal',
     description:'Prueba sintética',status:'open',priority:'medio',version:1}],
   listEvidence:async()=>[{id:'c8709acb-9e96-8dfa-b3d1-53f42528315b',
      project_id:'qa-p',case_id:caseId,media_type:'image/png',file_bytes:1280,
      created_at:'2026-11-20T14:00:00Z'}],
   signedEvidence:async()=>{
    window.qaSignedReissues++;
    return 'https://qfctnnnnltghepwujpdm.supabase.co/storage/v1/object/sign/qa-case-evidence/synthetic?token=synthetic'+window.qaSignedReissues;
   }
  }});
 });
 const card=page.locator('.pqrs-cases article').first();
 await card.getByRole('button',{name:'Consultar evidencias privadas'}).click();
 const prepare=card.getByRole('button',{name:/Preparar enlace privado/});
 await prepare.click();
 await expect(card.locator('a[data-private-url]')).toHaveCount(1);
 await page.clock.fastForward(40000);
 await prepare.click();
 await expect(card.locator('a[data-private-url]')).toHaveCount(1);
 await expect(card.locator('a[data-private-url]')).toHaveAttribute('href',/synthetic2/);
 // The first URL's timer must not retire the newer replacement link.
 await page.clock.fastForward(40001);
 await expect(card.locator('a[data-private-url]')).toHaveCount(1);
 await page.clock.fastForward(40001);
 await expect(card.locator('a[data-private-url]')).toHaveCount(0);
 await expect(card.locator('[data-private-expired]')).toContainText('retirado por seguridad');
 await prepare.click();
 await expect(card.locator('a[data-private-url]')).toHaveAttribute('href',/synthetic3/);
 await expect(card.locator('[data-private-expired]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.qaSignedReissues)).toBe(3);
});
