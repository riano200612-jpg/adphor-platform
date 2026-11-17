# ADPHOR — Cloudflare Worker QA de consulta (sin ejecución)

**Destino único:** QA Integral, base \`qfctnnnnltghepwujpdm\`, alias
\`https://qa-integral-claude-reviewed.adphor-platform.pages.dev\`.

## Alcance realizado

\`backend/src/adphor_ai/qa_readonly_api.py\` implementa \`GET /agent-readiness\`,
\`GET /agent-runs\` y \`GET /agent-runs/{uuid}?project_id=...\` como lectura
exclusiva del registro RLS ya existente, sin depender del FastAPI local.

La ruta verifica el bearer con **Supabase Auth**, exige JWT AAL2 cuyo \`sub\`
coincide con la identidad validada y consulta **\`public.project_role(project)\`**
con el mismo bearer. Esa función SQL ya existente comprueba la identidad QA
activa y la pertenencia actual; solo \`admin\` y \`coordinator\` leen. Después
consulta la vista \`agent_run_status\` con \`security_invoker=true\`.

El estado \`reviews_ready\`, \`rules_ready\` y \`models_ready\` permanece
**siempre falso** en este servicio. No se permite POST, PATCH, DELETE,
aprobaciones, modelos, claves privadas, reportes ni efectos operativos.

## Configuración aislada y seguridad

\`backend/wrangler.qa.jsonc\` separa la URL y el origen de QA de
\`backend/wrangler.jsonc\` heredado. Por seguridad:
- Usa \`workers_dev:false\`: no se publica automáticamente una URL pública.
- \`QA_AGENT_READONLY_ENABLED:false\` por defecto.
- No incluye \`SUPABASE_PUBLISHABLE_KEY\`, \`service_role\` ni secretos en GitHub;
  la clave publishable deberá configurarse **por el propietario** en el
  entorno QA, como variable pública (sin compartirla en el chat).
- No establece ruta ni dominio personalizado antes de certificar Access.
- El frontend QA mantiene su lectura directa actual; **no modificar**
  \`VITE_AGENTS_API_URL\` hasta desplegar y probar el backend en un hostname
  autorizado bajo Access con pruebas positivas/negativas reales.
- El Worker original de conexión (\`backend/wrangler.jsonc\`) permanece intacto.

## Gate de publicación futura

Requiere revisar el destino real, identidad del deploy, token Auth,
rol AAL2, membresía revocada, Cross Tenant, anonimato, Access Allow/Deny,
ausencia de escritura, rate limit y E2E con sesión auténtica. No se
certifica accesibilidad pública desde las pruebas unitarias ni el
despliegue de Pages.

**Pruebas aisladas:**
\`PYTHONPATH=backend/src python -m unittest backend.tests.test_qa_readonly_api -v\`
y \`node --test tests/agent-api.test.js\`.

**Nota:** las APIs de Supabase y Cloudflare pueden cambiar; validar en
documentación vigente y no desplegar usando la configuración antigua que
apunta a producción.
