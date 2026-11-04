# ADPHOR — ejecución correctiva del auditor (4 noviembre 2026)

Base: 13ae830. Rama derivada: qa/auditor-corrective-20261104. Sin cambios en main.

## Fuentes recuperadas físicamente

Tres ZIP descargados, CRC aprobado y SHA-256 calculado. El resumen sin datos personales está en 20261104-source-integrity-summary.json. El maestro original coincide con el hash del manifiesto QA. Las identidades de las 44 copropiedades y 55 colaboradores se cotejaron con hoja y fila del maestro, sin leer ni exportar hojas de credenciales.

Se verificaron 213 imágenes (122 hashes distintos); 41 copropiedades y 46 colaboradores tienen coincidencia exacta por ID y nombre normalizado. Faltan coincidencias para 3 copropiedades y 9 colaboradores. No se infirieron identidades visualmente ni permisos. Los índices con nombres/rutas y los archivos originales permanecen fuera del checkout.

Herramienta reproducible: tools/client_archive_audit.py. Rechaza rutas ZIP inseguras, CRC inválido, archivos con nombres duplicados y salida privada dentro del checkout. Compara identidades con el maestro original y verifica imágenes. No importa ni modifica datos.

## Auditoría de Supabase real (solo lectura)

El único proyecto accesible es ADPHOR, ref oqizvirqjwbbhyyjpthq. No se dispone de un proyecto QA aislado en la conexión actual; list_branches devolvió una lista vacía. El intento de crear una rama solicitó confirmación y expiró sin crearla.

- public.projects: un registro de prueba; columnas id,name,type,location,areas,is_demo. No hay photo_filename.
- Catálogos de propiedades/reuniones reales en adphor_import_private con RLS activo, sin equivalencia autorizada al proyecto de prueba.
- Tablas públicas operativas encontradas: profiles,memberships,tickets,projects,ticket_events,monthly_reports,agent_reviews,agent_runs. Todas con RLS activo.
- project_role comprueba project_id y auth.uid(), SECURITY DEFINER con search_path vacío. No se cambiaron funciones ni políticas.
- No existen buckets property-photos ni staff-photos. evidence es privado, máximo 2 MB, solo JPEG/PNG/WEBP. No se cambió su configuración.

## Fotografías y acompañamientos implementados para QA aislado

- src/js/services/private-media.js: consulta registros aprobados; verifica sesión y membresía antes de firmar fotos por cinco minutos.
- src/js/services/supabase.js: combina proyectos autorizados con qa_property_photos. El código nuevo solo se activa con VITE_PRIVATE_MEDIA_QA_ENABLED y el gate de proyecto QA aislado.
- src/js/ui-companion-options.js y ui-meeting-assessment.js: tarjetas con nombre/cargo/fotografía, selección exclusiva y «Sin acompañamiento requerido». Usa las reglas existentes de sector y jerarquía. No se crea una reserva externa ni se certifica disponibilidad.
- docs/sql/qa-private-media-draft.sql: propuesta con RLS, aprobación explícita, vínculo a proyectos y acceso a objetos registrados/aprobados. Sin permisos de escritura desde clientes. Termina en ROLLBACK; no aplicada al servidor.

## PQRS y evidencias implementados para QA aislado

- Backend: hash del contenido e identificador estable por actor/caso/formato; verifica existencia del caso antes de leer bytes. La respuesta metadata_linked=true requiere una relectura de la fila persistida. Si falla la asociación, devuelve error; reintentar el mismo archivo reutiliza el identificador. Un conflicto de objeto requiere verificar bytes, nunca se asume éxito por la ruta.
- Frontend: adaptador HTTP autenticado, rechazado para el proyecto productivo; el formulario conserva el radicado en memoria ante fallos de carga y evita crear otro caso al reintentar. Los campos del caso quedan bloqueados durante ese reintento.
- docs/sql/qa-evidence-enabled-draft.sql: bucket QA separado de 20 MB para JPEG/PNG/WEBP/MP4/WEBM/PDF; RLS comprueba actor, caso, proyecto, objeto y límite de cinco evidencias con bloqueo transaccional. No sobrescrituras ni borrado por clientes. Propuesta con ROLLBACK, no aplicada.
- Un fallo de asociación puede dejar un objeto privado sin vínculo; el mismo envío puede recuperarlo. La limpieza administrativa sigue pendiente. El formulario conserva su estado de reintento solo durante la vista actual; tras recarga debe consultarse el radicado comunicado.

## Pruebas realmente ejecutadas

- npm test: 198 aprobadas, 0 fallos (incluye PostgreSQL PGlite para las propuestas de medios y evidencias).
- Python unittest discover backend/tests: 133 aprobadas con requirements-fastapi.txt del repositorio instalado.
- Playwright: 12 E2E aprobadas en Chromium 153 mediante CHROMIUM_PATH. Incluye selector, navegación, móvil, PQRS, fallos de refresco, reintentos y tarjetas de acompañantes.
- npm run build: aprobado.
- git diff --check: aprobado.

Las E2E usan repositorios de prueba/datos sintéticos. El backend usa respuestas HTTP simuladas. PGlite ejecuta PostgreSQL local con contratos mínimos Auth/Storage. Ninguno de estos resultados certifica escritura contra Supabase QA remoto, expiración real de URLs firmadas o el despliegue privado.

Evidencias visuales sintéticas: qa/corrective-20261104/pqrs-retry.png y companions-synthetic.png. No contienen fotografías ni nombres reales del cliente.

## Despliegue y bloqueos

No desplegado. No se ha verificado Cloudflare Access ni emitido una nueva URL QA.

El usuario indicó que guardó la sesión; TinyFish rechazó el inicio de la revisión por saldo agotado. No hubo sesión de automatización iniciada ni cambios en Cloudflare. El build remoto de la nueva rama sigue bloqueado por el allowlist existente; no se amplió sin comprobar la protección privada.

Para activar el trabajo preparado falta: un Supabase QA aislado, aprobar correspondencias source_id→project_id y membresías, aplicar allí los borradores revisados, importar imágenes privadas, validar API/Storage reales, recuperar acceso operativo a Cloudflare y comprobar Access antes de habilitar la rama para despliegue.

## Dictamen actual

| Función | Implementada | Prueba local | Remota/desplegada |
|---|---|---|---|
| Inspección y conciliación de ZIP | Sí | Sí, archivos reales | No requiere despliegue |
| Fotos privadas en catálogo | Adaptador y contrato | RLS local | Bloqueada por QA aislado e importación |
| Acompañantes, cargos y fotos | Sí, catálogo aprobado | Navegador sintético | Bloqueada por QA aislado e importación |
| PQRS con evidencias asociadas | Backend/adaptador/formulario | Python, SQL y navegador sintético | Pendiente de integración remota |
| Entorno Cloudflare privado | Pendiente | No | Bloqueado |

No se certifica integración completa ni entrega al cliente.
