# P0 — Certificación técnica ADPHOR QA (11 noviembre 2026)

**Estado:** respaldo de código, NO PUBLICADO, NO LIBERABLE hasta autorización humana y verificación administrativa de Cloudflare Access y del hostname del candidato.
**Rama:** `qa/integral-claude-reviewed-20261111` (única rama autorizada).
**SHA inicial verificado en GitHub:** `36c1f480c998a1624c73df9f6525d1ce41ba4771`.
**SHA final:** ver commit de respaldo `[CF-Pages-Skip]` en el informe de entrega.

## A. Estado real y bloqueos
- Las 7 E2E que el informe anterior declaraba bloqueadas eran en realidad **29 pruebas en 12 archivos**. El bloqueo era infraestructura: el Chromium oficial no se descargaba y el binario de sistema abortaba con `socket EPERM`.
- Resuelto: Chromium real de `@sparticuz/chromium` (paquete npm, versión 153) lanzado vía `CHROMIUM_PATH` con un wrapper que no usa `--single-process`. Ese flag hacía morir el navegador al cerrar el primer contexto; por eso fallaban 14 de 29 pruebas.
- Corregido un defecto del fixture: `tests/e2e/visits-isolated.spec.js` no creaba el rol `anon`, que la migración de visitas revoca explícitamente. Se añadió `create role anon;` (equivalente al que ya usa la prueba de contrato).

## B. Resultados reales (ejecución de este entorno)
| Suite | Línea base | Resultado |
|---|---|---|
| JavaScript (`npm test`) | 355 | **355 PASS**, 0 fallos |
| Python (`unittest`, requisitos fijados en venv) | 136 | **136 PASS** |
| SQL aislado (`qa/porto/test-persistence.mjs`) | 30 | **30 PASS** (sintético; NO JWT de Supabase ni E2E) |
| Aislamiento de build | 3 | **3 PASS** |
| Build normal (`--base=/`) | PASS | **PASS** |
| Build protegido sintético (ramas QA, `VITE_VISITS_SQL_ENABLED=false`, sin probe) | PASS | **PASS**, probe ausente |
| E2E Playwright con Chromium real | 7 bloqueados | **29 PASS**, 0 FAIL, 0 flaky, 0 omitidas |

Evidencia E2E: `qa/e2e-20261111/resultados-playwright.json`, `qa/e2e-20261111/stderr.log`, capturas en `qa/e2e-20261111/capturas/`.

**Limitación de la E2E:** prueba la interfaz con datos sintéticos y fixtures aislados. **No** valida sesión real de Supabase QA, MFA de la cuenta autorizada, Google Calendar ni Storage privado remoto.

## C. Seguridad verificada por código y pruebas
- MFA obligatorio en QA: `qaAuthPolicy` deriva `required` de la URL del backend; los flags no pueden bajarlo.
- AAL2 antes de consultas protegidas: pruebas de `cloud-authentication.test.js` (AAL1 denegado, deriva de AAL2 bloqueado).
- Alias demo: `VITE_ALLOW_DEMO_LOGIN_ALIAS=false` por defecto y nunca activo con MFA obligatorio (cuatro pruebas).
- RLS: las 11 tablas creadas en `supabase/migrations` tienen RLS habilitada (comprobación estática; `qa/database` no se recorrió).
- Separación QA/producción: la referencia `oqizvirqjwbbhyyjpthq` aparece solo como exclusión en `porto.js` y `evidence-api.js`, nunca como destino.

## D. Preflight Cloudflare y CI/CD (estático)
| Elemento | Hallazgo | Acción |
|---|---|---|
| `checks.yml` push | Solo `main` y la rama QA **anterior** `qa/pqrs-carrusel-integracion-20261104` | Pendiente de reconciliar; la rama vigente no dispara CI en push |
| `deploy-approved-qa` | Condición `github.ref` apunta a la rama anterior | No modificado: depende de evidencia administrativa |
| `deploy.yml` | Solo `main` (producción) | Sin cambios |
| `qa/integration-target.json` | `branch` y `qaUrl` apuntan a la rama y hostname anteriores | Pendiente: no se supone un hostname nuevo |
| `vite.config.js` | Acepta ambas ramas para la compilación protegida | Sin cambios |
| Marcador `[CF-Pages-Skip]` | Ningún workflow lo lee; es convención de equipo | Verificar en Cloudflare antes de depender de él |
| `ADPHOR_QA_ACCESS_VERIFIED` | No activado | Permanece apagado hasta certificación real de Access |

## E. Pendiente que requiere autorización humana
1. Confirmar en el panel de Cloudflare Pages el hostname y el Deployment ID del candidato de esta rama.
2. Verificar Allow/Deny real de Access con una identidad autorizada y otra no autorizada.
3. Confirmar que la cuenta de José existe en Supabase QA con MFA y membresía asignada (no se creó ninguna).
4. Autorizar la reconciliación de `checks.yml` e `integration-target.json` hacia la rama vigente.
5. Autorizar cualquier publicación Preview. Este informe no publica.

## F. Funcionalidad pendiente (no implementada en esta fase)
- Calendar corporativo: escrituras, reservas y concurrencia real requieren OAuth y autorización explícita. No se activaron.
- Agenda transaccional (reprogramar/cancelar): sin contrato aprobado; no se conectó a la interfaz.
- Visitas ciclo completo (ejecución/seguimiento): fuera del contrato actual.
- PQRS adjuntos privados y radicación remota: requieren backend privado autorizado.

## G. Dictamen
**NO LIBERABLE.** Las pruebas locales y de navegador pasan, pero la verificación administrativa de Access, la sesión real de José y el hostname del candidato no están certificados.

## H. Reversión selectiva
Revertir el commit de esta fase con commit inverso revisado sobre el HEAD vigente. No hay SQL remoto ni datos que revertir. No usar rollback de producción.
