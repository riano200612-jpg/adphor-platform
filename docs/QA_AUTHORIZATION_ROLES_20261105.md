# QA: identidades autorizadas y separación de funciones

**Prioridad vigente:** auditoría interna del propietario. La cuenta del cliente
está inactiva en el padrón y su permiso Access se retira; no debe recibir
invitaciones ni acceso antes de autorización expresa. Ver
`QA_OWNER_AUDIT_FIRST_20261105.md`. Las dos identidades siguientes describen
los roles de ambas fases, no dos cuentas habilitadas simultáneamente.

Aplicable únicamente a Supabase `qfctnnnnltghepwujpdm` y las vistas previas de
Cloudflare Pages `adphor-platform`. No se modificó producción.

## Verificación de identidad y recuperación

El propietario identificó expresamente las dos cuentas autorizadas. La identidad
del cliente fue corroborada mediante la notificación de Google Drive del
27 de octubre de 2026 que compartió la carpeta «Plataforma ADPHOR».
No se publican en este archivo datos de autenticación ni el padrón de correos.

Se conservó intacta la política administrativa de Access
`e599bbc9-5cc7-46a3-8c10-da62fd8ba65f`. Se añadió para el cliente la política
específica `ac9cbe54-5aa0-4671-89c9-40a0d9cc87a1`, en la aplicación
`404fe4c0-6373-480b-9117-eba14c9c26b7`, destino
`*.adphor-platform.pages.dev`. Ambas permiten correos exactos; sin dominios
amplios, bypass ni nuevas cuentas históricas. La política original no fue
reemplazada ni se cambiaron proveedores, sesiones o configuración MFA de Access.
Access no tenía exigencia MFA activa: no presentar su OTP de correo como
segundo factor TOTP de Supabase.

## Roles en Supabase QA

| Identidad | Rol de aplicación | Rol operativo por copropiedad |
| --- | --- | --- |
| Propietario técnico | technical_admin | admin |
| Cliente y auditor funcional | functional_admin_auditor | coordinator |

El rol coordinator permite operar y verificar los casos con las reglas existentes,
sin conceder al cliente credenciales SQL, service_role, GitHub o Cloudflare.
Las referencias históricas `admin`, `j.guzman`, `g.hernandez` no crean usuarios.
El identificador de rol `admin` continúa siendo un rol válido, no una cuenta.

El padrón de dos correos se guardó únicamente en
`qa_identity_private.principals`, con RLS y sin SELECT/INSERT/UPDATE para clientes.
No se incluyen los datos del padrón en esta migración pública.

La migración QA `20261105144315_qa_authorized_principals.sql` está aplicada:

- Verifica identidad contra auth.users, confirmación de correo y padrón activo.
- Exige `aal2` en las ocho tablas públicas mediante políticas restrictivas.
- Protege los RPC existentes mediante project_role/visible_profile.
- Storage mantiene sus cuatro políticas, que consultan project_role.
- No confía en correos o roles de user_metadata/JWT editables por el cliente.
- Prepara before_user_created para limitar las altas al padrón.
- Prepara provision_confirmed_users para asignar perfiles y membresías a
  usuarios Auth existentes y confirmados; sólo ejecución administrativa.

## Validación

- Pruebas JavaScript: 205 PASS.
- Contrato PGlite: comprueba AAL1, tercero, correo sin confirmar, falsificación de
  rol, permisos sobre padrón, acceso Storage, revocación e idempotencia.
- Verificación en QA hospedado: dos principals y ocho políticas restrictivas.
- Prueba SQL hospedada con claims sintéticos: tercero sin perfil/proyectos ni rol,
  incluso presentando un correo autorizado y user_metadata.role=admin.
  Esta prueba no certifica emisión/verificación de JWT reales.
- Advisors: permanecen tres RPC públicos SECURITY DEFINER para revisar; las tablas
  privadas sin políticas están cerradas intencionadamente a los roles cliente.
- Primer intento de migración revertido íntegramente por propiedad administrada
  de storage.objects. Se retiró esa alteración: no se cambió su propietario ni RLS.

## Pendiente antes de certificar la aplicación

Auth sigue con cero usuarios. El padrón autorizado NO sustituye a las cuentas Auth.
Se requiere sesión administrativa en Supabase para completar por el canal Auth:

1. Registrar el hook before_user_created y comprobar configuración de altas.
2. Crear/onboard únicamente las dos identidades, sin confirmaciones de correo
   ficticias, contraseñas compartidas ni creación manual de auth.users mediante SQL.
3. Configurar URLs de redirección para el alias real QA.
4. Completar registro personal de MFA y recuperación segura.
5. Ejecutar provision_confirmed_users como administrador, y verificar roles reales.
6. Probar login y aislamiento con JWT auténticos y los dos usuarios.
7. Completar UI de alta/recuperación/MFA, módulos y calificación funcional.

No se enviaron invitaciones o mensajes. No se declaró ingreso del cliente,
registro de MFA ni plataforma integral certificada. El modo de página mínima
continúa activo mientras falten las comprobaciones exigidas por el Gauntlet.
