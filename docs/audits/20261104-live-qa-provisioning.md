# ADPHOR — bloque real de QA, 4 noviembre 2026

## Historial verificable

La rama qa/pqrs-carrusel-integracion-20261104 permanecía en 13ae830; los cambios posteriores estaban en qa/auditor-corrective-20261104. Se incorporaron por fast-forward hasta e6965e083c8e8257adf2acb5d0165d93c129f1d8. Main no se modificó. No se repitieron pruebas sintéticas ni se abrió TinyFish.

## Entorno real creado

Organización elegida explícitamente por el usuario: ADPHOR.

- Proyecto: adphor-qa.
- Ref: qfctnnnnltghepwujpdm.
- Región: us-east-1.
- Estado devuelto: ACTIVE_HEALTHY.
- Independiente del proyecto productivo oqizvirqjwbbhyyjpthq, que no se modificó.

El intento previo de branching devolvió PaymentRequiredException: requiere plan Pro. Se utilizó un proyecto independiente; no se contrató una ampliación de plan.

## Cambios aplicados al servidor QA

| Migración registrada | Versión |
|---|---|
| adphor_qa_workflow_baseline | 20261104191540 |
| adphor_qa_pqrs_base | 20261104191554 |
| adphor_qa_pqrs_lifecycle | 20261104191646 |
| adphor_qa_private_evidence | 20261104191717 |

Fuentes SQL: supabase/migrations/202610190001_workflow.sql; definición mínima pilot_pqrs del paquete Porto; qa/database/supabase/migrations/20261029134441_porto_pqrs_lifecycle.sql; docs/sql/qa-evidence-enabled-draft.sql (COMMIT en sustitución del ROLLBACK, exclusivamente en QA).

Se importaron 43 copropiedades reales desde projects.jsonl del ZIP conciliado previamente inspeccionado. ID destino source-N conserva el ID numérico positivo original. Se copiaron solamente nombre y sector; no correos, credenciales ni fotografías. La fila de ID cero se excluyó. No se crearon usuarios ni membresías ni se concedió acceso anónimo.

## Comprobaciones reales ejecutadas

- Consulta inicial: esquema public y buckets vacíos.
- Consulta posterior: 43 proyectos, cero IDs fuera del patrón source-N.
- Ocho tablas públicas operativas; todas con RLS activo.
- Ningún bucket público. evidence conserva 2 MB/JPEG/PNG/WEBP; qa-case-evidence es privado y admite 20 MB para JPEG/PNG/WEBP/MP4/WEBM/PDF.
- Existe la política INSERT de qa_case_evidence y el trigger de auditoría de pilot_pqrs.
- Sin privilegios INSERT/UPDATE/DELETE para anon en tablas públicas.
- Petición HTTP real GET /rest/v1/projects?select=id usando clave publicable y sin sesión: 401, código PostgreSQL 42501, permission denied. La sugerencia automática de conceder SELECT a anon no se aplicó.

No son pruebas E2E autenticadas: no se creó un radicado ni se cargó un objeto ni se confirmó asociación de evidencias en este bloque. No se reutilizaron los resultados sintéticos anteriores como certificación remota.

## Fotografías: rechazo y alcance

La solicitud adphor_qa_private_media devolvió status=declined, sin motivo detallado. No se reintentó ni se aplicó otra variante. No existen qa_property_photos, qa_project_companions ni sus buckets. Las fotografías y los nombres de colaboradores originales no se publicaron ni importaron.

La conciliación física anterior sigue disponible en 20261104-source-integrity-summary.json: CRC aprobado, hash del maestro verificado, 41 coincidencias de copropiedades y 46 de colaboradores. No se repitió ese procesamiento.

## Seguridad y siguientes bloqueos

El asesor de Supabase reporta dos tablas de staging privado con RLS y sin políticas (denegación por defecto intencional) y tres avisos por funciones SECURITY DEFINER del baseline expuestas a authenticated (project_role, visible_profile, ticket_command). Requieren auditoría antes de certificación; no se eliminó RLS para resolverlos.

Referencia del asesor: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

Faltan aprobación de la migración de medios, cuentas/membresías QA autorizadas, importación privada de fotos, ejecución autenticada de PQRS/API/Storage y E2E contra los servicios reales. El frontend y el backend no se desplegaron. Cloudflare Access no se modificó ni se certificó; el despliegue sigue reservado a la aprobación del auditor.

No se iniciaron navegadores, servidores de desarrollo ni automatizaciones en este bloque. Las consultas y tareas de aprovisionamiento terminaron. Se conserva únicamente el proyecto QA necesario para continuar, además de las fuentes del cliente.
