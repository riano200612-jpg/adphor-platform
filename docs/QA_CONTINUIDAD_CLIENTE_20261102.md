# ADPHOR — auditoría de continuidad y entrega cliente
**Fecha:** 2026-11-02 (hora Colombia). **Rama:** `qa/cliente-integracion-verificada-20261102`.

## Estado verificado en fuentes conectadas
- GitHub principal `riano200612-jpg/adphor-platform` público; fuente original `riano200612-jpg/adphor-jose-original-private` privado. No mover originales al repo público.
- El respaldo de José fue enviado por el propietario a `main` privado mediante commit `7089d48`, 25 archivos Portal y 7 Reuniones; su archivo `portal/PortalHome.html` se leyó en GitHub anteriormente. Se necesita un diff por módulo y una comparación visual en navegador para declarar fidelidad.
- PR #15 (`qa/premium-ux-20261030`) sigue abierto Draft, y PR #16 (`qa/staff-validation-20261031`) sigue abierto Draft; #16 corrige validaciones de permiso booleano y asignación de responsables de otra copropiedad. No fusionar automáticamente.
- `vite.config.js` bloquea un despliegue remoto de QA si no se han activado los controles para staging protegido; conservar `QA_DEPLOY_BLOCKED`.
- `qa/simulacion-operativa.html` existe en la rama QA, pero `vite.config.js` solo añade `qa/cliente.html` bajo `ADPHOR_BUILD_QA_DEMOS=true`. **La simulación nueva no forma parte del build actual**, por lo que no existe evidencia de despliegue.
- Supabase `oqizvirqjwbbhyyjpthq`: 755 filas en `adphor_ingest.source_rows`, 3 lotes, 40 filas en `adphor_import_private.client_property_catalog` y 16 en `client_meeting_catalog`, que no son reservas confirmadas. En `public`: 1 proyecto, 2 perfiles, 2 membresías, 7 tickets, 21 eventos y 1 ejecución + 1 revisión de agentes; RLS habilitada en todas las tablas consultadas.
- Avisos de seguridad: cinco funciones `SECURITY DEFINER` ejecutables por usuarios autenticados (revisar funciones y concesiones), protección de contraseñas filtradas desactivada, cuatro tablas de staging privado sin políticas RLS (posiblemente bloqueo intencional, no apertura automática). Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable y https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Brecha de interfaz y funciones
| Requisito | Estado conocido | Criterio de aceptación |
|---|---|---|
| Identidad visual José | Original privado y premium QA; comparación lado a lado pendiente | Capturas de escritorio/móvil y diferencias aprobadas |
| Login/MFA | Código de autenticación disponible | Inicio, segundo factor, cierre y denegación de acceso real |
| Inicio/calendario | Demo y componentes parciales | Reuniones guardadas/consultadas vía API autorizada |
| Agendar + acompañamientos | Formulario orientativo | Disponibilidad real, delegados de misma propiedad, idempotencia |
| Visitas | Fuente Apps Script y demo | Persistencia SQL y trazabilidad tras recarga |
| PQRS | Fuente Apps Script y demo | Radicación, estado, respuestas y evidencias privadas |
| Gerencia | Flujo simulado | Aprobar/rechazar con auditoría, sin envío no autorizado |
| ML→DL→PLN | Contratos y borradores QA | Ejecución real solo en entorno aislado, revisión humana obligatoria |

## Orden de trabajo seguro
1. Auditar código fuente de José en repo privado (secretos, URLs incrustadas, MFA, identidad visual) y rotar cualquier credencial comprometida.
2. Conciliar PR #16 con el desarrollo premium en rama de QA separada; no fusionar aún con main.
3. Montar prueba local/cloud de la simulación con assets originales saneados, **etiquetada DEMOSTRACIÓN, sin datos reales ni acceso público**.
4. Verificar Access de Cloudflare y un origen QA aislado antes de habilitar compilaciones remotas. Probar acceso autorizado y denegado.
5. Implementar API/RLS verificables para agenda, visitas y PQRS; no modificar datos reales hasta contar con respaldo y pruebas de aislamiento.
6. Ejecutar baterías JS/Python/SQL/E2E con resultados reproducibles, y probar visualmente.
7. Solo entonces proporcionar URL HTTPS de QA al cliente, verificada en navegador y protegida.

## Prohibiciones
No desplegar automáticamente el branch a producción, no eliminar el guard de Vite, no exponer `.clasp.json`, PIN, llaves privadas o PII, no usar supuestos «datos reales» cuando son una proyección no conciliada y no afirmar que modelos están ejecutándose sin pruebas.

## Estado
**No hay certificación de enlace cliente en esta auditoría.** Este informe es un punto de control para la siguiente ejecución; cualquier resultado adicional de Cloudflare Access se anexa tras observación directa.