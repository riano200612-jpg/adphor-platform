# ADPHOR PQRS — Verificación estricta de evidencias privadas (QA)
Fecha: 20 de noviembre de 2026.

## Objetivo
Evitar que el navegador muestre metadatos privados o prepare un enlace de 90 segundos para un archivo distinto del radicado/copro­piedad autorizados.

## Cambios de alcance reducido
- `validateQaCaseEvidenceRow` comprueba ID, proyecto, radicado, autor, bucket privado, MIME, bytes y ruta completa `project/pqrs/case/author/id.ext`.
- `listEvidence` solicita `uploaded_by` y rechaza filas inconsistentes, listas truncadas o duplicados, sin revelar archivos.
- `signedEvidence` comprueba **el path exacto del archivo esperado** en la URL firmada, además de origen HTTPS de Supabase QA y de credenciales URL vacías.
- La consulta revalida MFA AAL2, sesión y membresía antes de acceder a la evidencia.
- Pruebas negativas: identificadores de otras copropiedades, rutas falsificadas, MIME, tipo, tamaños y sufijos alterados; la suite existente conserva una prueba positiva de carga, reintento, listado y firma.

## Alcance y límites
Solo código QA Integral y pruebas. Sin cambios de SQL, RLS, bucket, banderas, originales de José, Apps Script, Calendar ni producción. No se aprueban destinatarios ni se habilita correo.

La pestaña visible del usuario permanece en una versión anterior de UI, y no se disponía de una sesión MFA controlable desde este chat para realizar una subida real de bytes. La certificación E2E autenticada en navegador y la verificación de descarga real siguen pendientes.

## Gate
PR único, comprobaciones Node/Python/Cloudflare Pages/Chromium PASS antes de fusionar; comprobar deployment ID y SHA en Cloudflare tras squash.
