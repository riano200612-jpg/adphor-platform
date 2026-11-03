// ADPHOR P1: entry point shared by existing modules. No synthetic records or bypasses.
// Operational meetings/visits require a verified staging API before being enabled.
export const UNIFIED_MODULES = Object.freeze([
  {id:'dashboard',title:'Inicio',detail:'Resumen por copropiedad'},
  {id:'meetings',title:'Reuniones',detail:'Solicitudes y evaluación gerencial'},
  {id:'recorridos',title:'Visitas y recorridos',detail:'Bitácora de hallazgos y seguimiento'},
  {id:'pqrs',title:'PQRS',detail:'Radicación y seguimiento autorizado'},
  {id:'reports',title:'Informes',detail:'Resultados mensuales verificables'},
  {id:'agent-history',title:'Agentes IA',detail:'Borradores y revisión humana'},
  {id:'tickets',title:'Archivos y evidencias',detail:'Evidencias vinculadas a novedades'}
]);
export function unifiedModuleStatus({mode='demo',portoEnabled=false}={}) {
  return UNIFIED_MODULES.map(m=>({
    ...m,
    available: !['meetings','pqrs'].includes(m.id) || portoEnabled,
    note: (m.id==='meetings'||m.id==='pqrs')&&!portoEnabled ?
      'Sin conexión transaccional certificada: módulo restringido' :
      m.id==='recorridos' ? 'Seguimiento de novedades; formulario de visitas independiente pendiente' :
      m.id==='tickets' ? 'Fotografías de mantenimiento; biblioteca multimedia pendiente' :
      m.id==='dashboard' ? 'Panel de datos autorizados' :
      mode==='demo' ? 'Modo de demostración' : 'Ver permisos y datos del módulo'
  }));
}
export function upcomingDueItems(tickets,projectId,limit=8) {
  return (Array.isArray(tickets)?tickets:[])
    .filter(t=>t?.project_id===projectId&&t.status!=='Cerrada'&&/^\d{4}-\d{2}-\d{2}$/.test(t.due_date||''))
    .sort((a,b)=>a.due_date.localeCompare(b.due_date))
    .slice(0,Math.max(0,Math.min(20,limit)));
}
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
export function mountUnifiedHub(target,{project,tickets,members,mode,portoEnabled}) {
  target.replaceChildren();
  const title=el('section','panel');
  title.append(el('p','eyebrow','CENTRO UNIFICADO · ADPHOR'),el('h1','', 'Operación integrada'),el('p','muted','Copropiedad seleccionada: '+(project?.name||'Sin asignación')));
  title.append(el('p','notice',mode==='demo'?'Vista de prueba. No muestra registros operativos reales.':'Los indicadores siguientes corresponden exclusivamente a la bitácora autorizada. No son reservas ni reuniones confirmadas.'));
  target.append(title);
  const modules=el('section','panel');modules.append(el('h2','','Módulos y acceso'));
  const grid=el('div','module-grid');
  for(const m of unifiedModuleStatus({mode,portoEnabled})){
    const button=el('button','module-card');button.type='button';button.disabled=!m.available;
    if(m.available)button.dataset.page=m.id;
    const text=el('span');text.append(el('strong','',m.title),el('small','',m.detail),el('small','',m.note));
    button.append(text);grid.append(button);
  }
  modules.append(grid);target.append(modules);
  const agenda=el('section','panel');agenda.append(el('h2','','Plazos de mantenimiento'));
  agenda.append(el('p','muted','Estos son vencimientos de novedades; NO son eventos de Google Calendar, visitas ni reuniones agendadas.'));
  const items=upcomingDueItems(tickets,project?.id);
  if(!items.length)agenda.append(el('p','muted','No hay plazos pendientes en la copropiedad seleccionada.'));
  else{
    const list=el('div','attention-list');
    for(const t of items){
      const b=el('button');b.type='button';b.dataset.ticket=String(t.id);
      b.append(el('strong','',t.title),el('small','',t.due_date+' · '+t.status));
      list.append(b);
    }agenda.append(list);
  }
  target.append(agenda);
  const people=el('section','panel');people.append(el('h2','','Equipo autorizado'));
  people.append(el('p','muted','Perfiles visibles mediante membresías de la copropiedad. No implica disponibilidad para acompañamientos.'));
  people.append(el('p','',String((members||[]).length)+' integrantes en la vista autorizada.'));
  target.append(people);
}
