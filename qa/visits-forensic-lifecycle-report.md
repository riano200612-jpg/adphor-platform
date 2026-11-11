# Evidencia de ciclo de vida y ensayo diferencial

Base auditada: 068196bf65aa878c9ba973c957a461131bcd56e1.

H3 confirmado por revisión: el timeout de etapa rechaza Promise.race sin cancelar la adquisición. Se añadió un propietario de recursos que observa adquisiciones desde su inicio. Al cerrar, libera recursos existentes en orden inverso, espera adquisiciones pendientes y libera las tardías antes de propagarlas. Cada close se memoiza. Las pruebas fuerzan finalización tardía y errores tardíos de navegador, contexto y página con plazos de etapa reales y comprueban que nunca se publican tras el cierre.

El watchdog continúa en el padre. Los plazos de inicialización e interacción se conservan. Una operación de adquisición que nunca resuelva sigue dependiendo del límite externo del supervisor. El apagado forzado del proceso no equivale a un cierre cooperativo.

Ejecución Work x64: A (Chromium solo) BLOCKED 3/3; B (Vite y Chromium) BLOCKED 3/3; C (PGlite solo) PASS 3/3; D (PGlite, Vite y Chromium con flujo SQL) BLOCKED 3/3. La restricción de socket impide abrir Chromium. No se observaron procesos residuales entre los PID del árbol registrado en las doce ejecuciones. El observador es una instantánea y no certifica la ausencia de todo proceso externo.

El RSS del árbol suma RSS por proceso; páginas compartidas pueden contarse varias veces. Los tiempos de CPU son el porcentaje informado por ps, no una medición exclusiva de una etapa. El retraso del event loop se mide con monitorEventLoopDelay y puede incluir intervalos ocupados por WASM. Las métricas cgroup pueden no estar disponibles según el host.

La causa raíz de Crostini sigue abierta. H1 (WASM residente), H2 (plazos bajo carga) y H4 (temporizadores de acción en el event loop) no prueban causalidad. La separación de SQL en otro proceso queda condicionada a los resultados comparables de Crostini. El escenario D conserva SQL real de PGlite y no sustituye el repositorio por mocks.

El runner usa tres procesos independientes por escenario, con la misma configuración de navegador. Cada invocación registra JSON con etapas, recursos, código de salida y procesos residuales observados. Los escenarios A y B terminan después de las interacciones sin SQL. C ejecuta SQL y cierra. D recorre revisión, guardado y consulta tras recarga.

Ejecución Crostini desde el checkout:
    env -u CHROMIUM_PATH node qa/run-visits-differential.js

Los resultados se escriben en un directorio test-results/visits-differential con marca temporal. No habilita servicios remotos, publicaciones ni escrituras corporativas.

Aceptación: H3 tiene regresión local aprobada. El criterio Formulario con SQL: consulta tras recarga permanece pendiente hasta obtener el PASS de D en navegador. Políticas y sesiones corporativas de Supabase, Cloudflare Access y Google Calendar requieren certificación independiente.
