# ADPHOR QA — Reconciliación de implementaciones omitidas

## 1. Base y límite operativo

HEAD remoto inicial consultado: `c6286a3c4e5a5d3cb3a08572964881b81a974f6f` en `qa/integral-claude-reviewed-20261111`. El árbol local `f7dcf88` coincide con esa instantánea. La QA anterior permanece en `590508630f196b45e4dce92b341e7605f3ebc020` y producción de referencia en `1cfc33bd76f3163635ac60db1432d230a3a2098b`.

Sin despliegues, Retry, Promote, cambios de Cloudflare/variables, migraciones, escrituras corporativas o cambios de cuentas/MFA. No se repitieron intentos de login, solicitudes anónimas ni forenses Chromium/Crostini. No se duplicó trabajo de Claude.

## 2. Nueva evidencia que corrige el estado del control de ramas

El Gauntlet inicial decía que no se había confirmado Guardar. Existe evidencia posterior: informe maestro de continuidad actualizado y captura del propietario de las 14:16 Colombia, con ambas ramas listadas y confirmación expresa del guardado. Se acepta como **PASS documental del propietario**, no como lectura independiente de la API.

| Configuración Pages | Estado reconciliado |
|---|---|
| Cuenta/proyecto | Cuenta ADPHOR indicada por el propietario; Pages adphor-platform |
| Git | riano200612-jpg/adphor-platform conectado, según propietario |
| Production | codex/flujo-mantenimiento; sin cambios por Work |
| Preview | Ramas personalizadas |
| Inclusiones guardadas | qa/pqrs-carrusel-integracion-20261104 y qa/integral-claude-reviewed-20261111 |
| Exclusiones | Sin cambios reportados; sin lectura API independiente |
| Vigilancia de archivos | Include `*`; no sustituye control de ramas |
| Build/output | npm run build -- --base=/ → dist; sistema v3, según propietario |

**No pedir nuevamente añadir o guardar la candidata.** Guardado no demuestra que exista un deployment exitoso ni que los registros skipped anteriores cambien de estado.

## 3. Dos bloqueos distintos

### A. Selección del proveedor: skipped histórico

Según la configuración anterior documentada, la candidata no estaba incluida en Preview. Cloudflare procesa exclusiones/inclusiones y omite ramas no seleccionadas. Es la causa probable fuertemente sustentada de los registros c6286a3, 6ae113f, 96e106d, 0b5c7c8 y 9d45f0b sin artefacto. Para el ID `91008b73-d10d-42f5-a7dc-ab90455898a5`, falta leer el skip_reason o detalle del proveedor: no se inventa una causa específica registrada.

No hay evidencia de que esos commits llevaran un prefijo intencional de omisión. Las rutas de vigilancia `*` no autorizaban una rama excluida. Un job GitHub Actions omitido no es el mismo registro que un deployment omitido por la integración nativa Pages.

### B. Build del repositorio: defecto reproducido y corregido

En c6286a3, `consolidatedQa` aceptaba solo la QA anterior. Con la candidata y flags QA válidos, una invocación local controlada del config real falló con exit 1 y **QA_DEPLOY_BLOCKED**. Además, `publicQaBuildConfig` rechazaba esa rama. Este defecto sucedería después de superar el filtro del proveedor; no explica por sí mismo un skipped que nunca inició build.

Corrección mínima:

- Vite acepta exclusivamente las dos ramas QA indicadas, bajo ADPHOR_PROTECTED_STAGING_QA=true y ADPHOR_QA_ACCESS_VERIFIED=true.
- Se siguen exigiendo Supabase QA exacto, clave presente, VITE_REQUIRE_MFA=true, flags/ref QA válidos y ausencia de modo readonly/demo incompatible.
- La candidata rechaza ADPHOR_QA_ACCESS_BOOTSTRAP=true. No se modifica el comportamiento histórico de bootstrap de la rama anterior.
- El manifiesto acepta y registra la rama candidata, sin revelar claves.
- No se modifican los destinos de qa/integration-target.json ni los workflows activos, que siguen refiriéndose a la rama QA anterior. No se utiliza ese workflow para publicar la candidata.

## 4. Pruebas y build

