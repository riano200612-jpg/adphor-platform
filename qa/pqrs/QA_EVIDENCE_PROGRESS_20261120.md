# ADPHOR QA Integral — Confirmación visible de evidencias PQRS
20 de noviembre de 2026

## Alcance
Solo la rama `qa/integral-claude-reviewed-20261111` del repositorio `adphor-platform`. No se modifica Apps Script, Master_ADPHOR, archivos de José, Google Drive, Calendar ni producción.

## Cambios
- Una fotografía, video o PDF seleccionado cuenta como confirmado **solo después** de que el repositorio de evidencias haya confirmado almacenamiento privado y metadatos asociados al mismo radicado/copropiedad.
- `uploadPrivateEvidence` rechaza un lote si llega incompleto, si hay identificadores repetidos, si el almacenamiento no se confirma o si el destinatario/proyecto no corresponde a la PQRS.
- El formulario informa `n de total` archivos privados confirmados y el radicado; si ocurre un fallo retiene la selección y reutiliza la misma PQRS para el reintento.
- Reintento idempotente de archivos ya asociados; no reemplaza objetos existentes.
- Los callbacks de progreso no modifican el estado persistente; se reportan luego del enlace de metadata.
- Compatibilidad con adaptador de evidencia privada existente sin exponer claves privilegiadas.

## Evidencia real del backend QA
- El proyecto QA tiene el bucket privado `qa-case-evidence` (20 MiB por objeto, solo JPEG/PNG/WebP/MP4/WebM/PDF).
- Las reglas del bucket y de `public.qa_case_evidence` validan pertenencia, caso, ruta y MFA; el formulario solo habilita el selector en el alias oficial de QA Integral cuando el flag privado está activo.
- Prueba PostgreSQL con una sesión QA AAL2 válida: se creó **solo dentro de BEGIN/ROLLBACK** un caso sintético, una fila simulada de `storage.objects` y su metadata; se verificó asociación de la propiedad, y se rechazaron un vínculo cruzado y la mutación de metadata. `QA_PQRS_EVIDENCE_RLS_ROLLBACK_PASS`.
- Se comprobó también que intentar registrar metadata sin un objeto en Storage falla con RLS.
- La prueba SQL **no subió bytes reales a Storage** ni verificó un flujo móvil autenticado. No se debe presentar como certificación completa de upload E2E.

## Certificación pendiente
- Archivo real de prueba con sesión QA MFA AAL2 en navegador oficial, recarga, enlace firmado de 90 segundos, reintento después de fallo y confirmación visible en historial.
- Comprobar que la cuenta probadora pertenece a la copropiedad, sin reutilizar datos ni credenciales originales.
- Correo real sigue bloqueado: el sistema no modifica las rutas aprobadas ni la barrera global de envíos.
