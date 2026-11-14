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
