# ADPHOR — criterio de entrega para demostración privada del 2 de noviembre de 2026

**Estado:** NO certificado para enlace externo. Esta lista es un contrato de aceptación, no una afirmación de implementación.

## Lo que pidió el cliente
0. Identidad corporativa ADPHOR y diseño fiel al Portal del cliente, no una maqueta independiente.
1. Login y 2. MFA exigible y probado.
3. Home con calendario de reuniones reales agendadas.
4. Reserva: copropiedades autorizadas, tipo de reunión, duración por defecto, carrusel de acompañamientos + «Sin acompañamiento requerido», sugerencia de horarios conforme a disponibilidad, prioridad/gerencia.
5. Visitas: mismo flujo original con lectura/escritura en SQL, RLS por copropiedad.
6. PQRS: mismo flujo original, persistencia SQL y trazabilidad.
7. Agenda con notificaciones solamente tras autorización.
8. Informes e historial de decisiones; agentes ML→DL→PLN con supervisión gerencial obligatoria. Ningún agente cierra casos ni notifica por sí solo.

## Fuentes
- Código original del cliente, respaldo privado: https://github.com/riano200612-jpg/adphor-jose-original-private
- Paquete recibido: 25 archivos Portal + 7 Reuniones. Importación al repositorio privado pendiente de ejecución; utilitario de carga allí disponible.
- Datos reales ya presentes en esquemas privados de Supabase: 755 filas en `adphor_ingest.source_rows`; 40 filas en `adphor_import_private.client_property_catalog`; 16 filas en `adphor_import_private.client_meeting_catalog` (conteos observados 2026-11-01). **No equivalen a funcionalidades operativas completas**.
- Tablas `public` disponibles: proyectos, perfiles, membresías, tickets y otros recursos del módulo de mantenimiento. El esquema vigente no expone tablas operativas `pilot_pqrs` ni `meetings` en public.

## Puertas de seguridad imprescindibles
- No activar importaciones de escritura ni sustituir datos reales sin conciliación y copias de seguridad.
- Nunca poner secretos de Apps Script, PIN, service_role o información privada en GitHub público, variables VITE ni repositorios Pages abiertos.
- Staging con control de acceso comprobado y MFA; las pruebas de lectura entre dos copropiedades deben demostrar aislamiento.
- Migraciones y RLS probadas; agentes con permiso mínimo y aprobación humana.
- No habilitar `ADPHOR_PROTECTED_STAGING_QA` sin confirmar protección real de Cloudflare Access; no eliminar bloqueo de despliegue.
- Validar con pruebas automáticas y manuales: autenticación, calendarios, agendas, visitas, PQRS, persistencia, reportes y ausencia de notificaciones no aprobadas.

## Enlace al cliente
Solo entregar un URL de presentación después de verificar respuesta HTTPS, Cloudflare Access, sesión/membresía, datos reales autorizados, principales recorridos y que no hay exposición pública. El dominio histórico de Pages no se certificó como un entorno privado funcional en la sesión del 2026-11-01.
