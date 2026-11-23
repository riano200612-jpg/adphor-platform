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

function diagnosis(status, code) {
  console.warn(code);
  return new Response(null, {status, headers: {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-ADPHOR-Calendar-Code': code,
  }});
}

function databaseFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code.startsWith('28')) return 'CAL_DB_LOGIN';
  if (code.startsWith('ERR_TLS_') || code.startsWith('CERT_') ||
      ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT'].includes(code)) return 'CAL_DB_TLS';
  if (/^(?:[0-9][0-9A-Z]|P0|XX|F0|HV)[A-Z0-9]{3}$/.test(code)) return 'CAL_DB_SQL';
  return 'CAL_DB_TRANSPORT';
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

async function hasEmptyBody(request) {
  if (request.body === null) return true;
  try {
    // Workerd can expose an empty POST as a stream. Stop at the first payload byte.
    for await (const chunk of request.body) {
      if (chunk.byteLength !== 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// The probe reads only server metadata. It never uses Google's OAuth credentials.
export async function probeCalendarDatabase(request, {verifyAccess, verifySession, lookupRole, connect}) {
  const url = new URL(request.url);
  const fields = [...url.searchParams];
  const projectId = url.searchParams.get('project');
  if (request.headers.get('Origin') !== QA_URL) return diagnosis(403, 'CAL_ORIGIN');
  if (fields.length !== 1 || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(projectId ?? '') ||
      !(await hasEmptyBody(request))) return diagnosis(400, 'CAL_REQUEST');
  const bearer = /^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!bearer) return diagnosis(401, 'CAL_SESSION');

  let access;
  try { access = await verifyAccess(request); }
  catch { return diagnosis(503, 'CAL_ACCESS_UNAVAILABLE'); }
  if (!access?.subject) return diagnosis(403, 'CAL_ACCESS');
  let session;
  try { session = await verifySession(bearer); }
  catch { return diagnosis(503, 'CAL_AUTH_UNAVAILABLE'); }
  if (!session?.userId) return diagnosis(401, 'CAL_SESSION');
  if (session.aal !== 'aal2') return diagnosis(403, 'CAL_AAL2');
  let role;
  try { role = await lookupRole({bearer, userId: session.userId, projectId}); }
  catch { return diagnosis(503, 'CAL_MEMBERSHIP_UNAVAILABLE'); }
  if (!['admin', 'coordinator'].includes(role)) return diagnosis(403, 'CAL_MEMBERSHIP');

  let sql;
  try { sql = connect(); }
  catch { return diagnosis(503, 'CAL_DB_CONFIG'); }
  let rows;
  try {
    rows = await sql.unsafe(`SELECT
    current_user = 'adphor_qa_calendar_oauth_login' AS dedicated,
    (SELECT count(*) = 3 FROM pg_catalog.pg_tables
      WHERE schemaname = 'calendar_oauth_private' AND rowsecurity
        AND tablename IN ('transactions', 'pending', 'connections')) AS rls,
    has_column_privilege(current_user, 'calendar_oauth_private.connections', 'payload', 'INSERT') AS can_store,
    NOT has_table_privilege(current_user, 'calendar_oauth_private.connections', 'SELECT') AS cannot_read,
    NOT has_schema_privilege('authenticated', 'calendar_oauth_private', 'USAGE') AS browser_denied`);
  } catch (error) {
    return diagnosis(503, databaseFailure(error));
  }
  const [row] = rows;
  if (rows.length !== 1 || row?.dedicated !== true || row.rls !== true ||
      row.can_store !== true || row.cannot_read !== true || row.browser_denied !== true) {
    return diagnosis(503, 'CAL_DB_PERMISSIONS');
  }
  return response(204);
}

export async function calendarOAuthPages(context, openDatabase) {
  const {request, env} = context;
  const url = new URL(request.url);
  const operation = operations.get(url.pathname);
  if (url.origin !== QA_URL || !operation || (operation !== 'readiness' && env?.ADPHOR_CALENDAR_OAUTH_ENABLED !== 'true')) return response(404);
  if (request.method !== (operation === 'callback' ? 'GET' : 'POST')) return response(405);
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) {
    return operation === 'readiness' ? diagnosis(403, 'CAL_ACCESS') : response(403);
  }

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
    return operation === 'readiness' ? diagnosis(503, 'CAL_RUNTIME_CONFIG') : response(503);
  } finally {
    if (sql) await sql.end({timeout: 2}).catch(() => {});
  }
}
