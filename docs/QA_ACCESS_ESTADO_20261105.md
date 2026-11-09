# Estado verificable del QA — 5 de noviembre de 2026

## Despliegue de comprobación

- Proyecto: `adphor-platform`; rama `qa/pqrs-carrusel-integracion-20261104`.
- Commit de la página mínima: `c194ba8b717f386101bc48c2d2d7075f600ca7cc`.
- Deployment: `8f267129-b014-4103-8e65-ab847dc843ea`, estado `success`.
- Log final: `Success: Your site was deployed!`; salida `index.html` (0.58 kB).
- URL canónica: https://8f267129.adphor-platform.pages.dev/
- Alias real: https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev/

La URL larga con sufijo `-20261104` propuesta previamente no es el alias
asignado por Cloudflare. Se corrige `qa/integration-target.json` para apuntar
al alias observado. El mismo valor deberá estar configurado en la variable
`ADPHOR_QA_URL` de GitHub antes de habilitar el workflow de publicación.

## Evidencia de acceso

La sesión guardada por el propietario permitió abrir el alias y la URL canónica
y leer `ADPHOR_QA_ACCESS_PROBE_V1` en ambos. Verificación de navegador TinyFish:
`6508e735-1840-4773-98d9-25f5bd740b67`.

Se observó redirección de visitantes sin sesión a Cloudflare Access. La prueba
anterior con identidad inexistente devolvió `access.api.error.invalid_user_id`:
resultado **inconcluso**, no PASS de denegación a una identidad autenticada.
No habilitar la publicación completa hasta completar los requisitos de acceso.

## Pruebas técnicas del commit c194ba8

- 204 pruebas JavaScript: PASS.
- 133 pruebas Python: PASS.
- Build y aislamiento de entradas/public/assets: PASS.
- 30 comprobaciones SQL locales con claims sintéticos: PASS; no certifican JWT
  reales, RLS hospedado ni persistencia de un usuario final.
- Playwright en GitHub Actions 42039370312: PASS.
- Playwright local: BLOCKED por descarga de Chromium; no confundir con un
  fallo funcional de los 12 escenarios. CI sí instaló el navegador y pasó.
- Trabajo `Deploy approved QA preview`: SKIPPED. El despliegue mínimo se
  completó mediante el reintento de Pages; no prueba el despliegue tras CI.

## Integración y consolidación

Repositorio operativo: `riano200612-jpg/adphor-platform`. Se conserva
`adphor-jose-original-private` como respaldo original privado. No se eliminaron
repositorios, ramas ni proyectos. En este workspace sólo se encontró un proyecto
con package.json, `adphor-platform`; no se inspeccionó el Chromebook del usuario.

Existen checks de infraestructura duplicada (`adphor-porto-staging` y
`adphor-porto-qa`) que fallan y requieren inventario antes de desconectarlos.
La persistencia del filtro de ramas Preview no se ha certificado: las lecturas
posteriores al guardado fueron contradictorias. No repetir guardados a ciegas.
La rama productiva continúa `codex/flujo-mantenimiento`, sin cambios.

QA contiene 43 copropiedades y carece de usuarios Auth, perfiles, membresías,
PQRS y objetos Storage. También falta parte del esquema consultado por los
módulos del frontend. El proyecto original contiene inventarios en
`adphor_ingest` y `adphor_import_private` (755 filas de origen, 40 copropiedades,
16 tipos de reunión); no se copiaron ni modificaron datos de producción.

## Criterio de entrega

Página mínima protegida: publicada y acceso autorizado verificado.
Aplicación integral: **NO APTA TODAVÍA**. Carrusel, PQRS con evidencias,
reuniones, MFA en Supabase e integración de Google Calendar no tienen prueba
E2E hospedada. No se han enviado avisos, creado reservas ni simulado éxitos.
