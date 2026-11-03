// ADPHOR unified PQRS interface. Retain the client's operational Apps Script
// until the authenticated PostgreSQL API and private object storage are certified.
import {normalizeAppsScriptExecUrl} from './ui-client-legacy-bridge.js';
const CONFIG_KEY='adphor-client-exec-links-v1';
const ROUTES=Object.freeze({owners:'form',tracking:'status',staff:'portal-team'});
export function sourcePortalUrl({environment='',stored=''}={}){
  const raw=typeof environment==='string'&&environment.trim()?environment:stored;
  return raw?normalizeAppsScriptExecUrl(raw):'';
}
export function pqrsPortalRoute(base,route){
  if(!Object.hasOwn(ROUTES,route))throw Error('Ruta PQRS no autorizada.');
  const url=new URL(normalizeAppsScriptExecUrl(base));
  url.searchParams.set('page',ROUTES[route]);
  return url.toString();
}
const el=(tag,txt)=>{const v=document.createElement(tag);if(txt!==undefined)v.textContent=String(txt);return v;};
export function mountUnifiedPqrs(root,{repo,projectId,role,environment='',storage=window.localStorage,open=(url)=>window.open(url,'_blank','noopener,noreferrer')}={}){
 root.replaceChildren();
 const page=el('section');page.className='panel pqrs-page';
 const eyebrow=el('p','CENTRO DE ATENCIÓN · ADPHOR');eyebrow.className='eyebrow';
 const heading=el('h1','PQRS para propietarios y colaboradores');
 const intro=el('p','Accede al formulario original para radicar y adjuntar evidencias, consultar un radicado o ingresar al portal de empleados. El formulario original admite un adjunto de hasta 10 MB; la carga múltiple del nuevo diseño requiere un servicio privado certificado.');intro.className='muted';
 const notice=el('p');notice.className='notice';notice.setAttribute('role','status');
 const choices=el('div');choices.className='module-grid';
 const panel=el('div');panel.className='panel';
 const preview=el('div');preview.className='pqrs-original-container';
 const frame=document.createElement('iframe');
 frame.title='Portal PQRS original de ADPHOR · formulario con radicación y evidencias';
 frame.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin allow-popups allow-downloads');
 frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='microphone; camera';
 frame.loading='lazy';frame.style.width='100%';frame.style.minHeight='780px';frame.style.border='1px solid #cbd5d1';frame.style.borderRadius='12px';
 const fallback=el('p','El original permite un archivo por radicación (máximo 10 MB). Para varios adjuntos el cliente indicó combinarlos en PDF. Si la cámara, el micrófono o el inicio de sesión no funcionan en el marco, abre el formulario en su propia pestaña.');fallback.className='muted';
 const launch=el('button','Abrir formulario de radicación');launch.type='button';launch.className='btn primary';launch.setAttribute('data-pqrs-action','');
 let selected='owners',currentUrl='';
 let saved='';
 try{const v=JSON.parse(storage.getItem(CONFIG_KEY)||'{}');saved=typeof v.portal==='string'?v.portal:'';}catch{}
 const admin=role==='admin';
 const mayStaff=['admin','coordinator','technician'].includes(role);
 const config=el('div');
 const input=el('input');input.type='url';input.autocomplete='off';input.placeholder='https://script.google.com/macros/s/.../exec';input.value=saved;
 const submitUrl=el('button','Guardar enlace del portal en este navegador');submitUrl.type='button';submitUrl.className='btn secondary';
 if(admin){
   const label=el('label','Configuración del despliegue original /exec (administrador)');
   label.append(input);config.append(label,submitUrl);
 }else config.append(el('p','El administrador debe configurar el enlace del portal si no existe una integración global.','muted'));
 const tabs=[['owners','Propietarios · Radicar PQRS'],['tracking','Consultar radicado'],...(mayStaff?[['staff','Empleados · Portal y PQRS']]:[])];
 function resolveBase(){
   try{return sourcePortalUrl({environment,stored:input.value||saved});}
   catch(err){notice.textContent=err.message;return '';}
 }
 function draw(){
   launch.textContent=selected==='owners'?'Abrir formulario de radicación y evidencias':selected==='tracking'?'Abrir consulta de radicado':'Abrir portal autorizado de empleados';
   const base=resolveBase();currentUrl='';
   if(!base){
     notice.textContent='Falta vincular el enlace /exec del Portal original del cliente. Los envíos y adjuntos no se habilitarán hasta configurarlo.';
     preview.replaceChildren(el('p','Formulario original pendiente de conexión. No se perderán ni crearán radicados desde esta vista.'));launch.disabled=true;
     return;
   }
   try{currentUrl=pqrsPortalRoute(base,selected);frame.src=currentUrl;preview.replaceChildren(frame,fallback);launch.disabled=false;
       notice.textContent='Enlace del Portal original configurado. Verifica su inicio de sesión y que el radicado y los adjuntos se confirmen dentro del formulario antes de cerrar la página. Este acceso no prueba por sí solo que el servidor respondió correctamente.';}
   catch(err){notice.textContent=err.message;launch.disabled=true;}
 }
 for(const [id,label] of tabs){
   const button=el('button',label);button.type='button';button.className='btn secondary';
   button.dataset.pqrsRoute=id;
   button.onclick=()=>{
     selected=id;
     choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
     frame.title='Portal PQRS original ADPHOR · '+label;draw();
   };
   choices.append(button);
 }
 launch.onclick=()=>{if(currentUrl)open(currentUrl);};
 submitUrl.onclick=()=>{
   try{const normalized=normalizeAppsScriptExecUrl(input.value);let v={};
     try{v=JSON.parse(storage.getItem(CONFIG_KEY)||'{}');if(!v||typeof v!=='object')v={};}catch{}
     v.portal=normalized;storage.setItem(CONFIG_KEY,JSON.stringify(v));saved=normalized;input.value=normalized;draw();}
   catch(err){notice.textContent=err.message;}
 };
 page.append(eyebrow,heading,intro,choices,notice,config,panel);
 panel.append(preview,launch);
 root.append(page);
 const historic=el('section');historic.className='panel';
 historic.append(el('h2','29 PQRS identificadas en el archivo histórico'),
   el('p','Corte del 3 de noviembre de 2026. Estas PQRS aún no están homologadas por copropiedad en PostgreSQL; los nuevos radicados se consultan en el Portal original cuando esté conectado.'));
 root.append(historic);
 const first=choices.querySelector('button');if(first)first.setAttribute('aria-pressed','true');
 draw();
}
