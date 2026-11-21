# ADPHOR — publicación QA y autenticación administrada

Fecha: 30 de octubre de 2026, America/Bogota. **Estado: parcial; revisión independiente requerida.**

## Publicación verificable

PR Draft: https://github.com/riano200612-jpg/adphor-platform/pull/14
Rama: `qa/unified-operations-20261029`.
Primer commit publicado: `a31864ced916b9c7bc9730f9664bcea284fba835`.
Árbol exacto: `50f583c0a1bdc50d266f6a4e3d9ace7c3431ad35`, idéntico al local `c7e66ade57d4091e9536773c542d9764ce9fc001`.

La terminal carecía de autenticación Git. Se publicó con GitHub Git Data API y se verificó igualdad del árbol completo de 127 archivos antes de crear la rama. El historial local original sigue conservado. No se fusionaron PR12, PR13 ni main.

CI del primer commit: **SUCCESS**, https://github.com/riano200612-jpg/adphor-platform/actions/runs/41052625943 . Incluyó npm test, SQL PGlite, aislamiento de build, compilación, instalación Chromium, Playwright y Python. Esto acredita los escenarios existentes y el selector sintético, no E2E integral de Supabase/IA.

## Seguridad de publicación

Escáner detect-secrets: 66 avisos revisados; 64 hashes SHA256 de inventario y 2 fixtures explícitos. Cero hallazgos sin clasificar. Registro: `SECRET_SCAN_QA_20261030.json`. Patrones de claves privadas, tokens conocidos y asignaciones password/api_key/pin también revisados en snapshots nuevos desde main, sin coincidencias. No equivale a garantía absoluta de ausencia de secretos. No hay .env privado, .clasp.json ni claves privadas rastreadas.

La revisión automática bloqueó el primer push por los avisos sin clasificar; se documentaron antes del siguiente intento. El posterior bloqueo de terminal fue autenticación ausente, resuelto mediante el plugin GitHub. No se eludió la revisión de secretos.

En esta rama Vite detiene compilaciones con CF_PAGES o WORKERS_CI. El bloqueo impide promover este candidato mediante los builds automáticos conocidos hasta validar Access. No modifica los despliegues ya existentes ni certifica su protección. No se debe eliminar sólo para obtener un check verde. Referencias: https://developers.cloudflare.com/pages/configuration/build-configuration/ y https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ .

## Autenticación: alcance de la corrección candidata

La cadena original muestra `validarUsuarioYEnviarOTP` (PIN + emisión) y `completarLoginConOTP(idDelegado,codigo)` (validación y retorno del perfil). La segunda función no exige por sí misma un comprobante de haber superado PIN. Se reprodujo con SpreadsheetApp simulado que un delegado sintético con OTP y timestamp vacíos obtiene `login_complete` mediante esa función. No se llamó la implementación original ni se probó su accesibilidad pública; el impacto externo depende de permisos de Apps Script y de las operaciones posteriores.

El destino NO reutiliza esa validación. `managed-mfa.js` utiliza listFactors y challengeAndVerify de Supabase para factores TOTP verificados. Rechaza códigos vacíos/malformados, errores del proveedor y respuestas sin aal2; vincula el desafío al usuario actual y consume el estado local al completar. No genera OTP, no guarda códigos, no registra secretos y no inscribe/restablece factores.

El login incorpora la pantalla de verificación antes de cargar datos. Usuarios sin factores mantienen su acceso existente, sin inscripción automática. Factores no TOTP se deniegan con explicación de incompatibilidad; soporte adicional pendiente.

FastAPI aplica `require_enrolled_mfa` después de validar el mismo bearer token mediante /auth/v1/user. La lectura de la claim aal NO es un verificador JWT independiente: depende obligatoriamente de esa validación previa. Si el usuario tiene factor verificado, sólo acepta aal2 y sub coincidente.

**Límite crítico:** el control frontend/API no asegura MFA en acceso directo a PostgREST/Storage. Las políticas SQL QA que exijan aal2 y las pruebas con usuarios/factores reales siguen pendientes. No declarar la seguridad MFA integral certificada. Las respuestas incorrecta/expirada/reutilizada se prueban simulando el rechazo del proveedor; falta verificar el comportamiento real de Supabase.

Documentación consultada: https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify y búsqueda de documentación MCP. El índice changelog.md no pudo leerse con el navegador de búsqueda por su tipo de contenido; no se presume ausencia de cambios incompatibles.

## Pruebas nuevas y estado por requisito

| Requisito | Estado | Evidencia o límite |
|---|---|---|
| Publicar rama/PR | Probado | PR14 y primer SHA verificado |
| Secretos | Probado dentro del escaneo | 66 avisos clasificados; originales privados excluidos |
| Comparar PR12/13 | Parcial | PR12 89bd843; PR13 bc65875, inventario nuevo recuperado; módulos incompatibles no fusionados |
| 32 originales | Parcial | Inventario con hashes; revisión completa de todas las funciones pendiente |
| Selector 40 propiedades | Probado sintético | Unitarias + Playwright del primer CI; RLS hospedada pendiente |
| MFA administrada | Implementado parcialmente | 8 pruebas JS nuevas y 2 Python; JWT/factores reales pendientes |
| Reuniones | Parcial | Evaluación reglas, SQL QA; calendario CRUD y excepciones integrales pendientes |
| PQRS | Parcial | Ciclo SQL/UI y 400 registros ficticios; correos, evidencias, calificación integral pendientes |
| SQL/persistencia | Probado local | 30 checks PGlite, no Supabase real |
| Supabase QA hospedado | Bloqueado | list_projects sólo muestra proyecto actual ADPHOR; no se crearon recursos ni cuentas |
| Playwright | Probado para primer SHA | CI enlazado; no demuestra backend hospedado |
| Enjambre | Parcial | Contratos/reglas; pipeline documental real e inferencia integral no certificados |
| Carga | Parcial | 40 propiedades/400 PQRS local; concurrencia productiva pendiente |
| URL QA privada | Pendiente | Ninguna URL nueva entregada ni despliegue realizado |
| IA-01 a IA-20 | NOT RUN | No sustituidas por las pruebas anteriores |

La actualización MFA pasa localmente **56 JS y 96 Python** más build. Evidencias `qa/porto/evidence/unified/mfa-*`. CI de esta actualización debe comprobarse por su nuevo SHA; no hereda el PASS del anterior.

## Backup, rollback y próximos pasos

Código previo respaldado en comentarios de PR13; árbol publicado como PR14; commits locales conservados. Reversión de MFA: revertir el commit candidato dentro de QA. No hay migraciones ni datos productivos que revertir.

P1: validar nuevo CI; completar MFA en SQL QA y ensayos con JWT/factores reales; crear o autorizar infraestructura QA aislada si su disponibilidad/coste lo permite; completar calendario transaccional y evidencias privadas. P2: comunicaciones sandbox, ETL aprobado, modelos reales y pruebas IA-01 a IA-20.

No se alteraron cuentas existentes, originales, Drive, políticas productivas ni main. No hay URL de cliente verificada. Dictamen propuesto: **apto para auditoría de código, todavía no apto para presentación funcional integral o producción**. Evaluación final reservada al auditor independiente.
