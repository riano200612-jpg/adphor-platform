# ADPHOR QA — Arranque Chromium: control individual sin SQL y con SQL hijo

Base: `8304dfedb9147eeff81f8daae63214bda5af610e`.
Rama local: `qa/visits-chromium-handshake-pair`.

## Evidencia recibida y análisis

Se leyó la evidencia del propietario `Texto pegado(20261111-124738).txt`, con el JSON completo de la ejecución D-sql-child iniciada a las 2026-11-11T12:40:36.500Z. No se repitieron doce variantes.

- SQL hijo: 23.872 ms, consulta de control PASS. Vite y precalentamiento PASS.
- Antes de Chromium: RSS del worker 162.408 KiB; SQL hijo 740.712 KiB. Memoria cgroup 1.159.237.632 bytes (aprox. 1,08 GiB); memoria libre reportada 1.846.153.216 bytes. Los datos no demuestran agotamiento de memoria. No hay counters OOM/CPU cgroup disponibles en esa salida.
- Carga media de un minuto: 0,8 al inicio, 1,47 antes de Chromium y 3,24 tras el intento. Es carga de planificación, no porcentaje de uso CPU. Los porcentajes `ps` son promedios de vida de procesos; cifras como 1440% con cuatro CPU no se usan como prueba cuantitativa de saturación en Crostini. Faltan deltas fiables por intervalo.
- Event loop del worker: máximo 983,56 ms después de SQL, 3.049,26 ms antes de Chromium y 3.466,59 ms tras el intento. Son máximos acumulados: no deben atribuirse todos al handshake. El máximo final 19.478,35 ms ocurrió después, durante el tramo de cierre/salida; no prueba que el lanzamiento se bloqueara ese tiempo.
- Chromium creó PID 29366, pero launch venció a 30.000 ms (etapa 31.177 ms). No se llegó a contexto, página o formulario.
- El cierre registrado PASS tardó 5.191 ms. La instantánea `diagnostic-end` todavía mostró PID 29366 y descendientes; después de salir el proceso el runner registró `residualProcesses: []`. Hay una ventana transitoria de procesos vivos, no evidencia suficiente de una fuga permanente.

Conclusión: hay presión/latencia observable, pero no causalidad exclusiva de PGlite demostrada. Separar el event loop no elimina los aproximadamente 724 MiB RSS del hijo SQL ni su coste de CPU de arranque. Tampoco puede afirmarse un defecto del protocolo a partir de un PID creado y un timeout sin trazas CDP.

## Inspección de Playwright instalado

Se inspeccionó el código local de `playwright-core` 1.64.1 (`lib/coreBundle.js`): lanzamiento con `--remote-debugging-pipe`; conexión Chromium espera `Browser.getVersion` y, para contexto no persistente, `Target.setAutoAttach`. El proceso se lanza con `detached: true` en Linux. Por ello, señalizar solo el grupo del worker no cubre necesariamente Chromium. No se modificó Playwright ni sus argumentos de seguridad.

## Parche

