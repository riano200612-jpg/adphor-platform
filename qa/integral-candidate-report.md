# ADPHOR QA — Candidata integral revisada

NO LIBERABLE: pendiente de navegador autenticado, AAL2 real y certificación del despliegue protegido.

## Integración

La entrega de Claude `33eb0f10039a7a40aa7546c354019c4ce76c6bbc`, basada en `29f73b1`, fue verificada mediante sus seis SHA-256, CRC del ZIP y bundle completo. El commit fuente se conserva como segundo padre de la revisión local; su árbol no sustituye los avances posteriores.

Claude propone `visit_drafts`/`save_visit_draft`; la candidata existente utiliza `qa_visits`/`qa_create_visit`. No se añadió otra tabla ni se ejecutó la migración alternativa. Se incorporó el control de habilitación `VITE_VISITS_SQL_ENABLED`, desactivado por defecto, tanto en el repositorio como en la interfaz. La lectura autorizada sigue independiente de la escritura.

## Alcance y aceptación

| Módulo | Implementación conservada | Aceptación real |
|---|---|---|
| Login y MFA | Autenticación, AAL2, membresías | BLOCKED: sesión real pendiente |
| Home | Reuniones verificadas por copropiedad | BLOCKED: navegador autenticado |
| Reuniones | Formulario, duración, acompañamientos y disponibilidad de tres estados | BLOCKED: backend Calendar real no certificado; creación deshabilitada |
| Visitas | Programación, revisión, repositorio SQL y consulta; escritura deshabilitada por defecto | BLOCKED: guardado AAL2 y recarga compartidos pendientes |
| PQRS | Consulta, gestión, historial y Atención hoy | BLOCKED: ciclo autenticado remoto pendiente |
| Agenda | Consulta verificada, filtros y manejo de errores | BLOCKED: navegador real; modificación corporativa no habilitada |
| Miss ADPHOR | Guía contextual y navegación por módulos | BLOCKED: recorrido autenticado transversal |
| Fotografías | Flujo privado existente conservado | Comprobación previa del propietario; sin recertificación nueva |

Visitas no certifica todavía ejecución de visitas, ingreso/salida, resultados, seguimiento ni adjuntos: requieren contrato aprobado. Agenda transaccional permanece en adaptador aislado/simulado; no se presenta como escritura corporativa. No se afirma disponer de RAG documental general.

## Pruebas

327/327 JavaScript PASS, incluyendo SQL auténtico aislado PGlite y bloqueo de escrituras por defecto. Build Vite PASS. La línea base Python permanece en 136/136, sin cambios nuevos de backend. No se ejecutaron nuevas baterías Chromium/Crostini. Los E2E preparados no constituyen PASS de navegador.

## Publicación y reversión

Solo se autoriza respaldo de código en rama QA excluida de los filtros de despliegue informados por el propietario. Los workflows versionados no tienen disparador push para esta rama. La plantilla E2E permanece inactiva fuera de .github/workflows. El control efectivo del proveedor requiere consulta administrativa antes de desplegar.

Las evidencias administrativas se conservan privadamente y se excluyen del árbol publicable. No se suben datos corporativos, originales ni credenciales al repositorio público.

Cronología corregida: Work aplicó la migración QA `20261111133108_qa_shared_visits_scheduled_contract` en la ejecución anterior a la integración de Claude; su exportación ya estaba incluida en `a6aea10` (11 de noviembre, 08:49 Colombia). No fue una operación paralela. Durante la integración de Claude y esta reconciliación solo se hicieron consultas remotas de lectura; no se aplicaron ni repitieron migraciones, activaron flags, desplegaron versiones, fusionaron PR ni escribieron registros corporativos. La versión de migración identifica el historial, pero no prueba por sí sola la hora exacta de ejecución. La aprobación de publicación Pages sigue pendiente. Deployment ID y SHA servido no confirmados. Reversión de revisión: conservar referencias anteriores y descartar esta rama; no ejecutar SQL destructivo ni mover ramas protegidas.

## Reconciliación de auditoría

La revisión de solo lectura confirma que existe la migración registrada, la tabla vacía, RLS con tres políticas y RPC SECURITY INVOKER. Una consulta administrativa no prueba una sesión AAL2 real. La confirmación funcional del guardado sigue bloqueada por la ausencia de sesión autorizada y de autorización expresa para habilitar escritura y crear el registro piloto.

Se corrigió el arranque para impedir fallback a demo en el hostname QA conocido o al configurar el backend QA: si falta clave/URL correcta o se pide el modo de solo lectura incompatible, se muestra configuración bloqueada. Esta corrección está en código candidato; las variables y el artefacto servido todavía no están verificados.

Agenda no cumple todavía el flujo transaccional de José. Reprogramación, cancelación, auditoría y reconciliación tienen servicios aislados/simulados, sin conexión corporativa a la interfaz. Se integraron alternativas de horario basadas en intervalos ocupados y límites de consulta, con cinco opciones como máximo. Sus 13 pruebas locales pasan, pero no certifican Google Calendar, jornada laboral ni disponibilidad real de acompañantes. El botón manual se conserva y elegir una alternativa exige reverificación.

## Corrección de concurrencia posterior

La revisión posterior a `96e106d` introduce propiedad compartida de las consultas: un finally obsoleto no puede habilitar controles de una operación nueva. La verificación manual y las alternativas comparten validación estricta de intervalos y del sobre de respuesta. La confirmación de Visitas verifica autor, responsable, motivo y horario, además de identificadores. Evidencias y limitaciones actuales: `qa/meeting-concurrency-closure.md`. No se ejecutaron operaciones remotas ni nuevas migraciones en esta corrección.

## Certificación de infraestructura posterior

Se intentó autenticación oficial Google con participación del propietario. Cloudflare devolvió Unable to sign in, sin sesión administrativa. El HEAD anónimo al alias QA devolvió 403 sin redirección; no se atribuye a una política Access sin configuración y prueba autenticada. Se ampliaron los metadatos públicos del artefacto (sin clave) y la compilación rechaza clave ausente o modo readonly incompatible. Dos builds locales con configuración sintética fueron idénticos; no certifican variables del proveedor. Estado y plan: `qa/access-pages-certification-20261111.md`.

## Reconciliación posterior de Pages y evidencia del propietario

La actualización del informe maestro y captura posterior confirman que el propietario guardó ambas ramas en Preview personalizado. No se le debe pedir otra vez que las añada. Los skipped anteriores son históricos; falta leer los deployments posteriores al guardado. Se reprodujo otro bloqueo independiente: el código de c6286a3 no admitía la rama candidata en Vite ni en el manifiesto. La corrección admite exclusivamente las dos ramas QA con las mismas compuertas y bloquea bootstrap en la candidata. Respaldo con prefijo oficial CF-Pages-Skip, sin publicación. Detalle y recuperación segura de Preview: `qa/pages-skipped-reconciliation-20261111.md`.
