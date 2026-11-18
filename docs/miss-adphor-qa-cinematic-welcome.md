# Miss ADPHOR — bienvenida audiovisual QA Integral

Estado: **implementación aislada; NO desplegar sin video ni validación E2E**.

- Esta rama nace de QA Integral @ 239782257391eef645b7060901073a49f5506ca7.
- Aporta pantalla de bienvenida opt-in, controles de reproducción y omisión, y foto corporativa estática de respaldo.
- Feature flag **desactivado por defecto**: VITE_MISS_ADPHOR_WELCOME_ENABLED debe ser exactamente true.
- Solo se activa en qa-integral-claude-reviewed.adphor-platform.pages.dev.
- Falta subir el MP4 aprobado como public/assets/branding/miss-adphor-bienvenida-qa.mp4 (SHA256 3309c774fbd4ae1a31030f42a900529aea71f11682684a5c0bb819c5c88f95a7). NO activar flag mientras falte ese archivo.
- El retrato original public/assets/branding/miss-adphor-qa-integral(4).webp NO se modifica.
- No altera Supabase, MFA, login, PQRS, Calendar, Workers, Cloudflare ni producción.
- Antes de fusionar y habilitar: ejecutar npm ci, npm test, npm run build, E2E móvil con Chromium, verificar asset MP4 y funcionamiento de Access, Gate QA y autenticación.
- La rama está fuera del filtro de despliegue automático de Cloudflare Pages; solo se publica la rama QA Integral.
