# ADPHOR QA — Corrección focalizada del responsable y limpieza E2E

Base: `qa/visits-split-services-experiment`, `8527378a9afa51104335e23a237cc54d2fde61cb`.
Rama local nueva: `qa/visits-focused-responsible-cleanup`.

## Evidencia Crostini recibida

Se revisó la transcripción completa `Texto pegado(20261111-010740).txt`, incluida su salida JSON de doce ejecuciones. No se repitieron las doce variantes.

- B: 2/3 PASS; primera repetición agotó el plazo del HTML mínimo.
- D residente: 0/3 PASS; dos timeouts de lanzamiento y un timeout de página.
- D SQL hijo: 0/3 PASS; timeout de lanzamiento, timeout de navegación y strict mode violation del selector de responsable en repetición 3.
- D servicios hijos: 0/3 PASS; dos timeouts de lanzamiento y un timeout de inicialización SQL.
- D servicios hijos 2: inicialización SQL venció a 55.034 ms; cierre falló a 7.137 ms con AggregateError genérico. No se conoce su causa interna exacta: la versión anterior no imprimía las causas anidadas. La interrupción forzada del hijo es una hipótesis, no una causa confirmada de esa ejecución.
- D residente 3: página venció a 22.909 ms y cierre a 30.176 ms. La dependencia secuencial del cierre es un defecto reproducible del código, pero el log anterior no prueba cuál de los recursos demoró el cierre en Crostini.
- Los doce resúmenes reportan `residualProcesses: []`. Son observaciones de PID conocidos, no una garantía de ausencia de cualquier proceso externo.

## Correcciones mínimas

### Selector del responsable

Sin cambiar el formulario ni la lógica empresarial, se usa `#visit select[name="responsible"]` para el campo del formulario y `#visit select[data-visit-responsible]` para el filtro. Son atributos ya existentes y ambos se comprueban como únicos. El ejecutor selecciona cada control por separado y comprueba que no modifica el otro. El E2E Playwright incorpora la misma regresión y comprueba el retorno del filtro a «Todos» conservando el responsable del formulario.

No se usa `.first()` ni se elimina el modo estricto. La causa funcional del error recibido era la coincidencia parcial de `getByLabel('Responsable')` con dos etiquetas.

### Limpieza

`qa/diagnostic-resources.js` inicia los cierres de todos los recursos conocidos antes de esperar sus resultados. Así una página bloqueada no impide pedir el cierre del navegador o de SQL/Vite. Se conserva el cierre único por recurso y el seguimiento de adquisiciones tardías. El padre mantiene el watchdog independiente y los límites anteriores.

La nueva regresión reproduce una página cuyo cierre solo termina al cerrar el navegador, junto con una adquisición tardía y un servicio independiente. Verifica que todos se liberan una vez. Antes del cambio, el cierre secuencial quedaría esperando la página sin llegar al navegador.

Los AggregateError muestran ahora `causes`. Los cierres de servicios registran kind, PID, duración, código, señal y si requirieron SIGKILL. Una salida no cero del hijo se convierte en fallo de limpieza: antes podía pasar inadvertida si no hubo SIGKILL. Un fixture hijo con salida 2 demuestra esta corrección y comprueba que el PID desaparece. El worker imprime también causas de errores internos de cierre.

No se elevaron límites. La limpieza forzada sigue siendo un fallo, no se transforma en PASS.

### Ensayo focalizado

`qa/run-visits-differential.js --focus=D-sql-child` ejecuta solo una repetición de esa variante. Conserva JSON, métricas, supervisión, guardado SQL auténtico, reintento idempotente, una fila, recarga y lectura del mismo request_id. Rechaza nombres de variante desconocidos. El modo comparativo previo permanece disponible, pero no es el siguiente paso.

## Verificación

| Control | Resultado | Evidencia y límite |
|---|---|---|
| Suite JavaScript | PASS | 279/279, cero fallos |
| Limpieza sin dependencia secuencial | PASS | Regresión unitaria con bloqueo reproducido |
| Recursos tardíos y cierre único | PASS | Regresiones preservadas |
| Fallo de cierre del hijo | PASS | Salida 2 detectada y PID inexistente |
| SQL hijo real | PASS | Guardado, reintentos, conflicto, aislamiento y consulta; sesión sintética |
| Vite | PASS | Inicio y módulo real precalentado |
| Build Vite | PASS | Compilación realizada |
| Sintaxis y git diff --check | PASS | Sin errores |
| Selección de ambos controles en navegador | BLOCKED en Work | Regresión añadida; Chromium no inicia por restricción socket() Operation not permitted |
| Formulario con SQL: consulta tras recarga | BLOCKED | Requiere evidencia nueva de Crostini |
| Ensayo focalizado Work | BLOCKED | Exactamente una ejecución D-sql-child; SQL/Vite y cierre PASS, PID residuales conocidos vacíos |
| Supabase/Calendar/Cloudflare/producción | SKIPPED | No modificados ni usados |

Las pruebas SQL aisladas no certifican una sesión AAL2 corporativa ni las políticas efectivas de Supabase. La interfaz, filtros de negocio, Miss ADPHOR, Agenda, PQRS y contratos SQL se conservaron.

## Crostini

Restaurar el bundle en un directorio nuevo siguiendo LEEME.txt. Con las dependencias instaladas y Chromium de Playwright ya disponible, ejecutar desde ese checkout:

```bash
env -u CHROMIUM_PATH node qa/run-visits-differential.js --focus=D-sql-child
```

No ejecutar `command -v chromium`. No repetir inicialmente `--bd`. Compartir el directorio nuevo `test-results/visits-differential-...` comprimido. Solo un PASS del registro `Formulario con SQL: consulta tras recarga`, junto al guardado SQL y una sola fila verificados, permite cerrar ese control. Si falla la limpieza, el nuevo JSON debe incluir la causa anidada o el recurso/proceso forzado; conservar esa evidencia.

## Reversión

Todos los cambios son locales y diagnósticos. El bundle conserva el historial completo. Para volver a la base, crear otro checkout en `8527378`; no borrar ni resetear los anteriores. No se realizó push, merge ni despliegue, ni se modificaron servicios compartidos.
