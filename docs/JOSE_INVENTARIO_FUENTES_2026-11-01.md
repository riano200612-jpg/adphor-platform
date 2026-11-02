# Fuentes originales José — inventario de respaldo (2026-11-01)

## Fuentes confirmadas
- Google Drive (acceso autenticado, fuente privada): `20260219_Plataforma_Running.zip`, ID `17b7cAA5cB_LxWP-IhFm4UaXi91EKmDSp`.
- SHA-256 del ZIP: `4770168967dadcdd49c468d06e68c2d3cfe9e1f3c7743356bf26c50cf66955eb`.
- Archivos interiores verificados: `Código.gs` (almacenado como `C#U00f3digo.gs`), `Index.html`, `Utilidades.gs`, `Calendario.gs`, `Correo.gs`, `appsscript.json`. Total: 6 archivos.
- Google Drive `Portal ADPHOR v2` y `01_BASE_DE_DATOS` están accesibles; este último contiene hojas maestras y materiales de diseño, **no** los 34 archivos fuente.
- El propietario ha confirmado por terminal Linux tres copias locales (`adphor-origen`, `adphor-integracion-qa`, `adphor-saneado`) con 26 archivos portal + 8 reuniones cada una. **Sus bytes no fueron transferidos a esta sesión**, por lo que no se puede verificar identidad ni subir los 34 con honestidad.
- En la copia local reportada, cada módulo conserva `.clasp.json`, que debe excluirse de Git.

## Resultado de revisión preliminar
El paquete RUNNING incluye referencias operativas a PIN y lógica de autenticación, identificadores de recursos Drive y direcciones de correo hardcodeadas. No publicar el ZIP sin saneamiento y auditoría específica. El repositorio `riano200612-jpg/adphor-platform` tiene visibilidad **public**.

## Estado Git y condiciones
- Esta rama QA almacena el inventario; **ningún código original nuevo fue publicado desde este ZIP**.
- El árbol local del propietario muestra conflicto `UU .gitignore` y carpeta anidada sin seguimiento `?? adphor-platform/`; no hacer `git add .` ni `git push` de `main` hasta resolverlos.
- Para subir el código completo, recibir un archivo con los 34 archivos saneados, sin `.clasp.json`, y revisar secretos y datos personales. Preferir repositorio privado de preservación para fuentes sin depurar y conservar huellas SHA-256.

## Integración de datos
Mantener las hojas maestras en Google Drive y el catálogo real bajo protección en Supabase; no incluir datos privados ni credenciales en Git público. El enlace al código fuente original en Drive sirve como respaldo provisional, no como integración desplegada.
