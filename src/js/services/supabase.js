import { createEvidenceApiRepository } from './evidence-api.js';
import { createPrivateMediaRepository } from './private-media.js';
import { signedPropertyPhoto } from './property-photos.js';
import { createCloudAuthentication } from './cloud-authentication.js';
import { qaAuthPolicy } from './qa-auth-policy.js';
import { createStaffDirectory } from './staff-directory.js';
import { assignedProjects, assignedMembers, assignedTickets } from './assigned-projects.js';
import { portoEnabled, createPortoRepository } from './porto.js';
import { submitAgentReview } from './agent-review.js';
import { createClient } from '@supabase/supabase-js';
import { agentApiOrigin, fetchAgentRuns, agentRuleRequest } from './agent-api.js';
import { fetchTenantSummary } from './tenant-consultation.js';
export function createCloudRepository(url, key) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
  let user = null;
  const privateMediaEnabled=import.meta.env.VITE_PRIVATE_MEDIA_QA_ENABLED==='true' && portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF);
  const media=privateMediaEnabled?createPrivateMediaRepository(client):null;
  const evidence=createEvidenceApiRepository({url,enabled:import.meta.env.VITE_QA_EVIDENCE_UPLOAD_ENABLED,stagingRef:import.meta.env.VITE_PORTO_STAGING_REF,origin:import.meta.env.VITE_AGENTS_API_URL,auth:client.auth,development:import.meta.env.DEV});
  const porto=createPortoRepository(client,{url,enabled:import.meta.env.VITE_PORTO_QA_ENABLED,stagingRef:import.meta.env.VITE_PORTO_STAGING_REF});
  if(evidence)porto.uploadEvidence=evidence.uploadEvidence;
  const authPolicy=qaAuthPolicy({url,requireMfa:import.meta.env.VITE_REQUIRE_MFA,hostname:globalThis.location?.hostname});
  const authentication=createCloudAuthentication(client,{required:authPolicy.required,
    allowEnrollment:authPolicy.isolatedQa || portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)});
  const staff=authPolicy.isolatedQa?createStaffDirectory(client):null;
  const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
  async function allPages(query) {
    const rows = [];
    for (let start=0;;start+=500) {
      const page=check(await query().range(start,start+499));
      rows.push(...page);
      if(page.length<500) return rows;
    }
  }
  return {
    porto,
    staffDirectoryEnabled:Boolean(staff),
    async staffDirectory(projectId){if(!staff||!user)throw Error('Equipo disponible solo en QA autorizado.');return staff.list(projectId);},
    async staffPhotoUrl(projectId,personId){if(!staff||!user)throw Error('Equipo disponible solo en QA autorizado.');return staff.photo(projectId,personId);},
    // Historical data is readable only when an isolated QA project is explicitly enabled.
    // Source status alone never proves a Google Calendar reservation.
    async listVerifiedQaMeetings(projectId) {
      if(!portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)) return [];
      if(!user) throw Error('Sesión necesaria.');
      const result=await client.from('qa_meeting_events')
        .select('id,project_id,title,source_status,start_at,end_at,is_calendar_verified')
        .eq('project_id',projectId).eq('is_calendar_verified',true)
        .eq('source_status','Confirmada').order('start_at',{ascending:true}).limit(500);
      return check(result);
    },
    async listQaPqrsHistory(projectId) {
      if(!portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)) return [];
      if(!user) throw Error('Sesión necesaria.');
      return check(await client.from('qa_pqrs_history')
        .select('id,project_id,source_id,subject,source_status,source_created_at')
        .eq('project_id',projectId).order('source_created_at',{ascending:false}).limit(200));
    },
    async meetingAvailability(projectId, start, end) {
      if (!portoEnabled(url,import.meta.env.VITE_PORTO_QA_ENABLED,import.meta.env.VITE_PORTO_STAGING_REF)) throw Error('Disponibilidad solo habilitada en QA.');
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
      if (data.project_id!==projectId || !Array.isArray(data.busy) || data.busy.some(slot=>
        !Number.isFinite(Date.parse(slot?.start)) || !Number.isFinite(Date.parse(slot?.end)) ||
        Date.parse(slot.end)<=Date.parse(slot.start))) throw Error('Respuesta de disponibilidad inválida.');
      return data.busy;
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
      if (!origin) throw new Error('El servicio de asistentes no está conectado.');
      const { session } = check(await client.auth.getSession());
      return agentRuleRequest({origin, token:session?.access_token, projectId, runId});
    },
    async agentRuns(projectId, offset = 0) {
      const origin = agentApiOrigin(import.meta.env.VITE_AGENTS_API_URL, import.meta.env.DEV);
      if (!origin) throw new Error('El servicio de asistentes todavía no está conectado a esta versión de la plataforma.');
      const { session } = check(await client.auth.getSession());
      return fetchAgentRuns({origin, token: session?.access_token, projectId, offset});
    },
    async monthlyReport(project, month, finalize=false) {
      return check(await client.rpc(finalize ? 'finalize_monthly_report' : 'monthly_report', { project, report_month: `${month}-01` }));
    },
    mode: 'cloud',
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
      if(media){
        const photos=await media.projectPhotos(assignedProjects(projects,members,user.id));
        for(const project of projects)project.photo_filename=photos.find(p=>p.project_id===project.id)?.filename;
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
      if(media)return media.propertyPhoto(projectId,filename);
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
