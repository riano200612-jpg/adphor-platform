# ADPHOR ONE · Proporciones visuales · QA Integral · 2026-11-19

Solicitud: equilibrar todas las opciones circulares en la pantalla integral y reducir el video de bienvenida de Miss ADPHOR en escritorio para que el formulario tenga espacio suficiente.

Destino único: qa-integral-claude-reviewed.adphor-platform.pages.dev; rama qa/integral-claude-reviewed-20261111.

Respaldo previo exacto: backup/qa-integral-before-proportions-20261119 → 56f262081a3e83bd20cb18e085364c54f4eda37d.

Cambios:
- Pantalla inicial con filas centradas y círculos de diámetro máximo ~78px, tarjetas del mismo ancho y alto, separaciones constantes y cuatro grupos con superficies discretas.
- Distribución equilibrada: seis accesos de Gestión diaria y seis de Operación y seguimiento; Equipo e inteligencia y Administración y control centrados, según permisos y flags realmente habilitados.
- Escritorio bienvenida: proporción panel de Miss ADPHOR / panel de acceso aproximada 46/54 en ancho; retrato de máximo ~228px y no más del 49% de la altura de la ventana. Formulario original intacto y más prominente; tabletas adaptadas. Móvil ≤580px conserva el diseño y las pruebas anteriores.
- Cambio de presentación únicamente en CSS de QA e identificación de grupo en la capa UI; los enlaces y permisos siguen derivados del menú real autorizado.

Sin cambios en video original, imagen original de José, datos, formularios, login/MFA, Access, RLS, Supabase, Workers o producción. Sin escribir datos reales.

Validar JavaScript, Python, build, E2E de 1440/1200/820/390px, a11y y permisos antes de squash PR al único alias de QA Integral.
