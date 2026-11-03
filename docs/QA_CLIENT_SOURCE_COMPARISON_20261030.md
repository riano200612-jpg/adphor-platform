# Comparación del código fuente ADPHOR recibido — 30 octubre 2026

## Fuentes revisadas
- `Calendario.gs` facilitado en el chat: funciones `getCalendarId`, `obtenerEventosCalendario`, `crearEvento`, `actualizarEvento`, `eliminarEvento`, reglas de color y Google Meet.
- `Gestión de Correos — ADPHOR` (HTML adjunto, 684 líneas): registro, verificación y revocación de correos autorizados; unidad, solicitante, email; gestiona solicitudes como PQRS.
- `Portal Comunidad — ADPHOR` (HTML adjunto, 2973 líneas): ingreso por correo autorizado, navegación PQRS, reservas comunitarias por unidad y horario, comprobante y consultas.

## Compatibilidad y diferencias
- Reuniones QA: ya permitía agenda local, prioridades y sugerencia gerencial; ahora adopta clasificación visible de tipo (Consejo, Asamblea, Comité, Gerencia), subtipo, modalidad y delegado. El módulo `client-meeting-mapping.js` conserva la nomenclatura, color y parsing de horarios de origen, sin copiar identificadores privados.
- PQRS QA: torre, apartamento y nombre de solicitante están disponibles solo en demo local. El archivo de Gestión de Correos evidencia un flujo adicional no implementado todavía en backend: petición para alta, verificación o revocación de correo autorizado con verificación de titularidad y autorización humana.
- Portal Comunidad: muestra flujo de ingreso, radicación, consulta de PQRS y reservas comunitarias con teléfono y unidad; estas reservas **no equivalen a reuniones gerenciales** y requieren entidad propia, políticas y horarios distintos.

## Riesgos de origen identificados
1. `actualizarEvento` borra el evento original antes de comprobar que la recreación y el registro en Sheets funcionen: riesgo de pérdida. Nunca trasladar esta secuencia; actualizar de manera atómica o con compensación.
2. `crearEvento` escribe Calendar antes de guardar Sheets: si falla Sheets queda un evento huérfano. PostgreSQL debe registrar operación y outbox primero y el sincronizador resolver el estado con idempotencia.
3. `FORZAR_PERMISOS_CALENDARIO` crea un evento real de prueba; queda **excluido**. No ejecutar operaciones para forzar permisos.
4. `parseFechaHoraCompleta` interpreta mal horas de 24h con formato 13:00 (las convierte a 1:00). Sustituido por parser validado en la copia QA.
5. La creación de Google Meet utiliza un ID aleatorio no criptográfico y silenciosamente ignora errores; usar solicitud idempotente y registrar error recuperable.
6. La llamada `sendInvites:false` en la creación original no constituye una garantía global de ausencia de notificaciones; la integración no ejecutará llamadas a Calendar hasta que se autoricen.
7. Gestión de Correos tiene una copropiedad fija en su HTML; en la aplicación unificada debe derivarse de la propiedad realmente autorizada y nunca de una cadena fija o de `sessionStorage` como autoridad.
8. Portal Comunidad contiene contenido de demostración, enlaces externos y `sessionStorage`; no trasladar sesiones ni datos personales directamente a GitHub.

## Siguiente ejecución técnica bloqueada
- Migrar la lógica de alta/verificación/revocación de correo a un flujo autenticado que guarde peticiones con estado y aprobación, sin enviar notificaciones hasta visto bueno.
- Implementar reuniones transaccionales + outbox en PostgreSQL QA aislado y sync por Google Calendar bajo consentimiento/credenciales gestionadas; validar RLS, conflictos concurrentes, citas sin 24h y rollback.
- Integrar reservas comunitarias como módulo distinto y asignación correcta a unidad/copropiedad.
- No modificar Apps Script original, cuentas de José, `main` ni datos productivos; no cargar los HTML íntegros sin retirar identificadores y material sensible.
