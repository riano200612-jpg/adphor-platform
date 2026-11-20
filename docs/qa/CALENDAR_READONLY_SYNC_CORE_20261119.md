# ADPHOR QA Integral · Preparación de sincronización unidireccional Google Calendar

**Destino único:** proyecto Supabase QA \`qfctnnnnltghepwujpdm\`, rama \`qa/integral-claude-reviewed-20261111\`.
**Fuente:** calendario corporativo «Reuniones»; archivos originales de José y \`Calendario.gs\` estrictamente inmutables.

## Auditoría previa al desarrollo

19 de noviembre 2026, después de la migración histórica: 507 eventos Google de 2026 (126/146/126/109 por trimestre) contrastados con 507 filas en \`qa_calendar_private.source_events\`. Se compararon ID, título, hora inicial/final y estado: 0 altas, 0 modificaciones, 0 faltantes. 443 mapeos propuestos; 0 revisados. RLS y permisos sin exposición a \`anon\`, \`authenticated\` o \`service_role\`.

## Qué se añade en este incremento

\`src/js/services/google-calendar-readonly-sync.js\` es un adaptador **inactivo** de solo lectura, apto para ejecutarse **exclusivamente en un backend** cuando una identidad corporativa OAuth autorice \`calendar.events.readonly\`. Implementa \`GET events.list\`, zona \`America/Bogota\`, ventanas máximas de 93 días, paginación, eventos recurrentes expandidos, fechas de día completo, descarta descripciones e invitados, valida respuestas completas y calcula un plan sin aplicar mutaciones.

Un evento cancelado o ausente queda **pendiente de revisión**. La ausencia nunca implica borrar una fila, revocar una reunión ni escribir en Google. La futura escritura del plan a SQL requerirá un adaptador y autorización separados, con límites de tenant, transacción y bitácora.

## Barreras para activar

- **No está implementado el scheduler** ni el escritor transaccional de \`qa_calendar_private.source_events\`; no se certifica sincronización automática.
- La conexión Google Calendar de ChatGPT **no puede transferir OAuth al backend**. Se requiere consentimiento OAuth corporativo y token gestionado en secretos de QA.
- Para comparar eventos, el cliente OAuth necesita permiso de lectura de eventos; el actual \`qa-calendar-availability\` solo hace FreeBusy.
- No cambiar \`Calendario.gs\`, el calendario original, correos, invitados, eventos, roles, MFA, producción ni proveedores.
- No habilitar escritura a Google/Meet sin una fase independiente de pruebas y aprobación.
- Antes de publicar un plan como datos operativos de cualquier copropiedad: conciliar los 443 mapeos y 64 no conciliados, validar RLS/AAL2, control de duplicados y regresiones.

## Recuperación y certificación

El código nuevo no se invoca desde la SPA ni desde una función en ejecución. Si el chequeo CI falla, no fusionar ni desplegar. Si QA deja de servir correctamente, recuperar último deployment Pages validado; no tocar OAuth ni calendario fuente.

El gate de este incremento es **CORE_READONLY_SYNC_PREPARED**, no **AUTOMATIC_SYNC_CERTIFIED**.
