# QA Integral · Acceso vertical Miss ADPHOR · 19 de noviembre de 2026

**Problema:** El usuario mostró en PC (1366×768) un video de bienvenida aislado en una columna izquierda y un panel de credenciales desproporcionado a la derecha. Se solicita una composición única, centrada y vertical: video arriba, credenciales debajo.

**Destino único:** `qa/integral-claude-reviewed-20261111` → `qa-integral-claude-reviewed.adphor-platform.pages.dev`.

**Respaldo previo:** `backup/qa-integral-before-stacked-login-20261119` → `3f881c24f7842b56d40efcfd589d22b24515dc3d`.

**Cambio:** exclusivamente un bloque CSS en `src/css/miss-adphor-welcome.css`, activado para `.miss-welcome-cover` desde 581px. El marco de video queda arriba y centrado en una cabecera azul marino con marca ADPHOR; el mismo formulario real se muestra debajo en tarjeta blanca del mismo ancho. Marco 9:16 con tamaño máximo 112px de ancho y aprox. 200px de alto; controles sonoros de 44px. En ventanas bajas cabe mediante scroll vertical normal, nunca ocultando ni superponiendo campos. El CSS móvil <=580px se conserva.

**Sin cambios:** reproductor JS, MP4 e imagen originales, HTML de formularios, credenciales, autenticación, MFA/AAL2, recuperación de contraseña, Cloudflare Access, datos, Supabase, producción ni otras QA.

**Pruebas de proporción:** Chromium a 1440×900, 1366×768, 1200×800, 1024×768, 820×768 y 760×620; orden vertical, centrado, tamaño, campos visibles, sonido y ausencia de scroll horizontal. Se conserva test de móvil, JavaScript, Python y build. Publicación únicamente tras PASS y squash único.
