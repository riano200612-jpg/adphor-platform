# ADPHOR QA Integral — Solicitud controlada de revisión de correos (2026-11-18)

## Regla absoluta
Los archivos originales de José — Apps Script, hojas maestras de Google Drive, fotos y calendarios — no se modifican. Solo se trabaja en `adphor-platform` rama QA Integral y `adphor-qa` Supabase.

## Datos y seguridad
- Tablas de conciliación ya verificadas: 43 propiedades; 36 coincidencias preliminares, tres conflictos (IDs 2,6,27), tres ausencias en Portal (40,41,43) y una sin email (42).
- Migración QA aplicada y probada: `adphor_pqrs_qa_review_request_20261118`.
- `public.qa_pqrs_recipient_review_requests` guarda solicitud pendiente para una copropiedad; no almacena ni expone emails. Solo personal técnico con QA MFA AAL2, sesión Auth vigente y rol admin de la copropiedad puede solicitar una revisión de una ruta `PENDING_APPROVAL`.
- RLS de SELECT/INSERT, grant por columnas, trigger para vincular la versión conciliada. 0 permisos UPDATE/DELETE del navegador. Índice único parcial rechaza duplicados pendientes.
- Las solicitudes para rutas CONFLICT, SOURCE_GAP o MISSING_EMAIL son denegadas.
- Pruebas PostgreSQL (ROLLBACK): admin autorizado crea solicitud; duplicado rechazado, fuente en conflicto y email faltante rechazados, usuario sin sesión y MFA no puede solicitar ni leer. No quedó ningún registro sintético.
- Vista del módulo PQRS muestra la solicitud y obliga a marcar confirmación de que **no aprueba envíos**.
- Sin proveedor de correo certificado, sin rutas aprobadas y sin salida de notificaciones.

## Pendiente
- Revisión humana independiente de correspondencia propiedad/correo, resolución de siete registros, prueba de entrega usando dirección autorizada, auditoría del proveedor y aprobación formal de ruta.
- Ninguna notificación automática ni sincronización de Apps Script original.
