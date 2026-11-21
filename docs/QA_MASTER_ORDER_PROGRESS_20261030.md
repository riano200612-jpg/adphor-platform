# ADPHOR — avance de la orden maestra

Fecha: 2026-10-30 UTC. Rama QA local: `qa/unified-operations-20261029`. Base de esta iteración: `aaad130a5acbc2e60bd536f7766935373a10cdc8`. **Entrega parcial para revisión; no certificada para producción.**

## Trabajo realizado

Se leyó completamente la orden adjunta. Se inventariaron los 32 originales privados: nombres de funciones, dependencias, tamaños y SHA-256 en `ORIGINAL_MODULE_INVENTORY_20261030.json`. El archivo no incluye sus contenidos, PIN ni configuraciones. El inventario estático no implica auditoría semántica completa de cada función. Los originales permanecieron intactos.

Se implementó búsqueda de copropiedades por nombre, insensible a acentos/mayúsculas, conservando la selección durante navegación y guardándola por usuario en sessionStorage. La selección guardada sólo se acepta si continúa en el catálogo devuelto por el repositorio; una selección revocada se sustituye por una disponible. No se incorporó lista fija de propiedades reales. El adaptador cloud sigue leyendo `projects` mediante la sesión y RLS. Esto requiere validación hospedada posterior; el filtrado frontend no sustituye autorización SQL.

Al cambiar de propiedad se limpian filtros y resultados mensuales; el módulo activo vuelve a renderizarse con el nuevo identificador. Las opciones se construyen con textContent, no HTML procedente de datos. Se mantiene el shell existente. La equivalencia visual exacta con todas las pantallas originales y el acceso de delegados sigue pendiente.

## Auditoría puntual de originales

| Hallazgo | Evidencia y alcance | Tratamiento |
|---|---|---|
| OTP vacío aceptado con timestamp vacío | Reproducción aislada de `validarOTP` en `reuniones/MFA.js`, con SpreadsheetApp simulado | No migrar esta implementación; no se intentó acceso real ni se afirma bypass completo de autenticación |
| OTP con Math.random y almacenamiento directo en Sheets | Lectura de `generarOTP`, `guardarOTP` | Sustituir en destino por autenticación administrada y MFA verificada, conservando la capacidad funcional |
| Depuración con contactos | Lectura de `obtenerCorreoUsuario` y `enviarOTPCorreo` | Minimizar datos y eliminar exposición en destino |
| PIN literal y presentación de PIN/hash | Hallazgo previo en `hashearPin` de Utilidades | Mantener original privado; utilidad no reutilizable en destino |
| Calendario, correo y PQRS duplicados | Inventario de ambos proyectos | Reutilizar reglas, centralizar identidad y transacciones; no copiar envíos ni cierres automáticos |

La reproducción usa el original por ruta local y una fila sintética. Comando: `node qa/audit/check-original-otp.mjs /ruta/privada/reuniones/MFA.js`. No publica el código original. Se debe revisar la cadena completa de login y sus controles antes de calificar el impacto explotable.

## Diferencias de arquitectura

| Original | Destino existente o requerido | Estado |
|---|---|---|
| Apps Script + google.script.run | JavaScript/Vite + FastAPI | Parcial: evaluación de reuniones y PQRS QA |
| Sheets / IDs de delegado | PostgreSQL, projects.id text, membresías y mapeos aprobados | Conciliación e importación completa pendientes |
| PIN/OTP en Sheets | Supabase Auth + MFA administrada | MFA destino pendiente; no se alteraron cuentas |
| Calendar/Meet directos | Transacción de agenda y adaptador externo autorizado | Pendiente |
| MailApp/GmailApp | Outbox revisada, consentimiento, sandbox | Sólo intenciones de aviso; proveedor no integrado |
| Archivos Drive y formularios multimedia | Storage privado, validación servidor, referencias autorizadas | Pendiente de integración completa |
| Clasificación IA y acciones históricas | ML/DL/PLN identificados y aprobación humana | Reglas disponibles; inferencia integral pendiente |

## Evidencias de pruebas

