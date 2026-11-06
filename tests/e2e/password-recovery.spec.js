import {test, expect} from '@playwright/test';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';

// Run against an isolated built QA artifact, with all Auth traffic mocked.
const origin = 'https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev';
let buildDir;
test.beforeAll(async () => {
  buildDir = await mkdtemp(resolve(tmpdir(),'adphor-recovery-'));
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js','build','--outDir',buildDir], {env:{...process.env,
    CF_PAGES:'1',CF_PAGES_BRANCH:'qa/pqrs-carrusel-integracion-20261104',ADPHOR_PROTECTED_STAGING_QA:'true',
    ADPHOR_QA_ACCESS_VERIFIED:'true',ADPHOR_QA_ACCESS_BOOTSTRAP:'false',VITE_REQUIRE_MFA:'true',
    VITE_PORTO_QA_ENABLED:'true',VITE_PORTO_STAGING_REF:'qfctnnnnltghepwujpdm',
    VITE_SUPABASE_URL:'https://qfctnnnnltghepwujpdm.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_publishable_recovery_test'},stdio:'pipe'});
});
test.afterAll(async () => {if(buildDir) await rm(buildDir,{recursive:true,force:true});});
test.beforeEach(async ({page}) => {
  await page.route(`${origin}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    const file = resolve(buildDir, path === '/' ? 'index.html' : `.${path}`);
    const body = await readFile(file);
    const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : 'text/html';
    await route.fulfill({body, contentType});
  });
});
test('expired recovery scrubs URL, shows an actionable error and returns to normal login', async ({page}) => {
  let authRequests = 0;
  await page.route('https://qfctnnnnltghepwujpdm.supabase.co/**', async route => {authRequests++;await route.abort();});
  await page.goto(`${origin}/#error=access_denied&error_code=otp_expired`);
  await expect(page.getByRole('heading',{name:'Establecer nueva contraseña'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('expirado');
  expect(new URL(page.url()).hash).toBe('');
  await page.getByRole('button',{name:'Volver al ingreso'}).click();
  await expect(page.locator('#login-form')).toBeVisible();
  expect(authRequests).toBe(0);
});
test('verified link updates only Auth password and then requires normal login and MFA', async ({page}) => {
  const user = {id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid'};
  let updates = 0;
  const unexpected = [];
  await page.route('https://qfctnnnnltghepwujpdm.supabase.co/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if(path === '/auth/v1/user' && req.method() === 'GET') return route.fulfill({json:user});
    if(path === '/auth/v1/user' && req.method() === 'PUT') {
      expect(req.postDataJSON()).toEqual({password:'synthetic-new-password-123',code_challenge:null,code_challenge_method:null}); updates++;
      return route.fulfill({json:user});
    }
    if(path === '/auth/v1/logout') return route.fulfill({status:204});
    unexpected.push(path); await route.abort();
  });
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aal:'aal1'})}.${Buffer.from('synthetic-signature').toString('base64url')}`;
  await page.goto(`${origin}/#type=recovery&access_token=${token}&refresh_token=synthetic-refresh`);
  await expect(page.getByText('Enlace verificado.',{exact:false})).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await page.getByLabel('Nueva contraseña',{exact:true}).fill('synthetic-new-password-123');
  await page.getByLabel('Confirmar contraseña',{exact:true}).fill('synthetic-new-password-123');
  await page.getByRole('button',{name:'Guardar nueva contraseña'}).click();
  await expect(page.locator('#recovery-status')).toContainText('Contraseña actualizada');
  await page.getByRole('button',{name:'Volver al ingreso'}).click();
  await expect(page.locator('#login-form')).toBeVisible();
  expect(updates).toBe(1); expect(unexpected).toEqual([]);
});

test('login password visibility toggles without submitting or changing its value', async ({page}) => {
  let authRequests = 0;
  await page.route('https://qfctnnnnltghepwujpdm.supabase.co/**', async route => {authRequests++;await route.abort();});
  await page.goto(origin);
  const password = page.getByLabel('Contraseña', {exact:true});
  await password.fill('synthetic-visibility-only');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', {name:'Mostrar contraseña',exact:true}).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('synthetic-visibility-only');
  await page.getByRole('button', {name:'Ocultar contraseña',exact:true}).click();
  await expect(password).toHaveAttribute('type', 'password');
  expect(authRequests).toBe(0);
});

for (const existing of [false,true]) test(`QA login ${existing?'challenges existing':'enrolls first'} TOTP before any protected request`,async({page})=>{
  const id='00000000-0000-4000-8000-000000000001';let aal='aal1';const protectedRequests=[];
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt=()=>`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aal,exp:Math.floor(Date.now()/1000)+3600})}.${Buffer.from('synthetic-signature').toString('base64url')}`;
  const user=()=>({id,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',factors:existing||aal==='aal2'?[{id:'factor-test',factor_type:'totp',status:'verified'}]:[]});
  const session=()=>({access_token:jwt(),refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:user()});
  await page.route('https://qfctnnnnltghepwujpdm.supabase.co/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path==='/auth/v1/token')return route.fulfill({json:session()});
    if(path==='/auth/v1/user')return route.fulfill({json:user()});
    if(path==='/auth/v1/factors')return route.fulfill({json:{id:'factor-test',type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"/>',secret:'SYNTHETIC'}}});
    if(path.endsWith('/challenge'))return route.fulfill({json:{id:'challenge-test',expires_at:Math.floor(Date.now()/1000)+300}});
    if(path.endsWith('/verify')){expect(req.postDataJSON().code).toBe('123456');aal='aal2';return route.fulfill({json:session()});}
    if(path.startsWith('/rest/v1/')){
      protectedRequests.push(path);expect(aal).toBe('aal2');
      const token=req.headers().authorization?.split(' ')[1];expect(JSON.parse(Buffer.from(token.split('.')[1],'base64url')).aal).toBe('aal2');
      if(path==='/rest/v1/profiles')return route.fulfill({json:{name:'Synthetic QA Owner'}});
      if(path==='/rest/v1/projects')return route.fulfill({json:[{id:'qa-a',name:'Synthetic Property',areas:['General']}]});
      if(path==='/rest/v1/memberships')return route.fulfill({json:[{project_id:'qa-a',user_id:id,role:'admin',profiles:{name:'Synthetic QA Owner'}}]});
      return route.fulfill({json:[]});
    }
    await route.abort();
  });
  await page.goto(origin);
  await page.getByLabel('Correo o usuario',{exact:true}).fill('synthetic@example.invalid');
  await page.getByLabel('Contraseña',{exact:true}).fill('synthetic-password');
  await page.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(page.getByRole('heading',{name:existing?'Verificación adicional':'Configura tu autenticador'})).toBeVisible();
  expect(protectedRequests).toEqual([]);
  if(!existing){await page.getByRole('button',{name:'Registrar autenticador'}).click();await expect(page.getByLabel('Código',{exact:true})).toBeVisible();}
  expect(protectedRequests).toEqual([]);
  await page.getByLabel('Código',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verificar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Configura tu autenticador'})).toHaveCount(0);
  await expect(page.locator('#project-select')).toBeVisible();
  await expect(page.locator('#project-select')).toHaveValue('qa-a');
  expect(protectedRequests[0]).toBe('/rest/v1/profiles');
});
