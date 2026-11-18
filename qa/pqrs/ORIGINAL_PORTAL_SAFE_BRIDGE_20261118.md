# QA Integral — puente seguro hacia el PQRS original

Fecha: 2026-11-18. Destino exclusivo: rama `qa/integral-claude-reviewed-20261111` de `adphor-platform`.
No se modifica Apps Script, sus archivos Google ni producción.

## Evidencia de auditoría del respaldo original
- `portal/PQRS.js`: `registrarPQRSPublico()` escribe `PQRS_Master` y `PQRS_Log`, y llama a `pqrsNotifRecibida()`.
- `portal/PQRS_Notificaciones.js`: la función `_nEmailDelegFromCopro` toma la primera copropiedad que coincide con `ID_Delegado`; un mismo delegado en varios edificios puede desviar la copia al correo equivocado.
- La notificación administrativa adicional del flujo de radicación se encuentra en `if (false)` y no se ejecuta.
- El Apps Script original no ha sido modificado. No se enviaron correos reales durante la auditoría.
- Supabase QA tiene 43 `public.projects`, 29 registros de origen en `pilot_private.pqrs_sources`, y cero asociaciones confirmadas en `pilot_private.pqrs_approved_mappings`.
- Master_ADPHOR contiene 43 copropiedades; rutas 6, 27 y 42 no están certificadas.

## Este incremento
- El administrador autenticado que accede desde el alias exacto de QA Integral puede abrir el `/exec` original sin volver a guardar la URL en su navegador.
- La URL original no se activa implícitamente en producción, previews alternas ni para roles diferentes a `admin`.
- El formulario mantiene el servicio de José como origen; no se duplica ni modifica su estado desde esta interfaz.
- Mensaje visible: confirmar radicado y adjuntos; entrega de correos por copropiedad aún sin certificar.
- La configuración explícita `VITE_ADPHOR_PORTAL_EXEC_URL` y la almacenada por un administrador siguen teniendo prioridad.

## Gating para próximas entregas
- No se activa el reparto automático a administradores sin aprobación por ID y nombre, correo validado, prueba de entrega y registro de auditoría.
- La migración privada `adphor_pqrs_qa_core_v1_20261118` se instaló previamente en Supabase QA con el outbox siempre `BLOCKED`.
- El frontend no implica que exista sincronización automática del Apps Script con Supabase.
