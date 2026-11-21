# ADPHOR — Guía del repositorio

**Fecha de referencia:** 20 de noviembre de 2026. **Audiencia:** equipo de ingeniería, revisión del cliente y colaboradores.

## Dónde comenzar

1. [README principal](../README.md): describe la base histórica y señala la ruta de trabajo vigente.
2. [Arquitectura general](ARQUITECTURA_GENERAL.md): distribución de frontend, backend, datos, integraciones y pruebas.
3. [Mapa de módulos](MAPA_DE_MODULOS.md): dónde encontrar cada componente y qué se puede inferir de su presencia.
4. [Estado y fuentes de verdad](ESTADO_DEL_DESARROLLO.md): rama base, QA Integral, propuestas abiertas y diferencias entre implementación y certificación.
5. [Colaboración](../CONTRIBUTING.md): normas de lectura, PR y controles de seguridad.

## Referencias oficiales para navegar

- [Repositorio público](https://github.com/riano200612-jpg/adphor-platform).
- [main — base histórica](https://github.com/riano200612-jpg/adphor-platform/tree/main): rama predeterminada protegida. No asumir que contiene todo el trabajo reciente.
- [QA Integral — línea de integración](https://github.com/riano200612-jpg/adphor-platform/tree/qa/integral-claude-reviewed-20261111): consultar la punta del branch al momento de revisar.
- [QA histórica](https://github.com/riano200612-jpg/adphor-platform/tree/qa/pqrs-carrusel-integracion-20261104): preservar como referencia de recuperación y comparación.
- [Solicitudes de cambio abiertas](https://github.com/riano200612-jpg/adphor-platform/pulls): propuestas en revisión; no necesariamente integradas.
- [Historial de la rama QA](https://github.com/riano200612-jpg/adphor-platform/commits/qa/integral-claude-reviewed-20261111): cronología técnica.

## Estructura lógica de QA Integral

| Ruta | Propósito |
| --- | --- |
| `src/js/` y `src/css/` | Interfaz web, componentes y estilos |
| `src/js/services/` | Servicios de negocio y adaptadores de integración |
| `backend/` | Núcleo Python y servicios de asistencia/IA |
| `functions/` | Funciones server-side vinculadas a Cloudflare Pages |
| `supabase/migrations/` | Evolución de modelos de datos y políticas |
| `supabase/functions/` | Endpoints y funciones específicas de QA |
| `tests/` | Pruebas JavaScript, de contratos y Playwright |
| `qa/` | Contratos, herramientas de pruebas aisladas y evidencias |
| `docs/` | Historial de auditorías, decisiones y entregables técnicos |
| `.github/workflows/` | Automatización y controles de calidad |

**Atención:** algunas rutas anteriores se encuentran en la rama QA y no existen todavía en `main`. Use el selector de rama antes de concluir que falta un módulo.

## Convenciones de lectura

- **En `main`** significa que el archivo está en la rama predeterminada, no que cubre todas las etapas posteriores.
- **En QA** significa que existe implementación candidata o consolidada en la rama QA; por sí solo no acredita aceptación real.
- **En PR** indica una propuesta independiente y pendiente de resolución, aunque tenga pruebas locales.
- **Certificado** debe respaldarse con pruebas específicas, identidad autorizada, evidencia y aprobación; no se deduce de la documentación.

## Conservación del patrimonio del proyecto

Conservar ramas de respaldo, historial Git y material original de José sin copiar archivos privados al repositorio público. No fusionar, renombrar o borrar referencias históricas solo por antigüedad o duplicidad de commits. Primero se revisan diferencias, descendencia, PR, recuperación y permisos.

**Esta guía es documentación de orientación; no cambia el comportamiento de la plataforma.**
