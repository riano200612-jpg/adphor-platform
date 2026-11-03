# ADPHOR QA — Auditoría adicional de fuentes recibidas, octubre 30 de 2026

## Nuevos originales comparados
- Interfaz HTML de Plataforma Reuniones: formulario, reloj, consulta de calendario, edición, confirmación, navegación y colores azul/dorado.
- MFA.gs: PIN+OTP vía hoja Delegados; duración 10 minutos, 3 intentos, reenvío y correo.
- Utilidades.gs: sincronización de fotos, normalización de duración, funciones de envío y mantenimiento de calendario.

## Incorporado en la rama QA
- Duración automática de reuniones: Asamblea 5 horas, Comité 3 horas, otras 4; duración manual acotada.
- Cálculo de hora final en el formulario QA cuando el campo Fin no está definido.
- Criterio de Google Meet: solo virtual/mixta confirmada, sin llamadas externas por ahora.
- Pruebas de estas reglas.

## Hallazgos de seguridad — NO ejecutar originales desde QA
1. `Utilidades.gs` contiene funciones que convierten archivos de Drive a visibilidad de cualquiera con el enlace; no trasladar ese cambio de permisos.
2. Contiene procedimiento que elimina eventos del calendario con simulación desactivada por defecto; debe excluirse y prohibirse la ejecución automática.
3. Contiene procedimientos que envían por correo PIN y mensajes de prueba; ningún envío hasta autorización explícita de la prueba con destinatarios definidos.
4. `MFA.gs` usa Math.random para OTP y almacena OTP en texto claro, compara hashes básicos y registra direcciones de correo en logs. Mantener autenticación MFA de proveedor gestionado; nunca importar este mecanismo literalmente.
5. Los originales exponen nombres y permisos de los delegados desde hojas; nuevo backend debe aplicar autorización de membresía y RLS actual por copropiedad.
6. `Index.html` carga scripts por CDN, permite acceso directo a funciones de Apps Script y utiliza un calendario embebido; preservar experiencia visual, no asumir autorización por UI.
7. La plantilla de correo HTML requiere escape de valores y URLs de Meet validadas antes de uso.
8. El correo de bloqueo y el correo de recordatorio son flujos diferentes. Ambos requieren política central de envío; QA solo prepara, nunca entrega.

## Pendiente de completar
- Vista de calendario corporativo basada en consultas autenticadas de Google Calendar y PostgreSQL QA (sin exponer eventos o identificadores a usuarios de otras copropiedades).
- Outbox de notificaciones de reunión con confirmaciones, destinatarios aprobados y worker independiente.
- Historial transaccional de ediciones, cancelaciones y permisos de Gerencia.
- Ingesta validada de documentos, fotos privadas y datos de copropiedades.
- Pruebas reales de autenticación/RLS en un proyecto aislado.

Originales de José conservados sin mutaciones, sin importar claves ni IDs privados a GitHub, sin llamadas GmailApp, DriveApp o CalendarApp.
