# ADPHOR QA Integral — Acceso simétrico Miss ADPHOR — 19/11/2026

**Referencia visual aportada por el cliente:** captura de PC con cabecera sobredimensionada, logotipo a la izquierda y video pequeño separado del eje de un formulario mucho más ancho. El usuario pide un diseño armónico y distribuido uniformemente.

**Solución:** única tarjeta centrada (ancho máximo 530px) y compuesta verticalmente por cabecera azul marino con logotipo centrado y video Miss ADPHOR centrado debajo; bloque blanco de credenciales alineado en el mismo eje y ancho. Separaciones controladas; video original 9:16 de hasta 100px de ancho; controles de sonido y campos originales intactos. Alturas bajas admiten scroll vertical normal, nunca horizontal. Para móvil (<=580px), conservar el diseño y estilos anteriores.

**Cambio técnico mínimo:** reemplazar las reglas CSS de escritorio anteriores en `src/css/miss-adphor-welcome.css`, evitando acumular sobreescrituras. Sin tocar `src/js/app.js`, `src/js/ui-miss-adphor-welcome.js`, reproductor, video MP4, fotografía, autenticación, recuperación de contraseña, MFA, Access ni datos originales.

**Destino exclusivo:** Cloudflare Pages `adphor-platform`, rama `qa/integral-claude-reviewed-20261111` y alias `qa-integral-claude-reviewed.adphor-platform.pages.dev`. No QA histórica ni producción.

**Respaldo previo:** `backup/qa-integral-before-symmetric-login-20261119` → `300d7215baf9d71544f0651dc8a0559150d6d816`.

**Gate:** JavaScript, Python, Vite/Pages, E2E 1440x900 / 1366x768 / 1200x800 / 1024x768 / 820x768 / 760x620, accesibilidad WCAG y regresión móvil. Squash único y comprobación posterior del deployment SHA/alias/CI.
