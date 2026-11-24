import {validateCalendarAvailabilityResponse} from './calendar-availability.js';
import {invokeQaCalendarAvailability} from './qa-calendar-edge.js';
import {readVerifiedAgendaQuery} from './verified-agenda.js';
import {createSharedVisitRepository} from './shared-visits.js';
import { createEvidenceApiRepository } from './evidence-api.js';
import {createQaCaseEvidenceRepository} from './qa-case-evidence.js';
import {qaPrivatePqrsEvidenceAllowed} from './qa-pqrs-evidence-rollout.js';
import {createQaVisitEvidenceRepository} from './qa-visit-evidence.js';
import { createPrivateMediaRepository } from './private-media.js';
import { signedPropertyPhoto } from './property-photos.js';
import { createCloudAuthentication } from './cloud-authentication.js';
import {createQaAccountAvatarRepository} from './qa-account-avatar.js';
import { qaAuthPolicy,qaSessionResumePolicy,QA_SESSION_STORAGE_KEY } from './qa-auth-policy.js';
import { createStaffDirectory } from './staff-directory.js';
import {createCorporateStaff} from './corporate-staff.js';
import { assignedProjects, assignedMembers, assignedTickets } from './assigned-projects.js';
import { portoEnabled, createPortoRepository } from './porto.js';
import { submitAgentReview } from './agent-review.js';
import { createClient } from '@supabase/supabase-js';
import {createIamClient} from './iam-client.js';
import {validateTaskCandidate,validateQaCandidateRows} from './task-catalog.js';
import { agentApiOrigin, fetchAgentRuns, fetchAgentReadiness, agentRuleRequest } from './agent-api.js';
import {qaAgentRegistryReadiness,qaAgentRuns,qaAgentRunDetail} from './qa-agent-registry.js';
import {qaMissWeeklyReader} from './qa-miss-weekly-report.js';
import { fetchTenantSummary } from './tenant-consultation.js';
const authPolicyForVisitEvidence=url=>
  url==='https://qfctnnnnltghepwujpdm.supabase.co';
