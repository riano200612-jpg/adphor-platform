# Avatar personal · ADPHOR QA Integral · 19/11/2026

**Objetivo:** donde aparece “JR”, mostrar la fotografía del usuario autenticado. Nunca reutilizar imágenes por similitud de nombres de empleados.

**Comportamiento:** un círculo de 40px (38px en móvil) que carga el archivo privado `<user_uuid>/avatar.webp` tras verificar identidad remota + AAL2. Menú accesible desde el círculo para subir/cambiar foto, o quitarla. Se convierten las fotos JPG/PNG/WebP de hasta 5 MB a WebP 320×320 (máx. 1 MB), recorte centrado, y se guardan en una ruta fija de su propio usuario. Cuando falta el archivo, hay error o cambia de cuenta, se mantienen las iniciales. Las URL temporales de Blob se revocan en redibujados y cierre de sesión; no hay localStorage de fotos.

**Protección:** depósito privado `qa-account-avatars` aislado de `qa-staff-photos` y `property-photos`. RLS con el ID verificado y AAL2; hay políticas antiguas amplias que cubren depósitos no-property, por lo cual se agregan políticas RESTRICTIVE de SELECT, INSERT, UPDATE y DELETE a la nueva migración. El esquema original de perfiles (id, name) permanece intacto. No se han importado fotografías ajenas.

**Alcance único:** rama `qa/integral-claude-reviewed-20261111`, hostname `qa-integral-claude-reviewed.adphor-platform.pages.dev`, Supabase QA `qfctnnnnltghepwujpdm`. La interfaz utiliza el cliente Supabase existente, no abre otra sesión. No cambia lógica de IAM, MFA, calendario, PQRS ni archivos originales del cliente.

**Respaldo:** `backup/qa-integral-before-account-avatars-20261119`, SHA `30ffc6f75e87d446e92e7d0107d56b1654fd374c`.

**Gate:** JS/Python, compilación Vite/Pages, Chromium + a11y, comprobación RLS/bucket en QA real, merge squash único, deployment SHA y CI posteriores. Las pruebas sintéticas no certifican fotos de usuarios reales hasta que estos las suban y verifiquen su sesión.
