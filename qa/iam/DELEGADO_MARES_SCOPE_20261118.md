# ADPHOR QA Integral — delegado de una sola copropiedad
Fecha: 18 de noviembre de 2026.

**Alcance del piloto:** Edificio Mares (`source-7`), una única membresía de inmueble con `role='admin'`. El cargo de negocio es **Delegado / Administrador de copropiedad**. No usar `technician`, `viewer` ni `technical_admin` como sustitutos.

## Permisos
- Administrar casos, responsables, PQRS y Visitas **solo** dentro de su inmueble, sujeto a cada RLS.
- Consultar reuniones con el enlace manual a Google Calendar aprobado; sin reservar ni enviar invitaciones automáticamente.
- No administrar usuarios corporativos, auditoría histórica transversal ni las otras 42 copropiedades.
- Registro de contraseña propia y MFA TOTP AAL2 obligatorio antes de ver datos.

## Flujo autorizado de alta
1. Un operador corporativo verificado con MFA AAL2 usa **Usuarios y permisos** de la única QA Integral.
2. Crea una **invitación individual** desde IAM (servidor), asignando exclusivamente `source-7` y rol `admin`; no crear cuentas Auth con SQL directo.
3. Se certifica la invitación/aceptación real, el vínculo a `auth.users`, un `profile`, **una sola membresía** y ausencia de entrada en `iam_admin_allowlist`.
4. Cloudflare Access debe permitir el correo de prueba en el **hostname exacto** de QA Integral; no ampliar el wildcard a previews históricos sin revisión de seguridad.
5. Prueba AAL2: inicio y menú Mares; negativa AAL1, acceso a cualquier otro proyecto y accesos a IAM general.
6. Registrar evidencias sin contraseñas, enlaces de recuperación ni códigos MFA.

## Estado de esta contribución
Solo separación visual de la interfaz y pruebas sintéticas de denegación. **No crea ni invita** usuarios, no modifica Access ni Supabase y no despliega a QA hasta que el PR pase la validación y sea autorizado.