- `npm test`: **43 PASS**. Cuatro pruebas nuevas de catálogo de 40 propiedades, búsqueda, selección revocada, preferencias por usuario y almacenamiento indisponible.
- `node qa/porto/test-persistence.mjs`: **30 comprobaciones SQL PASS**. Base temporal PGlite, migraciones QA existentes, 40 propiedades ficticias y 400 PQRS; lectura total por administradora con múltiples membresías, denegación a viewer, 10 registros visibles a coordinadora de una sola propiedad, denegación cruzada y recuperación de 400 filas tras cerrar/reabrir almacenamiento.
- Medición local de la sección de escala: **251 ms**, incluye inserción, consultas y reapertura. Es una comprobación básica local; no mide concurrencia productiva, red, límites de Supabase ni capacidad sostenible.
- `npm run build`: PASS. `git diff --check`: PASS.
- Reproducción del defecto OTP: confirmado en fixture sintético. No es una prueba de seguridad aprobada del original.
- Prueba Playwright del selector de 40 propiedades preparada: **NOT RUN**. Chromium no estaba disponible y `npx playwright install chromium` falló por descarga inválida/truncada. Las pruebas E2E existentes tampoco se ejecutaron en esta iteración.
- La primera ampliación SQL esperaba lectura para viewer, pero la política existente excluye ese rol. Se corrigió la expectativa del test, conservando la política: viewer=0; coordinadora de una propiedad=10. No se relajaron permisos.
- La suite Python de 94 pruebas aprobada corresponde al commit base anterior; no se repitió porque esta iteración no cambia Python.

Evidencias: `qa/porto/evidence/unified/{selector-tests,scale-sql,selector-build,original-otp-audit}.log`. Identidades SQL simuladas, **no JWT reales de Supabase**. No se disparó GitHub Actions para estos cambios locales.

## Matriz de alcance

| Requisito | Estado | Evidencia / pendiente |
|---|---|---|
| Inventario 32 archivos | Probado como inventario estático | JSON con hashes; auditoría semántica completa pendiente |
| Interfaz institucional | Parcial | Shell conservado; comparación visual original pendiente |
| Selector dinámico y búsqueda | Implementado, pruebas unitarias aprobadas | Playwright y RLS hospedada pendientes |
| Reuniones | Parcial | Evaluación por reglas conectada; calendario/persistencia integral pendientes |
| PQRS | Parcial | Lifecycle SQL y UI previos; 400 registros QA persistidos; importación y multimedia pendientes |
| Multimedia/audio/videos | Pendiente | No se certifica inventario completo de archivos de Drive |
| Comunicaciones | Pendiente | Ningún mensaje real enviado |
| BD unificada | Parcial | Migraciones QA; no alteración de base cliente |
| ETL/documentos | Pendiente | No se habilitó acceso de agentes a documentos reales |
| ML/DL/PLN integral | Pendiente | No confundir reglas con inferencia real |
| 40 propiedades / 400 registros | Probado localmente en SQL | Carga concurrente de producción pendiente |
| JWT/RLS hospedada | Bloqueado en esta iteración | Requiere staging y usuarios QA verificables |
| Staging protegido/URL cliente | Pendiente de verificación | Sin URL nueva ni despliegue |
| IA-01 a IA-20 | NOT RUN | No reemplazadas por unitarias |

## Seguridad, reversión y próximos pasos

No se modificaron main, Apps Script, Sheets, cuentas, datos reales, RLS productiva ni Cloudflare Access. No hubo push de rama ni despliegue. No se comprobó salud de producción en esta iteración. Reversión del código: revertir el commit QA; la prueba SQL sólo crea una base temporal local y no requiere rollback productivo.

P1: completar revisión semántica de los originales; verificar protección de previews y staging; disponer de navegador; ejecutar E2E y JWT reales QA-A/QA-B; conectar persistencia transaccional de calendario y excepciones. P2: evidencias privadas, proveedores sandbox, ingesta documental aprobada e inferencia real evaluada.

Calificación sugerida del alcance de esta iteración: **implementación parcial con evidencia local, apta para auditoría de código; no apta todavía para evaluación integral del cliente**. Evaluación definitiva a cargo del auditor independiente.
