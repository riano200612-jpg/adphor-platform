# ADPHOR · Estado verificado de integración real (2026-11-01)

## Alcance de esta verificación
Diagnóstico de solo lectura de GitHub y Supabase, sin despliegue, sin modificación de datos operativos ni apertura de permisos. Este documento **no certifica** el entorno como listo para cliente.

## Repositorio y rama
- Repositorio: `riano200612-jpg/adphor-platform` (público).
- Rama examinada: `qa/premium-ux-20261030`.
- `src/js/app.js` selecciona `createCloudRepository()` solo si están presentes ambas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; de lo contrario emplea datos de demostración.
- `src/js/services/supabase.js` implementa inicio de sesión con Supabase y MFA gestionado, y consulta proyectos, membresías y tickets; la activación del MFA depende de `VITE_REQUIRE_MFA`.
- `src/js/services/porto.js` restringe el piloto PQRS a staging **aislado**, distinto de `oqizvirqjwbbhyyjpthq`. Mantener este control; no deshabilitarlo para mostrar información privada.
- `qa/cliente.html` declara que es una simulación y no conecta servicios reales.
- `vite.config.js` bloquea el despliegue de QA salvo opt-in explícito para staging protegido.

## Supabase verificado (proyecto `oqizvirqjwbbhyyjpthq`)
- Proyecto activo, PostgreSQL 17.
- Tablas `public` observadas: `projects` 1 fila; `profiles` 2; `memberships` 2; `tickets` 7; `ticket_events` 21; `monthly_reports` 0; `agent_runs` 1; `agent_reviews` 1. Todas tienen RLS activada.
- Tablas de ingesta privadas observadas: `adphor_ingest.source_rows` 755 filas; `adphor_ingest.import_batches` 3.
- Catálogos privados observados: `adphor_import_private.client_property_catalog` 40 filas; `adphor_import_private.client_meeting_catalog` 16.
- No se encontraron tablas `public.pilot_pqrs`, `public.pilot_meetings`, `public.meetings`, `public.visits` ni `public.visitas`.
- **Interpretación**: hay datos reales en staging de importación privado, pero no está demostrado que estén reconciliados y autorizados para operación o presentación desde la interfaz.

## Seguridad pendiente de revisión
Los avisos automáticos señalan 5 funciones `SECURITY DEFINER` ejecutables por `authenticated` (`finalize_monthly_report`, `monthly_report`, `project_role`, `ticket_command`, `visible_profile`) y protección de contraseñas filtradas desactivada. Estas funciones pueden formar parte del diseño de autorización: **auditar implementación y GRANT antes de cambiar privilegios**. Los 4 objetos privados con RLS sin políticas podrían ser intencionalmente inaccesibles desde el cliente.

Referencias:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Condiciones para mostrar al cliente con datos reales
1. Validar importación y reconciliación contra registros originales (duplicados, huérfanos, asignación de copropiedad, trazabilidad).
2. Preparar entorno **privado y aislado** con Cloudflare Access y usuarios autorizados; demostrar acceso denegado a cuentas sin permiso.
3. Implementar proyección de lectura con autorización por copropiedad de los catálogos privados, sin abrir esquemas de ingesta al navegador ni publicar credenciales.
4. Probar login, MFA completo, calendario/agenda con datos verificados, reuniones y PQRS end-to-end, escritura controlada y ausencia de mensajes externos no autorizados.
5. Ejecutar pruebas automatizadas, respaldo/restauración y validar controles de seguridad; después habilitar despliegue QA protegido.
6. No promover cambios a `main` ni presentar la maqueta como datos operativos hasta pasar los controles anteriores.

Este archivo registra verificaciones, no constituye integración ni despliegue terminado.
