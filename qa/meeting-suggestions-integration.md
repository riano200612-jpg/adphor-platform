# ADPHOR QA — Integración de horarios sugeridos

## Base y procedencia

Rama única: `qa/integral-claude-reviewed-20261111`. HEAD remoto consultado antes de modificar: `0b5c7c80db0807e3c29e917a866bbc68727be947`. El árbol local `0b294f8` coincide con ese HEAD. No se reinició ni restableció el proyecto.

ZIP recibido: SHA-256 `2f6fb0f0c03af0fb9c01b2d14b200bc4c1dadc1c9dc4b8edf96827e37cb898e9`. CRC PASS y cuatro archivos del manifiesto SHA256SUMS PASS. Parche SHA-256 `f6614405f522f8d13e228222b43cbf9b6019324847a21f6ebd4631c9891d85e8`.

`git apply --check` FAIL en el primer bloque: el parche espera una línea vacía después del tercer import; la base verificada contiene un cuarto import del calendario demo. No se forzó su aplicación. Se adaptó manualmente el cambio conservando todos los imports y funciones existentes. No había un avance remoto concurrente al comienzo.

## Código integrado y ajustes de revisión

- Algoritmo determinista: hasta cinco opciones posteriores al inicio pedido, pasos de 30 minutos y horizonte de 48 horas.
- Ambos extremos incluyen 30 minutos de margen y cada opción debe caber íntegramente en la ventana consultada. No se usa una consulta de un horario corto como evidencia para otras fechas.
- Servicio de lectura reutiliza `repo.meetingAvailability` con la misma copropiedad. El rango máximo es de 61 horas, dentro del límite existente de siete días del backend. No utiliza claves Google en el navegador ni introduce otro endpoint.
- Error, respuesta malformada o fecha sin zona no generan franjas libres. Un resultado válido completamente ocupado devuelve lista vacía.
- Se respeta el fin explícito del formulario. Se valida duración de 15 minutos a 12 horas y anticipación mínima de 24 horas. Al escoger alternativa se conservan inicio y fin; la revisión previa se invalida.
- Respuestas tardías se descartan mediante revisión, contenido del formulario y conexión del control al DOM. Cambiar copropiedad desmonta los controles anteriores. Se invalidan resultados por input, change y reset.
- Toda alternativa se presenta como ausencia de conflictos reportados, nunca como reserva o franja corporativa elegible. Jornada/días y disponibilidad de acompañantes requieren políticas/servicios aprobados. No se inventaron horarios laborales.
- El backend existente conserva AAL2, membresía y roles admin/coordinator. Este incremento no prueba su despliegue ni OAuth real.
- Se corrigió el texto obsoleto que afirmaba que no había fotografías publicadas. El carrusel y sus filtros no se modificaron.

## Evidencia

| Control | Resultado | Alcance |
|---|---|---|
| Nuevos tests del algoritmo y servicio | PASS 13/13 | Datos sintéticos, errores, ventana, margen, duración, lead time y consulta acotada |
| Suite JavaScript completa | PASS 306/306 | Incluye regresión de Visitas, Agenda, PQRS, autenticación y guía |
| Build Vite | PASS | No es despliegue |
| Sintaxis y git diff --check | PASS | Fuente y pruebas |
| Playwright | SKIPPED ejecución; cinco tests recolectados | Dos nuevos casos UI, tres casos existentes; sin afirmar PASS de navegador |
| Google Calendar corporativo y OAuth | BLOCKED | Backend/secretos/sesión autorizada no certificados |
| Sesión Supabase AAL2 real | BLOCKED | No se simuló como evidencia real |
| Pages/Deployment ID/SHA servido | BLOCKED | No consultados en esta fase; no hubo despliegue |

No se repitieron diagnósticos Chromium/Crostini ni ensayos PostgreSQL aprobados. La plantilla E2E sigue inactiva fuera de `.github/workflows`; se corrigió su rama objetivo a la candidata actual. El comando preparado sigue siendo `node qa/run-candidate-e2e.js` en host Linux x64 aislado autorizado. Sus fixtures son sintéticos y no certifican OAuth/AAL2 remoto.

## Visitas, PQRS y Agenda

Visitas mantiene `qa_visits`/`qa_create_visit` y `VITE_VISITS_SQL_ENABLED` apagado por defecto. No se crearon filas remotas ni otra tabla de borradores. La consulta de metadatos QA confirma campos programados existentes; no hay contrato aprobado de ejecución, entrada/salida, adjuntos o resultados. Los tests de idempotencia/aislamiento SQL aislado siguen incluidos en la suite.

PQRS conserva creación, consulta, actualización, historial y manejo de clasificaciones históricas. La suite de regresión pasa; el ciclo compartido AAL2 y recarga real no se ejecutó. No se tocaron registros históricos.

La consulta administrativa de columnas de `qa_meeting_events` confirma un modelo de lectura con `source_id` y procedencia, pero sin columna ETag/versión remota ni identificador de calendario. No se presume que `source_id` sea por sí solo un ID Google escribible. Agenda real de reprogramación/cancelación requiere un resolutor autorizado de ID corporativo y versión vigente, autorización OAuth de escritura independiente y un diario persistente aprobado para reintentos/reconciliación. El servicio actual `qa/agenda-simulated-service.js` usa `calendar.get/available/update`, `authorize` y `journal.claim/confirm`, pero solo adaptadores aislados. Su tabla `isolated_agenda_operations` no se exportó como esquema corporativo.

Ruta de integración preparada: resolver evento por copropiedad y ID estable → comprobar AAL2/rol/membresía y versión vigente → reclamar clave de operación en diario persistente → revalidar disponibilidad → actualizar el mismo evento con condición de versión → persistir confirmación o marcar por reconciliar → releer evento por ID ante timeout. Faltan contratos/aprobación de diario y política de notificaciones antes de implementar su adaptador corporativo. No se inventaron API, columnas, credenciales ni permisos para aparentar el cierre de esa brecha.

## Entrega y reversión

Sin migraciones remotas, activaciones de escritura, eventos, invitaciones ni cambios de Cloudflare. No se tocaron ramas productivas. Antes de publicar se requiere certificar Access, variables reales, artefacto exacto, AAL2 y recorridos de navegador, además de autorización expresa.

Revertir este incremento mediante commit inverso revisado en la misma rama, conservando `0b5c7c8` como referencia anterior; no force-push ni cambio de rama consolidada. No hace falta rollback SQL porque este incremento solo consultó metadatos. El Deployment ID de reversión debe obtenerse antes de cualquier futuro despliegue, que permanece sin autorizar.
