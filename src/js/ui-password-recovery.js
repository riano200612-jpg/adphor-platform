import {createClient} from '@supabase/supabase-js';
import {readQaRecovery, createPasswordRecovery} from './services/password-recovery.js';

export async function mountQaPasswordRecovery(root, {url, key, onLogin}) {
  const credentials = readQaRecovery(window.location, window.history, url);
  if (!credentials) return false;
  root.innerHTML = `<main id="main" class="login-form-wrap"><section class="panel" aria-labelledby="recovery-title"><p class="eyebrow">ADPHOR QA</p><h1 id="recovery-title">Establecer nueva contraseña</h1><p id="recovery-status" role="status">Verificando enlace…</p><p id="recovery-error" class="error" role="alert"></p><form id="password-recovery-form" hidden><label>Nueva contraseña<input name="password" id="recovery-new-password" type="password" autocomplete="new-password" minlength="12" required></label><button type="button" class="text-btn" data-toggle-password="recovery-new-password" aria-controls="recovery-new-password" aria-pressed="false">Mostrar contraseña</button><label>Confirmar contraseña<input name="confirmation" id="recovery-confirm-password" type="password" autocomplete="new-password" minlength="12" required></label><button type="button" class="text-btn" data-toggle-password="recovery-confirm-password" aria-controls="recovery-confirm-password" aria-pressed="false">Mostrar contraseña</button><p>Usa al menos 12 caracteres. Después deberás ingresar y completar MFA.</p><button class="btn primary" type="submit">Guardar nueva contraseña</button></form><button class="btn secondary" id="recovery-login" type="button">Volver al ingreso</button></section></main>`;
  const status = root.querySelector('#recovery-status');
  const errorBox = root.querySelector('#recovery-error');
  const form = root.querySelector('#password-recovery-form');
  const back = root.querySelector('#recovery-login');
  form.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = form.querySelector('#' + button.dataset.togglePassword);
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
      button.setAttribute('aria-pressed', String(visible));
    });
  });
  let recovery;
  let saving = false;
  back.addEventListener('click', async () => {
    if (saving) return;
    back.disabled = true;
    try { await recovery?.cancel(); onLogin(); }
    catch { errorBox.textContent = 'No se pudo cerrar la sesión de recuperación. Cierra esta pestaña y vuelve a abrir QA.'; back.disabled = false; }
  });
  if (credentials.error || !key) {
    status.textContent = '';
    errorBox.textContent = credentials.error || 'Falta configurar el servicio de recuperación.';
    return true;
  }
  try {
    const client = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}});
    recovery = await createPasswordRecovery(client.auth, credentials);
    status.textContent = 'Enlace verificado. Introduce tu nueva contraseña de forma privada.';
    form.hidden = false;
    form.elements.password.focus();
  } catch (error) {
    status.textContent = '';
    errorBox.textContent = error.message;
    return true;
  } finally {
    // Keep recovery credentials only in the auth client's in-memory session.
    credentials.access_token = ''; credentials.refresh_token = '';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const button = form.querySelector('button');
    button.disabled = true; back.disabled = true; errorBox.textContent = '';
    let password = form.elements.password.value;
    let confirmation = form.elements.confirmation.value;
    form.reset();
    try {
      const result = await recovery.update(password, confirmation);
      form.hidden = true;
      status.textContent = result.signedOut
        ? 'Contraseña actualizada. Vuelve al ingreso y completa MFA.'
        : 'Contraseña actualizada. Cierra esta pestaña y vuelve a abrir QA para ingresar y completar MFA.';
    } catch (error) { errorBox.textContent = error.message; }
    finally { password = ''; confirmation = ''; saving = false; button.disabled = false; back.disabled = false; }
  });
  return true;
}
