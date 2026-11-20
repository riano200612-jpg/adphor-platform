import {test,expect} from '@playwright/test';

const mount = async(page,admin=true)=>{
 await page.goto('./');
 await page.evaluate(async(admin)=>{
   const {mountCorporateStaff}=await import('/adphor-platform/src/js/ui-corporate-staff.js');
   const person=[
    {id:'delegate-1',name:'Persona Gerencia QA',role_label:'Gerente General',department:'Gerencia',carousel_visible:true,assigned_properties:0,functions:[],photo_path:null},
    {id:'delegate-2',name:'Persona Tecnología QA',role_label:'Auxiliar de Tecnología',department:'Tecnología',carousel_visible:true,assigned_properties:4,functions:[],photo_path:null},
    {id:'delegate-3',name:'Persona Oculta QA',role_label:'Delegado',department:'Delegados',carousel_visible:false,assigned_properties:1,functions:[],photo_path:null},
   ];
   window.rosterPeople=person;
   const repo={
    corporateStaffDirectory:async()=>admin?person:person.filter(p=>p.carousel_visible),
    corporateStaffCanManage:async()=>admin,
    corporateStaffSetVisible:async(id,v)=>v,
    corporateStaffPhoto:async()=>{throw Error('No photo');},
    corporateStaffHistory:async()=>[],
   };
   window.remountRoster=()=>mountCorporateStaff(document.querySelector('main'),{repo});
   document.body.replaceChildren();
   const root=document.createElement('main');document.body.append(root);
   await mountCorporateStaff(root,{repo});
 },admin);
};
test('corporate carousel includes unassigned staff, filters areas and accents, and works on mobile',async({page})=>{
 await mount(page);
 await expect(page.getByRole('heading',{name:'Equipo corporativo ADPHOR'})).toBeVisible();
 await expect(page.getByRole('listitem')).toHaveCount(3);
 await expect(page.getByText('Sin copropiedad asignada')).toBeVisible();
 await page.getByLabel('Filtrar por área').selectOption('Tecnología');
 await expect(page.getByRole('listitem').filter({visible:true})).toHaveCount(1);
 await page.getByLabel('Buscar por nombre o cargo').fill('tecnologia');
 await expect(page.getByRole('listitem').filter({visible:true})).toHaveCount(1);
 await page.getByLabel('Buscar por nombre o cargo').fill('gerencia');
 await expect(page.getByRole('listitem').filter({visible:true})).toHaveCount(0);
 await page.getByLabel('Filtrar por área').selectOption('');
 await expect(page.getByRole('listitem').filter({visible:true})).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('corporate admin changes visibility, reads server confirmation and retains choice on remount',async({page})=>{
 await mount(page);
 await page.getByRole('button',{name:'Ocultar del carrusel a Persona Tecnología QA'}).click();
 await expect(page.getByRole('button',{name:'Mostrar del carrusel a Persona Tecnología QA'})).toBeVisible();
 await expect(page.getByText('Cambio guardado.')).toBeVisible();
 await page.evaluate(()=>window.remountRoster());
 await expect(page.getByRole('button',{name:'Mostrar del carrusel a Persona Tecnología QA'})).toBeVisible();
 await page.getByRole('button',{name:'Mostrar del carrusel a Persona Tecnología QA'}).click();
 await expect(page.getByRole('button',{name:'Ocultar del carrusel a Persona Tecnología QA'})).toBeVisible();
});
test('corporate read-only user cannot see hidden people or switch controls',async({page})=>{
 await mount(page,false);
 await expect(page.getByRole('listitem')).toHaveCount(2);
 await expect(page.locator('.staff-company-toggle')).toHaveCount(0);
 await expect(page.getByText('Persona Oculta QA')).toHaveCount(0);
});

test('private portrait loads on mobile and replaces initials rather than getting stuck lazy-loading',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountCorporateStaff}=await import('/adphor-platform/src/js/ui-corporate-staff.js');
   const root=document.createElement('main');
   document.body.replaceChildren(root);
   const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#aaa"/></svg>');
   await mountCorporateStaff(root,{repo:{
     corporateStaffDirectory:async()=>[{id:'delegate-32',name:'Claudia Zúñiga',role_label:'Coordinador Zona Norte',
       department:'Coordinación',carousel_visible:true,assigned_properties:10,functions:[],
       photo_path:'delegate-32/'+'a'.repeat(64)+'.jpg'}],
     corporateStaffCanManage:async()=>false,
     corporateStaffPhoto:async()=>photo,
   }});
 });
 await expect(page.getByRole('img',{name:'Fotografía de Claudia Zúñiga'})).toBeVisible();
 await expect(page.locator('.staff-company-placeholder')).toHaveCount(0);
 expect(await page.getByRole('img',{name:'Fotografía de Claudia Zúñiga'}).evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
});