| Comprobación | Resultado |
|---|---|
| Reproducción previa del defecto | PASS como demostración de fallo: candidata → exit 1, QA_DEPLOY_BLOCKED |
| Tests dirigidos Auth/build/ramas | 17/17 PASS |
| JavaScript completo | 327/327 PASS, 0 FAIL |
| Build Vite ordinario | PASS |
| Dos builds controlados de la rama candidata | PASS: 13 archivos idénticos |
| Negativas de configuración | Rechazadas: falta de staging/Access/MFA/clave, URL/ref producción, readonly, bootstrap candidato y rama no autorizada |
| Datos reales, OAuth, AAL2 y navegador | BLOCKED; las pruebas anteriores son locales/sintéticas |
| CI remoto del respaldo | No se afirma ejecutado; los push de esta rama no coinciden con los disparadores versionados |

Los builds reproducibles usaron la fuente local `37eea0f71707441e50f0821a23880549dbbc9151` y configuración sintética aislada, sin conexión corporativa. Manifiesto SHA-256 `a775e42646f23b760a91976a2a7f2647317617a251858455dc8206e6f34d9982`. Las banderas de esos procesos de prueba no cambian ninguna variable remota ni certifican Access.

## 5. Respaldo seguro sin publicar

Ahora un push normal a la candidata puede activar Pages. Para respaldar código en la misma rama sin desplegar se utiliza el prefijo oficial **[CF-Pages-Skip]**, al comienzo del mensaje del commit. La omisión de ese respaldo es intencional y no un nuevo defecto de build. No se cambiaron los filtros para conseguirlo ni se abrió una PR que dispare otra ruta.

La estrategia no autoriza un deploy. La publicación futura requerirá un commit de publicación sin ese prefijo, mismo árbol revisado de código, SHA exacto preparado y aprobado ANTES de actualizar la referencia. No asumir que Retry de un registro skipped va a resolver el problema o que cambiar su mensaje conserva el mismo SHA. No ejecutar simultáneamente integración nativa y workflow/direct upload.

## 6. Access — evidencia preservada

| Control | Evidencia conocida | Estado |
|---|---|---|
| Aplicación | adphor-platform - Cloudflare Pages, autohospedada | PASS documental |
| App ID | 404fe4c0-6373-480b-9117-eba14c9c26b7, histórico | BLOCKED para vigencia actual/AUD |
| Wildcard | *.adphor-platform.pages.dev, según capturas del propietario | PASS documental |
| Raíz del proyecto | No demostrada en la misma aplicación | BLOCKED; no se visitó producción para comprobarla |
| Allow | Allow Members - Cloudflare Pages; e599bbc9-5cc7-46a3-8c10-da62fd8ba65f, acción Allow, orden 1 | PASS documental |
| Include Emails | Propietario y dos titulares corporativos | PASS documental; no se publican datos personales adicionales |
| Evaluador | Un usuario aprobado, según evidencia previa y actual del propietario | PASS documental; no demuestra identidad concreta ni login real |
| MFA adicional Access | Desactivado según propietario | Distinto de TOTP/AAL2 Supabase; no modificado |
| Sesión | Duración de la política igual a la aplicación; duración exacta pendiente | Documentado parcialmente |
| Proveedor vigente / bypass / cobertura de rutas | Sin lectura independiente completa | BLOCKED |
| Allow/Deny efectivos en URL exacta | Sin sesión legítima de prueba de esta fase | BLOCKED |

No se vuelve a pedir la configuración o evaluador ya documentados. No se repite el login automatizado fallido ni se carga saldo a TinyFish. El Team Domain compartido no se considera erróneo por su nombre. Access, MFA Supabase y RLS son controles diferentes.

## 7. Preview frente a Production

| Variable/control | Preview, según propietario | Production, referencia protegida |
|---|---|---|
| Supabase | qfctnnnnltghepwujpdm | oqizvirqjwbbhyyjpthq; no se accedió ni modificó |
| Clave frontend | Presente; valor no leído/reproducido | Presencia reportada, valor no leído |
| ADPHOR_PROTECTED_STAGING_QA | true | No copiar flags QA a producción |
| ADPHOR_QA_ACCESS_BOOTSTRAP | false | Sin cambios |
| ADPHOR_QA_ACCESS_VERIFIED | true | Es flag, no prueba de seguridad |
| VITE_PORTO_QA_ENABLED / STAGING_REF | true / referencia QA | Sin cambios |
| VITE_REQUIRE_MFA | true | Sin cambios |
| VITE_VISITS_SQL_ENABLED | No visible en ocho filas; apagado por defecto en código | Sin cambios |

