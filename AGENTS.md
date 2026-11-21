# ADPHOR — instrucciones de ingeniería para Codex

## Misión y límites

Este repositorio contiene ADPHOR, su interfaz, funciones Cloudflare, backend, pruebas y migraciones. Codex actúa como asistente de ingeniería, no como administrador de copropiedades ni como la instancia de Miss ADPHOR orientada a usuarios finales.

- Trabajar en la **única QA Integral** aprobada. Confirmar al inicio de cada tarea el HEAD real de la rama QA, el último deployment Pages y la configuración de publicación; no asumir que un SHA histórico sigue vigente.
- Rama QA de referencia a fecha 2026-11-20: `qa/integral-claude-reviewed-20261111`. Verificarla en GitHub antes de tomarla como base.
- El proyecto Pages existente es `adphor-platform`. Nunca crear otro proyecto QA, otro dominio QA permanente o una infraestructura paralela por conveniencia.
- Producción, datos originales, calendarios corporativos, cuentas externas, documentos privados y credenciales están fuera de alcance salvo autorización explícita, específica y posterior.
- El repositorio puede ser público: no guardar actas, PII, tokens, claves privadas, sesiones, logs identificables, exportaciones reales ni secretos en commits, PRs, artefactos o prompts.
- El código ejecutado en navegadores es público: **nunca** poner `service_role`, claves secretas ni credenciales administrativas en `VITE_*`.
- No cambiar por cuenta propia políticas Cloudflare Access, secretos, variables, pipelines de publicación, RLS, autorizaciones ni automatizaciones.
- No ejecutar `push` a la rama QA, `merge`, `deploy`, migraciones reales ni activación de flags de funcionalidades sin autorización específica del propietario y controles completos. Las PRs son propuestas.
- No usar `git push --force` ni reescribir historia compartida. No borrar ramas o respaldos sin inventario y autorización.

## Proceso obligado

1. **Descubrir el estado**: `git status`, rama/base/HEAD, PRs relacionados, workflow existente, último despliegue y documentación relevante. Preservar cambios ajenos y trabajo aprobado.
2. **Acotar la tarea**: describir fallo o mejora, criterios de aceptación y archivos previstos. Reutilizar implementaciones ya existentes; evitar reconstrucciones e integraciones duplicadas.
3. **Aislar el cambio**: una rama de trabajo corta desde el HEAD QA verificado; cambios mínimos y revisables. Preferir un único commit coherente y PR hacia QA Integral; no acumular PRs duplicadas.
4. **Ejecutar pruebas**: usar los scripts existentes, no inventar PASS. Distinguir pruebas unitarias, sintéticas, de integración, E2E real y verificación de despliegue. Registrar los comandos exactos, resultados y hashes.
5. **Seguridad**: comprobar aislamiento por copropiedad, roles y membresías, RLS de Supabase, MFA AAL2 cuando corresponda y acceso anónimo/permitido/denegado de Cloudflare Access; no usar datos de residentes reales para pruebas.
6. **Certificar**: revisar código, resultado de GitHub Actions, eventos de Cloudflare y, si hubo publicación autorizada, deployment ID/branch/SHA/alias/rollback. Una CI verde por sí sola no certifica el runtime.
7. **Entregar dictamen**: `READY_FOR_OWNER_AUTHORIZATION` o `BLOCKED`, evidencias verificables, riesgos, versión efectivamente desplegada y próximo paso concreto. Nunca afirmar una publicación que no ocurrió.

## Matriz técnica de referencia

Consultar el workflow vigente en `.github/workflows/checks.yml` antes de ejecutar comandos. El proyecto utiliza Node.js 22, Vite, Playwright, Python y el paquete Python Worker QA. Entre las comprobaciones existentes:

```sh
npm ci
npm test
node qa/porto/test-persistence.mjs
node qa/checks/build-isolation.mjs
npm run build
npm run test:e2e
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
python qa/security/validate_private_worker.py
```

Playwright requiere Chromium y dependencias del runner. La compilación de Pages Functions y el empaquetado de Worker QA deben seguir la definición exacta del workflow; no desplegar un Worker para probarlo.

## Reglas concretas para revisión de código

- Rechazar caminos en los que un usuario de una copropiedad pueda leer, buscar, adjuntar o modificar objetos de otra, incluso cambiando IDs en peticiones o enlaces.
- Rechazar rutas que omitan autorización server-side/RLS, MFA AAL2 requerido, comprobación de propietario o control de acceso a adjuntos. Un control visual no constituye seguridad.
- Detectar claves secretas, credenciales y datos reales en frontends, artefactos y logs; bloquear flujos que publiquen sin gates o mezclen QA con producción.

## Habilidades de proyecto

- `.agents/skills/adphor-503-triage/SKILL.md`: diagnóstico reproducible de errores 503.
- `.agents/skills/adphor-qa-certification/SKILL.md`: validación integral y dictamen antes de publicación.
- `.agents/skills/adphor-private-documents/SKILL.md`: ingestion segura de documentos de Miss ADPHOR.

Guía de incorporación: `docs/CODEX_QA_INTEGRAL.md`. Una Skill es un procedimiento, no autorización para ejecutar operaciones fuera de alcance.
