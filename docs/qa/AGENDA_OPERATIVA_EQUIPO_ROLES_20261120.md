# ADPHOR QA Integral — supervisión de agenda del equipo (R03, R11, R12)

**Fecha:** 20 de noviembre de 2026. **Destino único:** `qa/integral-claude-reviewed-20261111`. **Alcance:** vista de solo lectura sobre las tareas de mantenimiento ya persistidas.

## Requerimiento de José

Coordinadores y administradores necesitan ver los compromisos del equipo de la copropiedad, mientras cada empleado consulta los suyos. La agenda existente solo mostraba `assignee = usuario actual`, lo que impedía la supervisión desde «Mis tareas» a un administrador.

## Solución acotada

- En «Mis tareas», los roles `admin` y `coordinator` disponen de las vistas «Mis asignaciones» y «Equipo de la copropiedad».
- La selección de alcance es compartida con el plan quincenal existente, para evitar dos indicadores contradictorios.
- La proyección filtra siempre por `project_id`, excluye tareas cerradas y no inventa actividades que aún no están registradas.
- El modo personal sigue visible para `technician` y `viewer`; la función de proyección rechaza explícitamente `scope=team` para esos roles.
- La vista de Inicio conserva exclusivamente el resumen personal, aunque un coordinador estuviera consultando antes el equipo.
- Los registros sin responsable se muestran con etiqueta informativa solo en la vista autorizada de equipo.
- Al cambiar de cuenta o copropiedad, la selección vuelve al alcance personal.
- Abrir una tarjeta usa el mismo diálogo auditado; ni la vista ni su proyección conceden permisos adicionales.

## Fronteras de seguridad y pendientes

No se introduce una autorización alternativa. La RLS del servidor sigue determinando qué filas llegan a la aplicación; el filtro de UI solo restringe más el conjunto ya autorizado. Se mantienen las reglas AAL2 y de rol para editar o cerrar. Este cambio **no certifica** el aislamiento de dos cuentas reales en una sesión MFA: requiere aceptación con identidades QA distintas.

No activa programación recurrente, aprobaciones de catálogo, avisos, sprints históricos ni Google Calendar. Esos requisitos continúan pendientes de los datos y decisiones aprobadas por José. Ningún original, calendario, proveedor de correo ni dato de producción se modifica.

## Pruebas exigidas antes de fusionar

- Node: separación por propiedad, falta de autorización de equipo para técnico/consulta, datos sin responsable, caracteres HTML y representación de Inicio.
- Chromium: móvil 390 px, tarjeta asignada a compañero visible para administrador solo al elegir equipo, diálogo original, coordinación con plan quincenal, Inicio personal y reset tras nueva sesión.
- Suite completa de Python, Node, aislamiento, compilación, Chromium y CI post-fusión.
- Cloudflare Pages: SHA/alias exactos de QA Integral y estado `success`.

La certificación del incremento es de **lectura y navegación**. No sustituye la certificación funcional real de roles empresariales ni la agenda recurrente completa.
