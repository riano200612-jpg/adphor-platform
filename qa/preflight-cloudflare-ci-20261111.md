# Preflight Cloudflare y CI/CD — rama `qa/integral-claude-reviewed-20261111`

Análisis estático de los workflows y de `qa/integration-target.json` en el SHA `36c1f480c998a1624c73df9f6525d1ce41ba4771`. No se consultó ni modificó ningún panel de Cloudflare.

| Control | Estado | Notas |
|---|---|---|
| Push de CI sobre la rama vigente | No dispara | `checks.yml` solo escucha `main` y la rama anterior |
| Publicación automática QA | Desactivada para la rama vigente | `deploy-approved-qa` exige la rama anterior |
| Publicación de producción | Sin cambios | `deploy.yml` solo `main` |
| Target de integración | Apunta a rama y hostname anteriores | Pendiente de evidencia administrativa |
| Marcador `[CF-Pages-Skip]` | No leído por workflows | Verificar comportamiento en Cloudflare |
| Flag de Access verificado | Apagado | No activar sin certificación real |
| Flag de visitas SQL | `false` | Sin cambios |
| Flag de alias demo | `false` por defecto | Sin cambios |
