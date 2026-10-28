# ADPHOR — protocolo de certificación RLS multitenant en staging

**Estado:** diseño de pruebas, no ejecutado. **Solo para instancia Supabase QA separada**, nunca para el proyecto productivo `oqizvirqjwbbhyyjpthq`.

## Requisitos previos

1. Proyecto Supabase nuevo y aislado con referencia distinta a producción; no utilizar tokens ni usuarios reales.
2. DDL candidato `INDIVER_ADPHOR_DDL_RLS_2026-10-28.sql` revisado de forma independiente y ejecutado solo en QA.
3. Crear dos copropiedades completamente sintéticas: A y B, cada una con al menos dos registros diferentes y lotes verificados.
4. Crear cuentas Auth separadas: usuario-A, usuario-B y agente-A. Asignar membresías autorizadas únicamente dentro de QA.
5. Preparar la API REST/PostgREST de QA y confirmar que las vistas son `security_invoker=true`; no publicar esquemas privados de producción.
6. Aislar el contenedor o infraestructura de agentes para que solo disponga de URL/llaves de staging. No colocar `service_role` ni credenciales privilegiadas en clientes.
7. Definir cómo se restablecerá la base QA y el responsable de verificar cada resultado.

## Matriz de aceptación, con identidades JWT reales

| Caso | Contexto | Resultado obligatorio |
|---|---|---|
| T01 | usuario-A SELECT datos de A | Solo registros A; al menos dos visibles |
| T02 | usuario-A SELECT datos de B | 0 filas / acceso denegado |
| T03 | usuario-B SELECT datos de A | 0 filas / acceso denegado |
| T04 | usuario-B SELECT datos de B | Solo registros B; al menos dos visibles |
| T05 | anónimo SELECT tabla/vista protegida | 0 filas / sin permiso |
| T06 | usuario-A UPDATE/DELETE sobre A y B | Denegado; datos sin alterar |
| T07 | agente-A con compuerta inicial false | 0 filas |
| T08 | agente-A con compuerta QA autorizada, mapeos aprobados y sin P1 | Solo registros A |
| T09 | agente-A intenta leer B tras habilitar A | 0 filas / acceso denegado |
| T10 | incidencia P1 abierta de A | agente-A vuelve a 0 filas |
| T11 | agente-A con membresía/identidad revocada | 0 filas desde la siguiente petición |
| T12 | usuario-A usa un ID ajeno en filtro de vista | 0 filas / acceso denegado |
| T13 | un mapeo no aprobado intenta alimentar registro de negocio | FK / constraint rechaza la inserción |
| T14 | se intenta reasignar `copropiedad_id` de un registro | Operación rechazada |
| T15 | consulta desde SQL Editor con rol administrador | Se registra como prueba privilegiada, **NO** es evidencia de RLS |

## Reglas de validación

- Las pruebas deben llamar la API con tokens reales de cada identidad QA, no fingir identidad con una variable del frontend.
- Verificar denegación de acceso tanto por enumeración de IDs como por cambio de filtros.
- El cierre de P1 de QA es requisito adicional a una compuerta administrativa.
- Una consulta de comprobación no habilita automáticamente el enjambre en la API ni activa modelos.
- Guardar evidencia de resultados sin incluir claves JWT, correos, archivos, contenido de PQRS o nombres reales de edificios.
- Cualquier falla de T01-T14 bloquea el despliegue y la lectura real.
- Verificación final por auditor independiente del PR y autorización expresa del administrador.

## Bloqueos actuales (28-oct-2026)

- No hay proyecto Supabase staging independiente entre los proyectos conectados.
- El libro de Drive presenta una divergencia en la fila 525 de `Registros` respecto del snapshot SQL: cambio de identificador y fecha de evento.
- Siguen sin aprobarse 626 coincidencias candidatas, y 56 eventos carecen de correspondencia exacta.
- Incidencias P1 de GitHub #8, #9 y #10 pendientes.
- Solo se ha ejecutado la comparación de origen y pruebas de Python sintéticas; **ninguna prueba T01-T15 se ha ejecutado todavía**.
