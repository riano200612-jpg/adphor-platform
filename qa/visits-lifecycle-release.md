# Visitas: preparación de integración controlada

Base: `6006777ff45f0c34757bab1c9bb0e0581bd49a21`, rama `qa/integral-claude-reviewed-20261111`.
Destino futuro exclusivo: `https://qa-integral-claude-reviewed.adphor-platform.pages.dev/`.
Este PR no aplica migraciones, no activa variables y no publica la plataforma.

## Contrato

Se amplía `qa_visits`, conservando `qa_create_visit` y su clave `(project_id,request_id)`.
Estados: programada → en_ejecucion → completada; cancelación justificada desde programada/en_ejecucion.
Solo admin/coordinator de la copropiedad, con principal activo y AAL2, puede operar.
La fecha programada se introduce en Colombia; ingreso y salida usan el reloj del servidor.
La edición de programación termina al ingresar; los estados finales son inmutables.
Observaciones, actividades, conclusiones y compromisos admiten 4000 caracteres por campo.
El cierre requiere conclusiones. La cancelación requiere motivo de hasta 1000 caracteres.

`qa_transition_visit` usa privilegios de propietario exclusivamente para evitar conceder UPDATE directo.
Comprueba principal, AAL2, rol y copropiedad antes de acceder al registro; fija search_path vacío.
Bloquea la fila, compara versión y registra estado + historial en la misma transacción.
Cada reintento conserva operation_id, autor, versión y contenido; un reintento idéntico devuelve
la confirmación original, incluso si después hubo otra transición. Una versión obsoleta falla con 40001.
No se permite actualizar/eliminar historial desde authenticated. Las visitas existentes reciben
un evento explícito `baseline`, sin inventar ejecuciones anteriores.

No hay persistencia localStorage en este flujo. Las pruebas usan PostgreSQL/PGlite aislados e
identidades sintéticas; no certifican sesiones Supabase reales ni autorización Cloudflare Access.

## Evidencias privadas

El contrato existente `qa_case_evidence` acepta solo `pqrs`/`recorridos` y valida entidades de esas tablas.
No permite asociar Visitas. Este PR mantiene esa restricción, no crea otro bucket ni reutiliza falsamente
un tipo de caso. La pantalla informa que los adjuntos de Visitas están pendientes de habilitación.
Ampliar ese contrato requiere revisión específica de permisos Storage, asociación y pruebas cruzadas.

## Validación

- `npm test`: incluye contrato original y nuevo ciclo, RLS, estados, fechas, versiones y reintentos.
- `npx playwright test tests/e2e/visits-lifecycle.spec.js`: UI real y SQL aislado, recarga,
  respuesta perdida después de COMMIT, reintento, doble clic, edición, ingreso, seguimiento, cierre e historial.
- Workflow `Visitas PostgreSQL concurrency`: dos conexiones PostgreSQL independientes, conflicto
  de versión y reintento idéntico simultáneo. Base efímera de CI; ninguna conexión a Supabase.
- Workflow existente `Validate ADPHOR`: regresión general y Chromium. No se modifica su despliegue.
- El runner local de Work bloquea sockets de Chromium. No se declara PASS local de navegador;
  el resultado de GitHub Actions debe comprobarse antes de aprobar integración.

## Activación gradual — necesita autorización posterior

1. Comprobar HEAD remoto, SHA revisado del PR y todos los checks. Verificar de nuevo el control de ramas.
   Pages tiene despliegue automático en la rama integral: **fusionar el PR constituye autorización de publicación**.
   No fusionar antes de autorizar esa consecuencia. La rama de trabajo queda fuera de las ramas Preview permitidas.
2. Verificar Allow y Deny de Access en el hostname exacto, sesión real AAL2 y permisos de la cuenta de prueba.
   No equiparar variables booleanas ni resultados sintéticos con estas verificaciones.
3. Aprobar y aplicar exclusivamente a `qfctnnnnltghepwujpdm` la migración
   `20261113191217_qa_visits_lifecycle.sql`. Nunca ejecutarla en producción.
4. Con `VITE_VISITS_SQL_ENABLED` y `VITE_QA_VISITS_LIFECYCLE_ENABLED` ausentes/false,
   la interfaz conserva consulta con las siete columnas originales y no llama al nuevo RPC.
5. Tras autorización, integrar y publicar con flags apagados. Verificar SHA, alias, Access y regresión de PQRS/Agenda.
6. Autorizar por separado activación de ambos flags y publicación del build correspondiente.
   Las variables frontend requieren nueva compilación; cambiar variables no cambia un bundle existente.
7. Solo con permiso de escritura de prueba: registrar una visita QA identificada, editar, ingresar,
   guardar seguimiento, completar, recargar, comprobar historial y aislamiento con otra identidad legítima.
   No enviar invitaciones ni usar Calendar para esta prueba. No borrar evidencia para simular éxito.

## Recuperación Preview — preparada, no ensayada

Referencia anterior a este PR: deployment `4e20e4c7-5ef9-4a3b-89c2-43a84a066227`, SHA `6006777`.
Antes de publicar, conservar los bytes del artefacto de esa versión y verificar su manifiesto SHA-256.
Los respaldos antiguos `5905086`/`799972f` no contienen los PR #34–#39 y no son una reversión equivalente.
No asumir que Cloudflare permite rollback nativo de Preview ni ensayarlo contra producción.

Ante incidente, detener escrituras mediante una acción expresamente aprobada: revocar EXECUTE del nuevo
RPC y, si procede, INSERT/EXECUTE de creación. Una bandera frontend sola no revoca clientes ya abiertos.
Conservar tablas e historial, sin migración destructiva. Tras aprobación, volver a publicar el artefacto
anterior comprobado en el mismo proyecto y rama Preview, con flags desactivados. No tocar la rama productiva.
Comprobar asociación del alias, SHA/configuración, Access anónimo/autorizado y consulta tras recuperación.
El procedimiento exige respaldo recuperable de `6006777` y una autorización específica; este PR no lo ejecuta.

## Bloqueos separados

`GOOGLE_CALENDAR_BLOCKED_CLIENT_MFA`: OAuth corporativo y Meet requieren al titular;
no bloquean el desarrollo aislado de Visitas. Adjuntos de Visitas y certificación real AAL2 siguen pendientes.
La existencia de código, build o CI satisfactorio no significa que el ciclo esté operativo en la QA publicada.
