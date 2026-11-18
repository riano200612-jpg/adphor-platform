# Miss ADPHOR — bienvenida audiovisual QA Integral

Estado: **video incluido e identidad validada; pendiente CI final y verificación QA live**.

- Esta rama nace de QA Integral @ 239782257391eef645b7060901073a49f5506ca7.
- Aporta pantalla de bienvenida opt-in, controles de reproducción y omisión, y foto corporativa estática de respaldo.
- El componente se ofrece **solo** en hostname QA Integral (sin bloqueo de login). Variable opcional VITE_MISS_ADPHOR_WELCOME_ENABLED=false lo desactiva sin modificar el código.
- Solo se activa en qa-integral-claude-reviewed.adphor-platform.pages.dev.
- MP4 aprobado incorporado: public/assets/branding/miss-adphor-bienvenida-qa.mp4. SHA256 3309c774fbd4ae1a31030f42a900529aea71f11682684a5c0bb819c5c88f95a7; Git blob 210f5660144d7e752c4be5baba38df347977d619.
- El retrato original public/assets/branding/miss-adphor-qa-integral(4).webp NO se modifica.
- No altera Supabase, MFA, login, PQRS, Calendar, Workers, Cloudflare ni producción.
- Antes de fusionar: ejecutar npm ci, npm test, npm run build, E2E Chromium; verificar asset MP4, hostname QA y Access. El usuario debe pulsar Escuchar bienvenida para iniciar audio (sin autoplay).
- La rama está fuera del filtro de despliegue automático de Cloudflare Pages; solo se publica la rama QA Integral.
