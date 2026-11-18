# ADPHOR QA Integral — Conciliación de destinatarios PQRS, 18 noviembre 2026

**Alcance:** solo el proyecto Supabase `adphor-qa` y la rama QA Integral; las fuentes originales de José son estrictamente de solo lectura.

## Referencias verificadas (sin modificar)
- `Master_ADPHOR` → pestaña `Copropiedades`: 43 identificadores.
- `Master_Portal_v4` → pestaña `0_Copropiedades`: 39 identificadores.
- `public.projects` en Supabase QA: 43 copropiedades.
- Cruce por ID, nombre de copropiedad y correo de contacto: 36 coincidencias preliminares, 3 conflictos (IDs 2,6,27), 3 ausencias de la segunda hoja (IDs 40,41,43) y 1 sin correo válido (ID 42).

## Infraestructura QA aplicada
- Migración: `adphor_pqrs_qa_private_recipient_candidate_review_20261118`.
- `adphor_pqrs_qa.recipient_candidate_reviews` contiene los 43 correos **como candidatos**, no como rutas autorizadas, bajo RLS y sin acceso de `anon`/`authenticated`.
- `public.qa_pqrs_route_readiness` expone a admin/coordinator, con MFA AAL2 y pertenencia a la copropiedad, únicamente `project_id`, estado, código de revisión, indicador de correo presente y hora de conciliación; **no expone correo, nombres ni descripciones**.
- Las tablas privadas `recipient_routes` y `notification_outbox` permanecen sin rutas aprobadas ni envíos.
- No se importaron los originales del PQRS de Apps Script al repositorio ni se escribió en Drive.

## Pruebas DB
- 43 candidatos privados, 43 indicadores seguros.
- Cuenta QA administrativa con sesión Auth existente + AAL2: puede leer los 43 estados por su rol; ID 2 = CONFLICT.
- Simulación no autorizada: 0 filas.
- `anon` no tiene acceso a la tabla pública de estados.
- `authenticated` no tiene acceso a direcciones privadas ni puede modificar estados.
- 0 rutas aprobadas y 0 correos enviados.

## Limitaciones pendientes
- Esta iteración **no habilita el correo**: la aprobación de destinatarios requiere corroboración y autorización; el proveedor de email no está configurado/certificado.
- La pantalla muestra el estado de **una** copropiedad seleccionada, no un directorio abierto de contactos.
- La fuente original Apps Script aún no se sincroniza; el PQRS nativo PostgreSQL de QA sí registra su copia mínima.
- Una coincidencia en dos hojas no prueba propiedad del correo ni recepción de mensajes.
