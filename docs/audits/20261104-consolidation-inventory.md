# Inventario de consolidación ADPHOR — 4 noviembre 2026

Base inventariada: 5c718de473eac368c4f91f74e8c4abe03a10ea6a. Repositorio: riano200612-jpg/adphor-platform.

## Cloudflare

| Servicio | Tipo confirmado por GitHub | Función a conservar / pendiente | Acción realizada |
|---|---|---|---|
| adphor-platform | Pages | Proyecto principal elegido; conservar dominio y producción existentes. Crear únicamente preview protegida de la rama activa. | Ningún cambio remoto |
| adphor-porto-staging | Pages | El dominio raíz observado redirige a Access. Conservar políticas y revisar dominios/bindings antes de retirar automatización duplicada. | Ningún cambio remoto |
| adphor-porto-qa | Workers Builds | Revisar funciones, rutas, bindings y secretos. No clasificar como Pages ni eliminar por el nombre. | Ningún cambio remoto |

Los tres generaron builds para 5c718de y los tres fallaron. No hay acceso administrativo de Cloudflare ni token en el entorno. El navegador alternativo del bloque anterior recibió «Unable to sign in». No se abrió TinyFish ni se repitió ese inicio de sesión.

Access del preview exacto y los usuarios permitidos siguen sin verificar. HTTP 302 en el dominio raíz de staging no certifica las políticas de todos los previews. El HTTP 200 en la raíz de adphor-platform no demuestra por sí solo ausencia de Access en otros dominios.

## Ramas remotas

La columna «contenida» verifica únicamente ascendencia Git, no equivalencia funcional ni dependencias externas. Cero ramas borradas; ninguna se declaró prescindible solo por ser antigua.

| Rama | SHA | Contenida en la activa | Commits fuera de su historial |
|---|---|---|---:|
| `backup/prod-before-client-bridge-20261103` | `80104309ac51` | Sí | 0 |
| `backup/prod-before-commit-recovery-20261103` | `aa50dbada8b8` | Sí | 0 |
| `backup/prod-before-pqrs-foto-ux-20261103` | `fce189aa33a4` | Sí | 0 |
| `backup/prod-before-pqrs-saturday-recovery-20261103` | `548562ac2d2a` | Sí | 0 |
| `backup/prod-before-visible-sha-20261103` | `c8d38731db1e` | Sí | 0 |
| `backup/prod-legacy-ui-pre-unification-20261103` | `e3d0b25597b2` | No; revisar | 9 |
| `backup/qa-p1-integracion-verificada-20261103` | `c8d38731db1e` | Sí | 0 |
| `codex/comparativos-gerencia` | `3addf6dc459c` | Sí | 0 |
| `codex/enjambre-python` | `a17d296329b5` | Sí | 0 |
| `codex/flujo-mantenimiento` | `1cfc33bd76f3` | Sí | 0 |
| `codex/import-appsscript-client-qa` | `bc65875c76fd` | No; revisar | 8 |
| `codex/indicadores-bitacora` | `878fd6f0999a` | No; revisar | 1 |
| `codex/informes-mensuales` | `0d3165bc4dbb` | Sí | 0 |
| `codex/porto-calendario-gerencial-qa` | `89bd84305bec` | No; revisar | 25 |
| `feature/dl-evidencias-v1` | `08771162b1f5` | No; revisar | 7 |
| `feature/enjambre-modelos-v1` | `c38c9b11d68c` | No; revisar | 8 |
| `feature/miss-adphor-login-interactivo-20261103` | `0ee13dc059da` | No; revisar | 1 |
| `gh-pages` | `c06ecc21ce13` | No; revisar | 1 |
| `main` | `cd9748778daa` | Sí | 0 |
| `qa/auditor-corrective-20261104` | `e6965e083c8e` | Sí | 0 |
| `qa/catalog-mapping-gate-20261028` | `8674c827b208` | Sí | 0 |
| `qa/cliente-integracion-verificada-20261102` | `80e8a248f487` | Sí | 0 |
| `qa/cliente-preview-real-readonly-20261103` | `fb5799777ed9` | Sí | 0 |
| `qa/p1-integracion-modulos-gate-20261103` | `1cfc33bd76f3` | Sí | 0 |
| `qa/pqrs-carrusel-integracion-20261104` | `5c718de473ea` | Sí | 0 |
| `qa/premium-ux-20261030` | `9c22840d0b27` | Sí | 0 |
| `qa/staff-validation-20261031` | `a662321a1849` | No; revisar | 1 |
| `qa/unified-operations-20261029` | `16864f58c37c` | Sí | 0 |
| `respaldo/adphor-api-20261021` | `ad6e7a416031` | No; revisar | 3 |

