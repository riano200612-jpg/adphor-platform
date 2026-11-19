# ADPHOR QA Integral — Onboarding de foto personal / 2026-11-19

## Hallazgo verificado (solo lectura)
- El avatar personal ya estaba implementado y desplegado: src/js/ui-qa-user-avatar.js y servicios de almacenamiento.
- Supabase QA contiene la migración 20261119232902 para el bucket privado qa-account-avatars (WebP, máximo 1 MB, AAL2 y ruta exclusiva del UUID autenticado).
- El conteo de storage.objects para este bucket era **0** al investigar. Por tanto no existe una foto personal lista para sustituir "JR"; no se puede garantizar que los empleados verán una foto hasta que cada uno cargue la suya.
- profiles contiene id/name; no contiene enlace avatar; fotos corporativas por miembro no son una fuente verificada de identidad Auth y no deben reasignarse silenciosamente.

## Cambio visual específico
- Al faltar foto, un pequeño símbolo + integrado en el avatar existente sugiere que la persona puede cargarla mediante clic. Sin nuevas ventanas automáticas.
- Panel de carga explica que la foto privada se mostrará tras próximos ingresos; título y estado distinguen sin foto, foto lista y error de lectura.
- Foto WebP cargada sustituye las iniciales, y al retirar vuelve a ellas.
- Test E2E de persistencia tras remonte de sesión, cambio de usuario, WCAG y rutas personales; mantiene fallback.

## Límites
No se modifican ni migran fotos originales de empleados, perfiles de terceros, base de datos, RLS, IAM, MFA, producción, calendario u otras plataformas. El objetivo es reutilizar el flujo privado que ya existe, sin inventar vínculos ni debilitar seguridad.

Respaldo: backup/qa-integral-before-avatar-onboarding-20261119 @ 5f635f99770ccf3d54636440ff1ab055bc2a9a6a.
Publicar solo en qa/integral-claude-reviewed-20261111 (alias qa-integral-claude-reviewed.adphor-platform.pages.dev), después de JS/Python/build/E2E y verificar SHA/alias.

## Fix validated from E2E failure
The real browser run exposed an overlap: a main-content button intercepted pointer clicks on the profile photo dropdown. Give the authenticated QA topbar a stacking level higher than main; keep panel positioned relative to the avatar and preserve natural click semantics. The image upload, removal and other tests must pass WITHOUT force-clicking.
