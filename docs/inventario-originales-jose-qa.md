# Inventario de importación — originales de José (QA)

> Este archivo NO contiene el código original ni credenciales. El ZIP fuente permanece fuera de GitHub. Las aplicaciones y hojas originales son **solo lectura**.

## Estado verificado
- `adphor-codigo-integracion-qa.zip`: 32 archivos de código y configuración (7 Reuniones, 25 Portal), validado localmente.
- Confirmadas en rama QA las rutas `src/js/services/legacy-compat.js` y `qa/cliente.html`.
- Los módulos originales bajo `legacy/apps-script/{reuniones,portal}` NO están incorporados aún.
- Clasp `.clasp.json` y cuentas de autenticación: excluidos del ZIP.
- Precaución: `reuniones/Utilidades.js` contiene asignación de PIN; `portal/PQRS.js` contiene referencias que requieren inspección de credenciales/servicios. También hay emails e identificadores de calendario.

## Lista de archivos por integrar y sanear
- [ ] `reuniones/appsscript.json`
- [ ] `reuniones/Calendario.js`
- [ ] `reuniones/Código.js`
- [ ] `reuniones/Correo.js`
- [ ] `reuniones/Index.html`
- [ ] `reuniones/Utilidades.js`
- [ ] `reuniones/MFA.js`
- [ ] `portal/appsscript.json`
- [ ] `portal/Calendario.js`
- [ ] `portal/Copropiedades.js`
- [ ] `portal/Correo.js`
- [ ] `portal/Código.js`
- [ ] `portal/Comunidad.html`
- [ ] `portal/GestionCorreos.html`
- [ ] `portal/GestionCorreosRegistro.html`
- [ ] `portal/Index.html`
- [ ] `portal/JavaScript.html`
- [ ] `portal/PortalHome.html`
- [ ] `portal/PQRS_Notificaciones.js`
- [ ] `portal/PQRS.js`
- [ ] `portal/PQRSForm.html`
- [ ] `portal/PQRSStatus.html`
- [ ] `portal/QuizCartagenaData.html`
- [ ] `portal/Registro.html`
- [ ] `portal/RegistroCorreo.html`
- [ ] `portal/ProcesadorPQRS.js`
- [ ] `portal/Reuniones.js`
- [ ] `portal/RevocacionCorreo.html`
- [ ] `portal/StyleSheet.html`
- [ ] `portal/Utilidades.js`
- [ ] `portal/VerificacionCorreo.html`
- [ ] `portal/Visitas.js`

## Reglas para push
1. Clasificar y eliminar secretos, PIN, hashes, credenciales, correos personales y tokens de código y fixtures destinados a GitHub.
2. No publicar `.clasp.json`, `.clasprc.json`, `.env` ni copias completas de bases reales.
3. Revisar código Apps Script que actúe con permisos del propietario y uso de `webapp.access: ANYONE`.
4. Subir versiones saneadas **únicamente a rama QA**, en commits revisables, nunca directo a `main`.
5. Mantener el acceso actual de los dos administradores: cualquier migración de autenticación debe preservar las cuentas y permisos sin copiar credenciales.
6. Validar CI, pruebas de permisos multi-copropiedad y UI antes de activar datos reales.

## Fuentes Drive pendientes
Carpetas Proyecto ADPHOR, Plataforma ADPHOR, Portal ADPHOR v2 y 99_BACKUPS todavía necesitan un inventario recursivo completo y conciliación; no están incorporadas en su totalidad en GitHub.
