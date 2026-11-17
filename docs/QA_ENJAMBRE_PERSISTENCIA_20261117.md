# ADPHOR — Registro del enjambre en la única QA Integral

**Fecha:** 17 de noviembre de 2026. **Proyecto:** Supabase QA \`qfctnnnnltghepwujpdm\`.
**Producción y archivos originales de José:** sin modificar.

La migración **ya existente** en \`supabase/migrations/20261021180130_agent_review_registry.sql\` se aplicó solo en Supabase QA. Historial remoto: \`20261117185347_qa_integral_agent_review_registry_from_20261021180130\`.

Verificación directa: \`agent_runs\`, \`agent_reviews\` y vista \`agent_run_status\` presentes; RLS activo en ambas tablas, vista \`security_invoker=true\`, sin permisos anónimos ni inserciones de aprobación desde el rol de servicio. El asesor no reportó hallazgos nuevos sobre estos objetos.

Pruebas SQL sintéticas revertidas: sesión representada mediante JWT AAL2 y miembro admin QA, AAL1 sin acceso, hash incorrecto rechazado, segunda aprobación rechazada, autor atribuido por el servidor. **0 filas** conservadas en los dos registros tras \`ROLLBACK\`. La simulación SQL no acredita un inicio de sesión E2E real.

Se agrega lectura del historial desde \`agent_run_status\` por el JWT humano de Supabase QA, MFA AAL2 y RLS. La aplicación filtra copropiedad, usa campos explícitos y rechaza filas inconsistentes. No permite modelos, ejecución, escritura, aprobación, cierre ni mensajes automáticos cuando falta \`VITE_AGENTS_API_URL\`.

**Bloqueado:** no existe backend ejecutor público de agentes certificado; aún no se han ejecutado análisis reales. Mantener \`ADPHOR_QA_AGENT_RULES_ENABLED\` desactivado y no publicar credenciales privadas.

**Conciliación futura:** el nombre/version del archivo SQL en GitHub y el registro asignado por la herramienta administrada en Supabase son diferentes. Antes de utilizar \`supabase db push\`, conciliar el historial con procedimientos oficiales para evitar reejecutar el \`CREATE TABLE\` original. No ajustar la tabla de migraciones a mano.
