# ADPHOR — Estado del desarrollo y fuentes de verdad

**Corte documental:** 20 de noviembre de 2026. Este documento no sigue ni certifica despliegues: el desarrollo de QA Integral continúa en paralelo.

## Ramas de referencia

| Referencia | Uso de lectura |
| --- | --- |
| `main` | Rama predeterminada protegida; contiene la base histórica. No refleja por sí sola todo QA reciente |
| `qa/integral-claude-reviewed-20261111` | Línea activa de integración QA y base de varias propuestas |
| `qa/pqrs-carrusel-integracion-20261104` | Histórico de QA; conservar para comparación/recuperación |
| `feature/*`, `fix/*`, otras `qa/*` | Trabajos específicos; su existencia no demuestra que hayan entrado en la integración |
| `backup/*`, `respaldo/*` | Referencias de conservación; no borrar sin auditoría explícita |

## Propuestas de especial interés

- [PR #167 — Documentos de Miss ADPHOR](https://github.com/riano200612-jpg/adphor-platform/pull/167): borrador en revisión al corte.
- [PR #70 — PQRS dual](https://github.com/riano200612-jpg/adphor-platform/pull/70): revisión pendiente al corte; no confundir con propuestas anteriores del mismo tema.
- [PR #59 — Restauración de sesión AAL2](https://github.com/riano200612-jpg/adphor-platform/pull/59): borrador que requiere verificación.
- [PR #166 — IAM](https://github.com/riano200612-jpg/adphor-platform/pull/166): integrado en QA durante el corte de la revisión; comprobar siempre el historial real.

## Evidencia y criterios

| Fuente | Qué permite concluir | Qué no permite concluir |
| --- | --- | --- |
| Árbol Git | Archivo y versión existentes | Funcionamiento en la plataforma |
| PR y revisión | Propuesta, comentarios y decisión registrada | Que el PR está automáticamente integrado |
| Prueba local/CI | Resultado en su entorno y versión | Integración real de servicios externos |
| Verificación autenticada | Comportamiento observado para identidades autorizadas | Cobertura universal de permisos/edificios |
| Aprobación del cliente | Aceptación específica documentada | Que todo cambio posterior sigue certificado |

## Convenciones de organización

**MANTENER:** rama de integración, histórico QA, respaldo sin auditoría de recuperación, fuentes trazables del cliente (sin publicarlas), PR abiertos en revisión.

**REVISAR:** ramas repetidas, informes desactualizados, trabajos que puedan solaparse y descripciones que usan «listo» sin prueba verificable.

**NO HACER POR LIMPIEZA:** fusionar, cerrar PR, cambiar rama predeterminada, mover código, alterar Access/Supabase o borrar backups.

## Incorporación de otro ingeniero

Empiece por la [guía del repositorio](GUIA_DEL_REPOSITORIO.md), después [arquitectura](ARQUITECTURA_GENERAL.md), [módulos](MAPA_DE_MODULOS.md) y el [protocolo de contribución](../CONTRIBUTING.md). Verifique el SHA actual de la rama que estudie porque pueden existir cambios simultáneos.
