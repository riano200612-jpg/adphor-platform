# ADPHOR QA — Degradación Chromium/PGlite y desacoplamiento experimental

## Conclusión y procedencia

El propietario reportó 12 ensayos A–D v2 PASS en Crostini ARM64. Las medianas D/B son 1,98× para lanzamiento, 1,03× para contexto, 6,98× para página y 8,26× para setContent/textContent (etiquetado «about»). D-2 registró 61.065 ms para crear página. Es evidencia de degradación combinada; no demuestra causalidad exclusiva de PGlite.

Se recibieron y validaron los doce JSON originales de `ADPHOR_AB_RESULTADOS_V2.tar.gz`, SHA-256 `714668d76b5b62d667f7e2936685b508260c2480d5cf0cc45fc27e0e3d69edf3`. Se verificaron esquema de etapas esperado por escenario, `ok=true`, todos los estados PASS, metadatos ARM64/Node/cuatro CPU, tiempos no negativos y orden temporal monotónico. Las medianas recalculadas coinciden con el mensaje del propietario. `qa/visits-ab-v2-validated-summary.json` conserva hashes individuales y resultados derivados. Los JSON originales se preservan sin alteración en el paquete de evidencias, separados del código.
La versión v2 del instrumento local devuelve correctamente el resultado de stage(), valida que se obtuvo un Browser y usa las mismas llamadas Chromium entre A, B y D. No equivale al E2E funcional: PGlite ejecuta SELECT 1 y Vite solicita la raíz; no guarda visitas ni precalienta el módulo real. No se conoce el hash del instrumento realmente ejecutado en Crostini. Sus cierres secuenciales pueden omitir cierres posteriores si uno falla; execSync(ps) no tiene deadline; no mide retraso del event loop ni utilización CPU por intervalo. Esas limitaciones no invalidan automáticamente las duraciones recibidas, pero restringen la inferencia causal.

Los timestamps de archivos muestran ensayos agrupados A→B→C→D. La transcripción muestra carga creciente (hasta 6,07 con cuatro CPU) y PGlite residente de aproximadamente 722–775 MiB RSS antes del navegador. Load average no es utilización CPU; sumar RSS puede contar memoria compartida varias veces. Sin mediciones de presión/CPU no se puede afirmar OOM, saturación causal exclusiva ni fuga acumulativa.

## Cambios

Rama `qa/visits-split-services-experiment`, derivada de `9ed81c6`, preserva `068196b` y la corrección H3 `4e7015f`. No se reemplazó el ejecutor residente ni la persistencia existente.

- `qa/diagnostic-resources.js` conserva la propiedad de adquisiciones pendientes y cierre único de recursos tardíos. Se agregó regresión con proceso real tardío y comprobación ESRCH después del cierre, además de browser/context/page simulados después de deadline.
- `qa/diagnostic-service.js` registra inmediatamente cada proceso hijo antes de esperar readiness. RPC con IDs, métodos limitados, deadlines y rechazo de mensajes tardíos; cierre SIGTERM con límite de cinco segundos y SIGKILL de respaldo informado como error. No se comunica con servicios corporativos.
- `qa/diagnostic-service-worker.js`: SQL PGlite auténtico en proceso hijo y Vite local en otro proceso. Permanecen en el grupo del supervisor independiente; no se usa detach. Escucha desconexión y SIGTERM, serializa consultas y cierra recursos. SQL vive solo en memoria durante cada ensayo.
- `qa/diagnostic-sql-bootstrap.js`: único bootstrap sintético compartido por ambas variantes; mismas políticas, esquema y sesión de prueba que antes.
- `qa/diagnose-visits-browser.js`: opt-in `--split-sql` o `--split-services`, métricas por árbol, CPU acumulada y event loop del padre y servicios. Mismo formulario, campos, teclado, confirmación y lectura SQL; reintento idempotente después de guardar, una sola fila y búsqueda del mismo ID tras recarga.
- `qa/run-visits-differential.js --bd`: tres rondas intercaladas, cuatro variantes (12 ejecuciones): B; D residente; D SQL hijo; D SQL+Vite hijos. Cada proceso se inicia de nuevo. Guarda JSON por ejecución, secuencia, fecha, errores, snapshots y PID residuales conocidos. No elimina outliers ni trata timeouts como medidas completas.

No se cambiaron límites de Chromium ni del formulario, lógica de negocio, controles corporativos, UI de Visitas, Agenda, PQRS o Miss ADPHOR.

## Hipótesis controladas

