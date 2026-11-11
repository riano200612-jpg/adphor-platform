# ADPHOR QA — Integración Claude y avance del cliente

Estado: respaldo de código, NO PUBLICADO, NO LIBERABLE. Fecha: 11 noviembre 2026, Colombia.

## Integración y alcance exacto

HEAD remoto leído: `e7d5040021216fde4310023b1af15bc328e6c400`. Fuente Claude: `2e0620ed2d8031f8d5b6fb4b8f5f8bc8da2bbd71`, hijo directo de esa base. Los 10 SHA256SUMS, restauración del bundle completo, fsck y git apply --check pasan. Se aplica el parche de cuatro archivos sobre la base, sin fusionar el bundle. ZIP recibido con nombre local files (2)(1).zip; SHA256: `01098a58df0d734147d54efaaea33471c30bede108197d8511ab4ba36d70eb37`.

Claude: alias demo opt-in, false por defecto, imposible con MFA obligatorio. QA fuerza MFA desde el backend conocido aun si VITE_REQUIRE_MFA=false. Se conserva el acceso AAL2 antes de profiles, MFA, RLS y Access. Work añade pruebas de opción omitida y backend QA con flag MFA falso.

Avance B: Miss ADPHOR calcula vencimientos por el día de Colombia, valida fechas reales y no vence hoy prematuramente entre 00:00 y 05:00 UTC. Su consulta de reuniones ordena registros confirmados por fecha, limita la copropiedad y rechaza respuestas/horarios inválidos. No altera registros ni concede permisos. Se reutilizan módulos existentes; no se crea otra plataforma.

Diff desde la base: `.env.example`, `src/js/services/cloud-authentication.js`, `src/js/services/supabase.js`, `tests/cloud-authentication.test.js`, `src/js/ui-miss-adphor-chat.js`, `tests/miss-adphor-chat.test.js`, `qa/integral-candidate-status.json` y este informe. Ninguna migración, política ni workflow modificado.

## Pruebas independientes ejecutadas

- npm ci --ignore-scripts: PASS, lockfile conservado.
- npm test de entrega Claude: 350/350 PASS. Suite final: 355/355 PASS, 0 omitidas.
- PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v: 136/136 PASS.
- node qa/porto/test-persistence.mjs: 30 comprobaciones SQL PASS; 40 propiedades/400 PQRS sintéticas, aisladas.
- node qa/checks/build-isolation.mjs: 3/3 PASS.
- npm run build -- --base=/: PASS. Build protegido de rama candidata: PASS con configuración sintética y escrituras sin activar. No es prueba de variables remotas ni artefacto servible.
- git diff --check: PASS.
- E2E aislados: 7 fallos de infraestructura, 0 PASS; ninguna página ni aserción funcional ejecutada. Descarga oficial Chromium devolvió ZIP inválido; alternativa /usr/bin/chromium abortó con socket EPERM. No se certifica navegador ni sesión corporativa.

## Matriz actualizada de requisitos

| Requisito | Código y pruebas disponibles | Pendiente real / siguiente paso |
|---|---|---|
| José: acceso MFA/AAL2 | Inscripción/verificación TOTP y bloqueo de profiles antes de AAL2; regresión alias QA PASS | Sesión legítima de José, perfil/membresías autorizadas y prueba AAL2. No se creó usuario, invitación ni factor |
| Home | Lectura de reuniones verificadas por copropiedad existente | Aceptación en QA autenticada y SHA servido; no repetir implementación |
| Calendar corporativo | Formulario, acompañamientos, duración, cinco alternativas, buffer y controles de concurrencia existentes | OAuth/servicio corporativo, jornada y disponibilidad de acompañantes certificados; reservas seguras no conectadas ni habilitadas |
| Visitas SQL | Contrato qa_visits/qa_create_visit, revisión, idempotencia y aislamiento probados localmente | Prueba piloto AAL2 compartida tras autorización de escritura; ciclo de ejecución/seguimiento requiere contrato aprobado |
| PQRS | Radicación, ciclo e historial con SQL aislado existente | Ciclo remoto autenticado y adjuntos privados con permisos, carga y recuperación verificados; no se afirma operación completa |
| Agenda transaccional | Consulta verificada y filtros existentes; adaptador transaccional aislado | Conectar reprogramación/cancelación, auditoría y reconciliación corporativa; no basta activar un flag |
| Directorio/carrusel/fotos | Implementación previa conservada, selector Sin acompañamiento requerido | Aceptación autenticada y autorización/visibilidad de fotografías; no se recopilaron nuevas imágenes |
| Miss ADPHOR | Guía, navegación, Atención hoy y reuniones verificadas existentes; fechas Colombia y orden/validación mejorados en esta entrega | Recorrido autenticado transversal; no modelo entrenado, no RAG general, no ejecución autónoma |

## Preparación de despliegue protegido

1. Respaldar exclusivamente en qa/integral-claude-reviewed-20261111 con prefijo [CF-Pages-Skip] y actualización condicionada al HEAD leído; sin force-push. Los workflows actuales no disparan push para esta rama.
2. No publicar en esta ejecución ni cambiar banderas. La configuración de Preview ya guardada por el propietario se conserva: no volver a pedir agregar ramas ni repetir esa auditoría.
3. Antes de una publicación autorizada: obtener hostname candidato y Deployment ID efectivos, comprobar Allow/Deny real de Access y variables efectivas, bootstrap=false, MFA=true, backend/ref QA correcto y alias demo=false. ACCESS_VERIFIED no debe activarse desde un build sintético.
4. El workflow automatizado y qa/integration-target.json aún apuntan a la rama QA anterior: no usarlos para publicar esta candidata. Reconciliar el destino exacto con evidencia administrativa antes de habilitar publicación; no se cambian ahora ni se supone un hostname.
5. Repetir E2E en un host de navegador compatible; luego verificar SHA servido y sesión AAL2. Ejecutar ensayos corporativos de escritura solo con autorización separada. Ningún PASS local sustituye estos pasos.

## Reversión

Conservar la base e7d5040. Al ser un único commit de respaldo, revertir únicamente el commit integrado mediante commit inverso revisado con [CF-Pages-Skip], sobre el HEAD QA vigente. Resolver conflictos conservando cambios posteriores; no reset, force-push ni mover producción. No hay SQL remoto ni datos que revertir. No utilizar rollback nativo de producción Pages. Si se publica más adelante, el plan de reversión deberá usar un Preview protegido previamente certificado y desactivar solo las escrituras expresamente autorizadas en ese momento.

No se modificó producción, no se ejecutaron migraciones ni escrituras remotas, no se cambiaron políticas Access/MFA/RLS, no se publicó ni se enviaron invitaciones.
