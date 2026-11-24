# ADPHOR — Gate P0 Hyperdrive / Calendar QA Integral

**Actualización:** 2026-11-24 UTC; configuración y evidencias verificadas en Cloudflare, Supabase QA y GitHub.  
**Base oficial QA:** `qa/integral-claude-reviewed-20261111`, SHA previo `0174a3ff02140010925353680a8b322ee8967420`.  
**Alias exclusivo QA:** https://qa-integral-claude-reviewed.adphor-platform.pages.dev/  
**Proyecto Supabase QA:** `qfctnnnnltghepwujpdm` (`us-east-1`).  
**Producción:** prohibido cambiar la rama `codex/flujo-mantenimiento`, sus bindings o variables.

## Motivación y corrección P0

El adaptador anterior Workerd → Supavisor (pooler regional) falló en STARTTLS con `UnknownIssuer` (dictamen `BLOCKED_SECURITY`). Un intento posterior de aprovisionar Hyperdrive contra ese pooler falló con `EAUTHQUERY: auth_query secret check timed out`, sin demostrar contraseña incorrecta. Cloudflare recomienda usar la conexión **directa PostgreSQL** de Supabase al configurar Hyperdrive, puesto que Hyperdrive ya hace pooling.

La rama del PR #183 reemplaza la conexión TCP directa en `backend/src/calendar-oauth/pages-runtime.mjs` por **solo** `context.env.ADPHOR_CALENDAR_QA_HYPERDRIVE.connectionString`. La ausencia o invalidez del binding falla cerrado, sin fallback al secreto legado. La verificación TLS del origen corresponde a Hyperdrive; nunca se relaja en Workerd. Se conservan Access, AAL2, membresía de copropiedad, RLS y prueba de permisos. OAuth sigue desactivado.

## Infraestructura ya aprovisionada — lectura verificada

- Hyperdrive Cloudflare: `adphor-qa-calendar-oauth-preview`; ID `097411f4275f498d91a721f2d22375e4`.
- Conexión **directa** a `db.qfctnnnnltghepwujpdm.supabase.co:5432`; base `postgres`; usuario restringido `adphor_qa_calendar_oauth_login` **sin** sufijo de proyecto (el sufijo solo se usaba en el pooler).
- Certificado CA importado desde **Download certificate** del Dashboard oficial de Supabase QA: `ADPHOR QA - Supabase Root 2021 CA`, ID `0c605814-48a4-4abe-ad07-c60e24f63a47`, vigente hasta 2031-04-26. No se colocan el PEM ni secretos en Git.
- TLS de origen `verify-full`, caché SQL desactivada y límite actual verificado de **20** conexiones (no se presume un límite inferior).
- Cloudflare Pages `adphor-platform` tiene **solo en Preview** el binding `ADPHOR_CALENDAR_QA_HYPERDRIVE` apuntando a ese ID. Production no tiene binding Hyperdrive; se verificó que su rama y variables no cambiaron.
- `ADPHOR_CALENDAR_OAUTH_ENABLED=false` en Preview. No se autorizó ni se hizo conexión a Google.
- Access: aplicación específica para `qa-integral-claude-reviewed.adphor-platform.pages.dev`, con política `allow`. Esto describe configuración, **no** certifica el acceso mediante un navegador real.

## Gate de integración/despliegue autorizado por el propietario

1. CI del PR en GitHub: Node/SQL, Python, aislamiento, compilación y Playwright E2E en verde; revisar de nuevo si cambia el SHA.
2. Fusionar **solo** PR #183 a `qa/integral-claude-reviewed-20261111`, manteniendo intacta la rama de producción.
3. Verificar deployment Preview y alias efectivo con SHA nuevo. No activar `ADPHOR_CALENDAR_OAUTH_ENABLED`.
4. Verificar HTTP negativo anónimo/sin Access. Verificar con sesión real: Access válido, Supabase AAL2 y membresía autorizada → `POST /api/integrations/google-calendar/oauth/readiness?project=<slug>` con Origin QA y bearer debe devolver **204**, sin cuerpo. Verificar además AAL1 y membresía de otra copropiedad denegadas.
5. Comprobar que la base reconoce `current_user='adphor_qa_calendar_oauth_login'` y controles RLS/permisos; no se crean eventos ni transacciones.
6. Solo declarar `CERTIFIED_DB_TRANSPORT` tras una respuesta real 204 y controles negativos. En caso contrario conservar `BLOCKED_SECURITY`, registrar diagnóstico sin revelar credenciales y no habilitar OAuth.

**Riesgo independiente:** una captura del formulario mostró parcialmente una cadena de conexión; se requiere rotación coordinada de la contraseña técnica de QA y actualización del secreto de origen bajo autorización separada, sin modificar el rol postgres ni producción.

## Reversión y límites

Conservar los despliegues anteriores. No eliminar ramas, respaldos, configuraciones o certificados, y no cambiar alias/producción sin autorización adicional. No divulgar contraseñas, cadenas de conexión, tokens, JWT ni claves de firma en informes, tests o commits.

## Referencias
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/
- https://developers.cloudflare.com/hyperdrive/configuration/tls-ssl-certificates-for-hyperdrive/
- https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://supabase.com/docs/guides/database/connecting-to-postgres
