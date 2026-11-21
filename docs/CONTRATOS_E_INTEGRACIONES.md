# ADPHOR — Contratos e integraciones

Los archivos descritos se han localizado en QA Integral. Su existencia no confirma disponibilidad del servicio externo.

| Integración | Dónde comenzar | Dependencia |
| --- | --- | --- |
| Supabase Auth y datos | `src/js/services/supabase.js` | Sesión, RLS y autorización |
| IAM | `src/js/services/iam-client.js`, `functions/api/iam.js` | Backend con permisos y MFA |
| Calendario | `src/js/services/google-calendar-readonly-sync.js` | Origen corporativo autorizado |
| PQRS | `src/js/ui-pqrs.js`, `src/js/services/qa-case-evidence.js` | Fuente original o DB/Storage QA |
| Visitas | `src/js/services/qa-visit-evidence.js` | SQL/Storage privados |
| Miss ADPHOR | `src/js/ui-miss-adphor-chat.js`, `backend/src/adphor_ai/` | Modelos, reglas y fuentes autorizadas |
| Documentos en Miss ADPHOR | [PR #167](https://github.com/riano200612-jpg/adphor-platform/pull/167) | Propuesta con aislamiento privado |

## Cómo evaluar una integración

1. Identifique el **contrato**, la **ruta de llamada**, el **permiso**, el **test** y el **sistema origen**.
2. Clasifique como simulado, implementado, configurado, autenticado o aceptado; no mezcle etapas.
3. No registre secretos, identificadores de documentos privados o expedientes en el análisis.
4. No copie fuentes privadas de Drive o Apps Script al repositorio público como sustituto de una integración.

Consulte [arquitectura](ARQUITECTURA_GENERAL.md) y [seguridad](SEGURIDAD_Y_DATOS.md).