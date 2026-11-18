# ADPHOR PQRS — Ciclo operativo real QA (18 noviembre 2026)
Origen José (Apps Script y sus hojas): **inmutable / solo referencia**.
Ámbito de cambios: proyecto Supabase `adphor-qa` y rama QA Integral, nunca producción.

## Verificación
- Migración aplicada: `adphor_pqrs_native_capture_and_column_grants_20261118`.
- Permisos de columna: los usuarios QA con sesión AAL2 y RLS pueden crear PQRS, registrar respuestas y actualizar los campos autorizados; no pueden cambiar `project_id` ni falsificar `actor_id`.
- Trigger nativo crea índice privado mínimo y notificación `BLOCKED` en una sola transacción.
- Ensayo PostgreSQL: sesión administrativa real QA + PQRS sintética + respuesta + cambio de estado + historial + espejo privado + cola bloqueada: PASS, `ROLLBACK`.
- Al verificar, no quedaron casos ni cola sintéticos; rutas aprobadas: 0.
- Las 29 PQRS del Apps Script no se sincronizan automáticamente. El correo real sigue deshabilitado hasta certificar destinatarios por ID de propiedad y proveedor emisor.
- El informe semanal actual consulta la fuente `public.pilot_pqrs`, protegido por RLS.
- Archivo SQL adjunto es una instantánea del estado QA, **no** migración para main/producción.