Main tiene protected=true y el ruleset Active Main Protection está activo. No se cambió protección, default branch ni producción. La rama activa única para trabajo nuevo es qa/pqrs-carrusel-integracion-20261104. Las demás se conservan para revisión y respaldo; no se crearán nuevas ramas para esta consolidación.

## Cambios de este bloque

- .github/workflows/checks.yml: valida push a la rama activa además de mantener los disparadores preexistentes. Añade un único job QA que depende de los jobs JavaScript/E2E y Python. Está deshabilitado salvo habilitación explícita y constancia de Access verificado.
- qa/integration-target.json: registro único de repositorio, rama, proyecto Pages, cuenta, entorno QA y URL propuesta (no certificada).
- qa/deploy-preflight.mjs: antes de publicar comprueba destino exacto, rama/evento/repositorio/SHA, base aislada, credencial, configuración real de Pages y redirección anónima a Access. Rechaza que la rama de integración sea la rama productiva del proyecto.
- tests/deploy-preflight.test.js: pruebas nuevas y acotadas de rechazo de destinos y redirecciones inseguros. No son pruebas de autorización humana ni E2E de los módulos.

Mientras se preparaba este bloque, el auditor incorporó e20a13d, a6718a1 y a7ffef1: el guard de Vite reconoce la rama consolidada únicamente con ADPHOR_PROTECTED_STAGING_QA=true y ADPHOR_QA_ACCESS_VERIFIED=true. Se conservaron ambos archivos del auditor sin cambios. No se activaron flags, secretos, Environment ni publicación. La actualización incorpora ese historial antes del nuevo commit.

## Validación ejecutada

node --test tests/deploy-preflight.test.js tests/qa-deploy-block.test.js tests/qa-build-config.test.js: 8 aprobadas. npm run build: aprobado. Sin pruebas funcionales sintéticas repetidas, capturas adicionales ni nueva navegación. No hay SHA desplegado ni URL privada certificada.

## Trabajo administrativo pendiente antes de habilitar

1. Acceso de lectura/escritura al panel de Cloudflare para inventariar dominios, bindings, variables y controles de branch de los tres servicios.
2. Verificar Access en la URL exacta de qa/integration-target.json: política limitada a usuarios QA, sesión autorizada permitida y usuario ajeno rechazado. Proteger también las URLs hash alternativas.
3. Solo tras esa verificación, permitir exclusivamente la rama activa en el guard de Vite, manteniendo ADPHOR_PROTECTED_STAGING_QA=true.
4. Elegir un solo disparador: para el job preparado, desactivar los builds automáticos de preview de Pages en adphor-platform, sin tocar su producción. Revisar antes de pausar los disparadores de los otros servicios; no borrar proyectos.
5. Configurar Environment adphor-qa con revisores requeridos, token limitado de Pages, cuenta correcta y variables QA. ADPHOR_QA_DEPLOY_ENABLED y ADPHOR_QA_ACCESS_VERIFIED permanecen deshabilitadas hasta completar lo anterior.
6. La aprobación del Environment permite publicar el SHA ya validado. Confirmar URL hash, alias estable, navegación y protección reales. Los flags de medios/evidencias requieren además su certificación funcional independiente.

No se modificó el workflow productivo de GitHub Pages; su retirada requerirá revisión y autorización específica.
