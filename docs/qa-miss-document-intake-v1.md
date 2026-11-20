# Miss ADPHOR — recepción documental QA V1 (aislada)

**Estado: migración INSTALADA exclusivamente en Supabase QA; interfaz NO PUBLICADA.** Entorno: QA Integral, Supabase QA `qfctnnnnltghepwujpdm`; nunca producción.

## Aportes directamente desde el chat
- Miss ADPHOR presenta «Adjuntar archivo o enlace de Drive» dentro del chat autenticado, sin salir del módulo ni exigir permiso administrativo general.
- El formulario utiliza exactamente el proyecto y usuario actuales; descarta confirmaciones visuales de operaciones que terminen tras cambiar de usuario, rol o copropiedad.
- La pantalla «Documentos para Miss ADPHOR» permite consultar únicamente los 50 aportes recientes del propio usuario en cuarentena; las deduplicaciones buscan el identificador exacto sin depender de esa paginación.

## Qué implementa
- Todo usuario **autenticado, MFA AAL2 y miembro de una copropiedad** puede aportar archivos PDF, DOCX y XLSX (máx. 15 MiB) de su propio dispositivo o registrar un **enlace directo** a un archivo de Google Drive. Un enlace NO concede permiso de lectura al sistema y NO descarga el archivo.
- Archivos locales quedan privados en el bucket `qa-miss-documents`; metadatos quedan en `qa_miss_document_submissions`, siempre en estado `quarantined` y vinculados a `project_id`, `uploaded_by` y hash.
- Upload evita sobrescribir. No se ofrecen descargas, URL públicas ni vista previa. Duplicados de Storage se aceptan solo cuando existe un registro de cuarentena verificable con el mismo hash/usuario/copropiedad; los huérfanos exigen conciliación sin falsos acuses. Políticas de Storage restrictivas bloquean permisos amplios preexistentes para este bucket.
- No cambia originales de Google Drive, las tablas operativas ni la configuración de Cloudflare. No hace OCR, indexación RAG, entrenamiento, síntesis de informes, tareas en segundo plano o envíos.

## Alcance confirmado
- Formatos iniciales: PDF, DOCX y XLSX hasta 15 MiB; fotografías, CSV, audio, video y carpetas completas requieren una validación especializada posterior.
- El registro de un enlace de Drive es solo una referencia: no descarga ni copia el contenido.
- **Migración QA instalada: `20261120221708` (`qa_miss_document_intake_quarantine`). RLS en PostgreSQL comprobada mediante pruebas reversibles con una sesión registrada; faltan dos sesiones reales separadas, antivirus y aceptación en navegador antes de habilitar a usuarios finales.** El indicador actual de QA es deshabilitado por defecto.

## Puertas antes de habilitar la bandera
1. Revisar migración y políticas con dos identidades reales AAL2 de distintas copropiedades, incluyendo prueba negativa sin membresía y AAL1.
2. Revisar los avisos del asesor de seguridad, privacidad y validación de RLS. Confirmar el alcance de la aplicación Cloudflare Access.
3. Probar archivos válidos y adversarios con malware scanning aislado (inexistente en V1); los datos permanecen en cuarentena.
4. Certificar entorno y aprobar publicación de la rama principal QA; habilitar únicamente `VITE_QA_MISS_DOCUMENT_INTAKE_ENABLED=true` después de aplicar migración en Supabase QA.
5. Para importación **directa desde Drive**, agregar Google Picker/OAuth con scope `drive.file`, consentimiento individual, descarga controlada en backend, rate-limits, revocación y auditoría. Nada de esto está activo en V1.
6. Para generar informes diarios con fuentes documentales, crear extracción segura, control de PII, RAG por copropiedad, evaluación cruzada de fuentes y aprobación humana antes de difundir.

**Nota:** Los usuarios que todavía no existen o no tienen MFA/membresía asignada no pueden probar esta función. El conjunto QA actual aún debe ampliarse con identidades reales de distintos roles.
