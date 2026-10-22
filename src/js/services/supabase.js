import { submitAgentReview } from './agent-review.js';
import { createClient } from '@supabase/supabase-js';
import { agentApiOrigin, fetchAgentRuns, agentRuleRequest } from './agent-api.js';
export function createCloudRepository(url, key) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
  let user = null;
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
      const loginEmail = email.trim().toLowerCase() === 'adphor' ? 'demo-adphor@example.invalid' : email.trim();
      const data = check(await client.auth.signInWithPassword({ email: loginEmail, password }));
      const profile = check(await client.from('profiles').select('name').eq('id', data.user.id).single());
      user = { id: data.user.id, name: profile.name };
      return user;
    },
    async logout() { check(await client.auth.signOut()); user = null; },
    async load() {
      const results = await Promise.all([
        allPages(() => client.from('projects').select('*').order('id')),
        allPages(() => client.from('memberships').select('project_id,user_id,role,profiles(name)').order('project_id').order('user_id')),
        allPages(() => client.from('tickets').select('*').order('created_at', { ascending: false }).order('id')),
      ]);
      const [projects, members, tickets] = results;
      return { projects, members: members.map(m => ({ ...m, name: m.profiles?.name || 'Colaborador' })), tickets };
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
