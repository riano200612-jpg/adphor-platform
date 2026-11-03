// ADPHOR: non-destructive handoff to the client's existing live Apps Script.
// This bridge NEVER copies credentials, cases or calendar events and does not make API calls.
const ENTRY_KEY='adphor-client-exec-links-v1';
const SERVICES=Object.freeze([
  {id:'portal',name:'Portal original · PQRS y archivos'},
  {id:'meetings',name:'Plataforma original · Reuniones y Google Calendar'}
]);
export function normalizeAppsScriptExecUrl(raw){
  if(typeof raw!=='string'||raw.length>1500)throw Error('Introduce el enlace /exec del despliegue original.');
  let url;try{url=new URL(raw.trim());}catch{throw Error('El enlace no es una URL válida.');}
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||url.username||url.password||
    !/^\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec\/?$/.test(url.pathname)||
    url.hash||url.port)throw Error('Usa exclusivamente un despliegue Google Apps Script terminado en /exec; /dev no funciona como acceso productivo.');
  // Discard untrusted query parameters, tokens and fragments.
  return url.origin+url.pathname.replace(/\/$/,'');
}
export function clientServiceUrl(base,page=''){
  const url=new URL(normalizeAppsScriptExecUrl(base));
  if(page){
    if(!['form','status','gestion-correos'].includes(page))throw Error('Página no permitida.');
    url.searchParams.set('page',page);
  }
  return url.toString();
}
const element=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
export function mountClientLegacyBridge(root,{store=window.localStorage,open=(url)=>window.open(url,'_blank','noopener,noreferrer')}={}){
  root.replaceChildren();
  const section=element('section');section.className='panel';
  const header=element('h1','Servicios operativos originales del cliente');
  const notice=element('p','Los enlaces abren el sistema original de José en su propia pestaña. PQRS, calendario y archivos continúan en el servicio original; esta pantalla todavía NO los sincroniza a PostgreSQL ADPHOR.');
  notice.className='notice';section.append(header,notice);
  let saved={};
  try{const parsed=JSON.parse(store.getItem(ENTRY_KEY)||'{}');for(const x of SERVICES)if(typeof parsed?.[x.id]==='string')saved[x.id]=normalizeAppsScriptExecUrl(parsed[x.id]);}catch{saved={};}
  const status=element('p','');status.setAttribute('role','status');
  const grid=element('div');grid.className='module-grid';
  for(const service of SERVICES){
    const card=element('div');card.className='panel';
    const label=element('label',service.name+' · URL /exec');
    const input=element('input');input.type='url';input.autocomplete='off';input.spellcheck=false;input.placeholder='https://script.google.com/macros/s/.../exec';input.value=saved[service.id]||'';
    label.append(input);
    const save=element('button','Guardar enlace de este navegador');save.type='button';save.className='btn secondary';
    save.onclick=()=>{
      try{
        const url=normalizeAppsScriptExecUrl(input.value);saved[service.id]=url;
        store.setItem(ENTRY_KEY,JSON.stringify(saved));status.textContent='Enlace guardado. No se han almacenado credenciales.';input.value=url;
      }catch(error){status.textContent=error.message;}
    };
    const launch=element('button','Abrir servicio original');launch.type='button';launch.className='btn primary';
    launch.onclick=()=>{
      try{const url=normalizeAppsScriptExecUrl(input.value||saved[service.id]);open(url);status.textContent='Abriendo servicio original autenticado en otra pestaña.';}
      catch(error){status.textContent=error.message;}
    };
    card.append(label,save,launch);
    if(service.id==='portal'){
      for(const [page,name] of [['form','Radicar PQRS original'],['status','Consultar estado PQRS'],['gestion-correos','Gestionar correos original']]){
        const b=element('button',name);b.type='button';b.className='btn secondary';
        b.onclick=()=>{try{open(clientServiceUrl(input.value||saved[service.id],page));status.textContent='Abriendo '+name+'.';}catch(error){status.textContent=error.message;}};
        card.append(b);
      }
    }
    grid.append(card);
  }
  const clear=element('button','Eliminar enlaces guardados');clear.type='button';clear.className='btn secondary';
  clear.onclick=()=>{store.removeItem(ENTRY_KEY);saved={};grid.querySelectorAll('input').forEach(i=>i.value='');status.textContent='Enlaces eliminados del navegador.';};
  const help=element('p','Guarda solamente direcciones /exec entregadas por el cliente. No escribas PIN, contraseñas ni tokens. Los archivos y radicados siguen almacenados donde el servicio original los guarda; cerrar esta pestaña no los elimina.');
  help.className='muted';
  section.append(grid,status,clear,help);root.append(section);
}
