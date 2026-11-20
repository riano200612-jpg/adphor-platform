# ADPHOR QA Integral — Gate documental de Miss ADPHOR

**Auditoría:** 20 de noviembre de 2026 · **Único destino:** Supabase `adphor-qa` (`qfctnnnnltghepwujpdm`), sin producción ni originales de José.

## Dictamen
**`QA_STORAGE_INSTALLED · DB_RLS_PASS · END_USER_ACTIVATION_BLOCKED`**

Se instaló de forma aislada la migración `20261120221708_qa_miss_document_intake_quarantine`. En GitHub se conserva el mismo número de migración y su SQL bajo `supabase/migrations/` para impedir divergencia entre historial remoto y repositorio.

## Pruebas confirmadas en PostgreSQL QA
- Base `ACTIVE_HEALTHY`, 43 copropiedades, 2 usuarios autenticados, 86 membresías `admin` y **un solo usuario con sesión registrada**. No hay cuentas gestionadas activas para probar todos los roles.
- Bucket `qa-miss-documents`: privado, máximo 15 MiB, solo MIME PDF, DOCX y XLSX. 6 buckets anteriores conservados, sin cambios en sus definiciones.
- Tabla `public.qa_miss_document_submissions`: RLS activa, `authenticated` solo `SELECT`/`INSERT`, único estado posible `quarantined`; sin permisos de `UPDATE`/`DELETE`.
- Políticas restrictivas globales sobre `storage.objects`: el bucket nuevo niega `SELECT`, `UPDATE` y `DELETE` a los roles sometidos a RLS; `INSERT` exige principal QA validado, MFA AAL2, usuario, membresía y ruta exacta. No se cambiaron las políticas preexistentes.
- Prueba SQL reversible con `SET LOCAL ROLE authenticated` y `request.jwt.claims` derivados de una sesión QA registrada: **PASS** para `AAL2` autorizado (insertar y consultar metadatos propios), **DENY** para `AAL1`, suplantación de `uploaded_by`, propiedad no asignada, ruta Storage de otro usuario o propiedad, y lectura de objetos en cuarentena. La prueba se ejecutó con `ROLLBACK`.
- Post-verificación: 0 aportes, 0 objetos documentales de prueba; 7 buckets en total (6 anteriores + 1 privado nuevo).
- Advisor de seguridad: no detectó un hallazgo nuevo asociado a `qa_miss_document_submissions`; permanecen hallazgos de otras funciones/esquemas que se deben auditar por separado.

## Corrección de integridad en el candidato Git
- Proyectar `object_path` y `sha256` en lecturas RLS propias para verificar duplicados sin depender de la paginación.
- Distinguir fallos Storage ordinarios de `ResourceAlreadyExists`, `KeyAlreadyExists` y equivalentes conocidos, incluidos HTTP 400/409. No marcar un objeto huérfano como aportado.
- Comprobar `sha256`, ruta, MIME, tamaño, propietario, propiedad y estado antes de confirmar el registro documental.
- Validar mediante tests nuevos la recuperación legítima, el rechazo de un huérfano o error 400 ajeno, el rechazo de respuesta de ruta adulterada y la firma PDF falsa.

## Pendiente para acceso público de los usuarios QA
1. **Dos sesiones genuinas simultáneas de QA** con MFA AAL2, en cuentas separadas con membresías disjuntas de edificios; agregar control negativo AAL1 y sin membresía, y captura de evidencia con navegador y backend de Storage. Las cuentas actuales tienen memberships `admin` para todas las 43 propiedades, por lo que no constituyen evidencia real de aislamiento entre usuarios de edificios diferentes.
2. **Escaneo de malware efectivo** y detección segura de contenido activo, archivos Office malformados, bombas ZIP y PII sensible mediante backend segregado; actualmente la cuarentena impide que una IA descargue o indexe aportes. No certificar contenido como limpio a partir de MIME, firma o SHA-256.
3. **Aceptación funcional real en QA Integral**: acceso Cloudflare Access, confirmación del Deployment ID y SHA, selector de archivo, carga real, registro y recuperación. No activar `VITE_QA_MISS_DOCUMENT_INTAKE_ENABLED` antes de las pruebas de cuentas segregadas.
4. **Fase de lectura IA, por separado**: revisión humana, políticas de clasificación, procedencia, OAuth Google Drive consentimiento individual `drive.file`, extracción sin scripts ni macros, RAG privado por copropiedad y Guardianes que evalúen respuestas e informes. Nada de esto está autorizado con esta migración.

## Evidencia y límites
Las pruebas SQL anteriores **no equivalen a un inicio de sesión en un navegador ni a una transferencia binaria a Storage**. La aprobación CI garantiza el código evaluado, no las propiedades de un antivirus inexistente. La migración solo admite ingreso a cuarentena, no lectura por usuarios ni por agentes, entrenamiento, informes, envíos o publicación.

**Estado operativo:** migración QA instalada; interfaz bajo feature flag desactivado; PR #167 permanece Draft; no merge, no cambios en Cloudflare ni en producción.
