# Migración controlada — proyectos originales de ADPHOR (QA)

## Fuentes confirmadas (NO reemplazar)
- **Plataforma Reuniones**, Apps Script ID `1HSBoDME5uYWasbtV2pp0PjRv6Jj0nq_roEw-aLGM5GFsSwlN2swqNN4c`: `appsscript.json`, `Calendario.gs`, `Código.gs`, `Correo.gs`, `Index.html`, `MFA.gs`, `Utilidades.gs`.
- **Portal ADPHOR**, Apps Script ID `1Xgruby8uMK0mh6vJc5dhQ4GoKezzfGKZ9_QANGLFMbAx3YeH44cIpegi`: contiene rutas PQRS, correos autorizados y calificación, además de Google Calendar; inventario total pendiente de exportación.
- Respaldo **bacus.zip** del 19/02/2026, seis archivos de RUNNING. **Es histórico; no equivale al código actual**, que incluye MFA.gs.
- Repositorio vigente `adphor-platform` / rama `main`; desarrollo previo `codex/porto-calendario-gerencial-qa` PR #12.

## Regla de seguridad
**No subir archivos originales completos** sin auditoría de PIN, claves, identificadores y datos privados. El manifiesto histórico exponía webapp.access=ANYONE y executeAs=USER_DEPLOYING. No duplicar estas configuraciones en el nuevo entorno. No alterar ningún despliegue de Google Apps Script ni los datos reales de Supabase.

## Importación reproducible
1. Exportar cada proyecto actual con **clasp** y la cuenta autorizada, en directorios separados (ver comandos abajo). Guardar `.clasp.json` fuera de repositorios públicos, junto con archivos de credenciales.
2. Ejecutar auditoría de secretos, permisos, manejo de sesiones y dependencias.
3. Preparar copia **saneada** y registrar la huella SHA-256 de cada archivo. Solo entonces llevar código autorizado a `legacy/apps-script/reuniones/` y `legacy/apps-script/portal/`.
4. Conservar `Index.html` y su identidad azul/dorada como referencia visual; transformar `google.script.run` en un **adaptador API autenticado** al backend ADPHOR.
5. Integrar `?page=form`, `?page=gestion-correos`, `?page=status` como rutas compatibles; mantener autenticación Supabase y aislamiento por copropiedad.
6. Aplicar clasificación de reuniones Alta/Media/Baja, necesidad gerencial, colisiones y bloqueo de 24 horas **en servidor**. Notificaciones: outbox auditable y consentimiento previo; sin envío automático desde QA.
7. Ejecutar pruebas unitarias, CI, Playwright y dos identidades de copropiedades distintas antes de habilitar un staging protegido.

## Comandos Linux (fuera del repo)
```bash
npm install -g @google/clasp
clasp login
mkdir -p ~/adphor-origen/reuniones ~/adphor-origen/portal
cd ~/adphor-origen/reuniones
clasp clone '1HSBoDME5uYWasbtV2pp0PjRv6Jj0nq_roEw-aLGM5GFsSwlN2swqNN4c'
cd ~/adphor-origen/portal
clasp clone '1Xgruby8uMK0mh6vJc5dhQ4GoKezzfGKZ9_QANGLFMbAx3YeH44cIpegi'
```
Si `clasp clone` falla, habilitar Apps Script API desde la cuenta propietaria y comprobar permisos del proyecto; **no guardar tokens en GitHub**. Comparar con `bacus.zip` solo después de exportar la versión actual.

## Criterio de entrega
- Comparación por archivo y diferencias explicadas.
- Sin claves reales ni PIN personales en el repositorio.
- Interfaz original conservada e interacciones nuevas comprobadas.
- Staging privado con datos ficticios y validaciones RLS.
- Rollback documentado; producción y Apps Script originales intactos hasta auditoría.
