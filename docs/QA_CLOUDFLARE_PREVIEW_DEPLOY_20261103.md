# ADPHOR · Verificación de despliegue QA protegido — 2026-11-03

La rama `qa/p1-integracion-modulos-gate-20261103` contiene la interfaz institucional actualizada, Miss ADPHOR y el Centro integrado. Fuente principal: `src/js/app.js`, `src/js/ui-miss-adphor-chat.js`, `src/js/ui-unified-hub.js`.

## Contexto verificado
- Cloudflare Pages: `adphor-platform`, conectado a GitHub `riano200612-jpg/adphor-platform`.
- Rama de producción existente: `codex/flujo-mantenimiento`. No debe cambiarse sin aprobación de salida a producción.
- Vistas previas: Cloudflare Access exigido y política de correo aprobada `riano200612@gmail.com`.
- Configuración **Preview solamente**: `ADPHOR_PROTECTED_STAGING_QA=true`, guardada en Cloudflare para superar el bloqueo `QA_DEPLOY_BLOCKED`.
- Build Cloudflare Pages: `npm run build -- --base=/`; resultado `dist`.
- Este commit solicita el build automático de vista previa a través del flujo GitHub → Cloudflare Pages.

## Puerta de publicación
No afirmar que hay URL funcional hasta comprobar: despliegue terminado con éxito, carga de `index.html`, recursos JavaScript/CSS, presencia de Miss ADPHOR, autenticación autorizada de vista previa, y prueba en navegador.

## Estado funcional
El Centro integrado es navegación y seguimiento de plazos de la bitácora. Reuniones, visitas, archivos multimedia, PQRS y calendario de la operación original todavía tienen dependencias de autorización/migración; los datos reales solo se podrán consultar desde rutas protegidas y autorizadas. No son datos de calendario confirmados. No se autorizan cierres, reportes o envíos automáticos de agentes.
