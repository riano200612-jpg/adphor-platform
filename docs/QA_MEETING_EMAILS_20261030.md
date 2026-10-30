# ADPHOR QA — correos de reuniones y recordatorios

Se conserva la funcionalidad de **notificaciones automáticas programables** para reuniones: creación, cambios, cancelación y recordatorios.

- **Propietarios:** solamente destinatarios de la copropiedad autorizada que hayan habilitado notificaciones.
- **Administradores:** responsables autorizados de esa copropiedad.
- **Gerencia:** exclusivamente reuniones marcadas con participación o intervención gerencial.
- Se recomienda un primer recordatorio 24 horas antes; anticipación configurable y revisable.
- En QA se pueden generar y examinar los planes, pero su estado permanece `pending_approval`; el envío efectivo no está conectado ni habilitado. No enviar avisos reales de prueba sin confirmar explícitamente destinatarios, contenido, alcance y autorización de entrega.
- Alertas de **bloqueo de acceso**: registradas como incidentes, **sin correo automático** durante QA. No confundirlas con recordatorios de reuniones.
- El worker de envíos deberá verificar membresía actual, deduplicación e idempotencia, cancelación/reprogramación, consentimiento y estado de aprobación antes de cada entrega. No basta el código del navegador.
- No se modificó Google Calendar original ni se emitió ningún correo.

**Implementado:** `backend/src/adphor_ai/meeting_notifications.py` y sus pruebas. **Pendiente:** almacenar cola de salida con RLS en PostgreSQL QA, worker real verificado, panel de aprobación y pruebas con destinatarios autorizados.
