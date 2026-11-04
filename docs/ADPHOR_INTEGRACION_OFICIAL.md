# ADPHOR — punto único de integración

| Componente | Referencia oficial |
|---|---|
| Repositorio | riano200612-jpg/adphor-platform |
| Rama de integración | qa/pqrs-carrusel-integracion-20261104 |
| Pages principal elegido | adphor-platform |
| Base QA aislada | qfctnnnnltghepwujpdm (adphor-qa) |
| Producción | Main protegida; sin cambios autorizados en este bloque |
| Registro de destinos | qa/integration-target.json |
| CI | .github/workflows/checks.yml |
| Publicación QA | Job deploy-approved-qa, preparado y deshabilitado hasta verificar Access |

Trabajar y conservar commits únicamente en la rama activa. Las ramas históricas no son entornos de trabajo nuevos y se mantienen como respaldo hasta revisar su integración. No abrir otro repositorio ni proyecto para continuar.

La URL propuesta en el registro no es todavía una entrega certificada. No hay un nuevo despliegue QA. Access, la configuración de Cloudflare y el guard de Vite deben verificarse antes de activar la publicación. El inventario y las dependencias pendientes están en docs/audits/20261104-consolidation-inventory.md.

El job preparado publica únicamente en el proyecto principal, con la rama QA explícita y el SHA validado. Requiere finalizar tanto pruebas JavaScript/E2E como Python, aprobación del Environment y preflight. Los disparadores duplicados actuales de Cloudflare aún no se han desactivado por falta de acceso administrativo.

Fotos y colaboradores: adaptadores conservados, importación privada pendiente. PQRS: esquema QA y bucket privado existentes, certificación autenticada pendiente. Reuniones/calendario: código conservado; las simulaciones no se presentan como reservas externas. No se certifica el producto completo por aprobar el build.
