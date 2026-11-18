// Miss ADPHOR: board governance annex of existing authorized SQL monthly report.
// Pure presentation: no external effects, model invocation, data retrieval or sign-off.
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = v => new Intl.NumberFormat('es-CO').format(v);
const validInt = v => Number.isSafeInteger(v)&&v>=0&&v<=1e8;
const fields=['opening','created','reopened','closure_events','ending','overdue','unknown_deadlines'];
function isPartial(r){
 const [y,m]=r.month.slice(0,7).split('-').map(Number);
 return Date.parse(r.cutoff)<Date.UTC(y,m,1,5);
}
export function boardGovernancePlan(r){
 if(!r||typeof r!=='object'||Array.isArray(r)||
    typeof r.project_name!=='string'||!r.project_name.trim()||r.project_name.length>180||
    typeof r.month!=='string'||!/^d$/.test('d')||
    !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(r.month)||
    typeof r.cutoff!=='string'||!Number.isFinite(Date.parse(r.cutoff))||
    fields.some(f=>!validInt(r[f]))||!Array.isArray(r.areas)||r.areas.length>200||
    r.areas.some(a=>!a||typeof a.area!=='string'||a.area.length>160||
      !validInt(a.pending)||!validInt(a.review))) {
  throw Error('Datos insuficientes para informe de junta.');
 }
 const sum=r.opening+r.created+r.reopened-r.closure_events;
 const reviewed=r.areas.reduce((n,a)=>n+a.review,0);
 const seeded=Number(r.seeded??0);
 if(!validInt(seeded))throw Error('Carga histórica no verificable.');
 const reconciled=seeded===0&&sum===r.ending;
 const partial=isPartial(r);
 const status=r.is_demo===true?'DEMOSTRACIÓN - NO CERTIFICABLE':
    !reconciled?'NO CERTIFICABLE - CONCILIACIÓN PENDIENTE':
    partial?'BORRADOR - PERÍODO PARCIAL':
    r.frozen===true?'CIERRE CONSERVADO - REVISIÓN HUMANA':
    'BORRADOR - VALIDACIÓN PENDIENTE';
 const risks=[];
 if(!reconciled)risks.push({id:'GOV-01',level:'P0',focus:'Integridad de cifras',evidence:'Saldo esperado '+number(sum)+' / saldo informado '+number(r.ending)+(seeded?' / precargados '+number(seeded):''),decision:'Conciliar las fuentes y no aprobar el período como cierre.'});
 if(r.overdue>0)risks.push({id:'GOV-02',level:'P1',focus:'Pendientes vencidos',evidence:number(r.overdue)+' registros con plazo vencido al corte',decision:'Solicitar plan de recuperación y verificar responsables.'});
 if(r.unknown_deadlines>0)risks.push({id:'GOV-03',level:'P1',focus:'Plazos sin historial',evidence:number(r.unknown_deadlines)+' registros sin fecha histórica',decision:'Auditar la fecha antes de medir cumplimiento.'});
 if(reviewed>0)risks.push({id:'GOV-04',level:'P1',focus:'Evidencias por verificar',evidence:number(reviewed)+' registros pendientes de validación',decision:'Revisar expediente y evidencia antes de cerrar.'});
 if(!risks.length)risks.push({id:'GOV-00',level:'OBS',focus:'Continuidad del control',evidence:'Sin señales en indicadores seleccionados',decision:'Verificar muestra de evidencias: no equivale a riesgo cero.'});
 const decisions=[
  {horizon:'30 días',owner:'Coordinación - por designar',action:!reconciled?'Conciliar las fuentes del informe':'Revisar pendientes y responsables',control:'Pendiente de aprobación humana'},
  {horizon:'60 días',owner:'Administración - por designar',action:'Documentar evolución de pendientes con evidencia',control:'Sin ejecución ni aprobación automática'},
  {horizon:'90 días',owner:'Junta directiva - por acordar',action:'Revisar tendencias comparables y fijar prioridades',control:'Sin acuerdos ni contratos ejecutados'}
 ];
 return Object.freeze({projectName:r.project_name,month:r.month,cutoff:r.cutoff,
  status,reconciled,partial,risks,decisions,
  source:'Informe mensual del servidor QA (origen declarado)',
  scope:'Bitácora de mantenimiento únicamente',
  sourceHashCertified:false,boardApproved:false,notificationsSent:false,
  modelTrained:false,changesPersisted:false});
}
export function boardGovernanceView(r){
 const g=boardGovernancePlan(r);
 const riskRows=g.risks.map(x=>'<tr><td>'+esc(x.id)+'</td><td>'+esc(x.level)+'</td><td>'+esc(x.focus)+'</td><td>'+esc(x.evidence)+'</td><td>'+esc(x.decision)+'</td></tr>').join('');
 const actions=g.decisions.map(x=>'<tr><td>'+esc(x.horizon)+'</td><td>'+esc(x.owner)+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.control)+'</td></tr>').join('');
 return [
  '<section class="executive-page executive-detail executive-board-governance" aria-label="Anexo para junta directiva">',
  '<header class="executive-header"><div><p class="eyebrow">ADPHOR / MISS ADPHOR</p><h2>Anexo de gobierno y decisiones</h2><p class="executive-property">'+esc(g.projectName)+'</p></div>',
  '<div class="executive-meta"><strong>'+esc(g.month.slice(0,7))+'</strong><span>'+esc(g.status)+'</span><span>Corte: '+esc(g.cutoff)+'</span></div></header>',
  '<section class="executive-section"><div class="executive-section-title"><h3>05 / Riesgos y decisiones</h3><span>Para revisión de junta directiva</span></div>',
  '<p class="executive-caption">Cifras de mantenimiento. No constituyen diagnóstico, SLA, certificación financiera ni decisiones adoptadas.</p>',
  '<div tabindex="0" role="region" aria-label="Riesgos de gestión" class="table-wrap"><table><thead><tr><th>Ref.</th><th>Nivel</th><th>Riesgo</th><th>Evidencia</th><th>Decisión propuesta</th></tr></thead><tbody>'+riskRows+'</tbody></table></div></section>',
  '<section class="executive-section"><div class="executive-section-title"><h3>06 / Agenda 30 / 60 / 90 días</h3><span>Sin compromisos ejecutados</span></div>',
  '<div tabindex="0" role="region" aria-label="Agenda de seguimiento" class="table-wrap"><table><thead><tr><th>Plazo</th><th>Responsable propuesto</th><th>Acción sugerida</th><th>Control</th></tr></thead><tbody>'+actions+'</tbody></table></div></section>',
  '<section class="executive-reconcile"><h4>07 / Calidad, trazabilidad y aprobación</h4><div>',
  '<span><small>Conciliación</small><strong>'+(g.reconciled?'Consistente':'Pendiente')+'</strong></span>',
  '<span><small>Período</small><strong>'+(g.partial?'Parcial':'Completo al corte')+'</strong></span>',
  '<span><small>Huella certificada</small><strong>No disponible</strong></span>',
  '<span><small>Aprobación de junta</small><strong>Pendiente</strong></span>',
  '</div></section>',
  '<footer class="executive-notes"><h4>Alcance y responsabilidad</h4>',
  '<p>Fuente declarada: '+esc(g.source)+'. Alcance: '+esc(g.scope)+'. No se incluyeron PQRS, gastos, proveedores, datos de personas ni eventos de Calendar en los indicadores de este anexo.</p>',
  '<p>Miss ADPHOR organiza este borrador con reglas: no firma, aprueba, publica, entrena modelos ni notifica automáticamente. La junta y la administración deben contrastar las evidencias antes de tomar decisiones.</p>',
  '<span>ADPHOR · Documento para revisión de junta · '+esc(g.status)+'</span></footer></section>'
 ].join('');
}
export function boardGovernanceCsvRows(r){
 const g=boardGovernancePlan(r);
 return [[],['ANEXO PARA JUNTA DIRECTIVA','EVIDENCIAS Y CONTROL'],
 ['Estado de revisión',g.status],['Fuente declarada',g.source],['Alcance',g.scope],
 ['Conciliación',g.reconciled?'Consistente':'Pendiente'],
 ['Huella de fuente certificada','NO'],['Aprobación de junta','NO'],
 [],['ID','Nivel','Riesgo','Evidencia','Acción'],
 ...g.risks.map(x=>[x.id,x.level,x.focus,x.evidence,x.decision]),
 [],['Plazo','Responsable','Acción propuesta','Control'],
 ...g.decisions.map(x=>[x.horizon,x.owner,x.action,x.control])];
}
