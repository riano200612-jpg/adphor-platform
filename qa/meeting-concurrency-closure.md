# ADPHOR QA — Concurrencia de Reuniones y cierre funcional pendiente

## Base y continuidad

Rama única `qa/integral-claude-reviewed-20261111`. HEAD remoto inicial verificado: `96e106db266d6c25bb761a81cdb16242ea07d6c0`. El árbol local de continuidad `cfe0c63` coincide con esa instantánea publicada. No se reinició el proyecto, descartó historia ni generó otra candidata experimental. El SHA final se registra en GitHub y en el mensaje de respaldo, que también identifica el commit local equivalente.

## Corrección de Reuniones

- `src/js/services/meeting-request-gate.js`: propiedad de una consulta compartida entre verificación y sugerencias. Clic repetido mientras está activa no crea otra solicitud. Editar invalida la anterior y permite una nueva; la respuesta/rechazo/finally anterior no puede publicar ni liberar los controles de su reemplazo. Terminar una consulta no invalida su resultado: seleccionar alternativa o revisar sigue permitido hasta que cambie el contexto.
- `src/js/ui-meeting-assessment.js`: ambos botones utilizan el mismo propietario; sin rehabilitación incondicional en finally. Resultados, errores, selección y revisión comprueban vigencia. Input, change y reset invalidan. `app.js` pasa un comprobador de copropiedad actual, además de comprobar controles conectados al DOM.
- `src/js/services/calendar-availability.js`: validación común para consulta manual y sugerencias. Se exige fecha/hora completa con segundos, precisión representable de hasta milisegundos y zona conocida; se rechazan fechas imposibles, 24:00, intervalos sin zona, invertidos, nulos, incompletos o dispersos. El sobre del backend exige copropiedad solicitada, America/Bogota y un array busy válido. Se conserva el margen de 30 minutos.
- `src/js/services/meeting-slot-suggestions.js` y `supabase.js`: reutilizan esa validación. Cinco opciones como máximo, dentro de la ventana consultada. Errores no producen disponibilidad libre. Seleccionar opción invalida la revisión y requiere nueva comprobación. No se infieren jornada laboral ni disponibilidad de acompañantes; no hay reservas ni invitaciones automáticas.

## Visitas

`shared-visits.js` mantiene `qa_visits`/`qa_create_visit`. Solo un booleano true habilita el adaptador; strings y valores truthy no lo activan. La interfaz sigue vinculada al flag comparado explícitamente con 'true', apagado por defecto. La respuesta RPC debe ser una sola fila y concordar en autor, proyecto, solicitud, responsable, motivo y fecha con zona válida. La fecha local inválida no llega a RPC.

Las pruebas SQL aisladas amplían los rechazos: responsable sin membresía, viewer intentando crear, identidad sin membresía, AAL1 y apropiación del request_id de otro autor. Los reintentos idénticos conservan la fila y los cambios de contenido dan conflicto. El listado verifica todas las páginas y rechaza una página con otra copropiedad. No se modificó el SQL versionado, su RLS, sus privilegios ni la base compartida.

La interfaz explica que programada no significa realizada o cerrada. No se añadieron campos de ejecución, salida, cierre o adjuntos. El procedimiento `qa/visits-authenticated-pilot.md` está preparado, pero exige aprobación de datos, identidad y habilitación antes de ejecutar cualquier escritura.

## Agenda y otros módulos

Agenda real continúa siendo de consulta. Los contratos aislados exigen evento estable, versión, autorización, confirmación, idempotencia, disponibilidad, diario y reconciliación, pero no existe todavía un adaptador corporativo certificado de escritura ni un contrato aprobado de diario remoto. El campo de procedencia no se presume un ID Google escribible. No se expone el simulador como servicio real. Miss ADPHOR ahora lo explica sin insinuar que basta una habilitación administrativa.

Home, PQRS, fotografías y carrusel se conservan; la suite ejecuta sus regresiones disponibles. No se tocaron históricos ni se repitieron importaciones. La protección contra fallback silencioso a demo permanece en la candidata. No hay nueva evidencia de navegador autenticado o del artefacto servido.

## Resultados de esta revisión

