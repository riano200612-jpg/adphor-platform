# ADPHOR QA Integral — P0: diagnóstico del 503 de Google Calendar
Fecha: 2026-11-16 (America/Bogota)

## Evidencia previa (sin atribuir causa todavía)
- Rama y SHA base: `qa/integral-claude-reviewed-20261111` / `6f9687519d8d7b171d59b549d7737dadb1ca03e9`.
- Cloudflare Pages Preview: deployment `2882d893-3a33-4231-8bb8-3d123c53beaf` SUCCESS, alias único integral.
- Supabase QA: `qfctnnnnltghepwujpdm`, Edge Function `qa-calendar-availability` ACTIVE v1, `verify_jwt=true`.
- Invocaciones `function_edge_logs`: 503 el 2026-11-15 15:17:18 UTC y 2026-11-16 22:13:22 UTC.
- El servicio expone cuatro ramas 503 con mensajes diferentes, pero logs de invocaciones no contienen cuerpo de respuesta ni etapa.
- El conector ChatGPT Google Calendar reconoce `plataforma@adphor.com` y 9 calendarios; es OAuth independiente y NO certifica OAuth Edge QA.
- Los valores de secretos y las aprobaciones de José NO se leen ni se guardan aquí.

## Instrumentación mínima y segura
Se conserva el contrato HTTP y los mensajes anteriores. Los cuatro errores 503 emiten, solo al log de runtime:
`{"event":"adphor_qa_calendar_503","request_id":"<UUID generado en el servidor>","stage":"<etapa fija>","status":503}`

| Stage | Condición de código exacta | Investigación posterior |
|---|---|---|
| `supabase_runtime` | `SUPABASE_URL` no coincide con QA o falta clave pública/anon | Variables del runtime del proyecto, NO usar service_role |
| `auth_upstream` | Error excepcional al llamar o interpretar `/auth/v1/user` | Auth uptime/red, sin revelar JWT |
| `membership_upstream` | Error excepcional en `/rest/v1/memberships` | Revisión de disponibilidad PostgREST/RLS, no saltar membresía |
| `oauth_configuration` | Falta al menos una entre `ADPHOR_QA_CALENDAR_ID`, `ADPHOR_QA_CALENDAR_OAUTH_CLIENT_ID`, `ADPHOR_QA_CALENDAR_OAUTH_CLIENT_SECRET`, `ADPHOR_QA_CALENDAR_OAUTH_REFRESH_TOKEN` | Verificar presencia de nombres desde Secrets, nunca valores, y requerir autorización corporativa si faltan |

Los 502 siguen representando fallos de intercambio de OAuth o Google freeBusy y no se convierten en disponibilidad válida. JWT, AAL2, RLS, validación de entrada, CORS exacto, origen Google, `Cache-Control:no-store` y ausencia de escrituras permanecen intactos.

## Diagnóstico P0.2 — identificación precisa de las variables ausentes

Después de una solicitud **autenticada y autorizada con AAL2 y membresía admin/coordinator**, la rama `oauth_configuration` emite un segundo log seguro:
`{"event":"adphor_qa_calendar_missing_config","request_id":"<UUID>","missing_mask":<0–15>}`.

Interpretación binaria de `missing_mask` (solo presencia/ausencia, jamás valores):
- Bit 1: falta `ADPHOR_QA_CALENDAR_ID`.
- Bit 2: falta `ADPHOR_QA_CALENDAR_OAUTH_CLIENT_ID`.
- Bit 4: falta `ADPHOR_QA_CALENDAR_OAUTH_CLIENT_SECRET`.
- Bit 8: falta `ADPHOR_QA_CALENDAR_OAUTH_REFRESH_TOKEN`.

Se suman los bits cuando faltan varias. Máscara `15` significa que las cuatro variables están ausentes o vacías en el entorno de ejecución. La ausencia de un bit **no prueba que el valor presente sea correcto** ni garantiza autorización de Google: las fases de renovación y `freeBusy` aún requieren respuesta real. La nueva instrumentación no publica esos bits al navegador, no examina valores y no modifica credenciales.

Antes de interpretar el log, comprobar coincidencia de `request_id` y `oauth_configuration`. Evitar inferir que un 503 previo a esta versión ya tenía ese patrón.

## Consulta de solo lectura de logs
Supabase Dashboard → Edge Functions → qa-calendar-availability → Logs; filtrar `adphor_qa_calendar_503`.
Alternativamente, Logs Explorer puede filtrar `source='function_logs'` / `source='function_edge_logs'` y `event_message` por `adphor_qa_calendar_503`. Solo comunicar stage/status y hora; no divulgar otros campos.

## Gate de despliegue
1. PR con solo `index.ts`, pruebas y este runbook; CI (Node, Python, Playwright, build) completamente PASS.
2. Merge únicamente a QA Integral y confirmar SHA/Deployment ID/alias Pages. Producción intacta.
3. Comparar versión hospedada pre-deploy (v1) byte a byte con la fuente GitHub original (ya verificado). Guardar esa referencia.
4. Publicar los mismos dos archivos `index.ts` y `core.js` desde el merge aprobado en **el Supabase QA existente**, con `verify_jwt:true`. NO se escriben secretos ni se crea función distinta.
5. Confirmar v2 y JWT habilitado. Ejecutar una única comprobación de freeBusy desde un usuario QA autorizado AAL2; registrar etapa 503 en Logs o respuesta 200 real.
6. No activar reservas ni afirmar FreeBusy certificado hasta confirmar 200 `source=google_freebusy` con controles negativos.

## Recuperación verificada por procedimiento
- Frontend previo: Deployment `2882d893-3a33-4231-8bb8-3d123c53beaf`, SHA `6f9687519d8d7b171d59b549d7737dadb1ca03e9`. Recuperar únicamente sobre Preview según el procedimiento vigente de Cloudflare Pages y volver a verificar alias.
- Backend previo: re-deploy exacto de `supabase/functions/qa-calendar-availability/index.ts` y `core.js` del SHA base `6f9687519d8d7b171d59b549d7737dadb1ca03e9`, manteniendo `verify_jwt=true`. No alterar secretos; confirmar versión y responder pruebas 401/403/422.
- No revertir producción, datos SQL, ni Google Calendar. La recuperación no se considera ENSAYADA hasta ejecutarla y verificarla por separado.

## Restricción
No crear eventos, invitaciones, Meet, ni modificar OAuth, permisos, membresías o identidades en esta fase.