# ADPHOR — integración QA de evaluación de reuniones

Fecha de ejecución: 2026-10-30 UTC. Estado propuesto: **Listo para auditoría de código; integración funcional parcial**. No constituye certificación ni autorización para producción.

## Cambio y procedencia

Rama local `qa/unified-operations-20261029`. Base anterior `569cf4584ae147b41b16c72e3501d26a4f6b62ab` y recuperación del aislamiento del build `07561c7c4ec19cd9b5e4593628b4e6bc622c34b4`.

Se reutilizó la clasificación por reglas del PR #12 y se incorporó a FastAPI y al menú de la interfaz existente, junto al módulo PQRS QA. No se recuperó el mecanismo de autorización de agenda basado en booleanos del cliente. La clasificación es por palabras clave, no un modelo ML/DL/PLN entrenado.

Archivos principales: `backend/local_api.py`, `backend/src/adphor_ai/meeting_{api,priority,triage}.py`, `backend/tests/test_meeting_assessment.py`, `src/js/{app,ui-meeting-assessment}.js`, `src/js/services/supabase.js`.

`POST /meetings/assess` usa la dependencia existente de identidad verificada por Supabase y consulta la membresía en cada petición. Permite admin/coordinator; valida asunto, longitud, copropiedad y campos permitidos. Está deshabilitado por defecto y bloquea el proyecto productivo. El resultado declara `engine_kind=rules`, `persisted=false`, `booking_authorized=false`, `notifications_sent=false` y revisión administrativa pendiente.

La pantalla usa el menú existente y sólo se habilita con el gate de staging exacto de Porto. Envía campos explícitos; los campos del formulario no pueden sustituir la copropiedad seleccionada. Los resultados se muestran con `textContent`.

Las intenciones de aviso sólo son estructuras en memoria. Exigen consentimiento booleano verdadero y rol/copropiedad correctos, eliminan duplicados por destinatario/canal y permanecen pendientes de revisión. No existe proveedor de envío ni outbox conectada en este cambio.

## Evidencia reproducible

- `PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v`: **94 pruebas PASS**, incluidas 13 nuevas de reuniones. Evidencia `qa/porto/evidence/unified/python-tests.log`.
- `npm test`: **39 pruebas PASS**; incluye una prueba PostgreSQL local con PGlite. No es Supabase hospedado ni JWT real.
- `npm run build`: PASS.
- `node qa/checks/build-isolation.mjs`: **3 PASS** (build normal, inclusión explícita y retirada de artefactos anteriores).
- `git diff --check`: PASS.
- La primera ejecución Python sin PYTHONPATH produjo dos errores de importación; corregida la invocación, toda la suite pasó. No se ocultó un fallo funcional.
- Advertencia pendiente: Starlette depreca el uso de httpx en TestClient. No se actualizaron dependencias sin evaluación.

Las pruebas HTTP inyectan identidad y membresías simuladas. Cubren falta de sesión, acceso cruzado, revocación, rol insuficiente, bloqueo de producción, rechazo de aprobación enviada por cliente, entradas inválidas y ausencia de acciones automáticas. **No demuestran autenticación real, RLS hospedada ni E2E de navegador.** No se ejecutaron GitHub Actions para este commit local.

## Configuración QA (no aplicada a infraestructura)

Backend: `ADPHOR_DEPLOYMENT=staging`, `ADPHOR_CONSULTATION_MODE=synthetic`, `ADPHOR_STAGING_PROJECT_REF` igual al proyecto QA independiente, `SUPABASE_URL` correspondiente y `FRONTEND_ORIGIN` de QA HTTPS. Usa variables existentes de claves públicas y JWT del usuario; este endpoint no utiliza service_role.

Frontend: `VITE_PORTO_QA_ENABLED=true`, `VITE_PORTO_STAGING_REF` igual a la referencia QA de 20 letras y `VITE_AGENTS_API_URL` del backend QA. Estas variables no sustituyen Cloudflare Access ni las autorizaciones backend/SQL.

## Riesgos y siguientes pasos

P1: verificar Access en URLs de ramas y hashes antes de publicar ramas que disparen previews; disponer de staging y usuarios QA-A/QA-B con JWT reales; probar persistencia de PQRS y reuniones desde navegador; validar migraciones y membresías actuales. No se reauditaron Cloudflare ni Supabase en esta iteración.

P1: conectar calendario transaccional, bloqueo de 24 horas, conflictos y excepciones gerenciales con historial. Esta pantalla sólo evalúa prioridad: **no agenda ni persiste reuniones**. El módulo no debe presentarse al cliente como completo.

P2: conectar inferencia ML/DL/PLN validada y fuentes aprobadas; ahora sólo se reutilizan reglas. Todas las pruebas integrales IA-01 a IA-20 permanecen NOT RUN en esta iteración.

No se cambió producción, no se ejecutaron migraciones, no se importaron datos reales, no se modificaron originales Apps Script y no se publicaron previews. No se comprobó disponibilidad de producción en esta iteración. Reversión: revertir este commit en QA; no hay cambios de esquema ni datos que revertir.

Evaluación técnica sugerida del alcance implementado: **parcial, apto para revisión de código**. La nota definitiva y aprobación corresponden al auditor independiente.
