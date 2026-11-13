# ADPHOR — calendario corporativo en QA actualizada

**Único frontend:** https://qa-integral-claude-reviewed.adphor-platform.pages.dev

**Único Supabase QA:** `qfctnnnnltghepwujpdm`; no crear un proyecto paralelo ni tocar producción.

La función `qa-calendar-availability` es parte del backend de la misma plataforma QA. `POST /functions/v1/qa-calendar-availability` recibe `{project_id,start,end}` (ISO con zona, máximo siete días) y devuelve únicamente `{project_id,timezone:'America/Bogota',source:'google_freebusy',busy:[{start,end}]}` si una respuesta real de Google supera validación. **No crea, modifica ni elimina eventos; no envía invitaciones.**

## Condiciones obligatorias de autorización

- `verify_jwt=true` en Supabase Edge Functions.
- Solo origen web QA exacto; Auth valida el JWT, su AAL2 y la identidad actual.
- Consulta de la membresía mediante el **JWT del usuario** con RLS existente (identidad activa, MFA, copropiedad y rol `admin`/`coordinator`).
- Cualquier dato OAuth es secreto del backend. Nunca se usa `service_role` para consultar membresías ni se expone clave privada al navegador.
- Cache desactivada, respuestas sin detalles de invitados y sin escrituras.

## Dependencia corporativa pendiente

El administrador autorizado de Google Workspace deberá configurar en **Supabase QA → Edge Functions → Secrets** sin compartir valores en este chat:

- `ADPHOR_QA_CALENDAR_ID`: ID del calendario corporativo autorizado, no uno personal.
- `ADPHOR_QA_CALENDAR_OAUTH_CLIENT_ID`
- `ADPHOR_QA_CALENDAR_OAUTH_CLIENT_SECRET`
- `ADPHOR_QA_CALENDAR_OAUTH_REFRESH_TOKEN`

La autorización OAuth debe conceder solo el alcance mínimo de lectura de `freeBusy`. No guardar secretos en GitHub, Cloudflare Pages ni variables `VITE_`.

Si faltan, la función responde **503**; si el proveedor falla, **502**. Esto NO acredita un horario libre y jamás se sustituye por datos históricos o sintéticos.

## Despliegues escalonados

1. Integrar código mediante PR y CI; desplegar `qa-calendar-availability` solo en el proyecto Supabase QA con `verify_jwt=true`.
2. Mantener el flag `VITE_QA_CALENDAR_EDGE_ENABLED` **sin habilitar** en Cloudflare Pages Preview mientras no se confirme OAuth.
3. Probar 401 sin sesión, 403 con usuario AAL1 o membresía ajena, 503 sin configuración, 502 fallo de Google; después una consulta 200 de `freeBusy` con cuenta corporativa autorizada y AAL2.
4. Solo entonces establecer `VITE_QA_CALENDAR_EDGE_ENABLED=true` en **Preview** del proyecto Cloudflare Pages existente `adphor-platform`, nunca en producción.
5. Publicar commit de la rama `qa/integral-claude-reviewed-20261111` y auditar en la URL única: pantalla Reuniones, verificación manual, alternativas, margen de 30 minutos, no-reserva y ausencia de fugas.
6. Registrar SHA, Deployment ID, controles negativos, origen corporativo y reversión. Para revertir, apagar el flag Preview y recuperar el último despliegue válido; no modificar MFA, Access ni RLS.

La función desplegada no es certificación de disponibilidad hasta completar los pasos 3–5.