test('corporate admin chooses matching numbered source photo; mismatched and uncertain identities are blocked',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await page.evaluate(async()=>{
    const {mountCorporateStaff}=await import('/adphor-platform/src/js/ui-corporate-staff.js');
    document.body.replaceChildren();
    const root=document.createElement('main');document.body.append(root);
    window.photoImports=[];
    const people=[
      {id:'delegate-16',name:'Ruby Luz Ramos',role_label:'Delegado',department:'Delegados',carousel_visible:true,assigned_properties:0,functions:[],photo_path:null},
      {id:'delegate-54',name:'aa',role_label:'Auxiliar de Tecnología',department:'Tecnología',carousel_visible:true,assigned_properties:0,functions:[],photo_path:null},
    ];
    const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#aaa"/></svg>');
    await mountCorporateStaff(root,{repo:{
      corporateStaffDirectory:async()=>people,
      corporateStaffCanManage:async()=>true,
      corporateStaffHistory:async()=>[],
      corporateStaffPhoto:async()=>photo,
      corporateStaffUploadPhoto:async(id,file)=>{
        window.photoImports.push([id,file.name]);
        return id+'/'+'a'.repeat(64)+'.jpg';
      },
    }});
  });
  const upload=page.getByLabel('Seleccionar fotografía de Ruby Luz Ramos');
  const save=page.getByRole('button',{name:'Guardar fotografía'});
  await expect(page.getByLabel('Seleccionar fotografía de aa')).toHaveCount(0);
  await upload.setInputFiles({name:'54. James Alexander Riaño Becerra.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,255,0,1,2,3,4,5,6,7,8,9])});
  await expect(save).toBeDisabled();
  await upload.setInputFiles({name:'16. Ruby Ramos.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,255,0,1,2,3,4,5,6,7,8,9])});
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole('img',{name:'Fotografía de Ruby Luz Ramos'})).toBeVisible();
  await expect(page.locator('.staff-company-card').first().locator('.staff-company-placeholder')).toHaveCount(0);
  expect(await page.evaluate(()=>window.photoImports)).toEqual([['delegate-16','16. Ruby Ramos.jpg']]);
});

// A batch is staged first; no image can be uploaded without explicit review.
test('authorized admin reviews a numbered multi-file batch and imports without overwriting',async({page})=>{
 await page.goto('./');
 await page.evaluate(async()=>{
   const {mountCorporateStaff}=await import('/adphor-platform/src/js/ui-corporate-staff.js');
   document.body.replaceChildren();
   const root=document.createElement('main');document.body.append(root);
   window.batchWrites=[];
   const people=[
     {id:'delegate-16',name:'Ruby Luz Ramos',role_label:'Delegada',department:'Delegados',photo_path:null,carousel_visible:true,assigned_properties:0,functions:[]},
     {id:'delegate-37',name:'Jeaneth Rey',role_label:'Delegada',department:'Delegados',photo_path:null,carousel_visible:true,assigned_properties:0,functions:[]},
     {id:'delegate-11',name:'José Guzmán Castilla',role_label:'Gerente',department:'Gerencia',photo_path:'delegate-11/'+('c'.repeat(64))+'.png',carousel_visible:true,assigned_properties:0,functions:[]},
     {id:'delegate-54',name:'aa',role_label:'Auxiliar',department:'Tecnología',photo_path:null,carousel_visible:true,assigned_properties:0,functions:[]}
   ];
   const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="#eee"/></svg>');
   await mountCorporateStaff(root,{repo:{
      corporateStaffDirectory:async()=>people,
      corporateStaffCanManage:async()=>true,
      corporateStaffHistory:async()=>[],
      corporateStaffPhoto:async()=>photo,
      corporateStaffUploadPhoto:async(id,file)=>{
        window.batchWrites.push([id,file.name]);
        return id+'/'+('a'.repeat(64))+'.jpg';
      }
   }});
 });
 const photos=page.getByLabel('Seleccionar múltiples fotografías corporativas');
 await expect(photos).toBeVisible();
 const jpg=Buffer.from([255,216,255,1,2,3,4,5,6,7,8,9,10,11]);
 await photos.setInputFiles([
   {name:'16. Ruby Ramos.jpg',mimeType:'image/jpeg',buffer:jpg},
   {name:'37. Yeaneth Rey.jpg',mimeType:'image/jpeg',buffer:jpg},
   {name:'11. José Guzmán Castilla.jpg',mimeType:'image/jpeg',buffer:jpg},
   {name:'54. James Riaño.jpg',mimeType:'image/jpeg',buffer:jpg}
 ]);
 await expect(page.getByText('2 fotos preparadas · 2 descartadas')).toBeVisible();
 await expect(page.getByText('16. Ruby Ramos.jpg → Ruby Luz Ramos')).toBeVisible();
 expect(await page.evaluate(()=>window.batchWrites)).toEqual([]);
 await page.getByRole('button',{name:'Importar 2 fotografías verificadas'}).click();
 await expect(page.getByText('2 de 2 fotografías confirmadas en almacenamiento privado.')).toBeVisible();
 expect(await page.evaluate(()=>window.batchWrites)).toEqual([
   ['delegate-16','16. Ruby Ramos.jpg'],['delegate-37','37. Yeaneth Rey.jpg']
 ]);
 await expect(page.locator('.staff-company-card').filter({hasText:'Ruby Luz Ramos'}).getByRole('img',{name:'Fotografía de Ruby Luz Ramos'})).toBeVisible();
});
test('non-admin never receives batch importer or import permission',async({page})=>{
 await mount(page,false);
 await expect(page.getByLabel('Seleccionar múltiples fotografías corporativas')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Importar .*fotografías verificadas/})).toHaveCount(0);
});
