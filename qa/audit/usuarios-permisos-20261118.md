# ADPHOR · Auditoría y mejora inicial de Usuarios y Permisos
Fecha: 2026-11-18
Destino: QA Integral. Rama de trabajo **no incluida** en despliegues automáticos Pages: `qa/usuarios-permisos-auditoria-20261118`.
Base revisada: `qa/integral-claude-reviewed-20261111` @ `5059cb265c54617f00afd94a0d681b27c1953d92`.

## Evidencias vivas (solo lectura)
- Supabase QA: `qfctnnnnltghepwujpdm` (no usar el proyecto productivo ADPHOR).
- `public.qa_staff_members`: 48 colaboradores; `public.profiles`: 2; `auth.users`: 3; `public.memberships`: 86; `auth.mfa_factors` verificados: 1.
- Las 86 membresías de los dos usuarios pertenecen al rol `admin` POR COPROPIEDAD; no son concesiones generales de IAM.
- RLS habilitado en perfiles y membresías. Autenticados tienen SELECT en esas tablas, no privilegios directos de escritura; cualquier administración deberá pasar por backend privado.
- Existe catálogo `qa_identity_private.principals` y la función `current_principal()` que exige identidad permitida, correo confirmado, entrada activa y AAL2, pero **no constituye por sí sola autorización global para altas/bajas ni un panel de cuentas Auth**.
- Cloudflare Pages proyecto `adphor-platform`: rama de Preview automática incluida: `qa/integral-claude-reviewed-20261111`; protección Access sobre `*.adphor-platform.pages.dev`. No modificar Access durante esta fase.
- Advisory Supabase: funciones SECURITY DEFINER accesibles a `authenticated` requieren revisión por función; protección contra contraseñas filtradas desactivada. No corregir automáticamente por el riesgo de romper otros módulos.

## Cambios aislados de primera fase
- Módulo de consulta de miembros realmente visibles por RLS, búsqueda local y etiquetas no ambiguas.
- Borradores **locales y no ejecutables** para invitar y dar de baja; ningún correo, invitación, revocación, alta ni modificación de BD.
- Roles solicitables limitados a `admin` de copropiedad, `coordinator`, `technician` y `viewer`; prohibido solicitar `technical_admin` por cliente.
- Checklist de baja: identidad verificada, mínimo un administrador general, bloqueo de nuevos accesos, revocación de sesiones, bloqueo del acceso sensible con JWT aún vigente, Cloudflare/Google si aplica, historial y prueba de denegación.
- Test unitarios sin usuarios reales, no se expone `service_role` en frontend.

## Decisiones pendientes antes de habilitar acciones reales
1. Definir propietarios del privilegio de administrador general y certificarlos individualmente con MFA AAL2. El rol por inmueble no concede el permiso global.
2. Implementar servicio privado con verificación server-side de usuario, AAL2, principal activo y permiso global, origen QA y recursos permitidos, CSRF/CORS adecuados, validación de entrada y protección frente a repetición.
3. Transacción para cambios de membresías/estados y registro inmutable de acción, actor, target, motivo, fecha, decisión y resultado. La invitación de Supabase Auth será una operación separada con compensación ante errores.
4. Plan para revocar refresh tokens/sesiones y negar acceso con JWT no expirado; el bloqueo simple no alcanza. Aplicar el mismo control a RLS, RPC y endpoints sensibles.
5. Pruebas negativas: anónimo, AAL1, no autorizado, administrador por copropiedad, escalada de `app_metadata`, IDOR entre inmuebles, eliminación del último superadministrador, doble solicitud, fallo parcial y rollback.
6. Validación en QA Integral con el propietario, seguridad, CI y Cloudflare Access antes de fusionar o desplegar.

## Dictamen de esta iteración
**UI/DESARROLLO PARCIAL, SIN PUBLICACIÓN:** se preparan operaciones; no existe todavía un backend certificado de gestión de identidades. No confundir tests locales o CI con certificados de Auth/SSO real.

## Adenda funcional — tres administradores (2026-11-18)
Regla del propietario: tres identidades administrativas son las únicas habilitables para crear, modificar, suspender o retirar cuentas. Todos los demás usuarios, incluidos `admin` por copropiedad, carecen de capacidad de IAM general.

### Verificación en base QA
- Auth: **3 cuentas**, de ellas **2 correos confirmados**.
- Catálogo `qa_identity_private.principals`: **3 registros técnicos**, **1 activo y 2 inactivos**; no modificados.
- MFA TOTP verificado: **1**.
- Es obligatorio identificar y certificar individualmente las dos cuentas inactivas antes de habilitar sus operaciones; 3 cuentas registradas ≠ 3 operadores habilitados.

### Implementación preparatoria en este PR (NO desplegada en QA)
- `qa/database/supabase/migrations/20261118150000_qa_iam_managed_users.sql`: esquema privado de empleados, listado administrativo, roles por copropiedad, invitaciones de corta duración, control RLS/AAL2, protección de administradores e historial.
- `functions/api/iam.js` + `src/qa-gates/iam-api-gate.js`: endpoint solo QA Integral con `ADPHOR_QA_IAM_ENABLED=true`, `ADPHOR_QA_IAM_REF=qfctnnnnltghepwujpdm` y secreto privado `SUPABASE_SERVICE_ROLE_KEY`. Todos ausentes ⇒ 503, sin crear/banear usuarios. Autenticación real, JWT firmado, sesión AAL2, actor admin activo y sesión vigente obligatorios; origen exacto, anti-IDOR en SQL.
- `src/js/services/iam-client.js`, `src/js/ui-iam-live.js`: panel de operaciones reales **solo después** de que el servidor confirme autorización; de otro modo conserva auditoría/borradores.
- Invitaciones: reserva efímera previa → Supabase Auth invite → vinculación específica al usuario invitado → perfil y membresías; correo de aceptación habilita elección de contraseña mediante flujo QA existente, luego MFA obligatorio.
- Roles: cambio por lista explícita de edificios (no global admin).
- Suspensión y baja: deshabilitar principal antes de bloquear Auth; ban y confirmación posterior en bitácora; reintentos parciales no se proclaman éxito.
- **Referencias históricas**: `tickets`, `qa_visits` y `pilot_pqrs` tienen claves foráneas a `memberships`. La revocación conserva esas filas para no romper operaciones históricas; el RLS deniega inmediatamente la identidad. La retirada definitiva de asignaciones y reasignación de responsables requiere una etapa supervisada adicional.

### Activación deliberadamente pendiente
1. Revisión de funciones privilegiadas, política de invitación real y compensación si falla Auth; confirmar Supabase Auth callback real de invitación/contraseña.
2. Certificar identidades y MFA para las tres cuentas administrativas; 2 están inactivas y una cuenta no tiene correo confirmado.
3. Revisión y aplicación controlada de la migración exclusivamente en Supabase QA con respaldo y pruebas AAL1/AAL2 y múltiples inmuebles.
4. Configurar secreto solo de backend, habilitar flag QA bajo control y probar API bajo Cloudflare Access (Allow/Deny), accesos cruzados y suspensión con JWT previo.
5. Prueba operativa: correo de invitación entregado, aceptación y creación de contraseña, rol por edificio, retiro de acceso, reatribución de tickets/visitas/PQRS y notificaciones.
6. Solo tras CI integral, revisión de seguridad y autorización de propietario, fusionar PR de prueba a única QA Integral; producción y archivos originales sin tocar.
