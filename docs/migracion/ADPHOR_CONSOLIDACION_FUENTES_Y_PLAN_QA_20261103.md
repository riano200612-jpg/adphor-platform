# ADPHOR · Consolidación y migración trazable (19 octubre–3 noviembre 2026)

**Estado:** inventario y contrato de migración, NO migración operativa completada. Repositorio público: no contiene filas privadas, PIN, contraseñas, fotografías ni enlaces de archivos confidenciales.

## Fuentes encontradas y verificadas

1. `Master_ADPHOR` en Google Sheets, ID `1b398nS41DkHiFVu1kMgFu6JO2opZPx8ZT3libxkRIXo` (modificado el 03/11/2026). Hojas verificadas por metadatos/encabezados, no por validación de todas las filas: `Registros`, `Métricas Reuniones Meet`, `Visitas`, `PQRS`, `Copropiedades`, `Info Copropiedades`, `Delegados`, `Historial Ediciones`. También contiene copias, pruebas y una hoja **PIN**, excluidas de cualquier exportación pública.
2. Carpeta del cliente `Plataforma ADPHOR`: ID Drive `1rQgw7gNBDxxYhMp5PwBgDBycZWQiR8Jo`. El libro maestro está dentro de `01_BASE_DE_DATOS`: ID `1sd5MOkiqtNo1RsE2hTEoWFTQd3BM0k2v`.
3. Código original Portal/Reuniones de José en respaldo **privado** `riano200612-jpg/adphor-jose-original-private`, carpetas `portal/` y `reuniones/`. No copiar archivos originales sin sanear dependencias, secretos, IDs internos y datos personales.
4. Paquetes mencionados en conversaciones `01_BASE_DE_DATOS-20261103T134139Z-1-001.zip` y `media-20261103T134407Z-1-001.zip`. **No se ha verificado aquí acceso a sus bytes**; no afirmar importación de esos archivos.
5. Supabase `oqizvirqjwbbhyyjpthq` es **el único proyecto accesible** en la conexión actual. Tablas operativas publicadas: `projects` (1), `profiles` (2), `memberships` (2), `tickets` (7), `ticket_events` (21), `monthly_reports` (0), `agent_runs` (1), `agent_reviews` (1). Todas con RLS activo. Estos conteos son distintos del archivo maestro/histórico y no deben mezclarse.
6. Auditoría del 28/10/2026: 755 filas de origen en carga privada, 754/755 coincidencias verificadas, 44 copropiedades, 682 registros de actividades/reuniones y 29 PQRS; 55 delegados y 367 ediciones pendientes de tratamiento; 626 correspondencias candidatas, 56 registros sin correspondencia, IDs 6/27 divergentes, fila 525 diferente en fecha/identificador. Son conteos de **corte histórico**, no conteos de la operación actual en vivo.

## Mapeo por módulo (origen → destino de diseño)

| Fuente maestra | Clave de fuente | Destino previsto | Condición |
|---|---|---|---|
| Copropiedades | ID_Copropiedad | catálogo de proyectos | Homologar y aprobar IDs antes de dar acceso |
| Info Copropiedades | ID_Copropiedad | ficha detallada | Revisar privacidad, ubicaciones y contactos |
| Registros | ID_Registro | historial de actividades/reuniones | Nunca convertir automáticamente en reserva confirmada |
| Métricas Reuniones Meet | ID_Registro | telemetría histórica | Conciliar contra Registros |
| Visitas | ID_Visita | módulo de visitas | Confirmar cantidad y relaciones, no deducir desde filas vacías |
| PQRS | ID Caso | seguimiento y trazabilidad de PQRS | Homologar proyecto y estado bajo aprobación |
| Delegados | ID_Delegado | directorio privado, no Auth | Excluir PIN, OTP, claves y datos secretos; autorizar roles por RLS |
| Historial Ediciones | ID_Edición / ID_Original | auditoría de modificaciones | Preservar historial íntegro, detectar duplicados |

### Requerimientos consolidados del cliente

- Login institucional con MFA, permisos por rol y copropiedad, interfaz corporativa original.
- Home con calendario de reuniones **reales**, prioridades y criticidad.
- Agendar reuniones: copropiedades asignadas; tipo/subtipo; duración; prioridad; participación de gerencia; carrusel de acompañamientos y opción **«Sin acompañamiento requerido»**; horarios sugeridos, conflictos, historial y consentimiento para notificaciones.
- Visitas y PQRS conservando estructura del portal original con persistencia SQL segura.
- Archivos/evidencias: imágenes, audio, video y documentos en almacenamiento privado con metadatos, permisos y vistas previas.
- Informes mensuales con gráficas y procedencia de datos; Miss ADPHOR y agentes ML→DL→PLN exclusivamente asesorando, con aprobación humana en `agent_reviews`.
- Piloto Porto Castello, simulaciones claramente ficticias, datos reales solo en un entorno privado autorizado.

## Flujo de ejecución obligatorio

1. Crear o habilitar **destino QA privado independiente**, con Cloudflare Access, Auth/MFA, RLS, storage no público y cuentas de prueba; la base de datos productiva existente es **solo lectura** durante reconciliación.
2. Exportar versiones explícitas de las fuentes privadas a almacenamiento de staging con respaldo, fecha, checksum y manifiesto de procedencia. Evitar incluir `PIN` y copias de respaldo en el lote activo.
3. Importar a tablas privadas de ingestión con `source_system`, `source_file`, `source_sheet`, `source_row`, `source_id`, `source_hash`, `batch_id`, marcas de tiempo; usar claves únicas idempotentes y nunca borrado masivo.
4. Verificar antes de proyectar: duplicados, 6/27, 56 huérfanos, cambios fila 525, cuentas personales, referencias de fotos/archivos y autorizaciones de copropiedad.
5. Proyectar solo correspondencias aprobadas hacia nuevas tablas operativas QA con RLS, permisos y acciones transaccionales probadas. No generar invitados ni reuniones de calendario automáticamente.
6. QA de login, MFA, calendario, carrusel, visitas, PQRS, multimedia, informes y Miss ADPHOR. Publicar URL **preview** solo después de autenticar y validar visualmente.
7. No fusionar a `main` ni cambiar rama productiva de Cloudflare sin auditoría y autorización.

## Estado del código (03/11/2026)

- GitHub: `qa/p1-integracion-modulos-gate-20261103`, interfaz nueva con Miss ADPHOR, Centro integrado, Reuniones visibles en modo evaluación y carrusel alimentado por membresías autorizadas.
- Cloudflare Pages: vista previa QA `https://c7519dfb.adphor-platform.pages.dev` del commit `d8bba1b`; el enlace necesita regenerarse tras nuevos commits. Producción anterior sin cambios.
- **No afirmar migración total:** actualmente falta importar y reconciliar fuentes, preparar directorio de personal válido, persistencia de reuniones/visitas/PQRS, multimedia y calendario real.
