# ADPHOR · GAUNTLET — Auditoría integral y matriz de certificación QA
**Corte de evidencia:** 20 de noviembre de 2026 · **Prioridad:** P0 · **Estado:** PARTIALLY_CERTIFIED

> La auditoría continúa abierta. Este documento no acredita que el piloto multiusuario ni todas las funciones estén certificados. Solo contiene datos agregados, código versionado y condiciones objetivas. El único destino es QA Integral. Ningún original de José ni su plataforma productiva fueron modificados.

## 1. Baseline y límites
- Repositorio: \`riano200612-jpg/adphor-platform\`.
- Rama QA única: \`qa/integral-claude-reviewed-20261111\`.
- Base de auditoría: \`c0f6854ff3c088d5cbee4ed78573d8344a3a73b3\`, CI GitHub \`44773017311\` **success**.
- Cloudflare Pages deployment \`e01879e4-05c3-4ddb-add5-072e8674f79c\` **success**, alias oficial \`qa-integral-claude-reviewed.adphor-platform.pages.dev\`.
- Supabase QA (no producción): proyecto \`qfctnnnnltghepwujpdm\`.
- Originales de José: **solo referencia, nunca escribir**. Copias clonadas: fuente de migración privada; no escribir ni alterar el ejemplar fuente, solo staging QA.
- Una prueba sintética E2E demuestra comportamiento del código aislado, **no** certifica un usuario real con rol, MFA, RLS, correo y datos del edificio.

## 2. Matriz GAUNTLET por área

| Área | Evidencia observada en repositorio/QA | Estado GAUNTLET | Prueba de aceptación que falta o límite |
| --- | --- | --- | --- |
| Portada, Primera vez, Ingresar | Existen \`app.js\`, \`ui-miss-adphor-welcome.js\`, pruebas visuales de bienvenida y recuperación | PARCIAL | Recorrido de usuario real desde portada, tutorial realmente disponible, errores, zoom WCAG 2.2 AA y sesión válida |
| Identidad, contraseña, MFA | 3 cuentas Auth; 2 usuarios con MFA verificado; \`ui-mfa.js\`, \`ui-password-recovery.js\`; controles de PR #144/#150/#152 | **P0 BLOCKED** | Identidad individual verificada, recuperación y MFA AAL2 de delegada real; no reutilizar PIN ni correo histórico compartido |
| Permisos delegada/coordinadora | 43 proyectos operativos, 86 membresías previas; 55 candidatos legados, 0 enlazados a Auth; \`iam_accounts=0\`, \`iam_grants=0\` | **P0 BLOCKED** | Delegada de un edificio y de dos edificios con cuenta personal; coordinadora solo edificios aprobados; denegación RLS/RPC/Storage y revocación |
| Áreas de trabajo y novedades | \`ui-easy-case-form.js\`, \`ui-operational-agenda.js\`; contexto del edificio en novedades implementado por PR #156; 1 tarea QA | PARCIAL | Completar Novedad→Responsable→Plazo→Seguimiento→Evidencia→Cierre bajo MFA real; no perder datos o duplicar acciones |
| Compromisos por plazo | \`ui-operational-agenda.js\`, \`ui-sprint-board.js\`, pruebas Chromium de orden/agenda | PARCIAL | Datos persistentes reales, filtro vencidos/hoy/próximos, acciones verificadas y pruebas de usabilidad con usuarios |
| Actividades recurrentes | \`ui-task-catalog.js\`; 0 propuestas y 0 programaciones registradas | PARCIAL / APROBACIÓN | Crear propuesta no debe generar tarea automática; aprobación explícita antes de programar recurrencias reales |
| Agenda y reuniones | \`ui-meeting-experience.js\`, \`ui-meeting-assessment.js\`, PR #154; 32 registros históricos de reuniones QA | PARCIAL | Integridad entre solicitud, calendario y compromisos; la pantalla por sí sola no certifica reservas |
| Google Calendar corporativo | 507 eventos **copiados**, 0 mapeos revisados; consulta FreeBusy preparada; \`manual-google-handoff.js\` construye borrador/ICS | **PENDING_EXTERNAL_AUTHORIZATION** | OAuth QA propio aprobado por el propietario, AAL2, lectura y escritura en calendario sintético autorizado, prueba negativa e idempotencia; no escribir en original de José |
| PQRS end-to-end | 3 casos QA y 1 adjunto privado en metadata; PR #142/#143; 43 filas de readiness de rutas | **P0 PARCIAL** | Radicación→trámite→respuesta→cierre y evidencia en Storage real; 0 rutas de correo aprobadas, 2 notificaciones bloqueadas; no declarar correo entregado |
| Enlace/evidencia original Google Drive | UI y fallback del portal original en \`ui-pqrs-unified.js\`; issue #157 | **P0 NO VERIFICADO** | Identificar error «No se puede abrir el archivo» con cuenta propietaria autorizada; reparar ruta/permisos solo con consentimiento; nunca publicar ni editar originales |
| Visitas y bitácoras | 2 visitas QA, 2 metadatos de evidencia, 4 filas de historial; PR #155 añade edificio a formulario/seguimiento; E2E sintéticos | PARCIAL | Inicio/fin, foto/documento, persistencia/recuperación/descarga, vínculo a novedad y aislamiento con cuenta real de coordinadora |
| Carrusel / personal y fotos | 48 colaboradores, 323 asignaciones; \`ui-corporate-staff.js\`, pruebas foto privada | PARCIAL | Certificar foto, cargo, pertenencia y permiso real por edificio y sin abrir medios privados |
| Miss ADPHOR — guía | \`ui-miss-adphor-chat.js\`, guía contextual y preguntas de visitas/PQRS/reuniones con fuentes QA | PARCIAL | Recorrido con usuario real de una/dos propiedades y rechazos de consulta a otras propiedades; distinguir respuestas de guía de ejecución automática |
| Miss ADPHOR — informes | \`ui-miss-qa-weekly.js\`, \`ui-reports.js\`, borradores semanales y gráficos mensuales; PR actual añade control exacto de ámbito/totales | PARCIAL | Cifras fuente/periodo/denominadores, cobertura y comparación; PDF/XLSX realmente generados y accesibles solo por su rol; aprobación antes del envío |
| Historial del enjambre | \`ui-agent-history.js\`, tablas \`agent_runs\` y \`agent_reviews\` con RLS; 0 ejecuciones y 0 revisiones | PARCIAL / NO ACTIVADO | Validar API ejecutora, autorización, integridad de snapshots, auditoría, revisión humana y persistencia real; no simular agentes activos |
| Copias y documentos de José | Staging privado \`pilot_private.qa_cloned_source_batches/records\` con **167 registros en 4 lotes**, todos \`QUARANTINED\`; 44 copropiedades fuente vs 43 QA | PARCIAL / QUARANTINED | Conciliar divergencias y archivos restantes, hashes, medios, clasificación, derecho de acceso, permisos por edificio antes de RAG; ningún entrenamiento masivo |
| Seguridad de PostgreSQL y Storage | RLS activo en las tablas operativas principales. Aviso a revisar: \`qa_identity_private.property_photo_import_leases\` sin RLS; no lectura de tabla a \`anon\` ni \`authenticated\` en consulta verificada | **P0 REVIEW REQUIRED** | Revisar funciones privilegiadas, usuarios, políticas, permisos de servicio y AAL2; no habilitar políticas amplias ni «arreglar» a ciegas |
| CI, despliegue y QA pública | Baseline CI success y deployment Cloudflare success; pruebas Node/Python/Chromium sintéticas | PARCIAL | Control de Access anónimo/permitido/denegado, comprobación del SHA publicado y recorridos manuales posdespliegue autorizados |

## 3. Hallazgo reproducible corregido en este incremento
**GAUNTLET / INFORMES / P1:** la UI del borrador semanal únicamente comprobaba \`propertyCount === ids.length\` y que cada fila tuviera un ID permitido. Una respuesta con dos filas del **mismo edificio** o una lista vacía con un conteo declarado podía pasar el filtro e incluso habilitar exportación. Los totales tampoco se conciliaban con las filas.

**Corrección propuesta en PR de este documento:**
1. Exigir **exactamente** los ID autorizados, una sola vez cada uno.
2. Rechazar indicadores faltantes, negativos, no enteros o inconsistentes con el total.
3. Rechazar estados que afirmen certificación no existente.
4. Si el control falla, **no mostrar cifras ni ofrecer CSV/PDF**.
5. Pruebas Node adversarias y Playwright con respuesta sintética duplicada.
6. No cambiar Supabase ni modificar lógica IAM/RLS: defensa adicional de presentación, NO autorización.

## 4. Orden para terminar la auditoría — sin crear módulos innecesarios
**P0:** (a) identidades individuales y permisos para piloto de 43 propiedades; (b) PQRS real con destinatarios autorizados y evidencia, diagnosticar Drive; (c) sesión AAL2 y aislamiento real en tareas/visitas; (d) verificar política de Access de QA.

**P1:** (e) simplificar recorridos de novedades/compromisos/visitas por observación, no solo test sintético; (f) certificar carrusel/fotos; (g) reportes semanales/mensuales profesionalmente exportables y auditables.

**Dependencias externas:** (h) José autoriza OAuth de Calendar en interfaz oficial, sin compartir contraseña; (i) buzones personales verificados para altas reales; (j) autorización de personas y documentos para consulta asistida de Miss ADPHOR.

**P2:** (k) pruebas WCAG 2.2 AA con navegación por teclado, zoom 200 %, contraste y móviles; (l) proyección de almacenamiento para 43 copropiedades.

## 5. Evidencias y dictamen
- SQL QA consultado en modo **solo lectura**: agregados operativos, fuentes clonadas y conteos de identidad. No se exponen nombres, correos, secretos, contenido PQRS ni adjuntos.
- Las 167 filas de copias están **en cuarentena, no indexadas ni usadas para entrenamiento**. No son casos operativos activados.
- Verificar rama/CI/deployment posterior a cualquier PR antes de actualizar el baseline de publicación.
- **Dictamen actual:** \`PARTIALLY_CERTIFIED\` para funcionalidades con pruebas parciales; \`BLOCKED\` para piloto de acceso multiusuario; \`PENDING_EXTERNAL_AUTHORIZATION\` para Google Calendar corporativo.
- **Criterio para \`CERTIFIED_QA\`:** recorridos A–J del GAUNTLET con actor real autorizado, MFA AAL2, escritura/lectura persistente autorizada, Storage/RLS y negaciones adversarias, CI después de fusionar, y comprobación del alias y SHA publicados.

### Responsabilidades de actualización
Actualizar por cada incremento el campo **prueba ejecutada / tipo de datos / PR / CI / SHA / deployment / resultado real**. Si una prueba falla, mantener \`BLOCKED\` o \`PARCIAL\`, nunca \`CERTIFIED\`.
