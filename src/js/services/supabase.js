import { createClient } from '@supabase/supabase-js';
export function createCloudRepository(url, key) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
  let user = null;
  const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
  return {
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
        client.from('projects').select('*').order('name'),
        client.from('memberships').select('project_id,user_id,role,profiles(name)'),
        client.from('tickets').select('*').order('created_at', { ascending: false }),
      ]);
      const [projects, members, tickets] = results.map(check);
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
