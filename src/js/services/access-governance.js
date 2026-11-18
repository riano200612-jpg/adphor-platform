// Gestión de usuarios: modelo de consulta y solicitudes locales, sin efectos en Auth, RLS ni sesiones.
// El permiso 'admin' de una copropiedad no implica poder administrar identidades generales.
export const PROPERTY_ROLES = Object.freeze({
  admin: 'Administrador de copropiedad',
  coordinator: 'Coordinador',
  technician: 'Técnico',
  viewer: 'Consulta'
});
export const ACCESS_STEPS = Object.freeze({
  invite: [
    'Verificar identidad, vínculo laboral y aprobación del responsable.',
    'Comprobar que quien autoriza tenga rol administrativo general y MFA AAL2 en el servidor.',
    'Invitar desde un servicio privado; nunca distribuir contraseñas compartidas.',
    'Asignar únicamente copropiedades y el rol aprobado.',
    'Exigir MFA y verificar una sesión real con alcance mínimo.',
    'Conservar registro inmutable de autor, fecha, aprobación y alcance.'
  ],
  offboard: [
    'Confirmar identidad exacta, relación laboral y autorización de la baja.',
    'Comprobar que la operación no elimine el último administrador general.',
    'Bloquear nuevos inicios de sesión en Supabase Auth y proveedores corporativos aplicables.',
    'Revocar sesiones y refresh tokens; impedir acceso sensible con JWT anterior hasta su expiración.',
    'Retirar membresías y accesos a Cloudflare Access, Google Workspace, Drive o Calendar cuando corresponda.',
    'Conservar historial y evidencias sin borrar casos, documentos ni registros históricos.',
    'Comprobar la denegación efectiva con una prueba autenticada y registrar el resultado.'
  ]
});
export function visibleAccessInventory(members = [], projects = []) {
  const names = new Map((Array.isArray(projects)?projects:[]).filter(p=>p && typeof p.id === 'string').map(p=>[p.id,String(p.name||p.id)]));
  const users = new Map();
  for (const m of Array.isArray(members)?members:[]) {
    if (!m || typeof m.user_id !== 'string' || !m.user_id || typeof m.project_id !== 'string' || !m.project_id) continue;
    const current = users.get(m.user_id) || { id:m.user_id, name:String(m.name || 'Usuario registrado'), roles:new Set(), projectIds:new Set(), assignments:new Set() };
    if(m.name && current.name === 'Usuario registrado')current.name=String(m.name);
    current.roles.add(String(m.role || 'Sin rol'));
    current.projectIds.add(m.project_id);
    current.assignments.add(m.project_id);
    users.set(m.user_id,current);
  }
  return [...users.values()].map(u=>({
    id:u.id, name:u.name,
    roles:[...u.roles].sort(),
    projectIds:[...u.projectIds].sort(),
    projectNames:[...u.projectIds].map(id=>names.get(id)||id).sort((a,b)=>a.localeCompare(b,'es')),
    assignmentCount:u.assignments.size,
    // No hay lectura de auth.users ni de sesiones en esta pantalla.
    accountStatus:'No verificado'
  })).sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
export function filterAccessInventory(users,search='') {
  const q=String(search).trim().toLocaleLowerCase('es');
  return (Array.isArray(users)?users:[]).filter(u=>
    !q || [u.name,...u.roles,...u.projectNames].some(x=>String(x).toLocaleLowerCase('es').includes(q)));
}
const text=(s)=>String(s||'').trim();
export function prepareAccessDraft(input = {}, users = [], projects = []) {
  const kind=text(input.kind);
  const projectSet=new Set((Array.isArray(projects)?projects:[]).map(p=>p?.id).filter(Boolean));
  if (kind === 'invite') {
    const email=text(input.email).toLowerCase(), projectId=text(input.projectId), role=text(input.role);
    if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email)) throw new Error('Indica un correo válido para el borrador.');
    if (!projectSet.has(projectId)) throw new Error('Selecciona una copropiedad visible.');
    if (!Object.hasOwn(PROPERTY_ROLES,role)) throw new Error('Selecciona un rol de copropiedad permitido.');
    return ['BORRADOR DE ALTA — NO EJECUTADO','Cuenta: '+email,'Copropiedad: '+projectId,'Rol solicitado: '+PROPERTY_ROLES[role],
      'IMPORTANTE: este borrador no crea una cuenta ni envía credenciales.','Requisitos previos:',...ACCESS_STEPS.invite.map((v,i)=>`  ${i+1}. ${v}`)].join('\n');
  }
  if (kind === 'offboard') {
    const id=text(input.targetId),reason=text(input.reason);
    const user=(Array.isArray(users)?users:[]).find(u=>u.id===id);
    if(!user)throw new Error('Selecciona una identidad visible y verificada antes de preparar la baja.');
    if(reason.length<8 || reason.length>500 || /[\r\n]/.test(reason))throw new Error('Especifica un motivo entre 8 y 500 caracteres, en una sola línea.');
    return ['BORRADOR DE BAJA — NO EJECUTADO','Persona: '+user.name,'Identificador: '+user.id,
      'Copropiedades visibles: '+user.projectNames.join(', '),'Motivo: '+reason,
      'IMPORTANTE: no se ha desactivado ninguna cuenta, membresía, sesión ni acceso.','Verificación antes de ejecutar:',
      ...ACCESS_STEPS.offboard.map((v,i)=>`  ${i+1}. ${v}`)].join('\n');
  }
  throw new Error('Acción no disponible: únicamente se preparan altas y bajas sin ejecutar cambios.');
}
