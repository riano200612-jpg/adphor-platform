import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = 'https://qfctnnnnltghepwujpdm.supabase.co';
const owner = '9521a728-7b7d-4ffc-ad8c-82fb750978e1';
const email = 'riano200612@gmail.com';
const key = process.env.ADPHOR_QA_SUPABASE_API_KEY;
const [importer, manifest, originals] = process.argv.slice(2);

function hidden(prompt) {
  const result = spawnSync('python3', [
    '-c', 'import getpass,sys; print(getpass.getpass(sys.argv[1]))', prompt
  ], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  if (result.status !== 0 || !result.stdout.trim()) throw Error('Entrada local cancelada.');
  return result.stdout.replace(/\r?\n$/, '');
}

function checked(result, stage) {
  if (result.error) throw Error(stage + ' falló.');
  return result.data;
}

async function main() {
  if (!process.stdin.isTTY || !key?.startsWith('sb_publishable_') || !originals) {
    throw Error('Se requieren terminal local, clave publicable QA y tres rutas.');
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const login = checked(await client.auth.signInWithPassword({
    email, password: hidden('Contraseña Supabase QA: ')
  }), 'Inicio de sesión');
  if (login.user?.id !== owner) throw Error('Identidad QA inesperada.');
  const { totp } = checked(await client.auth.mfa.listFactors(), 'Consulta MFA');
  if (totp.length !== 1 || totp[0].status !== 'verified') throw Error('Se requiere un TOTP verificado.');
  const verified = checked(await client.auth.mfa.challengeAndVerify({
    factorId: totp[0].id, code: hidden('Código TOTP de QA: ')
  }), 'Verificación TOTP');
  const token = verified.access_token;
  const { user } = checked(await client.auth.getUser(token), 'Validación del token');
  const level = checked(await client.auth.mfa.getAuthenticatorAssuranceLevel(token), 'Validación AAL');
  if (user?.id !== owner || level.currentLevel !== 'aal2') throw Error('La sesión no cumple identidad y AAL2.');
  console.log('Identidad QA y AAL2 comprobados.');
  const result = spawnSync('python3', [importer, manifest, originals, '--upload'], {
    stdio: 'inherit', env: { ...process.env, ADPHOR_QA_STORAGE_TOKEN: token }
  });
  if (result.status !== 0) throw Error('Importación incompleta. No ejecutar link_verified.sql.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