const safeCalendarDatabaseReasons = new Set(['CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'ERR_TLS_HANDSHAKE_TIMEOUT', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_TLS_UNSUPPORTED_PROTOCOL', 'ERR_TLS_INVALID_PROTOCOL_VERSION', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_WORKER_UNSUPPORTED_OPERATION', 'ERR_INVALID_ARG_TYPE', 'ERR_MODULE_NOT_FOUND', 'ERR_SSL_WRONG_VERSION_NUMBER', 'ERR_SSL_BAD_RECORD_MAC', 'TYPEERROR', 'RANGEERROR', 'OTHER']);

export function createCloudRepository(url, key) {
  // Only the known, Cloudflare-Access-protected QA Integral origin can keep
  // a session across browser restarts; production and historic QA do not.
  const allowSessionResume=qaSessionResumePolicy({url,hostname:globalThis.location?.hostname});
  const authOptions={persistSession:allowSessionResume,autoRefreshToken:true,detectSessionInUrl:false};
  if(allowSessionResume)authOptions.storageKey=QA_SESSION_STORAGE_KEY;
  const client=createClient(url,key,{auth:authOptions});
  let user = null;
  const privateMediaEnabled=import.meta.env.VITE_PRIVATE_MEDIA_QA_ENABLED==='true' && portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF);
  const media=privateMediaEnabled?createPrivateMediaRepository(client):null;
  const propertyMedia=media ?? (url==='https://qfctnnnnltghepwujpdm.supabase.co'
    ? createPrivateMediaRepository(client) : null);
  const isEvidenceQa=url==='https://qfctnnnnltghepwujpdm.supabase.co' &&
    portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF);
  const evidenceEnabled=qaPrivatePqrsEvidenceAllowed({
    url,qaFlag:import.meta.env.VITE_QA_EVIDENCE_UPLOAD_ENABLED,
    portoEnabled:import.meta.env.VITE_PORTO_QA_ENABLED,
    stagingRef:import.meta.env.VITE_PORTO_STAGING_REF,
    hostname:globalThis.location?.hostname
  });
  const evidence=evidenceEnabled
    ?createQaCaseEvidenceRepository(client,{url})
    // A flag must never silently fall back to a different backend in QA.
    :isEvidenceQa?null:createEvidenceApiRepository({url,enabled:import.meta.env.VITE_QA_EVIDENCE_UPLOAD_ENABLED,stagingRef:import.meta.env.VITE_PORTO_STAGING_REF,origin:import.meta.env.VITE_AGENTS_API_URL,auth:client.auth,development:import.meta.env.DEV});
  const porto=createPortoRepository(client,{url,enabled:import.meta.env.VITE_PORTO_QA_ENABLED,stagingRef:import.meta.env.VITE_PORTO_STAGING_REF});
  if(evidence){
    porto.uploadEvidence=evidence.uploadEvidence;
    if(evidence.listEvidence)porto.listEvidence=evidence.listEvidence;
    if(evidence.signedEvidence)porto.signedEvidence=evidence.signedEvidence;
  }
  const visits=createSharedVisitRepository(client,{url,
    writesEnabled:import.meta.env.VITE_VISITS_SQL_ENABLED==='true',
    lifecycleEnabled:import.meta.env.VITE_QA_VISITS_LIFECYCLE_ENABLED==='true'});
  if(visits?.lifecycleEnabled && authPolicyForVisitEvidence(url) &&
     import.meta.env.VITE_QA_VISIT_EVIDENCE_ENABLED==='true'){
    visits.evidence=createQaVisitEvidenceRepository(client,{url});
  }
  const accountAvatar=createQaAccountAvatarRepository(client,{
    url,hostname:globalThis.location?.hostname,getActor:()=>user
  });
  const authPolicy=qaAuthPolicy({url,requireMfa:import.meta.env.VITE_REQUIRE_MFA,hostname:globalThis.location?.hostname});
  const authentication=createCloudAuthentication(client,{required:authPolicy.required,
    allowDemoAlias:import.meta.env.VITE_ALLOW_DEMO_LOGIN_ALIAS==='true',
    allowSessionResume,
    allowEnrollment:authPolicy.isolatedQa || portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)});
  const staff=authPolicy.isolatedQa?createStaffDirectory(client):null;
  const corporateStaff=authPolicy.isolatedQa?createCorporateStaff(client):null;
  const qaCalendarEdgeEnabled=authPolicy.isolatedQa && import.meta.env.VITE_QA_CALENDAR_EDGE_ENABLED==='true';
  const qaTaskCatalogEnabled=authPolicy.isolatedQa && authPolicyForVisitEvidence(url);
  const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
  async function allPages(query) {
    const rows = [];
    for (let start=0;;start+=500) {
      const page=check(await query().range(start,start+499));
      rows.push(...page);
      if(page.length<500) return rows;
    }
  }
  async function calendarPilotRequest(operation,projectId,status) {
    const {session}=check(await client.auth.getSession());
    if(!session?.access_token) throw Error('CAL_SESSION');
    const query=new URLSearchParams({project:projectId});
    const response=await fetch('/api/integrations/google-calendar/oauth/'+operation+'?'+query,{
      method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},
      credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),
    });
    if(response.status!==status) {
      const code=response.headers.get('X-ADPHOR-Calendar-Code');
      const reason=response.headers.get('X-ADPHOR-Calendar-Reason');
      throw Error(code==='CAL_DB_TRANSPORT'&&safeCalendarDatabaseReasons.has(reason)
        ?code+':'+reason:(code||'CAL_NO_DIAGNOSTIC'));
    }
    return response;
  }
  async function calendarMeetingRequest(operation,projectId,{method='GET',body}={}) {
    const pilotProject=import.meta.env.VITE_QA_CALENDAR_PILOT_PROJECT_ID;
    if(!authPolicy.isolatedQa||import.meta.env.VITE_QA_CALENDAR_BOOKING_ENABLED!=='true'||
      typeof pilotProject!=='string'||projectId!==pilotProject) throw Error('CAL_PILOT_DISABLED');
    const {session}=check(await client.auth.getSession());
    if(!session?.access_token)throw Error('CAL_SESSION');
    const query=new URLSearchParams({project:projectId});
    const headers={Authorization:`Bearer ${session.access_token}`};
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetch('/api/integrations/google-calendar/meetings/'+operation+'?'+query,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),
      credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),
    });
    if(!response.ok)throw Error('CAL_MEETING_HTTP_'+response.status);
    return response;
  }
  return {
    porto,
    visits,
    accountAvatar,
    iam:authPolicy.isolatedQa?createIamClient(client.auth):null,
    qaTaskCatalogEnabled,
    missWeeklyPreview:qaMissWeeklyReader(client,{url,hostname:globalThis.location?.hostname,getActor:()=>user}),
    async listQaTaskCandidates(projectId){
      if(!qaTaskCatalogEnabled||!user)throw Error('Catálogo de propuestas requiere una sesión QA autorizada.');
      const result=await client.from('qa_task_catalog_candidates')
        .select('id,project_id,title,description,cadence,status,created_by,reviewed_by,review_note,created_at,reviewed_at')
        .eq('project_id',projectId).order('created_at',{ascending:false}).limit(100);
      if(result.error)throw Error('No se pudo leer el catálogo QA autorizado.');
      return validateQaCandidateRows(result.data,projectId);
    },
    async proposeQaTaskCandidate(projectId,payload){
      if(!qaTaskCatalogEnabled||!user)throw Error('Sesión QA requerida.');
      const draft=validateTaskCandidate(payload);
      const data=check(await client.rpc('qa_task_candidate_command',{
        command:'propose',payload:{...draft,id:payload.id,project_id:projectId}
      }));
      if(data?.project_id!==projectId||data?.status!=='proposed')throw Error('Confirmación de propuesta no verificable.');
      return data;
    },
    async reviewQaTaskCandidate(projectId,id,decision,note){
      if(!qaTaskCatalogEnabled||!user)throw Error('Sesión QA requerida.');
      if(!['reviewed_for_design','rejected'].includes(decision)||String(note).trim().length<5)
        throw Error('Revisión no válida.');
      const data=check(await client.rpc('qa_task_candidate_command',{
        command:'review',payload:{id,decision,note:String(note).trim()}
      }));
      if(data?.project_id!==projectId||data?.status!==decision)throw Error('Confirmación de revisión no verificable.');
      return data;
    },

    verifiedCalendarEnabled:portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF),
    // This only reports whether an API origin was configured at build time.
    // It is not evidence that OAuth, Access or the corporate calendar is live.
    calendarAvailabilityConfigured:!allowSessionResume && (qaCalendarEdgeEnabled || Boolean(import.meta.env.VITE_AGENTS_API_URL?.trim())),
    privateCalendarOnly:allowSessionResume,
    // Distinguish an enabled Supabase QA Edge freeBusy adapter from an unverified agents API.
    qaCalendarEdgeEnabled,
    // A configured URL does not prove the agent API is deployed or ready.
    agentApiConfigured:Boolean(import.meta.env.VITE_AGENTS_API_URL?.trim()),
    agentRegistryReadOnlyEnabled:authPolicy.isolatedQa && !Boolean(import.meta.env.VITE_AGENTS_API_URL?.trim()),
    staffDirectoryEnabled:Boolean(staff),
    async corporateStaffDirectory(){if(!corporateStaff||!user)throw Error('Sesión QA requerida.');return corporateStaff.list();},
    async corporateStaffCanManage(){if(!corporateStaff||!user)return false;return corporateStaff.canManage();},
    async corporateStaffSetVisible(id,visible){if(!corporateStaff||!user)throw Error('Sesión QA requerida.');return corporateStaff.setVisible(id,visible);},
    async corporateStaffPhoto(path){if(!corporateStaff||!user)throw Error('Sesión QA requerida.');return corporateStaff.photo(path);},
    async corporateStaffUploadPhoto(id,file){if(!corporateStaff||!user)throw Error('Sesión QA requerida.');return corporateStaff.uploadPhoto(id,file);},
    async corporateStaffHistory(){if(!corporateStaff||!user)throw Error('Sesión QA requerida.');return corporateStaff.history();},
    async staffDirectory(projectId){if(!staff||!user)throw Error('Equipo disponible solo en QA autorizado.');return staff.list(projectId);},
    async staffPhotoUrl(projectId,personId){if(!staff||!user)throw Error('Equipo disponible solo en QA autorizado.');return staff.photo(projectId,personId);},
    // Historical data is readable only when an isolated QA project is explicitly enabled.
    // Source status alone never proves a Google Calendar reservation.
    async listVerifiedQaMeetings(projectId) {
      if(!portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)) return [];
      if(!user) throw Error('Sesión necesaria.');
      const result=await client.from('qa_meeting_events')
        .select('id,project_id,title,kind,source_status,start_at,end_at,is_calendar_verified')
        .eq('project_id',projectId).eq('is_calendar_verified',true)
        .eq('source_status','Confirmada').order('start_at',{ascending:true}).limit(501);
      return readVerifiedAgendaQuery(result);
    },
    async listQaPqrsHistory(projectId) {
      if(!portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)) return [];
      if(!user) throw Error('Sesión necesaria.');
      return check(await client.from('qa_pqrs_history')
        .select('id,project_id,source_id,subject,source_status,source_created_at')
        .eq('project_id',projectId).order('source_created_at',{ascending:false}).limit(200));
    },
    ...(authPolicy.isolatedQa && {
      async checkCalendarOAuthDatabase(projectId) {
        await calendarPilotRequest('readiness',projectId,204);
      },
      async startCalendarOAuthPilot(projectId) {
        const response=await calendarPilotRequest('start',projectId,200);
        const {authorizationUrl}=await response.json();
        const destination=new URL(authorizationUrl);
        if(destination.origin!=='https://accounts.google.com'||
          destination.pathname!=='/o/oauth2/v2/auth'||destination.username||destination.password){
          throw Error('Destino de autorización Google no válido.');
        }
        return destination.href;
      },
      async finalizeCalendarOAuthPilot(projectId) {
        await calendarPilotRequest('finalize',projectId,204);
      },
      async createGoogleCalendarMeeting(projectId,meeting) {
        const response=await calendarMeetingRequest('create',projectId,{
          method:'POST',body:{...meeting,confirmed:true},
        });
        const data=await response.json();
        let meet=null;
        if(typeof data?.meetLink==='string')meet=new URL(data.meetLink);
        if(data?.projectId!==projectId||!['created','meet_pending'].includes(data?.status)||
          typeof data?.googleEventId!=='string'||
          (data.status==='created'&&!meet)||
          (data.meetLink!==null&&typeof data.meetLink!=='string')||
          (meet&&!(meet.protocol==='https:'&&meet.hostname==='meet.google.com'))) {
          throw Error('CAL_MEETING_RESPONSE_INVALID');
        }
        return data;
      },
      async listGoogleCalendarMeetings(projectId) {
        const response=await calendarMeetingRequest('list',projectId,{method:'POST'});
        const data=await response.json();
        if(data?.projectId!==projectId||!Array.isArray(data.meetings))throw Error('CAL_MEETING_LIST_INVALID');
        return data.meetings;
      },
    }),
    async meetingAvailability(projectId, start, end) {
      if (allowSessionResume) throw Error('La disponibilidad de Calendar queda pendiente de la conexión OAuth privada.');
      if (!portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)) throw Error('Disponibilidad solo habilitada en QA.');
      if(qaCalendarEdgeEnabled){
        const {session}=check(await client.auth.getSession());
        if(!session?.access_token)throw Error('Sesión requerida.');
        return invokeQaCalendarAvailability(client.functions,projectId,start,end);
      }
      const origin=agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL,import.meta.env.DEV);
      if (!origin) throw Error('Servicio de disponibilidad sin conexión.');
      const {session}=check(await client.auth.getSession());
      if (!session?.access_token) throw Error('Sesión requerida.');
      const response=await fetch(new URL('/meetings/availability',origin),{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({project_id:projectId,start,end}),credentials:'omit',redirect:'error',
        cache:'no-store',signal:AbortSignal.timeout(22000)
      });
      if (response.status===401 || response.status===403) throw Error('La consulta requiere autorización y MFA AAL2.');
      if (response.status===503) throw Error('El calendario corporativo o el servicio QA no está habilitado.');
      if (!response.ok) throw Error('No se pudo verificar el calendario corporativo.');
      const data=await response.json();
      return validateCalendarAvailabilityResponse(data,projectId);
    },
    async assessMeeting(projectId, fields) {
      if (!portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)) throw Error('Evaluación solo disponible en QA aislado.');
      const origin=agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL,import.meta.env.DEV);
      if(!origin) throw Error('API no configurada.');
      const {session}=check(await client.auth.getSession());
      if(!session?.access_token) throw Error('Sesión requerida.');
      const response=await fetch(new URL('/meetings/assess',origin),{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({subject:fields.subject,notes:fields.notes,management_requested:fields.management_requested,project_id:projectId}),credentials:'omit',redirect:'error',
        cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!response.ok) throw Error(`Evaluación rechazada (${response.status}).`);
      const data=await response.json();
      if(data.project_id!==projectId || data.engine_kind!=='rules' || data.persisted!==false || data.booking_authorized!==false || data.notifications_sent!==false) throw Error('Respuesta de evaluación inválida.');
      return data;
    },
    async consultationSummary(projectId) {
      const origin = agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL, import.meta.env.DEV);
      if (!origin) throw new Error("El servicio de consultas no está conectado.");
      const { session } = check(await client.auth.getSession());
      return fetchTenantSummary({ origin, token: session?.access_token, projectId });
    },
    async agentReadiness(projectId) {
      if (!authPolicy.isolatedQa) throw new Error('El enjambre solo puede verificarse en QA Integral.');
      const origin = agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL, import.meta.env.DEV);
      if (!origin) return qaAgentRegistryReadiness(client,{qaUrl:url,projectId});
      const { session } = check(await client.auth.getSession());
      return fetchAgentReadiness({origin, token: session?.access_token, projectId});
    },
    async reviewAgentRun(projectId, runId, resultHash, decision, note) {
      return submitAgentReview(client, {projectId, runId, resultHash, decision, note});
    },
    async runAgentRules(projectId, requestId) {
      const origin = agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL, import.meta.env.DEV);
      if (!origin) throw new Error('El servicio de asistentes no está conectado.');
      const { session } = check(await client.auth.getSession());
      return agentRuleRequest({origin, token:session?.access_token, projectId, requestId});
    },
    async agentRunDetail(projectId, runId) {
      const origin = agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL, import.meta.env.DEV);
      if (!origin) return qaAgentRunDetail(client,{qaUrl:url,projectId,runId});
      const { session } = check(await client.auth.getSession());
      return agentRuleRequest({origin, token:session?.access_token, projectId, runId});
    },
    async agentRuns(projectId, offset = 0) {
      const origin = agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL, import.meta.env.DEV);
      if (!origin) return qaAgentRuns(client,{qaUrl:url,projectId,offset});
      const { session } = check(await client.auth.getSession());
      return fetchAgentRuns({origin, token: session?.access_token, projectId, offset});
    },
    async monthlyReport(project, month, finalize=false) {
      return check(await client.rpc(finalize ? 'finalize_monthly_report' : 'monthly_report', { project, report_month: `${month}-01` }));
    },
    mode: 'cloud',
    calendarBookingEnabled: authPolicy.isolatedQa && import.meta.env.VITE_QA_CALENDAR_BOOKING_ENABLED==='true' && typeof import.meta.env.VITE_QA_CALENDAR_PILOT_PROJECT_ID==='string',
    async restoreSession() {
      user=null;
      const restored=await authentication.restoreSession();
      if(restored)user=restored;
      return restored;
    },
    async login({ email, password }) {
      user=null;
      const result=await authentication.login({email,password});
      if(!result.mfaRequired)user=result;
      return result;
    },
    async enrollMfa() {return authentication.enrollMfa();},
    async completeMfa(code) {user=await authentication.completeMfa(code);return user;},
    async logout() {user=null;await authentication.logout();},
    async load() {
      if(!user)throw Error('Completa la autenticación.');
      const results = await Promise.all([
        allPages(() => client.from('projects').select('*').order('id')),
        allPages(() => client.from('memberships').select('project_id,user_id,role,profiles(name)').order('project_id').order('user_id')),
        allPages(() => client.from('tickets').select('*').order('created_at', { ascending: false }).order('id')),
      ]);
      const [projects, members, tickets] = results;
      if(propertyMedia){
        try {
          const photos=await propertyMedia.projectPhotos(assignedProjects(projects,members,user.id));
          const filenames=new Map(photos.map(photo=>[photo.project_id,photo.filename]));
          for(const project of projects)project.photo_filename=filenames.get(project.id);
        } catch {
          // Keep the catalog usable when optional private photos cannot be loaded.
        }
      }
      return { projects:assignedProjects(projects,members,user.id), members:assignedMembers(members,user.id,projects).map(m => ({ ...m, name: m.profiles?.name || 'Colaborador' })), tickets:assignedTickets(tickets,user.id,members,projects) };
    },
    privateMediaEnabled,
    async authorizedCompanions(projectId,sector){
      if(!media||!user)throw Error('Catálogo privado disponible solo en QA aislado.');
      return media.companions(projectId,sector);
    },
    async companionPhotoUrl(projectId,personId){
      if(!media||!user)throw Error('Fotografías privadas disponibles solo en QA aislado.');
      return media.companionPhoto(projectId,personId);
    },
    async propertyPhotoUrl(projectId,filename){
      if(propertyMedia)return propertyMedia.propertyPhoto(projectId,filename);
      if(!user)throw Error('Sesión necesaria.');
      const [projects,members]=await Promise.all([
        allPages(()=>client.from('projects').select('id').order('id')),
        allPages(()=>client.from('memberships').select('project_id,user_id').eq('user_id',user.id).order('project_id'))
      ]);
      const allowed=new Set(members.map(m=>m.project_id));
      return signedPropertyPhoto(client.storage,projects.filter(p=>allowed.has(p.id)),projectId,filename);
    },
    async save(action, payload) { return check(await client.rpc('ticket_command', { command: action, payload })); },
    async upload(files, projectId, ticketId) {
      const uploaded = [];
      try {
        for (const file of files) {
          const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
          const path = `${projectId}/${user.id}/${ticketId}/${crypto.randomUUID()}.${ext}`;
          check(await client.storage.from('evidence').upload(path, file, { contentType: file.type, upsert: false }));
          uploaded.push({ path, name: file.name });
        }
        return uploaded;
      } catch (error) {
        // Uploaded objects remain private. Maintenance removes unattached objects.
        throw new Error(`No se completó la carga de fotos. Vuelve a intentarlo. ${error.message}`);
      }
    },
    async imageUrl(path) { return check(await client.storage.from('evidence').createSignedUrl(path, 300)).signedUrl; },
  };
}
