# ADPHOR — Ingesta de documentación real (QA, 2026-10-30)

## Regla de alojamiento
- GitHub: código fuente auditado, migraciones SQL, pruebas, documentación técnica, manifiestos de origen **sin contenido privado**.
- Drive: documentos originales inmutables, hojas maestras, grabaciones y versiones históricas.
- Supabase/PostgreSQL: datos operativos estructurados por copropiedad; Storage privado para adjuntos. No copiar claves, PIN ni documentos con datos personales a commits.
- Antes de importar: clasificación de sensibilidad, permisos, coincidencia de propiedad, revisión de duplicados, ID de archivo, versión/hash, registro de procedencia, rollback y prueba de RLS con JWT de QA.
- El material de una propiedad no debe alimentar respuestas de otra. La ingesta al enjambre no equivale a entrenar modelos.
- **Envío de correos, SMS y WhatsApp: DESACTIVADO**, incluidos mensajes de prueba, hasta autorización expresa del propietario. No hay worker de envío habilitado.
- El módulo frontend `communication-gate.js` describe el requisito y contiene tests, **pero no es por sí solo una garantía de backend**; antes de habilitar proveedores implementar un servidor que aplique la misma política de denegación por defecto y registre consentimientos.

## Fuentes de Drive verificadas como carpetas principales
- Proyecto ADPHOR: https://drive.google.com/drive/folders/1Nx7_gqviZCPpt5WV1Gl9gnJ6xqXotSw0
- Portal ADPHOR: https://drive.google.com/drive/folders/1h1iklWsfg-ffTLf7nOAL8EY4oTXJ0yzc
- 99_BACKUPS: https://drive.google.com/drive/folders/1VypPu5TDZLbecBhx5OohDCmuXANfFYLf

**El inventario completo recursivo de archivos, audios y propiedades aún no está acreditado.** No se ha importado una carga masiva de datos reales ni aplicado migraciones QA en la base productiva.

## Criterios previos a ingesta de datos reales
1. Entorno PostgreSQL QA verdaderamente aislado y protegido; respaldo de origen sin mutación.
2. Catálogo de copropiedades aprobado por responsable y correspondencias de filas; no asociar registros huérfanos por inferencia.
3. Políticas RLS/Storage con JWT verificados, acceso entre inquilinos negado.
4. Verificaciones de completitud (conteos y hashes), idempotencia, reversión y observabilidad.
5. Acceso de agentes condicionado a documentos aprobados y sujeto a revisión humana.
6. Sin envíos de ninguna clase hasta visto bueno específico.
