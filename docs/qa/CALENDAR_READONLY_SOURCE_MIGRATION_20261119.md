# ADPHOR QA Integral — Migración conservadora de Google Calendar

**Destino único:** proyecto Supabase QA \`qfctnnnnltghepwujpdm\` conectado a \`qa/integral-claude-reviewed-20261111\`. Ninguna plataforma adicional.

**Fuente original protegida:** backup \`99_BACKUPS/20260219_Plataforma_Running.zip\`, archivo \`RUNNING/Calendario.gs\`. SHA-256 del ZIP \`4770168967dadcdd49c468d06e68c2d3cfe9e1f3c7743356bf26c50cf66955eb\`; SHA-256 de \`Calendario.gs\` \`6ac786eaeeee13409fbd471e2833265f82481214d364e982b6a91a79b19ed053\`. Comparación de IDs: el retorno literal de \`getCalendarId()\` coincide exactamente con el calendario corporativo «Reuniones» de la conexión Google Calendar autorizada. No se publican identificadores privados ni credenciales en el repositorio.

**Lectura 2026-11-19:** Google Calendar «Reuniones», rol owner, consulta freeBusy con respuesta válida; 2026: 507 eventos únicos distribuidos en trimestres 126 / 146 / 126 / 109 (todos confirmados). Periodos 2025 y 2027 consultados: cero resultados. Esto es inventario de la fuente, no certificación de sincronización automática.

## Contrato de copia segura

1. Leer eventos de Google exclusivamente por conector autorizado, sin modificar eventos, invitados, notificaciones, Apps Script ni calendarios.
2. Escribir una copia mínima (ID original, título, estado, inicio y fin) exclusivamente en \`qa_calendar_private.source_events\` mediante acceso SQL administrativo QA; no copiar asistentes, descripciones, correo, contraseñas ni PIN.
3. Mantener la tabla en un esquema privado no expuesto por Data API; RLS habilitado, sin permisos para \`anon\`, \`authenticated\` o \`service_role\`. No habilitar frontend ni agentes para leer directamente la tabla.
4. Conservar \`mapped_project_id=NULL\` y \`mapping_reviewed=false\` hasta validación explícita de copropiedad y no duplicidad con los 32 registros históricos existentes.
5. El importador usa \`ON CONFLICT (calendar_id,google_event_id)\` para no duplicar; nunca borra eventos fuente ni tablas históricas.
6. Ante fallo de consulta, no reemplazar una copia anterior por «calendario vacío» y no certificar agendas. No realizar escrituras a Google sin integración OAuth independiente y auditoría de roles/AAL2.

**Importante:** El acceso Google Calendar concedido al conector ChatGPT NO proporciona al backend de ADPHOR un refresh token reutilizable ni un proceso continuo de sincronización. Los 507 eventos no se consideran visibles para una copropiedad hasta completar la conciliación y la lectura segura por tenant.

**Operaciones prohibidas en esta fase:** cambiar \`Calendario.gs\`, restablecer contraseñas, reutilizar PIN16 de Hoja 10 como credencial Google, migrar contraseñas al repositorio, crear reuniones o Google Meet reales, activar cron sin OAuth, exponer calendarios privados o conceder acceso por defecto.
