import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';
import {createCalendarAccessVerifier} from './access.mjs';
import {createCalendarSupabaseAuthorization} from './supabase-authorization.mjs';
import {callbackPath} from './authorization.mjs';
import {finalizePath} from './finalize.mjs';
import {createCalendarOAuthRuntime} from './runtime.mjs';

const operations = new Map([
  ['/api/integrations/google-calendar/oauth/readiness', 'readiness'],
  ['/api/integrations/google-calendar/oauth/start', 'start'],
  [callbackPath, 'callback'],
  [finalizePath, 'finalize'],
]);

function response(status) {
  return new Response(null, {status, headers: {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'}});
}

function databaseOptions(connectionString) {
  const url = new URL(connectionString);
  if (url.protocol !== 'postgresql:' || !/^aws-[0-9]+-us-east-1\.pooler\.supabase\.com$/.test(url.hostname) ||
      url.port !== '5432' || url.pathname !== '/postgres' || url.search || url.hash ||
      url.username !== 'adphor_qa_calendar_oauth_login.qfctnnnnltghepwujpdm' || !url.password) {
    throw new Error('Invalid QA database configuration.');
  }
  return {
    host: url.hostname, port: 5432, database: 'postgres', username: url.username,
    password: decodeURIComponent(url.password), ssl: 'verify-full',
    max: 1, connect_timeout: 5, onnotice: () => {},
  };
}

function keyBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('Invalid QA encryption key.');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}

// The probe reads only server metadata. It never uses Google's OAuth credentials.
export async function probeCalendarDatabase(request, {verifyAccess, verifySession, lookupRole, connect}) {
  const url = new URL(request.url);
  const fields = [...url.searchParams];
  const projectId = url.searchParams.get('project');
  if (request.headers.get('Origin') !== QA_URL) return response(403);
  if (fields.length !== 1 || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(projectId ?? '') ||
      request.body !== null) return response(400);
  const bearer = /^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!bearer) return response(401);
  if (!(await verifyAccess(request))?.subject) return response(403);
  const session = await verifySession(bearer);
  if (!session?.userId) return response(401);
  if (session.aal !== 'aal2') return response(403);
  const role = await lookupRole({bearer, userId: session.userId, projectId});
  if (!['admin', 'coordinator'].includes(role)) return response(403);

  const sql = connect();
  const rows = await sql.unsafe(`SELECT
    current_user = 'adphor_qa_calendar_oauth_login' AS dedicated,
    (SELECT count(*) = 3 FROM pg_catalog.pg_tables
      WHERE schemaname = 'calendar_oauth_private' AND rowsecurity
        AND tablename IN ('transactions', 'pending', 'connections')) AS rls,
    has_column_privilege(current_user, 'calendar_oauth_private.connections', 'payload', 'INSERT') AS can_store,
    NOT has_table_privilege(current_user, 'calendar_oauth_private.connections', 'SELECT') AS cannot_read,
    NOT has_schema_privilege('authenticated', 'calendar_oauth_private', 'USAGE') AS browser_denied`);
  const [row] = rows;
  return response(rows.length === 1 && row.dedicated === true && row.rls === true &&
    row.can_store === true && row.cannot_read === true && row.browser_denied === true ? 204 : 503);
}

export async function calendarOAuthPages(context, openDatabase) {
  const {request, env} = context;
  const url = new URL(request.url);
  const operation = operations.get(url.pathname);
  if (url.origin !== QA_URL || !operation || (operation !== 'readiness' && env?.ADPHOR_CALENDAR_OAUTH_ENABLED !== 'true')) return response(404);
  if (request.method !== (operation === 'callback' ? 'GET' : 'POST')) return response(405);
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return response(403);

  let sql;
  try {
    const access = {issuer: env.ADPHOR_CALENDAR_OAUTH_ACCESS_ISSUER, audience: env.ADPHOR_CALENDAR_OAUTH_ACCESS_AUDIENCE};
    const supabase = {publishableKey: env.VITE_SUPABASE_ANON_KEY};
    const connect = () => (sql ??= openDatabase(databaseOptions(env.ADPHOR_CALENDAR_OAUTH_DATABASE_URL)));
    if (operation === 'readiness') return await probeCalendarDatabase(request, {
      verifyAccess: createCalendarAccessVerifier(access),
      ...createCalendarSupabaseAuthorization(supabase),
      connect,
    });
    connect();
    const routes = await createCalendarOAuthRuntime({
      database: {async query(statement, parameters) {return {rows: await sql.unsafe(statement, parameters)};}},
      encryptionKey: keyBytes(env.ADPHOR_CALENDAR_OAUTH_ENCRYPTION_KEY),
      access, supabase,
      google: {
        clientId: env.ADPHOR_CALENDAR_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: env.ADPHOR_CALENDAR_OAUTH_GOOGLE_CLIENT_SECRET,
        expectedEmail: env.ADPHOR_CALENDAR_OAUTH_PILOT_EMAIL,
      },
    });
    return await routes[operation](request);
  } catch {
    return response(503);
  } finally {
    if (sql) await sql.end({timeout: 2}).catch(() => {});
  }
}
