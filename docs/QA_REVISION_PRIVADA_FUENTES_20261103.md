# ADPHOR GAUNTLET — Entrega QA con fuentes reales (03/11/2026)

## Funcionalidad añadida en esta fase

Se incorpora una pantalla de **Revisión privada de fuentes** en la navegación, accesible solo desde la interfaz de usuarios autenticados cuyo rol efectivo en la copropiedad es `admin`, con modo `cloud`.

### Operación
1. Abrir la vista previa Cloudflare Pages de la **rama QA** y autenticarse con la cuenta autorizada.
2. En el menú, abrir **Revisión privada de fuentes**.
3. Seleccionar `ADPHOR_QA_PAQUETE_PRIVADO_CONCILIADO_20261103.zip` (ZIP de 68 KB entregado por separado al propietario).
4. Elegir una copropiedad del archivo y el mes en el calendario. Los eventos corresponden a registros históricos del cliente, clasificados por fecha y estado del archivo, **no son reservas nuevas ni agenda confirmada por Google Calendar**.
5. Para fotografías, seleccionar localmente `media-20261103T134407Z-1-001(1).zip`. El navegador genera vistas temporales de las fotografías de colaboradores; no hay subida a Supabase ni archivos públicos.
6. Cerrar o recargar la pestaña para borrar la información de la sesión del navegador.

### Límites de seguridad
- Esta pantalla **no sincroniza**, **no persiste** y **no modifica** datos de operación.
- Los ZIP no son archivos del repositorio y nunca se guardan en un servidor desde esta pantalla.
- Los expedientes PQRS no se muestran por detalle: el archivo no contiene relación unívoca y autorizada de cada caso a la copropiedad.
- Los registros sin correspondencia permanecen en cuarentena; no deben sumarse al calendario operativo.
- El carrusel fotográfico es una vista de archivos privados cargados por un administrador en su propia sesión, no un directorio autorizado para usuarios de todas las copropiedades.
- La protección por frontend **no sustituye RLS**. No debe incluirse una API de consulta privada sin autorización de servidor.

## Bloqueos observados en la auditoría

- Proyecto Supabase operativo `oqizvirqjwbbhyyjpthq`: una sola copropiedad `demo-01`; la fuente privada `adphor_ingest` conserva 755 registros de un corte anterior, con discrepancias respecto al ZIP del 03/11.
- Los modelos `qa_meeting_events` y `qa_pqrs_history` existen solo como SQL propuesto para un destino **QA independiente**; **no se han ejecutado sobre el Supabase operativo**.
- Las credenciales de Google Calendar disponibles en la conexión actual no listan el calendario compartido de ADPHOR; no es posible certificar la sincronización con CalendarApp.
- Las fotografías se conservan en ZIP privado; no hay autorización de difusión ni Storage privado con políticas por usuario/proyecto certificado.
- No hay persistencia funcional de reuniones, visitas o PQRS en la nueva interfaz.
- No se debe afirmar que la fecha del ZIP demuestra la vigencia de las reuniones; deben conciliarse con el calendario original.

## Estado de GitHub y entrega
- Branch: `qa/p1-integracion-modulos-gate-20261103`.
- PR #19: `https://github.com/riano200612-jpg/adphor-platform/pull/19`.
- Producción no modificada. Enlace de despliegue nuevo requiere comprobación exacta de commit en Cloudflare; no inventar URL.
- Prioridad posterior: destino QA independiente, importación idempotente, matrices de conciliación, acceso al calendario compartido, E2E de RLS y persistencia de los cuatro módulos.

## Evidencia mínima de certificación posterior
- GitHub CI: `npm test`, `npm run build`, `npm run test:e2e`, Gauntlet QA, PostgreSQL QA contract.
- Browser Cloudflare autenticado: abrir pantalla, seleccionar ZIP, comprobar los conteos de origen, seleccionar copropiedad, navegar meses, visualizar imágenes locales y verificar que no sale una petición de carga ni se escriben filas.
- Revisión negativa: usuario no administrador no ve la entrada; recargar elimina datos; archivos inválidos y ZIP malformados arrojan error, sin ejecutar código del archivo.

## Regla de entrega
Presentar esta pantalla como una **consulta privada de archivos históricos reales**. Nunca como calendario operativo, PQRS transaccional o migración completa.
