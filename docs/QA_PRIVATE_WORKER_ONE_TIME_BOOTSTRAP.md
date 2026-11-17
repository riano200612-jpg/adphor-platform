# ADPHOR — Bootstrap privado único del Worker QA

Fecha: 17 de noviembre de 2026. Único destino: QA Integral.

El workflow `Validate ADPHOR` agrega un job **de un solo uso** para publicar
`adphor-ai-qa` **deshabilitado**. La condición exige:
- Evento push exactamente a `qa/integral-claude-reviewed-20261111`.
- Mensaje del commit publicado con el marcador literal
  `[ADPHOR_PRIVATE_QA_BOOTSTRAP_20261117]`.
- Éxito previo de JavaScript, Python, E2E, empaquetado Python y build.
- Acceso a environment `adphor-qa`, secreto preexistente `CLOUDFLARE_QA_API_TOKEN` y
  variable `CLOUDFLARE_ACCOUNT_ID`.
- ID de cuenta exactamente igual a la cuenta ADPHOR certificada.
- El script `adphor-ai-qa` NO debe existir: se aborta si ya existe, sin sobrescribirlo.
- Configuración privada: workers.dev=false, preview_urls=false, sin rutas, sin schedule,
  `QA_PRIVATE_SERVICE_ONLY=true` y `QA_AGENT_READONLY_ENABLED=false`.

Luego ejecuta Pywrangler con la configuración QA exclusiva y verifica que el
script aparece en Cloudflare y el subdominio Workers.dev no está habilitado.

**Prohibido** usar un token de otra cuenta o añadir un service_role/writer key.
El flujo no configura credenciales Supabase, Service Binding ni variables de Pages.
El worker privado, aunque exista, permanece sin ruta y sin ejecución habilitada.

**Notas de seguridad:** la compilación por sí sola no certifica aislamiento;
el postflight del Worker y las pruebas Cloudflare Access con sesión real siguen siendo
necesarios antes de cualquier habilitación. Si falla, no reintentar sin diagnosticar
si el Worker ya existe; cualquier despliegue adicional requiere revisión.

La activación de consulta desde Pages será una fase separada, nunca automática.

## P0: QA histórica retirada — destino obligatorio

El preflight también exige `ADPHOR_QA_URL` igual a `https://qa-integral-claude-reviewed.adphor-platform.pages.dev`, leyéndola de la variable del environment `adphor-qa`. Si todavía apunta a la QA histórica, falta o contiene otro dominio, el despliegue se bloquea **antes de cualquier llamada a Cloudflare**, aunque el token exista. La variable se debe actualizar en GitHub mediante la verificación oficial de identidad; no se almacena código OTP ni API token en este repositorio.
