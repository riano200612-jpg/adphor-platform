# ADPHOR ONE · Menú integral circular · QA Integral · 19/11/2026

**Solicitud:** ninguna función oculta en menús desplegables; todos los accesos deben aparecer en círculos en Inicio, con distribución adaptativa a cada cuenta.

**Destino:** únicamente `qa-integral-claude-reviewed.adphor-platform.pages.dev` (Cloudflare Pages `adphor-platform`, preview branch `qa/integral-claude-reviewed-20261111`).

**Respaldo:** `backup/qa-integral-before-complete-circles-20261119` → commit `507d5becc67e6013c740e1f5b227cc6fb900622f`.

**Implementación:** capa visual aislada `src/js/ui-adphor-one.js` y `src/css/adphor-one.css`. Reúne automáticamente **todas** las entradas `button[data-page]` que el menú autorizado original genera, incluyendo nuevas funcionalidades futuras, y las muestra en círculos visibles agrupados. Etiquetas de los 18 módulos actuales y estilos corporativos. Se preservan botones y los contadores dinámicos ya existentes. Se mantiene botón «← Inicio» dentro de módulos. Ningún enlace «Otras funciones» o menú lateral fijo.

**Seguridad:** los módulos corporativos `qa-source` y `access-audit` aparecen solamente si la navegación original los habilita después de verificar `corporateAdmin` por IAM; los controles de backend/RLS/AAL2 siguen obligatorios. El código NO transforma la identidad de José ni de otra persona en administrador ni concede privilegios a partir de correos/nombres. Demo sin privilegios es una prueba UI, no certifica una cuenta real.

**No se modifica:** fuente de la aplicación, backend, archivos originales de José, datos ni calendarios reales, permisos, Cloudflare Access, Supabase, producción u otras plataformas.

**Gate:** `npm ci`, `npm test`, `npm run build`, Playwright Chromium E2E, WCAG automated, permisos y aislamiento. Tras QA PASS, squash merge único a la rama integral; comprobar SHA/alias/Deployment ID y acciones posteriores.
