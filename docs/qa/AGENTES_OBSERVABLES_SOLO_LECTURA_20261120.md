# ADPHOR QA Integral — Ronda observable de agentes QA (2026-11-20)

## Propósito
Permitir al propietario observar **sondas de verificación**, no modelos de IA, sobre la sesión autorizada de la única QA Integral. Se ejecutan automáticamente al entrar al **Historial del enjambre** y manualmente mediante "Repetir auditoría". Solo Administración/Coordinación, copropiedad autorizada, host QA exacto, identidad cargada y lectura de registro que acredita MFA AAL2.

## Seis sondas
1. Acceso: consulta de registro autenticado, MFA AAL2 y ámbito. No sustituye prueba externa de Cloudflare Access.
2. Operaciones: conteo y consistencia de los casos ya cargados para esa copropiedad.
3. Equipo: conteos agregados de colaboradores/fotos; solo administrador general habilitado.
4. Navegación: presencia de módulos en el menú actual (no prueba los servicios externos).
5. Miss ADPHOR: comprueba montaje del contenedor, no capacidad conversacional real.
6. Supervisor: verifica el estado de readiness, informa explícitamente que ML, DL, PLN y reglas NO ejecutan.

## Seguridad
Sin POST/PUT/PATCH/DELETE, sin mutación de Supabase, PQRS, Calendar, emails, solicitudes o personal. Sin persistencia de token, IDs o resultados privados. No crea filas agent_runs ni agent_reviews. Los agregados se muestran solo en pantalla al usuario autorizado. No ejecuta modelos IA, no entrena, no toma decisiones ni aprueba borradores.

## Para activar agentes ML/DL/PLN reales
Exigir primero backend seguro, modelos evaluados, credenciales servidor privadas, binding Pages→Worker, pruebas Access allow/deny, AAL2, aislamiento por copropiedad y auditoría de borradores con revisión humana. Actualmente el Worker no aparece desplegado y el registro tiene 0 ejecuciones. Las sondas NO reemplazan esos requisitos.

## Pruebas
Pruebas unitarias (fail-closed, AAL1, tenancy, ausencia de escrituras), Playwright (inicio automático, resultados visibles y nueva ronda), suite completa Validate ADPHOR y comprobación de Deployment ID/SHA/alias tras publicación.