| Prueba | Resultado | Evidencia y límites |
|---|---|---|
| Concurrencia de solicitudes | PASS 6/6 | Propiedad, repetición, orden inverso, rechazo antiguo, desconexión y contexto |
| Validación de calendario | PASS 5/5 | Parser, sobre, intervalos y ambos extremos del buffer |
| Algoritmo/servicio de sugerencias | PASS 13/13 | Incluidas en el grupo dirigido de 24 tests |
| Visitas/Agenda dirigidas | PASS 14/14 | Nueve tests de Visitas (uno SQL PGlite) y cinco de Agenda/guía |
| Suite JavaScript | PASS 323/323 | Incluye los anteriores, no se suman como ejecuciones de pruebas distintas |
| Build Vite y sintaxis | PASS | No equivale a despliegue |
| git diff --check | PASS | Sin cambios de workflows activos ni migraciones |
| Navegador E2E | BLOCKED | Siete tests recolectados; no ejecutados; dos nuevos casos de regresión UI |
| OAuth, AAL2 y persistencia compartida | BLOCKED | No se usaron mocks/claims SQL como certificación real |
| PostgreSQL 15 nativo | Evidencia previa conservada | No se repitieron ensayos de concurrencia/reinicio ya aprobados |

Backend Python sin cambios en esta revisión; evidencia previa 136/136, no recertificada aquí. No hubo diagnóstico Chromium/Crostini. Los fixtures de navegador y PGlite son explícitamente sintéticos y aislados.

## Matriz funcional para José

| Módulo | Implementado | Probado en este alcance | Disponible/certificado en URL QA |
|---|---|---|---|
| Identidad y navegación | Conservadas | Regresión local PASS | BLOCKED: artefacto/visual no verificados |
| Login/MFA/AAL2 | Compuertas y bloqueo de demo conservados | Local PASS; sesión real BLOCKED | BLOCKED |
| Home | Lectura de reuniones verificadas | Contratos locales PASS | Recarga AAL2 BLOCKED |
| Reuniones | Preparación, duración, revisión informativa | Concurrencia/validación PASS | Backend/OAuth reales BLOCKED; creación no disponible |
| Horarios sugeridos | Cinco alternativas de calendario con reverificación | PASS aislado | Jornada/acompañantes no certificados; real BLOCKED |
| Acompañamientos | Carrusel, filtros y Sin acompañamiento requerido conservados | Regresión local PASS | Sin nueva certificación real |
| Visitas programadas | Repositorio compartido e interfaz; flag apagado por defecto | SQL y adaptador aislados PASS | Ensayo remoto AAL2 BLOCKED |
| Visitas realizadas/cerradas | Contrato adicional no aprobado | No implementadas como ciclo completo | FAIL para ese alcance |
| PQRS | Creación, consulta, gestión, clasificación e historial existentes | Regresión local PASS | Ciclo compartido con recarga BLOCKED |
| Agenda | Consulta integrada; transacción solo aislada | Regresión local PASS | Reprogramación/cancelación real FAIL/no conectadas |
| Miss ADPHOR | Guía y navegación contextual | Regresión PASS; avisos corregidos | Recorrido autenticado BLOCKED |
| Directorio/fotografías | Estado anterior conservado | Sin recertificación visual nueva | Evidencia previa del propietario; SHA nuevo no servido |

## Infraestructura, autorizaciones y reversión

No se verificó Cloudflare Pages en esta fase: Deployment ID, SHA servido, variables y Access siguen sin certificación nueva. Un SHA de GitHub no demuestra lo que sirve Pages. No se activó la plantilla E2E fuera de .github/workflows, no se ejecutó ninguna acción de despliegue, no se ejecutaron migraciones ni escrituras corporativas y no se modificaron ramas protegidas.

Se necesita acceso administrativo legítimo para verificar el destino protegido, un host E2E compatible autorizado y una sesión Supabase AAL2 real. La habilitación de escritura y el registro piloto requieren aprobación separada. Google Calendar requiere backend desplegado, OAuth válido y autorización independiente para cualquier operación corporativa de escritura. No solicitar secretos por chat ni crear identidades adicionales.

Reversión: commit inverso revisado de este incremento sobre la misma rama, preservando cambios concurrentes y `96e106d` como referencia anterior. Sin force-push ni sustitución de ramas protegidas. Mantener flag apagado; no borrar tablas, filas ni historial. Antes de publicar, obtener el Deployment ID previo y probar el rollback del proveedor; no se presume ensayado. No hace falta rollback SQL de esta revisión, porque el esquema no cambió.
