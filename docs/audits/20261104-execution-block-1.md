# ADPHOR: verificación y corrección inicial — 4 noviembre 2026

Base inspeccionada: rama qa/pqrs-carrusel-integracion-20261104, commit 11e6c4f.
Referencia local de reversión: backup/qa-before-pqrs-submit-20261104.

## Cambio ejecutado

src/js/ui-pqrs.js: el formulario deshabilitaba el primer botón (quitar adjuntos) en lugar de enviar. Se deshabilita el submit y se rechazan eventos concurrentes mientras la solicitud está pendiente. Tras persistencia confirmada, se limpian vistas previas. Un fallo posterior al consultar la lista conserva el identificador confirmado y orienta a actualizar la lista, evitando presentar un error ambiguo de radicación.

Prueba agregada: tests/e2e/pqrs-submit.spec.js, con repositorio simulado y sin acceso a datos reales. Comprueba concurrencia y confirmación ante fallo de refresco.

## Evidencia ejecutada

- npm test: 196 aprobadas, 0 fallos.
- npm run build: aprobado.
- Playwright: no ejecutó el caso por ausencia de Chromium. Instalación intentada; el servidor entregó archivos incompletos (End of central directory record signature not found). No se certifica prueba de navegador.
- Supabase: consultas de solo lectura sobre catálogo, buckets y políticas.

## Bloqueos confirmados

Proyecto ADPHOR oqizvirqjwbbhyyjpthq: activo, PostgreSQL 17.11.

- No existe bucket property-photos. El código solicita ese bucket; no basta con desplegar el frontend para ver fotos.
- Único bucket encontrado: evidence, privado, límite 2097152 bytes, tipos image/jpeg, image/png, image/webp.
- La interfaz PQRS anuncia hasta 20 MB y PDF/video, incompatibles con ese bucket.
- Consulta de public por nombres %evidence%, %pqrs%, qa_cases, projects y memberships: solo projects y memberships. No prueba ausencia de tablas equivalentes en otros esquemas o con otros nombres.
- Storage evidence_read exige project_role por prefijo de copropiedad; evidence_upload exige UID en segundo segmento y rol admin/coordinator/technician.
- La UI sigue bloqueando explícitamente envío con evidencias. No se habilitó una operación sin asociación y persistencia verificadas.

## Fuentes localizadas (todavía sin inspección física)

- media-20261103T134407Z-1-001(1).zip: 133591282 bytes.
- 01_BASE_DE_DATOS-20261103T134139Z-1-001(1).zip: 139731044 bytes.
- ADPHOR_QA_PAQUETE_PRIVADO_CONCILIADO_20261103.zip: versión 3, 68889 bytes.

Localización por metadatos no certifica integridad, contenido ni correspondencias de fotos.

## Estado de entrega

Incremento de frontend implementado y validado por suite existente y build. E2E pendiente por entorno. Sin migraciones, importaciones de datos reales ni despliegue realizados en este bloque. URL privada, MFA y aislamiento entre copropiedades todavía no certificados. Próximo trabajo: recuperar bytes de fuentes y conciliar esquema QA autorizado antes de importar fotos o habilitar evidencias.
