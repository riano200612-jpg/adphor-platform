# ADPHOR — Gate P0: Cloudflare Hyperdrive TLS para Calendar QA Integral

**Fecha:** 2026-11-23 (America/Bogota)  
**Rama base:** `qa/integral-claude-reviewed-20261111` · `0174a3ff02140010925353680a8b322ee8967420`  
**Destino exclusivo:** `https://qa-integral-claude-reviewed.adphor-platform.pages.dev/`  
**Supabase QA:** `qfctnnnnltghepwujpdm`  
**Dictamen previo Codex:** `BLOCKED_SECURITY` por `UnknownIssuer` reproducido en Workerd → pooler regional durante STARTTLS; falta certificación hospedada con usuario real.

## Alcance de este PR
- En `backend/src/calendar-oauth/pages-runtime.mjs`, inicializar `postgres@3.4.8` exclusivamente desde `context.env.ADPHOR_CALENDAR_QA_HYPERDRIVE.connectionString`.
- **Fallar cerrado** si falta o es inválido el binding. Prohibido fallback a `ADPHOR_CALENDAR_OAUTH_DATABASE_URL` y prohibida cualquier relajación de TLS.
- Cloudflare Hyperdrive verifica **TLS de origen** con la CA regional oficial y `verify-full`; no se añaden CA ni secretos al navegador o repositorio.
- El probe conserva las comprobaciones existentes Cloudflare Access, AAL2, roles por copropiedad, metadatos del login dedicado y respuesta sin cuerpo. OAuth continúa desactivado.

## Gate de aprovisionamiento manual autorizado (todavía no ejecutado)
La API de Hyperdrive exige contraseña de origen, que no puede recuperarse del secreto enmascarado de Pages. Completar **en el panel oficial Cloudflare** sin escribir valores en terminal, chat ni GitHub:

1. En Supabase QA → Connect / Database settings, verificar el **Session Pooler** regional (5432) y descargar la **CA regional oficial del proyecto** desde el Dashboard. Verificar origen y vigencia; no usar una CA global no correspondiente ni autogenerada.
2. En Cloudflare → Hyperdrive crear la configuración exclusivamente destinada a QA `adphor-qa-calendar-oauth-preview` apuntando al mismo pooler regional, base `postgres`, usando el login técnico restringido existente `adphor_qa_calendar_oauth_login.qfctnnnnltghepwujpdm`. Introducir su contraseña **solo en el campo seguro del dashboard**, sin divulgarla ni rotarla.
3. Registrar la CA regional, seleccionar **TLS `verify-full`** (incluye hostname) y **desactivar caché de consultas**: el estado de Auth, membresías y transacciones nunca admite lecturas obsoletas. Fijar un límite de origen de **5 conexiones** inicialmente, según plan y límites reales.
4. Confirmar que Hyperdrive pudo validar la configuración **sin suponer éxito del probe**. Anotar únicamente nombre, ID no secreto, estado de TLS y caché; omitir credenciales.
5. En `Workers & Pages` → proyecto `adphor-platform` → configuración **Preview solamente** → Bindings → añadir Hyperdrive con variable **exacta** `ADPHOR_CALENDAR_QA_HYPERDRIVE` y la configuración anterior. **No añadir en Production**. No activar el flag `ADPHOR_CALENDAR_OAUTH_ENABLED`.
6. No alterar otros bindings, variables existentes, datos PostgreSQL ni permisos.
7. Tras CI completo y autorización de **merge/despliegue separada**, publicar la rama QA oficial y comprobar SHA/deployment/alias. Los bindings requieren redeploy para tener efecto.

## Condiciones de certificación
- CI completo: Node, persistencia, aislamiento, build, compilación Pages Functions, Playwright E2E y Python; pruebas sintéticas **no** equivalen a operación live.
- En QA: llamada anónima o sin Access rechazada; AAL1 y membresía ajena denegadas; un usuario **real** con Access + Supabase AAL2 + copropiedad autorizada obtiene `HTTP 204` en `readiness`.
- Comprobar en Supabase que el login real es dedicado, RLS y permisos privados son válidos; ninguna escritura de eventos ni Google en esta fase.
- Informar `CERTIFIED_DB_TRANSPORT` solo tras prueba real hospedada 204 y controles negativos. Si falla, `BLOCKED_ROOT_CAUSE` o `BLOCKED_SECURITY`.
- No crear eventos ni autorizar OAuth/Google Meet hasta fase posterior aprobada.

## Reversión sin eliminar recursos
Sin permiso adicional no desactivar bindings ni eliminar configuraciones. Para revertir la ejecución QA, detener la publicación, conservar el último deployment certificado `1dc486c5-7bc1-4851-bc82-86aae7390434` (PR #182) y solicitar autorización específica antes de cambiar alias o configuración.

## Fuentes de implementación
- https://developers.cloudflare.com/hyperdrive/configuration/tls-ssl-certificates-for-hyperdrive/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/hyperdrive/concepts/query-caching/
- https://supabase.com/docs/guides/database/psql/