- Nuevo modo `--launch-pair` del ejecutor existente: A (Chromium solo, sin SQL/Vite) y A-sql-child (SQL real inicializado en hijo, Chromium, sin Vite), una vez cada uno. Mismos 30 segundos de launch, 35 de etapa, 30 de contexto, 20 de página y límites anteriores de interacción. No hay límite experimental ampliado.
- Ambos ejecutan la interacción HTML mínima auténtica. Solo si ambos PASS y sin residuos observados se añade automáticamente una ejecución completa D-sql-child con Vite y el formulario real. Si no, el funcional queda SKIPPED; no se ejecuta otra batería de doce.
- Trazas `pw:browser,pw:protocol` para los dos controles y, cuando proceda, el funcional. `handshake` resume qué solicitudes CDP se enviaron y cuáles recibieron respuesta, sin inventar respuestas a partir de un PID. Se conservan logs originales; ausencia de una línea no demuestra que el navegador nunca intentara responder.
- Observador en el supervisor independiente: muestreo asíncrono cada dos segundos de árbol de procesos, PGID, estado, wchan, RSS, promedio CPU de vida, PSI y cgroup v1/v2 cuando existan. El timeout de `ps` no bloquea el event loop de Playwright. Los fallos de telemetría se registran sin convertir una muestra ausente en evidencia de ausencia de carga.
- Identidades de procesos observados incluyen PID, PGID y tiempo de inicio `/proc`, para evitar señalar un PID reutilizado. Tras salir el worker se revisan los descendientes observados, incluidos grupos separados. Se intenta TERM y, si siguen activos, KILL dentro del límite de limpieza, seguido de verificación. Zombies no cuentan como procesos ejecutándose. Un recurso que exige esta limpieza posterior se informa como fallo del ensayo, no como PASS. La observación es acotada: no garantiza descubrir procesos nunca muestreados.
- El contador de event loop se reinicia después de la instantánea previa al lanzamiento, para separar el arranque SQL/Vite de la ventana Chromium.
- Se conserva el selector exclusivo de Responsable, la limpieza concurrente, SQL auténtico e idempotencia. Después de recargar se vuelve a consultar SQL explícitamente: misma request_id, una fila, mismo motivo y responsable. No se cambia el formulario, los filtros ni la lógica empresarial.

## Resultados Work

| Control | Resultado |
|---|---|
| JavaScript completo | PASS, 282/282 |
| Regresión parser CDP | PASS: respuesta correcta, respuesta antigua ignorada, petición pendiente diferenciada |
| Observador de procesos | PASS: excluye árbol ajeno; detecta y termina descendiente separado tras salir el worker |
| IPC, SQL hijo y limpieza previa | PASS en suite completa |
| Build Vite | PASS |
| Sintaxis y diff --check | PASS |
| Pareja ejecutada en Work | A BLOCKED y A-sql-child BLOCKED por socket() Operation not permitted |
| Evidencia CDP Work | Browser.getVersion enviado, respuesta no observada en ambos controles; restricción propia de Work, no explicación de Crostini |
| Ensayo funcional automático | SKIPPED porque no pasaron los controles Chromium |
| Formulario con SQL: consulta tras recarga | BLOCKED, pendiente de navegador real Crostini |
| Producción y servicios compartidos | SKIPPED, sin cambios |

No se certifica E2E por las pruebas unitarias ni por SQL aislado. Los ensayos anteriores de PostgreSQL y las funcionalidades de Visitas, Agenda, PQRS y Miss ADPHOR se preservan.

## Crostini: un comando

Restaurar el nuevo bundle en otro checkout siguiendo LEEME.txt, sin sobrescribir los anteriores. Usar Chromium ya instalado por Playwright. No ejecutar `command -v chromium`.

```bash
env -u CHROMIUM_PATH node qa/run-visits-differential.js --launch-pair
```

Son dos controles y, únicamente si ambos pasan, un E2E completo. Todo se guarda en `test-results/visits-differential-...`, incluidos stderr, protocolo, muestras independientes, handshake y resultados. Compartir esa carpeta comprimida. No interpretar un código de salida cero de preparación como prueba del formulario; buscar el PASS literal `Formulario con SQL: consulta tras recarga` y su evidencia SQL.

La pareja tiene orden fijo y una observación por condición: sirve para localizar la fase que falla, no para una estimación causal estadística. Las trazas y el muestreo añaden carga, igual en ambos controles. No declarar una mejora sin datos nuevos.

## Reversión y límites

Nueva rama local, sin push, merge o despliegue. No se escribió en Supabase compartido, Google Calendar, Cloudflare ni producción. Para volver al estado anterior, usar un checkout separado en `8304dfe`; conservar todos los bundles y directorios anteriores. Los secretos y datos corporativos no participan en estas pruebas.
