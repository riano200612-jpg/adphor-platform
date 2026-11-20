# ADPHOR QA Integral — Prioridad de agenda operativa en Inicio

**Alcance:** incremento de comunicación y orden de lectura del panel Inicio. Basado en los criterios R11 (agenda operativa por persona), R17 (PQRS) y R10 (claridad del lenguaje) de la reunión ADPHOR del 18-Nov-2026.

## Cambio acotado

1. En Inicio, la agenda de mantenimiento asignado del usuario se sitúa antes de los accesos genéricos a otros módulos. Usa exclusivamente el proyector existente de tickets persistidos y respetando copropiedad, actor y RLS.
2. La tarjeta PQRS deja de afirmar incorrectamente que la radicación sigue pendiente: el texto invita a radicar y consultar, sin afirmar que el portal Google original ni los correos estén certificados.
3. El estado sin urgencias deja de decir «Todo al día», porque pueden quedar tareas no urgentes abiertas. Pasa a «Sin alertas urgentes» y advierte que otras tareas pueden seguir pendientes.

No se incorpora generación recurrente, ni sprints con persistencia histórica, ni operaciones en Google Calendar. Estas limitaciones permanecen claramente expresadas en la agenda operativa.

## Verificación

- Unit test `tests/qa-operational-home-priority.test.js`: prioridad de secciones, copy PQRS y honestidad de alertas.
- Chromium `tests/e2e/operational-home-priority-20261119.spec.js`: pantalla móvil 390 px, agenda visible antes del módulo de accesos y ausencia de copy obsoleto.
- Ejecutar la suite completa del repositorio, CI de PR y CI posterior a squash antes de aceptar el despliegue de QA.
- Única rama de destino `qa/integral-claude-reviewed-20261111`, sin tocar producción, Google Calendar ni originales del cliente.

**Dictamen de este incremento:** corrección de UX/orden de contenido. No equivale a certificación de la operación completa R11–R17.
