# Auditoría Drive y archivos José: directorio de personal, fotos y asignaciones — 2026-10-31

## Fuentes verificadas, sin publicar datos personales
- Google Drive: carpeta **Fotos Delegados**, contiene **55 archivos de imagen** según el listado de esta revisión (incluye Miss ADPHOR). No asumir que todas las personas continúan empleadas ni tienen autorización para aparecer públicamente.
- Spreadsheet **Master_ADPHOR**, hojas `Delegados` y `Copropiedades`.
- Encabezados `Delegados`: `ID_Delegado`, `Delegado`, `Foto`, `Usuario`, `PIN`, `Rol`, `Correo`, `Intentos Fallidos`, `Estado`, `Leyenda Rol`, `nivelAdmin`, `Sector Coordinado`, `Estado Bloqueado OTP`.
- Encabezados `Copropiedades`: `ID_Copropiedad`, `Copropiedad`, `ID_Delegado`, `Delegado`, `Correo Electrónico`, `Foto`, `Sector`, `ID_Coordinador`.
- Spreadsheet demo **master_portalADPHOR_demo_murano**, incluye `Delegados`, `Copropiedades`, `Reuniones`, `Visitas`, `PQRS_Master`, `PQRS_Log`, `Residentes` y `Historial Edicion Reuniones`.

## Hallazgos
1. Las fuentes originales contienen asociación *delegado → copropiedad* y rol, pero **no constituyen por sí solas un catálogo certificado de responsabilidades por área**, turno, competencias, estado activo y autorización para recibir incidencias.
2. Las hojas incluyen `PIN`, `Correo` y estados de OTP: **prohibido exportar estos campos a GitHub, frontend o informes**.
3. El nombre de una fotografía no demuestra titularidad, cargo ni consentimiento. Fotos permanecen en Drive hasta conciliar `ID_Delegado`, estado, permisos y autorización de uso.
4. La primera fase de mantenimiento conserva asignación, plazos, estados e historial; Recorridos usa ese mismo flujo.
5. El carrusel de personal en QA usa iniciales y miembros autenticados; faltan fotografías privadas y función de asignación conectada al backend.

## Entregable técnico añadido
- `src/js/services/staff-directory-contract.js`: contrato puro de empleado activo, pertenencia a copropiedad, responsabilidad por área y foto aprobada, sin datos personales incrustados.
- `tests/staff-directory-contract.test.js`: pruebas de aislamiento y autorización previa a escritura.
- **No se ha hecho importación real ni se ha enviado nada**. El contrato solo crea solicitudes para verificación backend.

## Migración controlada para Work
1. Extraer inventario completo de fotos y hojas fuente con ID, SHA-256, MIME, rutas, permiso y fecha; jamás ponerlo en commits públicos.
2. Conciliar foto ↔ delegado ↔ usuario gestionado ↔ membresía ↔ copropiedad ↔ función/área y aprobación de publicación; identificar datos faltantes.
3. Crear `staff_profiles` y `staff_assignments` en **PostgreSQL QA aislado**, con RLS por proyecto, claves externas y auditoría; no mezclar tenant IDs de Sheets con IDs Supabase sin mapeo.
4. Guardar imágenes en Storage privado; entregar URLs firmadas de corta duración solo a usuarios autorizados.
5. Carrusel: fotografía con consentimiento/estado, nombre/cargo/área autorizados, disponibilidad, botón **Asignar novedad**. Backend valida área, rol, pertenencia, permisos y versión del caso.
6. Adjuntos en Recorridos: imágenes, audio, video, PDF y notas; límites, tipos MIME reales, antivirus cuando aplicable, referencias privadas y confirmación de persistencia. Ningún contacto externo automático hasta aprobación.
7. Enjambre: procesar únicamente casos autorizados, generar sugerencias/hallazgos, mantener aprobación humana de cierre y reportes.
8. Probar 40+ copropiedades, concurrencia, RLS cruzada, fotos privadas, rol inactivo, delegación revocada, re-asignación, seguimiento y cierre.
9. Evaluar el resto de respaldos, Portal ADPHOR (HTML/JS/CSS), hojas históricas, audios y adjuntos; entregar matriz fuente→destino y faltantes con evidencias.
10. Mantener app única, visualmente fiel al Portal original, evitando publicar producción o modificar Apps Script.

## Estado
Inventario parcial de fuentes **confirmado**; contrato QA **añadido**; archivos originales no alterados. El usuario ha autorizado el análisis, pero no es una autorización para exponer fotos o datos personales en páginas públicas.
