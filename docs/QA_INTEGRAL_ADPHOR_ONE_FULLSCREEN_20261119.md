# ADPHOR ONE · Inicio a pantalla completa — 19-11-2026

Origen de solicitud: en QA Integral el menú fijo duplicaba los círculos y reducía la legibilidad.

Alcance: presentación, no función. Ocultamos la columna fija únicamente donde está activo ADPHOR ONE; ampliamos el contenido; organizamos ocho círculos en cuadrícula 4×2 en escritorio y 2 columnas en móvil. Conservamos el selector de copropiedad, controles de sesión y Miss ADPHOR. Un menú discreto «Otras funciones» expone solo funciones adicionales en Inicio; dentro de un módulo aparece un botón «← Inicio» y un menú «Herramientas». Todas las rutas se copian exclusivamente de la navegación filtrada del usuario y continúan usando el handler original `data-page`.

Seguridad: ninguna autenticación, permisos, RLS, MFA, backend, calendario ni datos originales modificados. La barra original sigue como fuente oculta de rutas autorizadas; no se puede desplegar esta capa fuera del alias QA Integral y sus previews de commit.

Respaldo exacto anterior: `backup/qa-integral-before-clean-home-20261119` → `80b777264937e86a30400e8094c2e574415c202d`.

Pruebas obligatorias: JS, Python, compilación Pages, E2E escritorio/móvil, WCAG automatizado, revisiones de origen y Deploy QA Integral. No cambios en otros proyectos.