1. D residente vs D SQL hijo: comprobar si separar event loop SQL reduce latencia aun conservando PGlite residente en RAM. La variante añade un proceso/IPC y no elimina presión global de memoria.
2. D SQL hijo vs D servicios hijos: comprobar la influencia adicional de separar Vite.
3. B vs ambos D: control sin SQL. Comparar solo etapas comunes de arranque/navegador, no duración total: D incluye guardado y recarga adicionales.

Mantener Chromium/Playwright/Node y configuración de energía iguales, cerrar otras cargas voluntariamente, no ejecutar los ensayos en paralelo. Las tres rondas invierten posiciones sin agrupar todos los D al final. Comparar snapshots iniciales y finales y CPU/cgroup; no suprimir una ejecución desfavorable. Si hay deriva de carga, timeouts censurados o residuos, conservar incertidumbre. Los límites existentes pueden censurar D; no elevarlos silenciosamente para producir medianas de aprobados. No se declara mejora experimental sin datos Crostini.

## Evidencia Work

- JavaScript completo: 277/277 PASS, cero FAIL.
- Build Vite: PASS.
- Pruebas H3/servicios dirigidas: PASS; proceso tardío terminado y PID no existente, cierre idempotente, rechazo de operaciones tras cierre.
- Servicio hijo PGlite: PASS. Guardado real, reintentos idénticos, una fila, conflicto de contenido, rechazo entre copropiedades, lectura posterior y cierre.
- Servicio hijo Vite: PASS, transformación real HTTP 200 del módulo UI y cierre.
- Ejecutar escenario C con servicios separados: PASS; inicialización, esquema, consulta y cierre.
- Escenario D separado: SQL y Vite/precalentamiento PASS; Chromium BLOCKED por socket() Operation not permitted. Cierre PASS. No se ejecutó UI ni recarga. No representa un defecto demostrado de Crostini.
- Python, PostgreSQL nativo y servicios corporativos: SKIPPED en este incremento porque no cambiaron; se conserva evidencia histórica, no se recertifica Supabase.

## Matriz de aceptación

| Control | Estado | Alcance |
|---|---|---|
| Doce A–D v2 | PASS | Archivos originales recibidos y validados; ejecución en Crostini del propietario |
| Causalidad exclusiva PGlite | BLOCKED | Falta control intercalado y métricas CPU/event loop |
| H3 recursos tardíos | PASS | Regresión automatizada, proceso real y recursos de navegador simulados |
| IPC servicios separados | PASS | Métodos/IDs/cierre, SQL auténtico |
| Guardado/idempotencia/aislamiento SQL | PASS | Sesión sintética aislada, no Supabase real |
| Vite separado | PASS | Loopback, módulo real |
| Mejora de latencias Crostini | BLOCKED | Comparación preparada, no ejecutada en Crostini |
| Formulario con SQL: consulta tras recarga | BLOCKED | Chromium no inicia en Work |
| Home/Reuniones/PQRS/Agenda/Miss | SKIPPED visual | Conservados, suite automática PASS; no certificación corporativa nueva |
| Publicación y servicios compartidos | SKIPPED | No autorizados, sin cambios |

## Crostini: un ejecutor

Descargar el bundle, verificar SHA-256 con el archivo acompañante, clonar en directorio nuevo (no sobrescribir checkouts), seleccionar `qa/visits-split-services-experiment` y ejecutar `npm ci` si no existen dependencias en ese checkout. Chromium se toma de Playwright; no ejecutar `command -v chromium` ni instalar paquetes nuevos innecesarios.

Desde la raíz de ese checkout:

```bash
env -u CHROMIUM_PATH node qa/run-visits-differential.js --bd
```

Este único comando produce doce ensayos independientes, incluido el recorrido funcional completo en cada D. Guarda los resultados en `test-results/visits-differential-...`. Un código distinto de cero exige revisar el JSON; no descarta las demás ejecuciones. El control exigido es el registro PASS de `Formulario con SQL: consulta tras recarga`, con guardado SQL confirmado y una fila. No equivale a MFA/AAL2 corporativo real.

Compartir la carpeta nueva de resultados comprimida, sin credenciales. Los doce JSON v2 anteriores ya fueron recibidos; no es necesario enviarlos otra vez. No atribuir éxito al mero fin del proceso. Mantener el ejecutor residente hasta demostrar una mejora reproducible y cierre seguro de la variante separada.

## Reversión

Todo es local y opt-in. Ejecutar sin flags conserva la variante residente. Volver a `9ed81c6` en otro worktree recupera la situación previa, incluida H3; no resetear ni borrar checkouts previos. No hubo push, merge, despliegue ni escrituras corporativas.
