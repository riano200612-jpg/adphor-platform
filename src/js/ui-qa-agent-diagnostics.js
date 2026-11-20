import {qaDiagnosticAllowed,runQaDiagnosticAgents} from './services/qa-diagnostic-agents.js';

const LABELS={ok:'Verificado',attention:'Revisar',blocked:'Bloqueado'};
export function mountQaDiagnosticAgents(container,context){
  if(!container)return ()=>{};
  const activeToken=Symbol('qa-agents');
  container.__adphorQaAgents=activeToken;
  const active=()=>container.isConnected && container.__adphorQaAgents===activeToken;
  if(!qaDiagnosticAllowed(context)){
    container.textContent='Los agentes de verificación requieren QA Integral, permisos de Administración o Coordinación y una sesión autorizada.';
    return ()=>{if(container.__adphorQaAgents===activeToken)delete container.__adphorQaAgents;};
  }
  container.replaceChildren();
  const section=document.createElement('section');section.className='panel qa-agent-watch';
  const heading=document.createElement('h2');heading.textContent='Agentes de verificación QA · solo lectura';
  const detail=document.createElement('p');detail.textContent='Ronda automática al abrir esta sección. Cada agente comprueba funciones o datos disponibles en tu sesión, sin ejecutar modelos de IA, enviar correos, cerrar casos ni escribir información.';
  const toolbar=document.createElement('div');toolbar.className='qa-agent-watch-toolbar';
  const rerun=document.createElement('button');rerun.type='button';rerun.className='btn secondary';
  rerun.textContent='Repetir auditoría';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.textContent='Iniciando comprobaciones de QA…';
  const log=document.createElement('ol');log.className='qa-agent-watch-log';
  log.setAttribute('aria-label','Resultados de los agentes de verificación');
  const note=document.createElement('p');note.className='muted';
  note.textContent='Resultados de esta sesión, sin persistencia de datos personales. Para la certificación de Cloudflare Access y procesos reales son necesarias pruebas E2E autorizadas.';
  toolbar.append(rerun);section.append(heading,detail,toolbar,status,log,note);container.append(section);
  let busy=false;
  const start=async()=>{
    if(!active()||busy)return;
    busy=true;rerun.disabled=true;log.replaceChildren();
    status.textContent='Agentes revisando la copropiedad seleccionada…';
    try{
      const report=await runQaDiagnosticAgents(context,{onStep:step=>{
        if(!active())return;
        const li=document.createElement('li');li.className='qa-agent-watch-item';
        li.dataset.agent=step.id;li.dataset.status=step.status;
        const title=document.createElement('strong');title.textContent=step.label+' · '+LABELS[step.status];
        const description=document.createElement('p');description.textContent=step.detail;
        const time=document.createElement('small');time.textContent='Comprobado: '+step.checkedAt;
        li.append(title,description,time);log.append(li);
        status.textContent='Completado: '+log.children.length+' comprobaciones';
      }});
      if(active()){
        const issues=report.steps.filter(x=>x.status!=='ok').length;
        status.textContent='Ronda finalizada: '+report.steps.length+' verificaciones; '+issues+
          ' requieren atención o permanecen bloqueadas.';
      }
    }catch{
      if(active())status.textContent='La ronda se detuvo. Comprueba la sesión y vuelve a intentarlo.';
    }finally{
      busy=false;if(active())rerun.disabled=false;
    }
  };
  rerun.addEventListener('click',start);
  void start();
  return ()=>{if(container.__adphorQaAgents===activeToken)delete container.__adphorQaAgents;};
}
