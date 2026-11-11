# Contratos propuestos para Visitas y Agenda en ADPHOR QA

## Visitas

La fuente histórica es la hoja Visitas del Portal Apps Script. El inventario de relaciones en Supabase QA muestra projects, memberships, profiles, tickets, evidencia de casos y reuniones. El inventario no identifica una entidad de visitas. Tickets registra novedades y no conserva el ciclo de inicio, salida y seguimiento de una visita.

| Campo histórico | Fuente | Destino existente | Transformación y validación | Riesgo |
|---|---|---|---|---|
| idCopropiedad | registrarInicioVisita | projects | Resolver por correspondencia aprobada con ID estable | Nombre ambiguo |
| idVisitante | registrarInicioVisita | Sin mapeo confirmado | Conciliar con identidad y membresía sin inferir equivalencia con responsable | Visitante y responsable pueden diferir |
| motivo y notas | registrarInicioVisita | Sin destino | Conservar texto de origen y validar límites antes de importar | Datos personales |
| Entrada y salida | Inicio y registrarFinVisita | Sin destino | Conservar precisión y zona original. Normalizar fechas verificadas a instantes | Hora sin zona o fecha faltante |
| Resultado y seguimiento | registrarFinVisita | Sin destino | Conservar valores históricos y validar fecha de seguimiento si existe | Estados sin homologar |
| Archivo | procesarArchivoVisita | Sin contrato de Storage para visitas | Conservar procedencia. Validar asociación, MIME, tamaño y acceso privado antes de copiar | Enlaces con acceso excesivo |
| idVisita y fila | Inicio, fin e historial | Sin destino | Verificar unicidad del ID dentro de la fuente. La fila sirve para trazabilidad | Posición mutable |

La propuesta requiere una entidad de visitas vinculada a projects, identidad de actor auditada y responsable validado contra la membresía. Separar fecha programada, entrada, salida y seguimiento. La clave de importación debe combinar fuente e ID estable verificado. Los reintentos de creación necesitan una clave de solicitud con unicidad por copropiedad. La tabla, sus reglas de conservación y el mapeo requieren aprobación antes de escribir una migración ejecutable. Una futura migración debe ser aditiva, ensayarse en aislamiento y permitir desactivar el acceso y la interfaz sin borrar registros incorporados.

## Agenda

La vista QA consulta reuniones verificadas. El ID de procedencia cotejado permite reconciliar Google, pero la vista histórica no acredita una versión remota vigente ni autorización de escritura.

- Solicitud propuesta: ID interno, acción de reprogramar o cancelar, versión esperada, clave de idempotencia y confirmación vinculada a los datos revisados. La reprogramación incluye inicio y fin.
- El servidor resuelve el calendario y el ID de Google a partir del evento autorizado. Verifica sesión AAL2, rol, membresía y estado. Para reprogramar vuelve a verificar disponibilidad y aplica la condición de versión sobre el mismo evento, preservando su identidad.
- Para cancelar, conservar el registro histórico y representar la cancelación como transición auditada. La política de notificaciones debe aprobarse antes de activar el servicio.
- Registrar la solicitud antes del efecto externo. Guardar estados pendiente, confirmado, rechazado y por reconciliar. Una clave repetida con los mismos datos devuelve el estado registrado. Rechazar su reutilización con otros datos.
- Si Google responde con timeout o falla la persistencia local después del cambio, consultar el evento por ID antes de reintentar. Si hay conflicto de versión, exigir una revisión nueva. No reemplazar el evento ni reportar éxito hasta confirmar el resultado.

Reprogramación y cancelación quedan deshabilitadas. Casos mínimos de prueba aislada: autorización, versión obsoleta, conflicto, doble confirmación, fallo parcial y reconciliación.

## Evidencia de concurrencia de Visitas

El propietario reportó PASS del ejecutor en Crostini con PostgreSQL 15.19 para el commit 0b3b676697c4b0fb3eca093a4b4d46b3d02b98ec. El clúster temporal inició y se detuvo correctamente. El resultado fue `PASS: concurrent retries, conflicts, recovery and authorization`. Las identidades y las funciones de sesión del ejecutor son sintéticas. Las políticas y sesiones reales de Supabase QA requieren certificación separada.

El propietario reportó PASS de reinicio nativo de Agenda en Crostini, PostgreSQL 15.19, commit 40dbf54aa7025d6acb28ceb07c51168ec4bb8c08. El clúster se detuvo y reinició con el mismo directorio, el segundo proceso Node recuperó la operación y el simulador registró una modificación. La integración corporativa sigue pendiente.
