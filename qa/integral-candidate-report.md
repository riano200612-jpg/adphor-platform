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

291/291 JavaScript PASS, incluyendo SQL auténtico aislado PGlite y bloqueo de escrituras por defecto. Build Vite PASS. La línea base Python permanece en 136/136, sin cambios nuevos de backend. No se ejecutaron nuevas baterías Chromium/Crostini. Los E2E preparados no constituyen PASS de navegador.

## Publicación y reversión

Solo se autoriza respaldo de código en rama QA excluida de los filtros de despliegue informados por el propietario. Los workflows versionados no tienen disparador push para esta rama. La plantilla E2E permanece inactiva fuera de .github/workflows. El control efectivo del proveedor requiere consulta administrativa antes de desplegar.

Las evidencias administrativas se conservan privadamente y se excluyen del árbol publicable. No se suben datos corporativos, originales ni credenciales al repositorio público.

No se realizaron migraciones remotas, activaciones de flags, despliegues, fusiones de PR ni escrituras corporativas en esta integración. La aprobación de publicación Pages sigue pendiente. Deployment ID y SHA servido no confirmados. Reversión de revisión: conservar referencias anteriores y descartar esta rama; no ejecutar SQL destructivo ni mover ramas protegidas.
