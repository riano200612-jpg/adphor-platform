# ADPHOR PQRS · Barrera transaccional de envío — QA Integral
Fecha: 18 de noviembre de 2026.

## Instalación y evidencia
- Supabase QA `qfctnnnnltghepwujpdm`, migración real aplicada `adphor_pqrs_qa_outbox_delivery_gate_20261118`.
- PostgreSQL 17.11: pruebas de una PQRS sintética y notificación `BLOCKED` con historial y 3 ataques rechazados: transición prematura, recibo de proveedor falsificado y asignación de correo a registro bloqueado.
- Pruebas ejecutadas antes y después de la migración. Todas mediante `BEGIN/ROLLBACK`; nada sintético persistió.
- Modo global de entrega: OFF / proveedor UNCONFIGURED. La tabla privada permite únicamente lectura al service_role, no activación.
- El envío futuro exige: ruta aprobada de la misma propiedad, correo idéntico al candidato, coincidencia entre las fuentes, revisión aprobada por persona diferente a quien la solicitó, versión de conciliación sin cambios, y transiciones de estado permitidas.
- Un supuesto recibo `SENT` además requiere comprobante de proveedor y al menos un intento.
- Auditoría privada: registra creaciones y transiciones de estado **confirmadas**. Los intentos que lanzan excepciones son revertidos y no quedan registrados en la tabla (deben auditarse por logs del backend si se desea su registro).
- Es una defensa en profundidad, NO un servicio de correo, ni prueba de entrega real.
- No afecta el PQRS original de Apps Script, las hojas de José, calendario, fotos ni producción.

## Pendientes antes de correo real
- Aprobaciones formales independientes de los destinatarios. Estado actual: 0 rutas aprobadas de 43 copropiedades, 7 diferencias/ausencias.
- Integrar el servicio emisor con secretos privados y prueba de recibo; gestionar errores y reintentos.
- Probar rutas de recepción de extremo a extremo en sesión autenticada de QA.
- Autorización expresa del propietario para activar la barrera global.
