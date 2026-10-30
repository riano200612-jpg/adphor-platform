# QA — Política de avisos de bloqueo de cuentas

**Prohibición vigente:** no enviar correo, SMS, WhatsApp ni invitaciones de calendario automáticamente, ni siquiera cuando una cuenta de delegado o residente queda bloqueada.

## Código integrado
- `backend/src/adphor_ai/notification_policy.py`: genera decisiones `deny-by-default`, rechazo obligatorio en QA y evento de auditoría sin correos, PIN o tokens.
- `backend/tests/test_notification_policy.py`: verifica ausencia de autorización para envíos QA y estructura del evento.
- `src/js/services/communication-gate.js`: política de interfaz previamente incluida.

## Hallazgo del código de José
- `validarUsuario` de Apps Script original llama a `MailApp.sendEmail` cuando llega al umbral de intentos fallidos.
- `validarResidente` llama a `MailApp.sendEmail` al delegado tras bloquear por fallos.
- **NO** modificar ni ejecutar el Apps Script original desde QA. Ningún correo se envió durante esta intervención.

## Integración restante, obligatoria antes de activar autenticación heredada
1. Conectar el evento de bloqueo real al registro persistente de auditoría mediante una transacción y verificación de tenant y rol.
2. Eliminar/desactivar toda llamada directa de email de las copias saneadas de `validarUsuario` y `validarResidente`; usar un servicio central auditado.
3. Garantizar que cada worker y proveedor aplica la política en backend; deshabilitar configuración, API keys y tareas de salida mientras QA esté activo.
4. Pruebas E2E: tres errores consecutivos bloquean el acceso, no producen peticiones HTTP de correo y no escriben secretos en logs.
5. Activar proveedores únicamente con autorización específica futura y reglas revisadas.

**Estado:** regla de seguridad y pruebas implementadas; integración transaccional y pruebas E2E pendientes. La protección no puede afirmarse para los scripts de producción sin modificar su código, lo cual no está autorizado.
