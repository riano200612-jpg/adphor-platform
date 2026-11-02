# Paquete José — recepción verificable (2026-11-01)

Archivo recibido: `adphor-codigo-integracion-qa(2).zip`.

SHA-256: `d6404c05b283e6ae86f200bb7415736be5a5adf84e487b4a73a691178a78d347`.

Tamaño descomprimido: 1,973,240 bytes.

Estructura confirmada: **32 archivos**: `portal/` (25 archivos), `reuniones/` (7 archivos), sin archivos `.clasp.json`.

## Inventario
### Reuniones
- `appsscript.json`
- `Calendario.js`
- `Código.js`
- `Correo.js`
- `Index.html`
- `MFA.js`
- `Utilidades.js`

### Portal
- `appsscript.json`
- `Calendario.js`
- `Copropiedades.js`
- `Correo.js`
- `Código.js`
- `Comunidad.html`
- `GestionCorreos.html`
- `GestionCorreosRegistro.html`
- `Index.html`
- `JavaScript.html`
- `PortalHome.html`
- `PQRS_Notificaciones.js`
- `PQRS.js`
- `PQRSForm.html`
- `PQRSStatus.html`
- `QuizCartagenaData.html`
- `Registro.html`
- `RegistroCorreo.html`
- `ProcesadorPQRS.js`
- `Reuniones.js`
- `RevocacionCorreo.html`
- `StyleSheet.html`
- `Utilidades.js`
- `VerificacionCorreo.html`
- `Visitas.js`

## Riesgo de publicación
Inspección estática preliminar detectó referencias a correos, Google Drive/Apps Script y lógica PIN/MFA/contraseñas. Dado que `riano200612-jpg/adphor-platform` es **público**, publicar sin revisión los 32 archivos puede revelar configuración y datos del cliente.

**Estado: manifiesto publicado, código fuente original aún no publicado en GitHub.** Mantener el archivo íntegro en almacenamiento privado; no subir sin sanitización o repositorio privado de acceso limitado. Las ramas de repositorios públicos también son públicas.

## Próximas acciones
1. Crear/verificar repositorio GitHub **privado** para respaldar íntegros los 32 archivos originales y su SHA-256.
2. Auditar credenciales y cambiar las incrustadas si existen.
3. Migrar módulos al árbol de ADPHOR en rama QA de integración, sin utilizar secretos de cliente en frontend.
4. Ejecutar pruebas de login, MFA, reuniones, visitas y PQRS en staging privado con datos autorizados.
