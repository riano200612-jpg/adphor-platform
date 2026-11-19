# ADPHOR ONE · QA Integral · primera capa visual (2026-11-19)

## Destino único
- Hostname: `qa-integral-claude-reviewed.adphor-platform.pages.dev`
- Branch de integración: `qa/integral-claude-reviewed-20261111`
- Commit de respaldo antes del cambio: `0c950476ea4e7f384f7cb7c4174318ef5640336f`
- Rama de restauración: `backup/qa-integral-before-adphor-one-20261119`

## Alcance
- Capa visual adicional para el dashboard autenticado: accesos circulares premium con colores ADPHOR.
- No reemplaza ni reimplementa ninguna función de Calendario, PQRS, Visitas, Reuniones, Directorio, Informes ni agentes.
- Reutiliza los `data-page` existentes y solamente expone módulos presentes en la navegación generada tras verificación de permisos.
- Los módulos y la bitácora permanecen sin cambios. Los mensajes dinámicos de reuniones y PQRS siguen actualizándose en sus tarjetas originales.
- El módulo queda desactivado fuera del alias QA Integral y sus URL de Preview inmutables.
- Interfaz adaptable a móvil y `prefers-reduced-motion`.

## Archivos
- Añadidos: `src/js/ui-adphor-one.js`, `src/css/adphor-one.css`, `tests/adphor-one-ui.test.js`
- `index.html`: solo 2 referencias estáticas aditivas y un comentario; sin cambios en la entrada de la app original.
- Ningún archivo de José, datos originales, backend, flujo IAM, MFA, RLS, calendario real, PQRS o producción se toca.

## Gate previo a integración y publicación
1. PR exclusivo hacia la rama QA Integral; Cloudflare preview branches solo permite dicha rama, no esta rama de validación.
2. `npm ci`, `npm test`, `npm run build`, E2E Playwright y checks de seguridad de GitHub: PASS.
3. Revisión del diff: cero cambios funcionales en el núcleo y cero archivos originales del cliente.
4. Tras la integración y el despliegue automático a QA Integral, validar alias Access (anónimo/permitido/denegado), rutas circulares y estados reales sin efectuar escrituras.
5. Si falla alguna prueba, no fusionar y conservar backup.

## Recuperación
Restaurar el commit `0c950476...` desde la rama backup de GitHub mediante PR/revert controlado, no forzar refs ni modificar producción. Cloudflare mantiene el deployment anterior identificable por ID `70f51d51-a8cf-4c2d-a36c-7993f00d7d63`.
