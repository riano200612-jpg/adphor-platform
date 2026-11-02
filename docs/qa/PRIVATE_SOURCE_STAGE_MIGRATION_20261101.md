# Migración de origen a staging privado — 2026-11-01

## Operación ejecutada en Supabase
Proyecto existente ADPHOR: `oqizvirqjwbbhyyjpthq`. **No es un proyecto QA separado.** Para contener el riesgo, se creó exclusivamente un esquema restringido `adphor_import_private`; no se alteraron tablas operativas, perfiles, membresías, PQRS ni calendarios.

Fuente exacta: Google Sheets `master_portalADPHOR_demo_murano` (hojas `Copropiedades` y `Reuniones`). **El nombre de origen contiene «demo»; NO declarar estos datos como operación productiva certificada.**

- `client_property_catalog`: **40 filas** de origen, **40 nombres distintos**.
- `client_meeting_catalog`: **16 filas** de origen, **16 referencias de copropiedad conciliadas por nombre**.
- Columnas guardadas: números de fila, identificadores de origen, nombres de copropiedad, y en reuniones tipo, fecha/hora de origen y estado bruto.
- Excluidos: correos, números de teléfono, residentes, documentos, fotografías, chats, notas, enlaces de Google Meet, datos de acceso y preguntas de recuperación.
- Sin publicaciones, invitaciones, correos ni WhatsApp.

## Verificación de seguridad posterior a la escritura
Ambas tablas tienen RLS habilitada y `FORCE ROW LEVEL SECURITY`. Se revocó acceso a `public`, `anon` y `authenticated`. SQL posterior confirmó:
- `anon_schema_access=false`, `authenticated_schema_access=false`.
- `anon_read=false` y `authenticated_read=false`.
- Cifras verificadas: 40 propiedades y 16 reuniones, 16 de 16 reuniones vinculables al catálogo del origen.

## Qué NO se ha hecho
- No se importaron datos al esquema operativo `public.projects` ni se crearon identidades o membresías de clientes.
- No hay agenda reservable persistente ni sincronización con Google Calendar.
- No hay importación de residentes, visitantes o PQRS, ni entrenamiento de Miss ADPHOR con datos personales.
- No se ha actualizado Cloudflare para mostrar las filas privadas; el acceso directo desde el navegador está expresamente bloqueado.

## Próximo paso para entorno con datos reales
1. Conciliar contra `Master_Portal_v4` y los originales Apps Script; distinguir demos, duplicados, históricos y registros vigentes.
2. Vincular identificadores origen → `public.projects.id` con correspondencia explícita por copropiedad.
3. Certificar con identidades autorizadas las políticas RLS de lectura/escritura y permisos administrativos, sin reutilizar credenciales de José.
4. Migrar datos vigentes en lotes idempotentes y auditados; conservar hash, conteos, rechazos y reversión.
5. Activar backend de reservas, visitas y PQRS exclusivamente cuando la persistencia y autorización estén verificadas.
