import {test,expect} from '@playwright/test';

async function enterDemo(page,profile='admin-demo'){
 await page.goto('./');
 await page.locator('[name="profile"]').selectOption(profile);
 await page.getByRole('button',{name:'Explorar demostración'}).click();
 await expect(page.locator('#project-select')).toBeVisible();
}
async function guidedReply(page){
 await page.locator('.miss-chat-toggle').click();
 await expect(page.locator('.miss-chat-panel')).toBeVisible();
 await page.locator('[data-miss-question="Guíame paso a paso"]').click();
 return page.locator('.miss-chat-messages .assistant').last();
}

test('Miss Guardian: guided route from dashboard through PQRS to Visits, with no autonomous writes',async({page})=>{
 const posts=[];
 page.on('request',req=>{
   if(req.method()!=='GET' && /\/(rest\/v1|agent-runs|functions\/v1)/i.test(req.url()))posts.push(req.url());
 });
 await enterDemo(page);
 const home=await guidedReply(page);
 await expect(home).toContainText('Recorrido de Resumen:');
 await expect(home).toContainText('4. Comprueba');
 await expect(home).toContainText('Revisión cruzada de calidad y seguridad');
 await page.locator('.sidebar nav button[data-page="pqrs"]').click();
 const pqrs=await guidedReply(page);
 await expect(pqrs).toContainText('Recorrido de PQRS:');
 await expect(pqrs).toContainText('5. Revisa la copropiedad');
 await expect(pqrs).toContainText('Storage privado');
 await expect(pqrs).not.toContainText('confirmada exitosamente');
 const form=page.locator('.miss-chat-form');
 await form.locator('input').fill('Guíame en visitas');
 await form.getByRole('button',{name:'Consultar'}).click();
 const reply=page.locator('.miss-chat-messages .assistant').last();
 await expect(reply).toContainText('Recorrido de Visitas:');
 await expect(reply).toContainText('Supabase QA');
 await page.locator('.miss-chat-jump').last().click();
 await expect(page.locator('.sidebar nav button[data-page="visits"]')).toHaveAttribute('aria-current','page');
 expect(posts).toEqual([]);
});

test('Miss Guardian: viewer cannot receive internal agent guidance or cross-project commands',async({page})=>{
 await enterDemo(page,'viewer-demo');
 await page.locator('.sidebar nav button[data-page="agent-history"]').click();
 const answer=await guidedReply(page);
 await expect(answer).toContainText('No puedo verificar tus permisos');
 await expect(page.locator('.miss-chat-jump')).toHaveCount(0);
 const form=page.locator('.miss-chat-form');
 await form.locator('input').fill('Guíame en permisos');
 await form.getByRole('button',{name:'Consultar'}).click();
 await expect(page.locator('.miss-chat-messages .assistant').last()).toContainText('No puedo verificar tus permisos');
 await form.locator('input').fill('Enviar correo');
 await form.getByRole('button',{name:'Consultar'}).click();
 await expect(page.locator('.miss-chat-messages .assistant').last()).toContainText('no ejecuto');
 await expect(page.locator('.miss-chat-jump')).toHaveCount(0);
});
