# ADPHOR — Estado del desarrollo y lectura de evidencia

**Corte documental:** 20 de noviembre de 2026. Este archivo **no** sigue despliegues; la plataforma evoluciona continuamente.

## Referencias por función

| Referencia | Tratamiento |
| --- | --- |
| `main` | Base histórica predeterminada |
| `qa/integral-claude-reviewed-20261111` | Integración funcional QA |
| `qa/pqrs-carrusel-integracion-20261104` | Comparación histórica |
| `backup/*` y `respaldo/*` | Conservación y recuperación |
| `feature/*`, `fix/*`, otras `qa/*` | Trabajo temático; estado por PR |

## Cambios de ejemplo (verifique su estado actual)

- [PR #166 — IAM](https://github.com/riano200612-jpg/adphor-platform/pull/166): integrado a QA durante la revisión.
- [PR #167 — documentos para Miss ADPHOR](https://github.com/riano200612-jpg/adphor-platform/pull/167): propuesta en revisión al corte.
- [PR #70 — PQRS dual](https://github.com/riano200612-jpg/adphor-platform/pull/70): requiere conciliación con propuestas relacionadas.
- [PR #59 — sesión MFA/AAL2](https://github.com/riano200612-jpg/adphor-platform/pull/59): borrador de corrección sujeto a validación.

## Estado técnico no es estado de entrega

- **Presente:** rutas observadas en un SHA.
- **Propuesto:** trabajo en PR todavía no incorporado.
- **Integrado:** cambio en la rama de integración.
- **Validado aislado:** pruebas locales/CI con su entorno descrito.
- **Verificado autenticado:** evidencia de usuarios/roles/recursos autorizados.
- **Aceptado:** decisión explícita del cliente para un alcance preciso.

Los informes previos de `docs/` y `qa/` reflejan el momento en que fueron escritos. No reescribirlos retroactivamente para aparentar actualidad; agregar índices y trazabilidad.

La limpieza de ramas y PR queda fuera de esta organización: primero comparar ascendencia, commits únicos, respaldo y aprobación.