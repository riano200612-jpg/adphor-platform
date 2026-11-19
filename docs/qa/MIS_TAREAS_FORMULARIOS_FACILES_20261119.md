# ADPHOR QA Integral — Formularios fáciles y áreas (19 noviembre de 2026)

## Diagnóstico real
En Supabase QA, **las 43 copropiedades tienen `projects.areas=[]`**. El formulario de «Mis tareas» genera el menú directamente a partir de esos valores, mientras `ticket_command` valida contra esa misma columna. Un desplegable inventado solamente en la pantalla no permitiría guardar: se requiere corregir los datos exclusivos de QA.

## Cambio
- Migración con guardias QA que rellena **solo** los conjuntos `areas=[]` con nueve categorías comunes y comprensibles; no reemplaza ningún catálogo ya definido.
- Se mantiene la validación en servidor para áreas, responsables, roles y fechas; no se eleva ningún permiso ni se crean tareas de prueba reales.
- Formulario «Registrar novedad» organizado en dos bloques: «¿Qué sucedió?» y «¿Quién lo atiende y para cuándo?». Controles grandes, textos explicativos, fotografías plegables y opcionales, prioridad Media y fecha límite de hoy visibles. El responsable inicial es la propia persona cuando tiene permiso.
- El formulario señala directamente el campo inválido sin borrar los valores; no muestra éxito si falla la escritura.
- La clase de estilos `adphor-simple-form` se reutiliza para acceso, actualización de novedades y propuestas recurrentes; los pasos específicos y permisos no se alteran.
- Las áreas son **provisionales**: José podrá confirmar/reemplazar la taxonomía por copropiedad posteriormente en un incremento auditado.

## Pruebas
JavaScript con controles de tenants, XSS y roles; PGlite comprueba migración idempotente y preservación de áreas existentes; Chromium valida formulario, móvil, error sin pérdida de información, usuario técnico y usuario de consulta.
**Las pruebas de navegador son sintéticas**: una sesión empresarial real MFA AAL2 de usuario autorizado requiere un navegador conectado a esta conversación o Work para el ensayo visual; nunca se solicita compartir claves.
No modificar originales de José ni Google Calendar ni producción. Único destino de publicación: QA Integral.
