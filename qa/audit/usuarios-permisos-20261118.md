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
