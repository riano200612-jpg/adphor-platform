# ADPHOR · Reuniones — preflight seguro de QA Integral

Estado: QA_TEST_PREFLIGHT_ONLY. No existe reserva automática certificada, ni está habilitada la creación de eventos desde ADPHOR.

## Archivos y alcance

Este incremento incorpora solo archivos nuevos. No modifica ni reemplaza los originales de José, Calendario.gs, Master_ADPHOR, Google Calendar, invitados, Meet, secretos, IAM, Supabase ni producción.

- src/js/services/qa-booking-preflight.js: contrato puro, no invocado, para una futura integración backend. Valida campos, fecha y zona Colombia, límites de 15 minutos a 12 horas, antelación de 24 horas y horizonte de 90 días. Requiere una afirmación de servidor ya verificada de Auth/MFA AAL2/membresía por copropiedad, y un calendario de prueba distinto al original con escritura desactivada. Exige respuesta Google FreeBusy, revisa 30 minutos de margen e incorpora una huella SHA-256 estable de solicitud por usuario/propiedad. Siempre devuelve booking_authorized=false, event_created=false, invites_sent=false y meet_created=false.
- tests/qa-booking-preflight.test.js: siete pruebas adversarias locales, con casos de rol, AAL1, tenant diferente, fallos de Google, tiempos incorrectos y conflicto de horario.

El campo actor es una afirmación **exclusiva del backend**; NO se puede recibir desde el navegador ni se utiliza aquí para conceder un permiso de escritura. El módulo no realiza llamadas a Google, no tiene tokens ni acceso a bases de datos.

## Para certificación real

1. Configurar OAuth independiente en servidor QA, con consentimiento corporativo; el conector Calendar de ChatGPT no proporciona tokens al backend.
2. Aprovisionar un calendario de prueba independiente: prohibido escribir en Reuniones de José durante esta fase.
3. Implementar endpoint backend con Auth y RLS efectivos, serialización y bloqueo de horarios, idempotencia persistente, bitácora, conciliación del evento Google y manejo de errores parciales.
4. Verificar con usuarios de prueba MFA AAL2, invitaciones consentidas y Meet cuando corresponda, incluyendo regresiones de concurrencia. Solo entonces solicitar autorización para un piloto sobre calendario corporativo.
5. Exigir CI (Node/Python/build/Chromium), SHA, Cloudflare Access y deployment QA Integral antes de fusionar y publicar.

No declarar BOOKING_QA_CERTIFIED por el éxito de una validación preliminar. Un resultado de FreeBusy no equivale a una reserva.
