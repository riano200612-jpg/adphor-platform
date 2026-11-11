# ADPHOR QA — revisión del paquete v2 y criterio E2E

## Fuentes examinadas

La rama de trabajo parte de 4e7015ffc5ef9807a369b11c713b8b213569ec47 y conserva la base auditada 068196bf65aa878c9ba973c957a461131bcd56e1. El paquete privado files.zip recibido tiene SHA-256 bbaf758d53d5d382874be5d1f23f4d203e4534f9454759f565c3dccd31b0e8e0. Se inspeccionaron INFORME_RESULTADOS_AB_CROSTINI.md y ADPHOR_CROSTINI_AB_v2.zip, incluidos ab-probe.mjs y README.md. Las fuentes corporativas y los artefactos de auditoría originales se conservan fuera de la aplicación.

## Resultado del auditor externo

El informe declara inválidos los ensayos completos A, B y D de v1 porque stage devolvía metadatos en lugar del recurso. C fue válido. Las medianas de lanzamiento válidas fueron 6634 ms en A, 34936 ms en B y 17538 ms en D. B no había precalentado Vite correctamente y la dispersión fue alta. La creación de PGlite tuvo medianas de 44225 ms en C y 29651 ms en D. El paquete no contiene resultados JSON de una ejecución v2. No permite atribuir causalidad a la residencia WASM.

## Revisión de v2

- stage devuelve el valor de la acción y propaga excepciones. Se conserva esta semántica en el ejecutor propio y se cubre con una regresión.
- vite_first_request solicita la raíz resuelta por Vite y solo devuelve el status; no rechaza un HTTP fallido ni comprueba la transformación del módulo de Visitas. El ejecutor propio verifica HTTP y MIME del módulo, selector y CSS.
- finally realiza los cierres secuencialmente sin aislar excepciones. Un cierre rechazado puede impedir los siguientes y el JSON final. El propietario de recursos propio memoiza los cierres, continúa con los demás y observa adquisiciones tardías.
- v2 configura el lanzamiento a 120 segundos y carece de un watchdog externo para contexto, página, SQL y cierre. El ejecutor propio conserva límites por etapa y supervisor externo.
- La instrumentación v2 usa execSync sin límite. El ejecutor propio limita la instantánea ps y registra el fallo si no puede obtenerla.

La v2 es material de contraste. No se ejecutó para producir resultados ni se copió como sustituto del diagnóstico existente.

## Experimento controlado

El runner propio ejecuta cada escenario en un proceso nuevo. Usa los órdenes A-B-C-D, B-C-D-A y C-D-A-B, con tres repeticiones por escenario. Esto reduce el sesgo de orden, aunque tres repeticiones no prueban causalidad y siguen existiendo ruido y cachés del sistema.

A usa Chromium y un input HTML; B añade Vite y el formulario real sin SQL; C ejecuta PGlite, esquema y consulta; D mantiene SQL real del adaptador aislado, formulario, confirmación, consulta y recarga. Ninguno utiliza Supabase o calendarios corporativos. Las mismas opciones de Chromium se usan en A, B y D.

Se conserva el defecto H3 corregido mediante un propietario de adquisiciones con limpieza tardía. Las regresiones cubren navegador, contexto y página que terminan después del deadline, rechazo tardío y fallo de cierre. Una adquisición que nunca se resuelve requiere el watchdog externo. No se afirma cancelación nativa de Promise.race.

## Estado de la candidata y aceptación

| Requisito | Implementación conservada | Evidencia | Estado de aceptación real |
| --- | --- | --- | --- |
| Identidad corporativa | Diseño y módulo Visitas empresarial | Build local | BLOCKED, revisión visual |
| Login | Flujo de acceso de QA | Regresión local | BLOCKED, sesión real |
| MFA | Controles existentes | Pruebas sintéticas | BLOCKED, AAL2 real |
| Home | Reuniones históricas e indicadores | Datos históricos cotejados previamente | BLOCKED, navegador QA |
| Reuniones | Tipo, duración, carrusel y revisión | Contratos y pruebas locales | BLOCKED, disponibilidad corporativa y flujo real |
| Visitas | Formulario, filtros y adaptador SQL aislado | SQL e idempotencia aislados; concurrencia nativa reportada por propietario | BLOCKED, E2E hasta recarga |
| PQRS | Filtros, historial y Atención hoy | Regresión local | BLOCKED, persistencia y autorización en portal |
| Agenda | Servicio, registro SQL y UI de prueba | Reinicio nativo y reconciliación simulada reportados por propietario | BLOCKED, integración visual y permisos |
| Miss ADPHOR | Guía contextual y progresiva | Regresión local | BLOCKED, experiencia en navegador |
| Cloudflare | Sin cambios | Última observación HTTP con redirección a Access | BLOCKED, deployment y audiencia |

No se habilitaron escrituras corporativas. El formulario compartido de Visitas conserva su modo de preparación. Las extensiones de seguimiento, resultados e historial siguen pendientes de un contrato de datos aprobado. No se indexaron documentos ni se activó RAG.

## Procedimiento y reversión

Desde el checkout recuperado y con npm ci terminado:
    env -u CHROMIUM_PATH node qa/run-visits-differential.js

El directorio final de reporte contiene results.json y un JSON de stdout, stderr y eventos por ejecución. Se debe revisar el resultado D en Formulario con SQL: consulta tras recarga. Un escenario bloqueado no certifica el flujo.

La reversión local consiste en volver a 4e7015ffc5ef9807a369b11c713b8b213569ec47. Los bundles y ramas previos se mantienen. No se aplicó ninguna migración ni se alteró infraestructura compartida.

## Verificación de esta revisión en Work x64

- JavaScript: 273 PASS, 0 FAIL.
- Python: 136 PASS.
- Build Vite y git diff --check: PASS.
- A: BLOCKED en las tres repeticiones; tiempo total 1201, 1078 y 1143 ms.
- B: BLOCKED en las tres repeticiones; tiempo total 1744, 1986 y 1784 ms.
- C: PASS en las tres repeticiones; tiempo total 3223, 4284 y 3756 ms.
- D: BLOCKED en las tres repeticiones; tiempo total 4700, 4468 y 4714 ms.
- No se observaron PID residuales registrados. Los nueve bloqueos de navegador se deben a la restricción de socket de Work.
- No se ejecutó el flujo E2E en Crostini en esta revisión.
