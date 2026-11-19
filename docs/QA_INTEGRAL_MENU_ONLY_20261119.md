# ADPHOR ONE — Solo menú en Inicio (QA Integral) · 2026-11-19

**Motivo:** El cliente solicita que al seleccionar su copropiedad encuentre únicamente los círculos de opciones, sin el bloque “Todo tu mantenimiento”, el panorama, las cuatro métricas, la trazabilidad y las últimas novedades.

**Rama y alias únicos:** `qa/integral-claude-reviewed-20261111`, `qa-integral-claude-reviewed.adphor-platform.pages.dev`.

**Respaldo:** `backup/qa-integral-before-menu-only-20261119`, commit `72e110464180ae5ea5eceab0d06a01b346162d01`.

**Implementación:** Capa QA Integral `src/js/ui-adphor-one.js`: el dashboard se reduce, en el DOM del navegador, a un encabezado compacto «¿Qué deseas gestionar?» y el catálogo circular autorizado; el código original `src/js/app.js` permanece sin cambios y los datos no se borran. Se elimina el círculo «Resumen», puesto que Inicio ya se alcanza desde el logotipo superior y «← Inicio». Bitácora, Informes y Centro integrado permanecen como herramientas independientes. Las funciones ocultas por permisos siguen ocultas.

**No se modifica:** fuentes de José, datos originales, SQL, Supabase, IAM/MFA/AAL2, Cloudflare Access, calendario real, audio/video, Worker, producción u otras plataformas.

**Gate:** pruebas unitarias y E2E de menú, acceso por copropiedad, ausencia de resumen, navegación a Reuniones y Visitas, 390px/1440px, accesibilidad y compilación, squash único; tras deploy, comprobar SHA, alias y run GitHub Actions.
