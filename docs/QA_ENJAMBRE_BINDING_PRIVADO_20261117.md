# ADPHOR QA Integral — Private Service Binding preflight (17 November 2026)

This increment prepares the single QA Integral site to call an **internal-only**
agent-readonly Worker through a Pages Functions Service Binding.

## Topology and conditions

Browser (QA Integral hostname protected by Cloudflare Access)
→ Pages Functions \`/agent-readiness\`, \`/agent-runs\`, \`/agent-runs/{uuid}\`
→ **ADPHOR_AGENT_READONLY** service binding
→ Python Worker \`adphor-ai-qa\` (workers_dev=false, no public routes)
→ Supabase QA via the caller's JWT, active principal and AAL2 RLS.

Both Pages and Worker gates are off by default. **No service binding or new
Worker has been deployed** by this commit. It does not enable ML/DL/PLN,
rules execution, approvals, PQRS sends, Google Calendar changes, or file writes.

### Preconditions to switch the integration on

1. Verify existing Pages Access covers the exact alias
   \`qa-integral-claude-reviewed.adphor-platform.pages.dev\` for an allowed,
   denied and anonymous user. A saved browser session alone is insufficient.
2. Deploy the disabled Python Worker using \`backend/wrangler.qa.jsonc\`
   with \`workers_dev=false\`, no routes and no secrets in source control.
   Confirm the script name and no public endpoints.
3. Set Worker \`SUPABASE_PUBLISHABLE_KEY\` and keep
   \`SUPABASE_URL=https://qfctnnnnltghepwujpdm.supabase.co\` and
   \`ALLOWED_ORIGIN\` exactly equal to the QA Integral origin. There must be
   no service-role or writer credential on this Worker.
4. Add a **Preview-only** Cloudflare Pages Service Binding named
   \`ADPHOR_AGENT_READONLY\` targeting \`adphor-ai-qa\`.
   Use Dashboard > Pages > adphor-platform > Settings > Bindings > Add > Service.
   Redeploy and verify that production configurations are unchanged.
5. Only after live Access, AAL2, revoked membership, cross-tenant and
   no-write checks are certified, enable
   \`QA_AGENT_READONLY_ENABLED=true\` on the Worker and
   \`ADPHOR_QA_AGENT_READONLY_PROXY_ENABLED=true\` in Pages Preview.
6. After the above preflight, the frontend can use
   \`VITE_AGENTS_API_URL=https://qa-integral-claude-reviewed.adphor-platform.pages.dev\`
   **only in Preview**. Until then it continues reading Supabase RLS directly.

### Guardrails on Pages

- Exact canonical QA hostname only. Immutable deployment URLs and branch previews
  will not access the proxy API.
- Only GET; no OPTIONS/POST/PATCH/DELETE. No forwarded cookies or arbitrary
  browser headers. Only explicitly supplied end-user JWT forwarded internally.
- Strict route, query and UUID validation; duplicate/unknown arguments denied.
- Fail closed when either opt-in flag or service binding is absent.
- No redirects, no upstream Set-Cookie, no upstream CORS headers or stack traces.
- Backend JSON is size limited and must match tenant, immutable statuses and
  explicitly disabled model/write actions.
- \`public/_routes.json\` scopes Pages Functions to only those 3 API paths,
  preserving Vite static assets and existing routing.

### Gate evidence and current scope

- \`node --test tests/agent-pages-binding.test.js\` runs isolated negative tests.
- The existing \`Validate ADPHOR\` workflow covers JavaScript, Python, builds,
  build isolation and Playwright.
- Live Access deny and full Worker/Pages Service Binding tests are still
  **not certified**. Do not mistake green unit tests or Pages deploy for
  functioning backend execution.

Relevant official documentation:
https://developers.cloudflare.com/pages/functions/bindings/
https://developers.cloudflare.com/pages/functions/routing/
https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
