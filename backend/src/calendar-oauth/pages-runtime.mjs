import {QA_URL} from '../../../qa/security/private-worker-bootstrap-core.mjs';
import {callbackPath} from './authorization.mjs';
import {finalizePath} from './finalize.mjs';
import {createCalendarOAuthRuntime} from './runtime.mjs';

const operations = new Map([
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

export async function calendarOAuthPages(context, openDatabase) {
  const {request, env} = context;
  const url = new URL(request.url);
  const operation = operations.get(url.pathname);
  if (url.origin !== QA_URL || !operation || env?.ADPHOR_CALENDAR_OAUTH_ENABLED !== 'true') return response(404);
  if (request.method !== (operation === 'callback' ? 'GET' : 'POST')) return response(405);
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return response(403);

  let sql;
  try {
    sql = openDatabase(databaseOptions(env.ADPHOR_CALENDAR_OAUTH_DATABASE_URL));
    const routes = await createCalendarOAuthRuntime({
      database: {async query(statement, parameters) {return {rows: await sql.unsafe(statement, parameters)};}},
      encryptionKey: keyBytes(env.ADPHOR_CALENDAR_OAUTH_ENCRYPTION_KEY),
      access: {issuer: env.ADPHOR_CALENDAR_OAUTH_ACCESS_ISSUER, audience: env.ADPHOR_CALENDAR_OAUTH_ACCESS_AUDIENCE},
      supabase: {publishableKey: env.VITE_SUPABASE_ANON_KEY},
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
