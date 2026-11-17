# ADPHOR — Verificación del paquete Worker QA privado

El único destino es QA Integral. Este cambio no despliega ni conecta ningún Worker.

- La configuración adphor-ai-qa impide workers.dev, previews públicos y rutas públicas.
- QA_PRIVATE_SERVICE_ONLY restringe los endpoints heredados y exige Origin exacto.
- QA_AGENT_READONLY_ENABLED sigue en false y no hay clave privada de escritura.
- CI comprueba la configuración y trata de empaquetar Python con pywrangler --dry-run sin token de Cloudflare.
- Las pruebas de enrutamiento simulan el runtime y bloquean métodos de escritura, OPTIONS y /v1/session.

El siguiente desbloqueo necesita un paquete CI PASS, verificación de rutas/versiones públicas inexistentes, Access Allow/Deny, y un flujo de despliegue privado autorizado. Ninguna prueba aislada equivale a certificación E2E.

Documentación: https://developers.cloudflare.com/workers/languages/python/
https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/