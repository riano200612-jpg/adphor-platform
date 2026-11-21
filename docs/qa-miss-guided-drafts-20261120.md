# Miss ADPHOR · Trámites guiados y borradores locales (QA Integral)

Fecha: 20 de noviembre de 2026, Colombia. Origen: `qa/integral-claude-reviewed-20261111` en el repositorio original. **No incluye la biblioteca documental en ejecución**.

## Alcance separado del PR documental #167
- Interfaz móvil de Miss ADPHOR: cinco rutas permitidas (PQRS, visitas, novedades, reuniones, informes) que abren **formularios preexistentes**, nunca endpoints nuevos con privilegios.
- Los botones se ofrecen solo al usuario QA conectado con copropiedad seleccionada; las rutas de administración se ocultan a visor y técnico cuando corresponda.
- La pregunta «Radicar una PQRS por ...» admite **borrador local y editable**. Solo utiliza el texto explícito posterior a «por», «sobre» o «:», hasta 240 caracteres, como asunto y descripción; no inventa fecha, destinatario, prioridad, identidad ni hechos.
- El borrador se transporta dentro del navegador a `#pqrs-create-form`, **sin guardarlo**. Solo se aplica si usuario, copropiedad y rol actuales coinciden exactamente con la solicitud que lo originó. El usuario revisa y confirma mediante el módulo normal, que conserva MFA, RLS, validaciones y adjuntos.
- Consultas rápidas plegadas; chat móvil con tamaño adaptativo sin alterar el resto del diseño. La asistente sigue usando reglas de orientación y lecturas ya autorizadas; **no es un modelo de IA generativa entrenado**.
- Documentos: solo aparece «Documentos · pendiente». La carga binaria desde Miss ADPHOR sigue bloqueada hasta el gate antimalware, MFA AAL2 de dos usuarios independientes y prueba de Storage bajo Access del PR #167.
- Sin operaciones automáticas, aprobación, envío, cierre, cambios en producción ni documentos originales. No se agregan tablas, variables, secretos, permisos o OAuth.

## Condición para publicar en la única QA
1. CI completo de JS, Python, build, Pages Functions y Chromium: PASS sobre el SHA de este PR.
2. Revisión del diff: **solamente** interfaz de Miss, reglas de navegación, CSS responsivo, pruebas y documentación. No adjuntos, migraciones ni cambios de identidad.
3. Verificar preview oficial protegido por Access y comparar Deployment ID, SHA y alias tras el despliegue aprobado.
4. No presentar como «IA autónoma»: el usuario debe confirmar cada formulario y los datos se limitan a la copropiedad activa.

## Vías siguientes, sin habilitar todavía
- PR #167: verificación real de dos sesiones MFA AAL2 por edificio, motor de inspección antimalware, cuota por usuario, sanitización de formatos Office/PDF, auditoría de archivos y aprobación humana.
- API segura para ejecutores con permisos mínimos y RAG documental por copropiedad, registro de fuente/versión, revisión Guardian de calidad y seguridad y evaluación adversaria antes de informes derivados.
