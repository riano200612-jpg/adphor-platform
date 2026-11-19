import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const owner='11111111-1111-4111-8111-111111111111';
async function demo(page){
 await page.goto('./');
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await expect(page.locator('.topbar .user-chip .avatar')).toBeVisible();
}
async function inject(page,initialPhoto=false){
 await page.evaluate(async({owner,initialPhoto})=>{
  const {mountQaAccountAvatar}=await import('/adphor-platform/src/js/ui-qa-user-avatar.js');
  const c=document.createElement('canvas');
  c.width=2;c.height=2;c.getContext('2d').fillRect(0,0,2,2);
  const photo=await new Promise(resolve=>c.toBlob(resolve,'image/webp',.84));
  window.__qaAvatarFixture={photo:initialPhoto?photo:null};
  const store={
   read:async id=>id===owner?window.__qaAvatarFixture.photo:null,
   upload:async(id,b)=>{if(id!==owner)throw Error('Different account');window.__qaAvatarFixture.photo=b;},
   remove:async id=>{if(id!==owner)throw Error('Different account');window.__qaAvatarFixture.photo=null;}
  };
  window.__qaAvatarCleanup=mountQaAccountAvatar(document.querySelector('.topbar .user-chip'),
    {store,userId:owner});
 },{owner,initialPhoto});
}
test('Default initials and account avatar menu, with WCAG audit',async({page})=>{
 await demo(page);
 await inject(page);
 const avatar=page.getByRole('button',{name:'Foto de mi perfil. Abrir opciones'});
 await expect(avatar).toBeVisible();
 await expect(avatar.locator('img')).toHaveCount(0);
 await avatar.click();
 await expect(page.getByText('Mi fotografía')).toBeVisible();
 await expect(page.getByText(/Aún no tienes foto guardada/)).toBeVisible();
 await expect(avatar).toHaveAttribute('data-photo-state','empty');
 await expect(avatar).toHaveAttribute('title','Agregar mi foto de perfil');
 await expect(page.getByRole('button',{name:'Quitar foto'})).toBeDisabled();
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
test('Upload personal synthetic image, show it in place of JR and remove it',async({page})=>{
 test.setTimeout(90000); // CI image conversion can exceed the generic 30s E2E timeout
 await demo(page);
 await inject(page);
 const avatar=page.getByRole('button',{name:'Foto de mi perfil. Abrir opciones'});
 const initials=(await avatar.textContent()).trim();
 await avatar.click();
 const validPng=Buffer.from(await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=12;canvas.height=12;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#387aa8';ctx.fillRect(0,0,12,12);
  return canvas.toDataURL('image/png').split(',')[1];
 }), 'base64');
 await page.locator('.qa-avatar-file').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:validPng});
 await expect(page.getByText('Tu foto se actualizó correctamente.')).toBeVisible();
 await expect(avatar.locator('img')).toHaveCount(1);
 await expect(avatar).toHaveAttribute('data-photo-state','ready');
 await expect(avatar).toHaveAttribute('title','Ver o cambiar mi foto de perfil');
 await expect(avatar.locator('img')).toHaveCSS('object-fit','cover');
 await page.getByRole('button',{name:'Quitar foto'}).click();
 await expect(avatar.locator('img')).toHaveCount(0);
 await expect(avatar).toHaveText(initials);
 await expect(avatar).toHaveAttribute('data-photo-state','empty');
 await expect(page.getByText('Foto retirada. Se muestran tus iniciales.')).toBeVisible();
});
test('Avatar of another user is never shown during change of account',async({page})=>{
 await demo(page);
 await inject(page,true);
 await expect(page.locator('.qa-avatar-trigger img')).toHaveCount(1);
 await page.evaluate(async()=>{
   window.__qaAvatarCleanup();
   const host=document.querySelector('.topbar .user-chip');
   const old=host.querySelector('.qa-avatar-trigger');
   const placeholder=document.createElement('span');placeholder.className='avatar';placeholder.textContent='OT';
   old.replaceWith(placeholder);
   const {mountQaAccountAvatar}=await import('/adphor-platform/src/js/ui-qa-user-avatar.js');
   mountQaAccountAvatar(host,{store:{read:async()=>null,upload:async()=>{},remove:async()=>{}},
     userId:'22222222-2222-4222-8222-222222222222'});
 });
 await expect(page.locator('.qa-avatar-trigger')).toHaveText('OT');
 await expect(page.locator('.qa-avatar-trigger img')).toHaveCount(0);
});


test('A saved photo reappears on the next authenticated shell mount without exposing other profiles',async({page})=>{
 await demo(page);
 await inject(page,true);
 const avatar=page.locator('.qa-avatar-trigger');
 await expect(avatar.locator('img')).toHaveCount(1);
 await expect(avatar).toHaveAttribute('data-photo-state','ready');
 await page.evaluate(async({owner})=>{
   window.__qaAvatarCleanup();
   const host=document.querySelector('.topbar .user-chip');
   const old=host.querySelector('.qa-avatar-trigger');
   const initials=document.createElement('span');
   initials.className='avatar';initials.textContent='JR';
   old.replaceWith(initials);
   const {mountQaAccountAvatar}=await import('/adphor-platform/src/js/ui-qa-user-avatar.js');
   window.__qaAvatarCleanup=mountQaAccountAvatar(host,{
      userId:owner,
      store:{
        read:async id=>id===owner?window.__qaAvatarFixture.photo:null,
        upload:async()=>{throw Error('Not needed')},
        remove:async()=>{throw Error('Not needed')}
      }
   });
 },{owner});
 await expect(page.locator('.qa-avatar-trigger img')).toHaveCount(1);
 await expect(page.locator('.qa-avatar-trigger')).toHaveAttribute('data-photo-state','ready');
 await expect(page.locator('.qa-avatar-trigger')).toHaveAttribute('title','Ver o cambiar mi foto de perfil');
});
