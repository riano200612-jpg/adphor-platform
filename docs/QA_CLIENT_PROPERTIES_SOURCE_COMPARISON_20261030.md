# ADPHOR — comparación de fuentes: Copropiedades y Portal Comunidad (2026-10-30)

## Fuentes revisadas
1. Fragmento `ObtenerInfoCopropiedades(idDelegado,isAdmin)` compartido en chat: lee hoja `Copropiedades`, índice 2 como delegado y campos 1,5–18 como datos descriptivos. El identificador de hoja de cálculo original se conserva fuera del código publicado.
2. `Código.gs` del Portal ADPHOR (archivo adjunto de 1070 líneas): enrutamiento `?page=portal-home`, `?page=portal-team`, `?page=portal-comunidad`, `?page=comunidad`, `?page=form`, `?page=status`, `?page=gestion-correos`, `?page=registro`; fotos de equipo y de propiedades, coordenadas, sesiones de delegados y residentes, PQRS de gestión de correos.
3. `Gestión de Accesos al Portal Comunidad` (archivo adjunto de 2333 líneas): formulario por etapas con copropiedad, unidad y correos autorizados, fotografías y validaciones.

## Avance incorporado a GitHub QA
- `src/js/services/client-property-mapping.js`: adaptador tipado de 19 columnas del catálogo Copropiedades, conserva campos existentes y distingue valores desconocidos de 0.
- `tests/client-property-mapping.test.js`: mapeo de campos, rechazo de registros sin identificador, filtrado por conjunto de fuentes autorizadas.
- Los componentes de búsqueda y selección por propiedad ya existentes utilizan la lista de proyectos autenticados; **no importan ni autorizan automáticamente el catálogo de Sheets**.

## Riesgos que bloquean copia literal
- `isAdmin===true` en la función original permite leer todas las copropiedades si el parámetro se controla desde un cliente; en ADPHOR el rol debe provenir de identidad autenticada y membresía verificada en backend + RLS, nunca de un booleano suministrado por el navegador.
- En `Código.gs`, `validarUsuario` y `validarResidente` contienen llamadas `MailApp.sendEmail` cuando una cuenta se bloquea. **No deben importarse ni ejecutarse en QA** sin la autorización expresa de comunicaciones.
- El documento tiene identificadores de Google Drive/Sheets, fotos de colaboradores, rutas de imágenes y datos de autenticación. No publicar los archivos originales indiscriminadamente.
- Una cuenta de residente vinculada a copropiedad + unidad + correo necesita verificación de titularidad y política de consentimiento, sin sustituir seguridad por `sessionStorage`.
- `ALLOWALL` en varias páginas Apps Script puede permitir embebido en marcos externos; la nueva plataforma debe tener política de contenido y protección contra framing acordes con el entorno.

## Contrato de migración pendiente
1. Inventariar fuente `Copropiedades` y todas sus filas autorizadas, registrar hash/version y resolver equivalencias con `public.projects.id` (tipo text).
2. Aplicar a una base **QA aislada** las entidades de metadatos: fotos privadas, ubicación, sector, constructora, altura, pisos y unidades por tipología. No sobrescribir valores existentes hasta conciliar la fuente y obtener aprobación.
3. Mapear los accesos de delegados y residentes mediante identidad gestionada; comprobar RLS desde sesiones de QA con roles distintos.
4. Enlazar PQRS y reuniones por `project_id` y unidad, nunca inferir propietario a partir de unidad sin identidad verificada.
5. Integrar el flujo de altas/revocaciones de correos como solicitud con aprobación; **no enviar correos de prueba, avisos de bloqueo ni invitaciones**.
6. Probar navegación y permisos con 40+ propiedades; mantener un staging protegido, el origen inmutable y producción intacta.

Estado: adaptador de catálogo implementado y registrado; migración efectiva de datos reales, UI de ficha detallada y PostgreSQL QA hospedado **pendientes**.
