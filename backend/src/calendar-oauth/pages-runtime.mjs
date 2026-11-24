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
  ['/api/integrations/google-calendar/meetings/create', 'createMeeting'],
  ['/api/integrations/google-calendar/meetings/list', 'listMeetings'],
]);

function response(status) {
  return new Response(null, {status, headers: {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'}});
}

function diagnosis(status, code, databaseReason) {
  console.warn(code);
  const headers = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-ADPHOR-Calendar-Code': code,
  };
  if (databaseReason) headers['X-ADPHOR-Calendar-Reason'] = databaseReason;
  return new Response(null, {status, headers});
}

const safeDatabaseTransportCodes = new Set(['CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'ERR_TLS_HANDSHAKE_TIMEOUT', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_TLS_UNSUPPORTED_PROTOCOL', 'ERR_TLS_INVALID_PROTOCOL_VERSION', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_WORKER_UNSUPPORTED_OPERATION', 'ERR_INVALID_ARG_TYPE', 'ERR_MODULE_NOT_FOUND', 'ERR_SSL_WRONG_VERSION_NUMBER', 'ERR_SSL_BAD_RECORD_MAC', 'TYPEERROR', 'RANGEERROR', 'OTHER']);

function databaseTransportReason(error) {
  // Inspect only structured error codes, including wrapped Postgres.js errors.
  // Never read or return Error.message, host, address, stack or credentials.
  for (const candidate of [error, error?.cause, error?.cause?.cause]) {
    const code = typeof candidate?.code === 'string' ? candidate.code : '';
    if (safeDatabaseTransportCodes.has(code)) return code;
    const name = typeof candidate?.name === 'string' ? candidate.name.toUpperCase() : '';
    if (safeDatabaseTransportCodes.has(name)) return name;
  }
  return 'OTHER';
}

function databaseFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code.startsWith('28') || code === 'SASL_SIGNATURE_MISMATCH') return 'CAL_DB_LOGIN';
  if (code.startsWith('ERR_TLS_') || code.startsWith('ERR_SSL_') || code.startsWith('CERT_') ||
      ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT'].includes(code)) return 'CAL_DB_TLS';
  if (/^(?:[0-9][0-9A-Z]|P0|XX|F0|HV)[A-Z0-9]{3}$/.test(code)) return 'CAL_DB_SQL';
  return 'CAL_DB_TRANSPORT';
}

// Cloudflare's QA-only Hyperdrive binding owns the verified TLS connection
// to the direct Supabase QA PostgreSQL origin. Never pass CA or origin credentials into Workerd.
function hyperdriveConnectionArgs(binding) {
  const connectionString = binding?.connectionString;
  if (typeof connectionString !== 'string') throw new Error('QA Hyperdrive binding unavailable.');
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Invalid QA Hyperdrive binding.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname || !url.username || !url.password || url.hash ||
      connectionString.length > 8192) {
    throw new Error('Invalid QA Hyperdrive binding.');
  }
  return [connectionString, {
    max: 1, connect_timeout: 5, fetch_types: false, onnotice: () => {},
  }];
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
    (SELECT rolinherit AND NOT rolsuper AND NOT rolbypassrls
       FROM pg_catalog.pg_roles WHERE rolname = current_user) AS constrained_login,
    pg_has_role(current_user, 'adphor_qa_calendar_oauth_state', 'USAGE') AS inherited_state_role,
    (SELECT count(*) = 3 FROM pg_catalog.pg_tables
      WHERE schemaname = 'calendar_oauth_private' AND rowsecurity
        AND tablename IN ('transactions', 'pending', 'connections')) AS rls,
    has_column_privilege(current_user, 'calendar_oauth_private.connections', 'payload', 'INSERT') AS can_store,
    has_column_privilege(current_user, 'calendar_oauth_private.connections', 'payload', 'SELECT') AS can_read_encrypted_payload,
    has_column_privilege(current_user, 'calendar_oauth_private.connections', 'user_id', 'SELECT') AS can_scope_user,
    has_column_privilege(current_user, 'calendar_oauth_private.connections', 'project_id', 'SELECT') AS can_scope_project,
    NOT has_column_privilege(current_user, 'calendar_oauth_private.connections', 'created_at', 'SELECT') AS no_extra_column_read,
    NOT has_table_privilege(current_user, 'calendar_oauth_private.connections', 'SELECT') AS no_tablewide_read,
    NOT has_table_privilege(current_user, 'calendar_oauth_private.connections', 'UPDATE') AS no_tablewide_update,
    NOT has_table_privilege(current_user, 'calendar_oauth_private.connections', 'DELETE') AS no_tablewide_delete,
    NOT has_schema_privilege('authenticated', 'calendar_oauth_private', 'USAGE') AS browser_denied`);
  } catch (error) {
    const code = databaseFailure(error);
    return diagnosis(503, code, code === 'CAL_DB_TRANSPORT' ? databaseTransportReason(error) : undefined);
  }
  const [row] = rows;
  if (rows.length !== 1 || row?.dedicated !== true || row.constrained_login !== true ||
      row.inherited_state_role !== true || row.rls !== true || row.can_store !== true ||
      row.can_read_encrypted_payload !== true || row.can_scope_user !== true || row.can_scope_project !== true ||
      row.no_extra_column_read !== true || row.no_tablewide_read !== true ||
      row.no_tablewide_update !== true || row.no_tablewide_delete !== true || row.browser_denied !== true) {
    return diagnosis(503, 'CAL_DB_PERMISSIONS');
  }
  return response(204);
}

export async function calendarOAuthPages(context, openDatabase) {
  const {request, env} = context;
  const url = new URL(request.url);
  const operation = operations.get(url.pathname);
  const pilotProjectId=env?.ADPHOR_CALENDAR_OAUTH_PILOT_PROJECT_ID;
  const pilotConfigured=typeof pilotProjectId==='string'&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(pilotProjectId)&&
    typeof env?.ADPHOR_CALENDAR_OAUTH_PILOT_EMAIL==='string'&&env.ADPHOR_CALENDAR_OAUTH_PILOT_EMAIL.length>0;
  if (url.origin !== QA_URL || !operation || (operation !== 'readiness' &&
      (env?.ADPHOR_CALENDAR_OAUTH_PILOT_ENABLED !== 'true' || !pilotConfigured))) return response(404);
  if (request.method !== (operation === 'callback' ? 'GET' : 'POST')) return response(405);
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) {
    return operation === 'readiness' ? diagnosis(403, 'CAL_ACCESS') : response(403);
  }

  const access = {issuer: env.ADPHOR_CALENDAR_OAUTH_ACCESS_ISSUER, audience: env.ADPHOR_CALENDAR_OAUTH_ACCESS_AUDIENCE};
  if (operation !== 'readiness') {
    let verified;
    try { verified = await createCalendarAccessVerifier(access)(request); }
    catch { return response(503); }
    if (!verified?.subject) return response(403);
  }

  let sql;
  try {
    const supabase = {publishableKey: env.VITE_SUPABASE_ANON_KEY};
    const connect = () => (sql ??= openDatabase(...hyperdriveConnectionArgs(env.ADPHOR_CALENDAR_QA_HYPERDRIVE)));
    if (operation === 'readiness') return await probeCalendarDatabase(request, {
      verifyAccess: createCalendarAccessVerifier(access),
      ...createCalendarSupabaseAuthorization(supabase),
      connect,
    });
    connect();
    const routes = await createCalendarOAuthRuntime({
      database: {
        async query(statement, parameters) {return {rows: await sql.unsafe(statement, parameters)};},
        async transaction(callback) {
          return sql.begin(async transaction=>callback({
            async query(statement,parameters) {return {rows:await transaction.unsafe(statement,parameters)};},
          }));
        },
      },
      encryptionKey: keyBytes(env.ADPHOR_CALENDAR_OAUTH_ENCRYPTION_KEY),
      access, supabase,
      google: {
        clientId: env.ADPHOR_CALENDAR_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: env.ADPHOR_CALENDAR_OAUTH_GOOGLE_CLIENT_SECRET,
        expectedEmail: env.ADPHOR_CALENDAR_OAUTH_PILOT_EMAIL,
        pilotProjectId: env.ADPHOR_CALENDAR_OAUTH_PILOT_PROJECT_ID,
      },
    });
    return await routes[operation](request);
  } catch {
    return operation === 'readiness' ? diagnosis(503, 'CAL_RUNTIME_CONFIG') : response(503);
  } finally {
    if (sql) await sql.end({timeout: 2}).catch(() => {});
  }
}
