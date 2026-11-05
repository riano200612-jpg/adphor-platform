# ADPHOR QA — publicación inicial para verificar Access

La rama autorizada es `qa/pqrs-carrusel-integracion-20261104` y el único
proyecto Pages es `adphor-platform`. No cambiar producción ni su rama.

## Modo de comprobación

Configurar **únicamente Preview**:

- `ADPHOR_PROTECTED_STAGING_QA=true`
- `ADPHOR_QA_ACCESS_BOOTSTRAP=true`
- `ADPHOR_QA_ACCESS_VERIFIED` ausente o `false`

El comando normal `npm run build -- --base=/` emite solamente `dist/index.html`,
con marcador `ADPHOR_QA_ACCESS_PROBE_V1`. No incluye `public/`, JavaScript,
demos, credenciales ni conexiones a Supabase. Un control sobre el bundle
rechaza cualquier salida adicional. El modo sólo acepta la rama autorizada.
La página no demuestra por sí sola que Access funciona.

## Verificación antes de habilitar la aplicación

1. Obtener de Cloudflare el URL del despliegue exitoso, su alias y SHA.
2. Solicitar ambos hostnames sin cookies y comprobar redirección HTTPS al
   dominio Cloudflare Access. El contenido del marcador no debe ser accesible.
3. Autenticarse con el usuario autorizado y comprobar que aparece el marcador.
4. Comprobar rechazo de una identidad no autorizada. Diferenciar el resultado
   del probador de políticas de una autenticación real: no son equivalentes.
5. Registrar fecha, URL, SHA y evidencia de cada resultado. No registrar tokens.
6. Sólo al superar estas verificaciones, retirar el modo bootstrap y habilitar
   `ADPHOR_QA_ACCESS_VERIFIED=true` en Preview. Revisar la URL/clave pública QA,
   MFA, permisos y datos antes de publicar la aplicación completa.

`ADPHOR_QA_ACCESS_VERIFIED` no es una prueba criptográfica: representa una
verificación humana respaldada por evidencia y se debe revocar si cambia el
hostname, la aplicación Access o su política.

## Línea base verificada el 5 de noviembre de 2026

- HEAD de partida: `b71a778b4fa51db08174f05df88111f48142c031`.
- CI 41913060137: JavaScript/build/Playwright y Python aprobados; trabajo
  `Deploy approved QA preview` **skipped**. CI exitoso no demuestra despliegue.
- Pages 99a9cacb-65ef-44e2-80b8-643375f38694: build fallido por
  `QA_DEPLOY_BLOCKED`. Se observó redirección a Access; no contenido funcional.
- Supabase QA `qfctnnnnltghepwujpdm`: 43 filas en `public.projects`; conteos
  exactos de perfiles, membresías, PQRS, fuentes y mapeos privados: cero.
- `auth.users`: cero. No existe todavía identidad QA que pueda iniciar sesión.
- `storage.objects`: cero. Buckets `evidence` y `qa-case-evidence`: privados.
- Migraciones hospedadas: baseline, PQRS base, lifecycle y evidencias privadas.
  No están presentes tablas de reuniones, directorio/fotos ni registro de agentes
  que otros módulos del frontend consultan. No dar esos módulos por integrados.
- Esquema `pilot_private` revisado; no hay datos ocultos de PQRS allí. Esto no
  establece que las fuentes externas u otros proyectos estén vacíos.
- Advisors informa tres funciones SECURITY DEFINER invocables por usuarios
  autenticados y dos tablas privadas con RLS sin políticas. Requiere revisión
  de autorización; no resolver desactivando RLS.

No se han creado identidades, copiado datos de producción ni inventado fuentes.
El aprovisionamiento de Auth y membresías debe usar identidad verificada y las
asignaciones autorizadas; no conceder acceso global automáticamente.
