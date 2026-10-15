import { getState, setCurrentUser } from '../core/state.js';

/** Perfiles de acceso. Los nombres corrigen el original, que guardaba el cargo como nombre. */
export const USERS = Object.freeze({
  angelica: { id: 'angelica', name: 'Angélica Castilla', role: 'Gerente General', department: 'Gerencia' },
  adalberto: { id: 'adalberto', name: 'Adalberto Gándara', role: 'Asesor Financiero', department: 'Finanzas' },
  carlos: { id: 'carlos', name: 'Carlos Restrepo', role: 'Administrador Operativo', department: 'Campo' },
  orlando: { id: 'orlando', name: 'Dr. Orlando Bustillo', role: 'Presidente de Consejo', department: 'Junta' },
});

/**
 * Matriz de permisos. Pendiente de validar con ADPHOR: hoy todos los perfiles
 * conservan el acceso del original, para no introducir cambios de comportamiento.
 */
const ALL_PERMISSIONS = ['minutas:write', 'minutas:status', 'reports:export', 'projects:switch'];
const PERMISSIONS = Object.freeze({
  Gerencia: ALL_PERMISSIONS,
  Finanzas: ALL_PERMISSIONS,
  Campo: ALL_PERMISSIONS,
  Junta: ALL_PERMISSIONS,
});

export const can = (user, permission) =>
  PERMISSIONS[user?.department]?.includes(permission) ?? false;

export function initAuth({ onLogin }) {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = USERS[new FormData(form).get('user')];
    if (!profile) return;

    setCurrentUser(profile);
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('main-interface').classList.remove('hidden');
    onLogin(profile);
  });
}

export function logout() {
  setCurrentUser(null);
  document.getElementById('main-interface').classList.add('hidden');
  document.getElementById('login-modal').classList.remove('hidden');
  document.getElementById('login-user').focus();
}

export const isLoggedIn = () => Boolean(getState().currentUser);