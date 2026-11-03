# ADPHOR — contrato obligatorio de plataforma única (QA)

## Decisión de producto
**La plataforma del cliente entregada por José Guzmán Castilla es la referencia funcional y visual.** ADPHOR Platform y sus mejoras premium se integrarán como evolución de esa plataforma; no se presentarán dos portales distintos ni se reemplazarán procesos útiles por demos sin equivalencia.

La interfaz de referencia accesible es el login de Portal Team ADPHOR (azul ADPHOR, dorado, lema, Miss ADPHOR y formulario Usuario/PIN). Su acceso interno requiere autenticación; no está auditado por navegador y no se afirma identidad visual exacta para pantallas protegidas. El ingreso nuevo debe conservar el lenguaje visual y recorridos del cliente, con seguridad gestionada: no reutilizar PIN incrustados ni mecanismos débiles.

## Fuentes originales — inmutables
- Apps Script Portal ADPHOR y Plataforma Reuniones, sus archivos .gs y .html recuperados con clasp.
- Drive Proyecto ADPHOR y Portal ADPHOR, incluidos `99_BACKUPS`, archivos de operación, fotografías, audios, videos, PDF y hojas maestras.
- Respaldo `20260219_Plataforma_Running.zip`: seis archivos de reunión extraídos y comparados.
- Las carpetas originales de José, Apps Script de origen, tablas y cuentas productivas **no se modifican**.

## Un solo modelo de producto
1. **Identidad y roles:** administración, delegados, Gerencia, propietarios/residentes autorizados; sin permitir acceso global por `isAdmin` enviado desde navegador.
2. **Copropiedades:** catálogo y fichas de propiedades, torres, apartamentos/unidades, responsables y metadatos; mapeo aprobado de ID Sheet a `public.projects.id`.
3. **Reuniones:** agendas y estados, anticolisión, 24 horas, excepciones gerenciales, participantes, historial, Meet y notificaciones tras autorización.
4. **PQRS:** radicación con torre, unidad, solicitante, adjuntos privados, seguimiento, evidencia y cierre humano.
5. **Comunidad:** reservas de zonas comunes separadas de reuniones gerenciales, solicitudes de acceso y correo autorizado.
6. **Operación:** mantenimiento, tareas y bitácora.
7. **Enjambre:** solo datos aprobados de su copropiedad, resultados reproducibles y aprobación humana.
8. **Informes:** métricas reales diferenciadas de demo, exportación y reportes gerenciales.

## Contrato de migración de datos reales
- **Código saneado a GitHub QA; datos personales fuera de GitHub**.
- Inventariar cada fuente con ruta y tipo, identificador, hash, fecha de revisión y propietario de datos.
- Relacionar cada fila/adjunto con copropiedad y, si corresponde, unidad y sujeto autenticado. No inferir pertenencia sin verificación.
- Importar primero a PostgreSQL QA aislado, con RLS por identidad; Storage privado para multimedia. Nunca realizar importación directa a producción.
- Mostrar conteos de origen/importado/rechazado y conciliación, además de idempotencia, deduplicación y plan de reversión.
- Documentar audios, adjuntos y fotos como pendientes cuando su contenido no haya sido examinado/conciliado.
- Notificaciones reales, Calendar API y Google Meet requieren autorización y conectores gestionados. En QA mantener simulación o previews sin mensajes reales.

## Puertas de aceptación para cliente
- Login verificado + autorizaciones entre copropiedades y unidades.
- Formularios PQRS y reuniones persistentes, visibles desde dos sesiones autorizadas.
- RLS y Storage QA probados con usuarios diferentes.
- Diseño premium **fiel al cliente**, auditado pantalla por pantalla en sesión autorizada.
- Datos reales solo si son necesarios, autorizados y protegidos; nunca exponerlos en preview público.
- Enlace HTTPS disponible y probado tras Cloudflare Access; estado real de compilación verificado. No presentar un error `Nothing is here yet` como servidor listo.
- No modificar `main`, no enviar correos o invitaciones sin autorización específica, ni contratar servicios.

## Orden de ejecución
A. Matriz exacta de funciones original → módulo unificado → pruebas y bloqueo.
B. Inventario y saneamiento de fuentes → correspondencia de copropiedades/unidades.
C. Esquema y API transaccionales en QA aislado → RLS → pruebas reales.
D. Conectar interfaz y sesiones autorizadas → pruebas E2E.
E. Vincular Google Calendar y outbox de avisos con control de consentimiento.
F. Auditoría visual/operativa final y despliegue protegido verificado.

**Estado a 30 octubre 2026:** código premium y partes de reuniones/PQRS implementadas en QA; la equivalencia visual completa y los datos reales unificados no están certificados. Este archivo es un contrato de aceptación, no prueba de importación completa.
