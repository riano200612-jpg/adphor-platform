# Miss ADPHOR — Guardian V1: acompañamiento de extremo a extremo

Destino único: QA Integral \`qa/integral-claude-reviewed-20261111\`.
Esta entrega mejora exclusivamente la **guía en el chat existente**.
El usuario selecciona «Guía paso a paso» o solicita «Guíame en PQRS/visitas/etc.».
La guía utiliza solo el módulo, rol y copropiedad ya autorizados en la sesión
cliente; **nunca lee ni transmite contenido real ni datos de otras copropiedades**.

## Qué se implementa
- Recorridos deterministas para Resumen, Copropiedades, Bitácora, PQRS,
  Visitas, Recorridos, Agenda, Reuniones, Informes, Equipo, Usuarios y otros.
- Dos evaluadores de reglas separados: calidad (etapas, orden, controles)
  y seguridad (alcance, navegación, rol, ejecución y tenant).
  Cada uno comprueba pruebas del otro. Son verificadores deterministas, **no
  dos modelos de IA remotos**.
- Elige el camino más corto que mantenga las comprobaciones obligatorias;
  las rutas sensibles requieren un control adicional.
- Sin permisos certificados, módulo desconocido o cambio de copropiedad:
  la guía se bloquea; no emite enlaces externos ni comandos.
- La respuesta aclara que NO certifica una operación efectuada ni la
  actualización de datos reales. Los controles del backend siguen mandando.
- La sesión de demostración se identifica claramente.
- En UI solo añade el acceso rápido al chat existente, sin ventanas
  invasivas, recordatorios activos ni envío de datos a terceros.

## Antes de automatizar las operaciones reales
1. Certificar acceso Cloudflare Access, autenticación Supabase MFA AAL2
   y permisos por copropiedad.
2. Confirmar datos de PQRS, Visitas, reuniones y archivos en Storage QA;
   no reutilizar claves de producción ni modificar originales de José.
3. Habilitar integración del Worker privado **solo** con gates verificados.
4. Añadir evaluación con resultados de casos autorizados y etiquetados,
   auditoría por acción, límites y supervisión humana en acciones críticas.
5. No enviar correos, cerrar casos, modificar roles ni confirmar Google
   Calendar sin verificación explícita y permisos efectivos.

## Validación
\`node --test tests/miss-journey-guardian.test.js\`, seguido del workflow
Validate ADPHOR completo y Playwright. Publicar únicamente la rama QA
Integral tras PASS, y verificar el deployment exacto de Cloudflare Pages.

Esta versión no contiene modelos conectados, entrenamiento autónomo,
cron, escrituras, reglas Cloudflare nuevas, ni cambios en Supabase o producción.
