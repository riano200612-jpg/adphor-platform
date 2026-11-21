---
name: adphor-qa-certification
description: Auditar y certificar cambios de ADPHOR QA Integral antes de merge o deployment, comprobar CI, seguridad, aislamiento por copropiedad y trazabilidad GitHub-Cloudflare.
---

# Gate de certificación · ADPHOR QA Integral

## Principio

No confundir *compila*, *pasa CI*, *está desplegado* y *funciona para usuarios autorizados*. Son afirmaciones distintas, que requieren evidencias distintas.

## Checklist de auditoría

1. Confirmar rama QA canónica actual, SHA de partida, permisos, PR y archivos modificados. Verificar que no se han arrastrado cambios de producción ni se sobreescriben originales.
2. Revisar el diff, modelos de datos, superficies de autorización y dependencias; comprobar que no contiene documentos originales, datos sensibles, secretos ni una nueva ruta de despliegue no autorizada.
3. Leer el workflow real `.github/workflows/checks.yml` y comprobar los jobs aplicables: JavaScript/SQL aislado, Python, Vite, Functions, Worker QA en dry-run, Playwright y artefactos. Registrar IDs y resultados; no inventar un número de tests.
4. Para cambios en permisos, almacenamiento, login o Miss ADPHOR, exigir evidencia con al menos dos contextos de copropiedades distintas; escenarios permitidos y denegados, comprobación RLS/AAL2 y acceso a objetos/archivos. Usar solo identidades de QA autorizadas y fixtures no sensibles.
5. Con acceso de lectura, comparar deployment ID, branch, commit hash, hora, estado y alias de Pages con el SHA esperado. Comprobar controles Access anon/allow/deny cuando sea posible.
6. Antes de habilitar una funcionalidad con escritura real, revisar rollback de código y reversibilidad de migraciones; un rollback de Pages no restaura datos de Supabase.
7. Si se aprueba y autoriza un despliegue, comprobar nuevamente URL QA, versión visible, recorridos críticos y errores operativos; no habilitar producción.

## Dictamen

Entregar un bloque estructurado:
- `READY_FOR_OWNER_AUTHORIZATION` o `BLOCKED`.
- PR, SHA base, SHA propuesto y SHA publicado (si aplica).
- Matriz por control: PASS / FAIL / NOT_RUN con fuente verificable.
- Riesgos, controles pendientes, impacto al usuario y procedimiento de recuperación.
- Acción exactamente requerida del propietario.

No utilizar `READY_FOR_OWNER_AUTHORIZATION` si cualquier gate crítico está en FAIL o NOT_RUN. Nunca ejecutar merge, push QA, deploy, mutación de Access, migración real o limpieza de ramas por la mera invocación de esta Skill.
