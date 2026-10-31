# ADPHOR — revisión incremental de asignaciones, 31 de octubre de 2026

Base remota comprobada: `81e83b95147025ab1a09e5234a1872e0b993b3a4`.
Rama de trabajo: `qa/staff-validation-20261031`; destino propuesto: rama QA premium, nunca main.

## Matriz previa a implementación

| Requisito | Componente existente | Diferencia o límite | Verificación prevista |
| --- | --- | --- | --- |
| Responsables autorizados | staff-directory-contract.js | Coerción Boolean admite cadenas como `false`; falta vínculo de copropiedad en la tarjeta | Pruebas de permisos estrictos y reutilización entre copropiedades |
| Reuniones originales | Adaptadores legacy-meeting y client-meeting | Existencia de adaptadores no demuestra sincronización Calendar | Conservar pruebas existentes; sincronización hospedada pendiente |
| Mantenimiento y bitácora | app.js y flujo existente de acciones | Ya se incorporó guía de pasos; no reconstruir | Regresión de suite JavaScript |
| PQRS y adjuntos | ui-pqrs y evidence picker | Selección y retirada locales; subida privada pendiente | Conservar bloqueo de falsa confirmación de almacenamiento |
| Autenticación | Supabase Auth y mfa_guard | MFA hospedado y recuperación no comprobados en esta iteración | NOT RUN para usuarios reales |
| Enjambre | Orquestador y agent_eval_qa | Evaluador offline no demuestra modelos integrales en web | No activar inferencia ni datos privados |
| Despliegue QA | Vite bloquea ramas distintas de premium en Cloudflare | Access y despliegue actuales sin verificación autenticada | Mantener bloqueo en esta rama |

Fuentes de esta revisión: código y pruebas del repositorio en el SHA indicado, e instrucción de continuidad suministrada por el propietario. No se realizó una nueva auditoría exhaustiva de Drive ni una importación de datos reales.

## Hallazgos

El contrato de cliente usa `Boolean(member.can_receive_cases)`, por lo que una cadena `false` se vuelve verdadera. Además, la tarjeta no conserva projectId y puede reutilizarse al construir una solicitud para otra copropiedad. Son defectos del contrato de cliente: no se ha demostrado una explotación del backend.

La corrección deberá rechazar permisos no booleanos, identificadores vacíos y tarjetas de otra copropiedad. El backend sigue obligado a comprobar JWT, membresía vigente, propiedad del caso, área y permiso al guardar. Una tarjeta previamente autorizada no demuestra que su membresía siga vigente.

## Alcance y reversión

Sin cambios en cuentas, SQL, Storage, fuentes originales, comunicaciones o producción. Sin datos personales nuevos. Reversión mediante revert del commit de esta rama. La revisión independiente y las pruebas de autorización hospedada siguen pendientes.

## Resultados ejecutados

- `node --test tests/staff-directory-contract.test.js`: 6 PASS; cuatro escenarios de regresión añadidos.
- `npm test`: 108 PASS, 0 FAIL, 0 omitidas. Evidencia: `qa/evidence/staff-validation/javascript.log`.
- `npm run build`: PASS. Evidencia: `qa/evidence/staff-validation/build.log`.
- `node --test tests/qa-deploy-block.test.js`: 2 PASS; bloqueo de compilación Cloudflare conservado. Evidencia: `qa/evidence/staff-validation/deploy-guard.log`.
- `git diff --check`: PASS.
- Python, PostgreSQL, RLS hospedada, Playwright y carga: NOT RUN en esta iteración. Los resultados históricos no se presentan como ejecución nueva.
- MFA, Access, persistencia remota, migración de datos y subida privada: pendientes de verificación; ninguna activación.

Estado propuesto: **Listo para auditoría del contrato de cliente; integración operacional parcial**. No se certifica la seguridad del sistema completo ni se autoriza producción.

Cloudflare devolvió `Unable to sign in. Try again or use your email and password.` tras autenticación Google. El intento posterior con correo y contraseña no se completó. No se puede confirmar el commit desplegado ni Access desde el panel en esta sesión. No se entrega una URL QA como validada.
