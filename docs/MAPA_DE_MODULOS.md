# ADPHOR — Matriz técnica de módulos

**Alcance:** rutas localizadas en QA Integral. «Código encontrado» no implica que esté conectado o certificado para el piloto.

| Área | UI / servicio | Backend o contrato | Prueba existente | Interpretación |
| --- | --- | --- | --- | --- |
| Inicio y navegación | `src/js/app.js`, `src/js/ui-adphor-one.js` | Servicios de navegación/branding | `tests/e2e/adphor-one.spec.js` | Código y test |
| Tareas y mantenimiento | `src/js/core/workflow.js`, `src/js/services/task-catalog.js` | SQL de operaciones | `tests/workflow.test.js`, `tests/task-catalog.test.js` | Código y contrato |
| IAM y MFA | `src/js/ui-iam-live.js`, `src/js/services/iam-client.js` | `functions/api/iam.js`, `supabase/functions/adphor-iam/` | `tests/qa-iam-api.test.js`, `tests/e2e/mfa-enrollment.spec.js` | Verificar permisos/AAL2 en sesión real |
| Copropiedades y personal | `src/js/ui-corporate-staff.js`, `src/js/services/assigned-projects.js` | Tablas y políticas SQL | `tests/corporate-staff.test.js` | Revisar aislamiento de edificios |
| Agenda / reuniones | `src/js/ui-meeting-assessment.js`, `src/js/services/google-calendar-readonly-sync.js` | `supabase/functions/qa-calendar-availability/` | `tests/e2e/meeting-suggestions.spec.js` | Conector externo requiere verificación |
| PQRS | `src/js/ui-pqrs.js`, `src/js/services/qa-case-evidence.js` | SQL y Storage privado | `tests/e2e/pqrs-evidence-persistence.spec.js` | Verificar recuperación y denegación cruzada |
| Visitas | `src/js/ui-visit-lifecycle.js`, `src/js/services/qa-visit-evidence.js` | Migraciones/Storage | `tests/e2e/visits-lifecycle.spec.js` | Pruebas disponibles |
| Miss ADPHOR | `src/js/ui-miss-adphor-chat.js`, `src/js/services/miss-*.js` | `backend/src/adphor_ai/` | `tests/miss-adphor-chat.test.js` | IA real requiere verificación de proveedor |
| Documentos Miss ADPHOR | [PR #167](https://github.com/riano200612-jpg/adphor-platform/pull/167) | Candidato de carga privada | Tests del PR | Propuesta separada; comprobar estado actual |
| Informes y gobierno | `src/js/ui-reports.js`, `src/js/services/miss-weekly-management.js` | SQL y contratos | `tests/reports.test.js` | Diferenciar métricas demo/reales |

## Cómo certificar afirmaciones

1. Indique ruta, rama y SHA.
2. Identifique el test real y el entorno.
3. Describa las funciones habilitadas, simuladas o pendientes.
4. Para usuarios/documentos, valide permisos y aislamiento con identidades autorizadas.
5. Registre aceptación del cliente aparte de los resultados de CI.

Accesos: [Código QA](https://github.com/riano200612-jpg/adphor-platform/tree/qa/integral-claude-reviewed-20261111) · [Pruebas](https://github.com/riano200612-jpg/adphor-platform/tree/qa/integral-claude-reviewed-20261111/tests) · [Servicios](https://github.com/riano200612-jpg/adphor-platform/tree/qa/integral-claude-reviewed-20261111/src/js/services) · [Migraciones](https://github.com/riano200612-jpg/adphor-platform/tree/qa/integral-claude-reviewed-20261111/supabase/migrations).