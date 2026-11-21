# ADPHOR — Mapa de módulos y ubicación del código

**Lectura:** el estado «Código en QA» indica presencia de implementación, no certificación funcional, autenticada ni autorización de uso con datos reales. Esta matriz guía al lector hacia los archivos; no es una prueba ejecutada hoy.

| Módulo | Ubicación principal en QA | Evidencia/cautela |
| --- | --- | --- |
| Inicio, identidad visual y navegación | `src/js/app.js`, `src/js/ui-adphor-one.js`, `src/css/` | UI y pruebas E2E de QA; contrastar con diseño aprobado |
| Mantenimiento y tareas | `src/js/core/workflow.js`, `src/js/services/task-catalog.js`, `src/js/ui-task-catalog.js` | Contratos y pruebas; distinguir datos reales de demo |
| Autenticación, permisos y MFA | `src/js/services/cloud-authentication.js`, `managed-mfa.js`, `iam-client.js`, `src/js/ui-mfa.js`, `src/js/ui-iam-live.js` | RLS/AAL2 deben verificarse con sesiones autorizadas |
| Copropiedades, asignaciones y personal | `src/js/services/assigned-projects.js`, `staff-directory.js`, `corporate-staff.js`, `src/js/ui-corporate-staff.js` | Alcance por copropiedad y consentimiento de fotografías |
| Reuniones, agenda y calendario | `src/js/services/calendar-availability.js`, `google-calendar-readonly-sync.js`, `src/js/ui-meeting-assessment.js` | No asumir conexión al calendario corporativo por ver pantallas |
| PQRS | `src/js/ui-pqrs.js`, `src/js/ui-pqrs-unified.js`, `src/js/services/pqrs-original-qa-link.js` | Distinguir sistema original, candidato PostgreSQL y pruebas |
| Visitas y evidencias | `src/js/services/visit-lifecycle.js`, `qa-visit-evidence.js`, `src/js/ui-visit-lifecycle.js` | Verificar persistencia, Storage privado y permisos |
| Miss ADPHOR | `src/js/ui-miss-adphor-chat.js`, `src/js/services/miss-*.js`, `backend/src/adphor_ai/` | Asistencia y contratos; proveedor/funciones reales requieren verificación |
| Documentos para Miss ADPHOR | [PR #167](https://github.com/riano200612-jpg/adphor-platform/pull/167) | Propuesta en borrador al corte; no afirmar que esté integrada |
| Informes y gobierno | `src/js/ui-reports.js`, `src/js/services/miss-weekly-management.js`, `src/js/services/miss-board-governance.js` | Separar salidas sintéticas de reportes confirmados |
| Migraciones y seguridad de datos | `supabase/migrations/`, `supabase/functions/` | No aplicar migraciones de QA a producción sin revisión específica |

## Dónde buscar las pruebas

- Unitarias/contrato JavaScript: `tests/*.test.js`.
- Flujos de navegador: `tests/e2e/*.spec.js`.
- Python: `backend/tests/`.
- SQL: `supabase/tests/` y `qa/database/ci/`.
- Informes y evidencias históricas: `docs/` y `qa/` en la rama correspondiente.

## Qué significa la presencia de código

1. **Archivo presente:** se puede estudiar su implementación.
2. **Prueba disponible:** existe un escenario de validación; debe ejecutarse para conocer el resultado actual.
3. **Integración externa:** requiere autenticar origen, confirmar autorización y verificar datos reales cuando proceda.
4. **Aceptado para piloto:** requiere evidencia y aprobación específica; no se deduce de 1–3.

Las rutas cambian durante el desarrollo; use los enlaces del [mapa del repositorio](GUIA_DEL_REPOSITORIO.md) y la búsqueda de GitHub para consultar la versión más reciente.
