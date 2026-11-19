# QA Integral — Pantalla de acceso equilibrada en dos columnas · 2026-11-19

**Decisión del cliente:** recuperar el concepto inicial de Miss ADPHOR a la izquierda y credenciales a la derecha, con video de tamaño MEDIO, nunca gigantesco ni diminuto. Los paneles deben estar proporcionados en altura, tipografía y márgenes.

**Implementación:** únicamente CSS de `src/css/miss-adphor-welcome.css`, aplicado por la clase QA restringida al hostname `qa-integral-claude-reviewed.adphor-platform.pages.dev`. Se reemplaza el bloque de escritorio vertical anterior, **sin acumular overrides**. En escritorios desde 840px: composición centrada de máximo 1100px, proporción 44% presentación / 56% credenciales, dos tarjetas con altura alineada y separación 15–23px. Video existente vertical 9:16, tamaño de ~145–190px de ancho según altura visible y hasta 45% de viewport. Se mantienen logotipo, botón de audio, formulario real, botón de ingreso y enlaces de recuperación. En 581–839px la interfaz se apila para evitar formularios comprimidos; <=580px se mantiene sin modificaciones.

**Copia de recuperación:** rama `backup/qa-integral-before-balanced-split-login-20261119` → commit `6019362e88dd1b2e0864db509503a347b0fd9f73`.

**Límites:** no modificar fotografías/videos originales, `src/js/app.js`, autenticación, MFA/AAL2, Cloudflare Access, Supabase, credenciales, Google Calendar, producción ni otros ambientes. Un solo deployment permitido a la rama `qa/integral-claude-reviewed-20261111`.

**Gate:** JavaScript/Python/Pages build, Playwright en escritorio (1440x900, 1366x768, 1200x800, 1024x768, 920x700, 840x620), tablet (820x768, 760x620, 600x800), móvil (390x844), WCAG, y post-deploy verificación del SHA y alias. No certifica credenciales reales.
