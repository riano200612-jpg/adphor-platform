# ADPHOR QA Integral — preparación de pruebas del sábado 21 de noviembre de 2026

Fuentes: reunión del 18 de noviembre (matriz R02–R17); exclusión expresa de la migración de Google Calendar hasta el sábado por el cliente.

## P0 incorporado
- R04: control de **10 minutos de inactividad** para sesión QA autenticada. Marca local por pestaña conservada entre recargas; comprueba la inactividad en navegación, escritura, foco y al volver de pestaña oculta; al vencer borra la interfaz protegida y llama al sign-out de Supabase. **Es cierre de sesión de la aplicación**, no prueba de que se revoque instantáneamente un JWT ya expedido.
- Formularios: PQRS muestra tipo, asunto, descripción; torre, apartamento y solicitante solo si se desean. Si no hay servicio de almacenamiento privado, el botón para adjuntar no promete una carga imposible; radicación sin archivos sigue disponible. El botón no confirma hasta tener radicado.
- Visitas: motivos sugeridos, instrucciones explícitas para revisar/confirmar, control de lectura sin escritura; mantiene el contrato SQL, responsable por copropiedad y seguimiento.
- Alta y administración de usuarios: controles visuales y tipografía legible, sin cambiar operaciones IAM, confirmaciones ni permisos.
- Todas las nuevas ayudas son web móvil, sin emular calendario ni alterar archivos del cliente.

## Estado operacional y límites previos a pruebas reales
- Mantenimiento: servidor `ticket_command` con área validada contra cada copropiedad y rol. En Supabase QA hay 43 copropiedades con nueve áreas temporales; **cero novedades reales creadas en este trabajo**.
- Visitas: flags QA de SQL, ciclo de vida y evidencias están habilitados, pero los navegadores de CI son sintéticos. Una visita real requiere usuario administrador/coordinador con MFA AAL2, copropiedad autorizada y confirmación explícita.
- PQRS: radicación nativa QA puede guardarse en Postgres según permisos; entrega a cada encargado por correo **NO certificada** hasta aprobar rutas de destinatario. Adjuntos PQRS dependen del servicio privado.
- IAM: todavía falta comprobar con cuentas humanas nuevas el ciclo completo invitación → primer ingreso → MFA → alcance de rol. No se crean invitaciones masivas.
- R05: limitación de tres intentos de acceso con enfriamiento **no está certificada en servidor**; no simular un bloqueo de frontend como seguridad real.
- Calendario Google: **en espera del cliente el sábado 21 de noviembre**; los originales no se tocan y no se declaran reuniones confirmadas.
- Se mantiene una sola QA Integral y el repositorio GitHub. Producción y los archivos originales de José permanecen intactos.

## Pruebas de aceptación humana para sábado
Usar únicamente personas y copropiedades autorizadas: 1) iniciar sesión y completar MFA AAL2; 2) guardar novedad sintética de QA con área y responsable, recargar, actualizar, adjuntar evidencia y verificar cierre; 3) PQRS sin adjuntos con radicado, historial y aislamiento; 4) Visita con responsable, revisión, confirmación, seguimiento y archivos de prueba; 5) verificar cuenta lectora sin permisos de edición; 6) dejar una sesión sin actividad 10 minutos y comprobar regreso al login; 7) documento separado para incidencias. El calendario queda fuera de las pruebas de escritura.

Ninguna prueba de CI sustituye la certificación de una sesión real de la empresa. Si la interfaz solicita credenciales, usar solamente la página oficial; no enviar contraseñas ni códigos MFA al chat.