Valores efectivos del artefacto servido, origen backend y OAuth siguen sin certificar. No se deduce ausencia global de una variable solo porque no aparezca en una captura parcial. En Work no hay token Cloudflare disponible para una lectura API independiente. No se extraen secretos de GitHub Actions para suplirlo.

## 8. Artefactos, URL y recuperación

| Elemento | Estado |
|---|---|
| Código GitHub inicial | c6286a3 confirmado; el respaldo final se identifica en el commit/mensaje de cierre |
| Último deployment omitido aportado | 91008b73-d10d-42f5-a7dc-ab90455898a5; sin artefacto utilizable |
| Último Preview exitoso posterior al guardado | BLOCKED: no hay listado posterior disponible |
| Deployment previo seguro | BLOCKED: un skipped no sirve de recuperación |
| SHA asociado al deployment | BLOCKED |
| SHA servido / manifiesto en navegador | BLOCKED |

Los aliases de Pages pertenecen a ramas. Un Preview de la candidata no actualiza por sí solo el alias de qa/pqrs-carrusel-integracion-20261104. No se inventó un hostname de deployment ni se cambió dominio o alias. La URL final debe obtenerse de los aliases devueltos por Pages y certificarse bajo Access.

**No usar Rollback to this deployment ni el rollback API de Pages para QA:** la documentación lo define como una operación de producción; los previews no son destinos de ese rollback. La recuperación QA propuesta conserva la URL atómica de un Preview previamente certificado y la QA anterior sin modificar. Si hay que restaurar el alias candidato, se necesita un commit inverso/republicación Preview explícitamente autorizada, con fuente y artefacto conocidos. No es instantáneo ni está ensayado. En el primer deployment de la candidata puede no existir un predecesor válido de esa rama.

La disponibilidad de Calendar añade otra comprobación: el backend existente restringe frontend_origin al alias QA anterior. No se ampliaron CORS/orígenes a un hostname nuevo no verificado. No presentar ese backend ni el calendario como operativos en el nuevo Preview hasta probar la URL real y su contrato.

## 9. Plan operativo sin ejecutar

1. Conservar como guardada la inclusión documentada de ambas ramas; no Guardar otra vez.
2. Obtener solo la novedad pendiente del propietario o de conexión oficial de lectura: último Preview posterior al guardado con ID, estado, rama, SHA, fecha y URL, y último Preview exitoso utilizable. No Retry/Deploy/Promote.
3. Revisar Access vigente para la URL elegida: App ID/AUD, wildcard, proveedor, regla Allow y rutas; realizar Allow/Deny y AAL2 cuando exista sesión legítima. No solicitar nuevas cuentas ni factores.
4. Mantener Visitas apagado. Validar variables no secretas contra el manifiesto; no copiar claves ni configuración de producción.
5. Elegir una sola ruta: integración nativa Pages para la candidata. La corrección de código está respaldada sin deployment; preparar después el commit de publicación no-skip y su SHA exacto para aprobación separada.
6. Antes de publicar, conservar Preview anterior verificado y definir recuperación sin operaciones productivas. No aprobar por tener flags o tests locales.
7. Solo con autorización específica, actualizar la referencia de publicación y observar el deployment. Registrar ID, SHA, URL y manifiesto servido, luego Access → Supabase Auth → AAL2 → copropiedad → módulos de lectura. Las escrituras corporativas siguen fuera de esta fase.

## 10. Conservación y fuentes

Sin modificaciones a producción, Cloudflare, Access, variables, Supabase, Google Calendar, directorio, fotografías o módulos de Claude. La revisión de código puede revertirse con un commit inverso revisado; nada de force-push. La futura publicación/reversión Preview requiere aprobación separada.

Fuentes: informe maestro de continuidad actualizado, captura del propietario tras Guardar, HEADs GitHub, código y pruebas locales. Documentación oficial consultada:

- https://developers.cloudflare.com/pages/configuration/branch-build-controls/
- https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- https://developers.cloudflare.com/pages/configuration/preview-deployments/
- https://developers.cloudflare.com/pages/configuration/rollbacks/
