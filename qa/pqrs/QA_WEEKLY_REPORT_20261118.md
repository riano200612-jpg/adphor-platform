# ADPHOR PQRS · informe semanal QA (2026-11-18)
**Solo QA Integral. No se modifica Apps Script, archivos originales de José, hojas originales ni producción.**

Infraestructura aplicada al proyecto Supabase QA `qfctnnnnltghepwujpdm`:
- `adphor_pqrs_qa_restrictive_rls_20261118`: 12 políticas restrictivas por copropiedad y rol en `pilot_pqrs`, historial y respuestas.
- `adphor_pqrs_weekly_summary_20261118`: función `public.qa_pqrs_weekly_summary`, `SECURITY INVOKER`. Solo admin/coordinator de la copropiedad, con control del principal AAL2 y RLS.
- Prueba transaccional: radicado sintético crítico + respuesta admin 1 hora después, resultado 1/1/1h/1 crítico; `ROLLBACK`. No quedó dato sintético.
- La estadística usa solo `public.pilot_pqrs`; no representa las 29 PQRS históricas de Apps Script sin homologación.
- Categorías por tipo, sin texto libre ni datos personales. SLA de 24h provisional.
- La respuesta de administradores se clasifica según el rol actual de quien respondió; no existe todavía snapshot histórico del rol.
- Los informes son consultas bajo demanda. No hay generación automática semanal ni envíos de correo certificados.
- Cero rutas de correo aprobadas. El outbox QA permanece bloqueado.
